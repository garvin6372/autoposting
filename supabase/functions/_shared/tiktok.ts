import { decrypt, encrypt, decryptPacked, packEncrypted } from './encryption.ts'
import { getSupabaseAdmin } from './supabaseAdmin.ts'
import { translatePlatformError } from './errors.ts'

export interface TikTokPublishParams {
  accountId: string
  title: string
  mediaStoragePath: string
  mimeType: string
  fileSizeBytes: number
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY'
  disableComment?: boolean
  disableDuet?: boolean
  disableStitch?: boolean
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getValidTikTokToken(accountId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data: tokenRecord, error } = await supabase
    .from('account_tokens')
    .select('*')
    .eq('account_id', accountId)
    .single()

  if (error || !tokenRecord) {
    throw new Error('No authentication tokens found for this TikTok account.')
  }

  const decryptedToken = await decrypt({
    encrypted: tokenRecord.encrypted_access_token,
    iv: tokenRecord.token_iv,
    tag: tokenRecord.token_tag,
  })

  // Check if token is expired or expiring in < 5 mins
  const isExpiringSoon =
    tokenRecord.expires_at &&
    new Date(tokenRecord.expires_at).getTime() - Date.now() < 5 * 60 * 1000

  if (isExpiringSoon && tokenRecord.encrypted_refresh_token) {
    const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')

    if (clientKey && clientSecret) {
      try {
        const decryptedRefresh = await decryptPacked(
          tokenRecord.encrypted_refresh_token,
          tokenRecord.token_iv,
          tokenRecord.token_tag
        )

        const refreshParams = new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: decryptedRefresh,
        })

        const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: refreshParams.toString(),
        })

        const data = await res.json()
        if (data.access_token) {
          const encryptedNewAccess = await encrypt(data.access_token)
          const encryptedNewRefresh = data.refresh_token ? await encrypt(data.refresh_token) : null
          const newExpiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString()

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
      } catch (refreshErr) {
        console.warn('Failed to refresh TikTok access token:', refreshErr)
      }
    }
  }

  return decryptedToken
}

export async function publishVideoToTikTok(
  params: TikTokPublishParams
): Promise<{ postId: string; liveUrl: string }> {
  const supabase = getSupabaseAdmin()
  const accessToken = await getValidTikTokToken(params.accountId)

  // 1. Fetch account username
  const { data: account, error: accError } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('id', params.accountId)
    .single()

  if (accError || !account) {
    throw new Error('TikTok account not found in database.')
  }

  const username = account.username?.replace('@', '') || 'user'

  // 2. Fetch video binary from storage
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from('media')
    .download(params.mediaStoragePath)

  if (downloadError || !fileBlob) {
    throw new Error(`Failed to download video from storage: ${downloadError?.message}`)
  }

  const videoBuffer = await fileBlob.arrayBuffer()
  const videoBytes = new Uint8Array(videoBuffer)
  const videoSize = videoBytes.byteLength

  // 3. Initialize Direct Post Video Upload
  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      post_info: {
        title: (params.title || 'New video').slice(0, 2200),
        privacy_level: params.privacyLevel || 'SELF_ONLY',
        disable_comment: params.disableComment || false,
        disable_duet: params.disableDuet || false,
        disable_stitch: params.disableStitch || false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: videoSize,
        total_chunk_count: 1,
      },
    }),
  })

  const initData = await initRes.json()
  if (initData.error?.code && initData.error?.code !== 'ok') {
    const errorMsg = initData.error?.message || JSON.stringify(initData.error)
    const tr = translatePlatformError('tiktok', errorMsg)
    throw new Error(`${tr.plainMessage} (${errorMsg})`)
  }

  const publishId = initData.data?.publish_id
  const uploadUrl = initData.data?.upload_url

  if (!uploadUrl || !publishId) {
    throw new Error(`TikTok initialization did not return upload URL: ${JSON.stringify(initData)}`)
  }

  // 4. Stream video bytes to TikTok upload URL
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.mimeType || 'video/mp4',
      'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      'Content-Length': String(videoSize),
    },
    body: videoBytes,
  })

  if (!uploadRes.ok && uploadRes.status !== 206) {
    const errText = await uploadRes.text().catch(() => '')
    throw new Error(`Failed to stream video to TikTok (${uploadRes.status}): ${errText}`)
  }

  // 5. Poll publishing status (max 30 attempts, 3s sleep = 90s)
  for (let attempt = 1; attempt <= 30; attempt++) {
    await sleep(3000)

    const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ publish_id: publishId }),
    })

    const statusData = await statusRes.json()
    const status = statusData.data?.status

    if (status === 'SUCCESS') {
      const liveUrl = `https://www.tiktok.com/@${username}/video/${publishId}`
      return { postId: publishId, liveUrl }
    }

    if (status === 'FAILED') {
      const failReason = statusData.data?.fail_reason || 'Unknown error'
      throw new Error(`TikTok video publishing failed: ${failReason}`)
    }
  }

  // If status is still processing after 90 seconds, return publishId and app link
  return {
    postId: publishId,
    liveUrl: `https://www.tiktok.com/@${username}`,
  }
}
