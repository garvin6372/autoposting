import { decrypt, encrypt } from './encryption.ts'
import { getSupabaseAdmin } from './supabaseAdmin.ts'
import { translatePlatformError } from './errors.ts'

export interface MetaPublishParams {
  accountId: string
  message: string
  mediaStoragePath?: string
  mimeType?: string
  isReelOrVideo?: boolean
}

export async function getValidMetaToken(accountId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  const { data: tokenRecord, error } = await supabase
    .from('account_tokens')
    .select('*')
    .eq('account_id', accountId)
    .single()

  if (error || !tokenRecord) {
    throw new Error('No authentication tokens found for this Meta account.')
  }

  const decryptedToken = await decrypt({
    encrypted: tokenRecord.encrypted_access_token,
    iv: tokenRecord.token_iv,
    tag: tokenRecord.token_tag,
  })

  return decryptedToken
}

// Publish post to Facebook Page
export async function publishToFacebookPage(params: MetaPublishParams): Promise<{ postId: string; liveUrl: string }> {
  const supabase = getSupabaseAdmin()
  const pageAccessToken = await getValidMetaToken(params.accountId)

  // 1. Fetch account details to get Facebook Page ID
  const { data: account, error: accError } = await supabase
    .from('social_accounts')
    .select('platform_account_id')
    .eq('id', params.accountId)
    .single()

  if (accError || !account) {
    throw new Error('Facebook Page account not found in database.')
  }

  const pageId = account.platform_account_id

  // 2. Determine post type: Text only, Photo, or Video
  if (params.mediaStoragePath) {
    // Generate temporary 1-hour signed URL for Meta servers to download media
    const { data: signedData, error: signedError } = await supabase.storage
      .from('media')
      .createSignedUrl(params.mediaStoragePath, 3600)

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to access media file from storage: ${signedError?.message}`)
    }

    const isVideo = params.mimeType?.startsWith('video/') || params.isReelOrVideo

    if (isVideo) {
      // Video upload to Facebook Page
      const res = await fetch(
        `https://graph.facebook.com/v23.0/${pageId}/videos?access_token=${encodeURIComponent(pageAccessToken)}&fields=id,permalink_url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_url: signedData.signedUrl,
            description: params.message,
          }),
        }
      )

      const json = await res.json()
      if (json.error) {
        console.error('Facebook video publish error:', json.error)
        const tr = translatePlatformError('facebook', json.error.message)
        throw new Error(`${tr.plainMessage} (${json.error.message || 'code ' + json.error.code})`)
      }

      const videoId = json.id
      return {
        postId: videoId,
        liveUrl: json.permalink_url || `https://www.facebook.com/${videoId}`,
      }
    } else {
      // Photo upload to Facebook Page
      const res = await fetch(
        `https://graph.facebook.com/v23.0/${pageId}/photos?access_token=${encodeURIComponent(pageAccessToken)}&fields=id,permalink_url`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: signedData.signedUrl,
            message: params.message,
          }),
        }
      )

      const json = await res.json()
      if (json.error) {
        console.error('Facebook photo publish error:', json.error)
        const tr = translatePlatformError('facebook', json.error.message)
        throw new Error(`${tr.plainMessage} (${json.error.message || 'code ' + json.error.code})`)
      }

      const photoId = json.id
      return {
        postId: photoId,
        liveUrl: json.permalink_url || `https://www.facebook.com/${photoId}`,
      }
    }
  } else {
    // Text-only feed post
    const res = await fetch(
      `https://graph.facebook.com/v23.0/${pageId}/feed?access_token=${encodeURIComponent(pageAccessToken)}&fields=id,permalink_url`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: params.message,
        }),
      }
    )

    const json = await res.json()
    if (json.error) {
      console.error('Facebook feed publish error:', json.error)
      const tr = translatePlatformError('facebook', json.error.message)
      throw new Error(`${tr.plainMessage} (${json.error.message || 'code ' + json.error.code})`)
    }

    const postId = json.id
    return {
      postId,
      liveUrl: json.permalink_url || `https://www.facebook.com/${postId}`,
    }
  }
}
