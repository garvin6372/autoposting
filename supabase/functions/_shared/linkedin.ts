import { decrypt, encrypt, decryptPacked, packEncrypted } from './encryption.ts'
import { getSupabaseAdmin } from './supabaseAdmin.ts'
import { translatePlatformError } from './errors.ts'

export interface LinkedInPublishParams {
  accountId: string
  message: string
  mediaStoragePath?: string
  mimeType?: string
  fileSizeBytes?: number
}

const LINKEDIN_API_VERSION = '202601'

export async function getValidLinkedInToken(accountId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data: tokenRecord, error } = await supabase
    .from('account_tokens')
    .select('*')
    .eq('account_id', accountId)
    .single()

  if (error || !tokenRecord) {
    throw new Error('No authentication tokens found for this LinkedIn account.')
  }

  const decryptedToken = await decrypt({
    encrypted: tokenRecord.encrypted_access_token,
    iv: tokenRecord.token_iv,
    tag: tokenRecord.token_tag,
  })

  // Check if expiring soon (< 5 minutes)
  const isExpiringSoon =
    tokenRecord.expires_at &&
    new Date(tokenRecord.expires_at).getTime() - Date.now() < 5 * 60 * 1000

  if (isExpiringSoon && tokenRecord.encrypted_refresh_token) {
    const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')
    const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')

    if (clientId && clientSecret) {
      try {
        const decryptedRefresh = await decryptPacked(
          tokenRecord.encrypted_refresh_token,
          tokenRecord.token_iv,
          tokenRecord.token_tag
        )

        const refreshParams = new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: decryptedRefresh,
          client_id: clientId,
          client_secret: clientSecret,
        })

        const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: refreshParams.toString(),
        })

        const data = await res.json()
        if (data.access_token) {
          const encryptedNewAccess = await encrypt(data.access_token)
          const encryptedNewRefresh = data.refresh_token ? await encrypt(data.refresh_token) : null
          const newExpiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()

          await supabase
            .from('account_tokens')
            .update({
              encrypted_access_token: encryptedNewAccess.encrypted,
              encrypted_refresh_token: encryptedNewRefresh ? encryptedNewRefresh.encrypted : tokenRecord.encrypted_refresh_token,
              token_iv: encryptedNewAccess.iv,
              token_tag: encryptedNewAccess.tag,
              expires_at: newExpiresAt,
              updated_at: new Date().toISOString(),
            })
            .eq('account_id', accountId)

          return data.access_token
        }
      } catch (err) {
        console.warn('Failed to refresh LinkedIn token:', err)
      }
    }
  }

  return decryptedToken
}

export async function publishToLinkedIn(
  params: LinkedInPublishParams
): Promise<{ postId: string; liveUrl: string }> {
  const supabase = getSupabaseAdmin()
  const accessToken = await getValidLinkedInToken(params.accountId)

  // 1. Fetch account details to get Author URN
  const { data: account, error: accError } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('id', params.accountId)
    .single()

  if (accError || !account) {
    throw new Error('LinkedIn account not found in database.')
  }

  let authorUrn = account.platform_account_id
  if (!authorUrn.startsWith('urn:li:')) {
    authorUrn = `urn:li:person:${authorUrn}`
  }

  let postContent: Record<string, any> = {}

  // 2. Handle Media Upload if present
  if (params.mediaStoragePath) {
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('media')
      .download(params.mediaStoragePath)

    if (downloadError || !fileBlob) {
      throw new Error(`Failed to download media file for LinkedIn: ${downloadError?.message}`)
    }

    const fileBuffer = await fileBlob.arrayBuffer()
    const fileBytes = new Uint8Array(fileBuffer)
    const isVideo = params.mimeType?.startsWith('video/')

    const endpoint = isVideo ? 'videos' : 'images'

    // Initialize media upload
    const initRes = await fetch(`https://api.linkedin.com/rest/${endpoint}?action=initializeUpload`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
        'LinkedIn-Version': LINKEDIN_API_VERSION,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
          ...(isVideo
            ? {
                fileSizeBytes: fileBytes.byteLength,
                uploadCaptions: false,
                uploadThumbnail: false,
              }
            : {}),
        },
      }),
    })

    const initData = await initRes.json()
    if (initData.status && initData.status >= 400) {
      throw new Error(`LinkedIn upload initialization failed: ${JSON.stringify(initData)}`)
    }

    const uploadUrl = initData.value?.uploadInstructions?.[0]?.uploadUrl || initData.value?.uploadUrl
    const mediaUrn = initData.value?.video || initData.value?.image

    if (!uploadUrl || !mediaUrn) {
      throw new Error(`LinkedIn did not return an upload URL or media URN: ${JSON.stringify(initData)}`)
    }

    // Stream binary bytes to LinkedIn upload URL
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': params.mimeType || 'application/octet-stream',
      },
      body: fileBytes,
    })

    if (!uploadRes.ok && uploadRes.status !== 201) {
      const errText = await uploadRes.text().catch(() => '')
      throw new Error(`Failed to upload media to LinkedIn (${uploadRes.status}): ${errText}`)
    }

    postContent = {
      content: {
        media: {
          id: mediaUrn,
        },
      },
    }
  }

  // 3. Create the LinkedIn Post
  const postPayload = {
    author: authorUrn,
    commentary: params.message || '',
    visibility: 'PUBLIC',
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    ...postContent,
    lifecycleState: 'PUBLISHED',
    isReshareDisabledByAuthor: false,
  }

  const postRes = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      'LinkedIn-Version': LINKEDIN_API_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(postPayload),
  })

  if (!postRes.ok && postRes.status !== 201) {
    const errorText = await postRes.text().catch(() => '{}')
    const tr = translatePlatformError('linkedin', errorText)
    throw new Error(`${tr.plainMessage} (${errorText})`)
  }

  const postUrn = postRes.headers.get('x-restli-id') || 'post_' + Date.now()
  const liveUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postUrn)}/`

  return {
    postId: postUrn,
    liveUrl,
  }
}
