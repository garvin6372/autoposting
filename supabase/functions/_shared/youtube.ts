import { decrypt, encrypt, decryptPacked, packEncrypted } from './encryption.ts'
import { getSupabaseAdmin } from './supabaseAdmin.ts'
import { translatePlatformError } from './errors.ts'

export interface YouTubePublishParams {
  accountId: string
  title: string
  description: string
  privacyStatus?: 'private' | 'unlisted' | 'public'
  mediaStoragePath: string
  mimeType: string
  fileSizeBytes: number
}

export async function getValidYouTubeAccessToken(accountId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  // 1. Fetch encrypted tokens
  const { data: tokenRecord, error } = await supabase
    .from('account_tokens')
    .select('*')
    .eq('account_id', accountId)
    .single()

  if (error || !tokenRecord) {
    throw new Error('No authentication tokens found for this YouTube channel.')
  }

  const decryptedAccess = await decrypt({
    encrypted: tokenRecord.encrypted_access_token,
    iv: tokenRecord.token_iv,
    tag: tokenRecord.token_tag,
  })

  // Check if token has expired or will expire in next 2 minutes
  const isExpired = tokenRecord.expires_at
    ? new Date(tokenRecord.expires_at).getTime() - Date.now() < 120000
    : false

  if (!isExpired) {
    return decryptedAccess
  }

  // 2. Token expired, perform refresh
  if (!tokenRecord.encrypted_refresh_token) {
    throw new Error('YouTube access token expired and no refresh token is stored. Please reconnect.')
  }

  const decryptedRefresh = await decryptPacked(
    tokenRecord.encrypted_refresh_token,
    tokenRecord.token_iv,
    tokenRecord.token_tag
  )

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

  const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId || '',
      client_secret: clientSecret || '',
      refresh_token: decryptedRefresh,
      grant_type: 'refresh_token',
    }),
  })

  const refreshData = await refreshRes.json()
  if (refreshData.error) {
    throw new Error(`Google token refresh failed: ${refreshData.error_description || refreshData.error}`)
  }

  const newAccessToken = refreshData.access_token
  const expiresInSeconds = refreshData.expires_in || 3600
  const newExpiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

  // Save re-encrypted access token
  const reEncryptedAccess = await encrypt(newAccessToken)
  await supabase
    .from('account_tokens')
    .update({
      encrypted_access_token: reEncryptedAccess.encrypted,
      token_iv: reEncryptedAccess.iv,
      token_tag: reEncryptedAccess.tag,
      expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)

  return newAccessToken
}

export async function publishVideoToYouTube(params: YouTubePublishParams): Promise<{ videoId: string; liveUrl: string }> {
  const supabase = getSupabaseAdmin()
  const accessToken = await getValidYouTubeAccessToken(params.accountId)

  // 1. Get a temporary download URL for the video in Supabase Storage
  const { data: signedData, error: signedError } = await supabase.storage
    .from('media')
    .createSignedUrl(params.mediaStoragePath, 3600)

  if (signedError || !signedData?.signedUrl) {
    throw new Error(`Could not access video file from media storage: ${signedError?.message}`)
  }

  // 2. Initiate Resumable Upload Session with YouTube Data API v3
  const metadata = {
    snippet: {
      title: params.title || 'Untitled Video',
      description: params.description || '',
      tags: ['SocialHub', 'Video'],
      categoryId: '22', // People & Blogs
    },
    status: {
      // YouTube enforces "private" for apps in testing mode prior to quota audit
      privacyStatus: params.privacyStatus || 'private',
      selfDeclaredMadeForKids: false,
    },
  }

  const initRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': params.mimeType || 'video/mp4',
        'X-Upload-Content-Length': params.fileSizeBytes.toString(),
      },
      body: JSON.stringify(metadata),
    }
  )

  if (!initRes.ok) {
    const errBody = await initRes.text()
    const translated = translatePlatformError('youtube', errBody)
    throw new Error(translated.plainMessage + ' ' + translated.actionableStep)
  }

  const uploadUrl = initRes.headers.get('Location')
  if (!uploadUrl) {
    throw new Error('YouTube did not return a valid resumable upload location URL.')
  }

  // 3. Stream the video file from Supabase Storage straight to YouTube
  const videoStreamRes = await fetch(signedData.signedUrl)
  if (!videoStreamRes.ok || !videoStreamRes.body) {
    throw new Error('Failed to stream video bytes from cloud storage.')
  }

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': params.mimeType || 'video/mp4',
      'Content-Length': params.fileSizeBytes.toString(),
    },
    body: videoStreamRes.body,
    // @ts-ignore Deno support for duplex streaming
    duplex: 'half',
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    const translated = translatePlatformError('youtube', errText)
    throw new Error(translated.plainMessage + ' ' + translated.actionableStep)
  }

  const uploadResult = await uploadRes.json()
  const videoId = uploadResult.id
  const liveUrl = `https://www.youtube.com/watch?v=${videoId}`

  return { videoId, liveUrl }
}
