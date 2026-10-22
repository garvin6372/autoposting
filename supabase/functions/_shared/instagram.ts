import { getValidMetaToken } from './meta.ts'
import { getSupabaseAdmin } from './supabaseAdmin.ts'
import { translatePlatformError } from './errors.ts'

export interface InstagramMediaItem {
  storagePath: string
  mimeType: string
  isReelOrVideo?: boolean
}

export interface InstagramPublishParams {
  accountId: string
  caption: string
  mediaItems: InstagramMediaItem[]
}

const META_API_VERSION = 'v23.0'

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 30
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${containerId}?fields=status_code&access_token=${encodeURIComponent(
        accessToken
      )}`
    )
    const data = await res.json()

    if (data.error) {
      throw new Error(`Instagram container check failed: ${data.error.message}`)
    }

    const status = data.status_code
    if (status === 'FINISHED') {
      return
    }

    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram video processing failed with status: ${status}`)
    }

    // Wait 3 seconds before next poll
    await sleep(3000)
  }

  throw new Error('Instagram video processing timed out after 90 seconds.')
}

export async function publishToInstagram(
  params: InstagramPublishParams
): Promise<{ postId: string; liveUrl: string }> {
  const supabase = getSupabaseAdmin()
  const accessToken = await getValidMetaToken(params.accountId)

  // 1. Fetch Instagram Account
  const { data: account, error: accErr } = await supabase
    .from('social_accounts')
    .select('platform_account_id')
    .eq('id', params.accountId)
    .single()

  if (accErr || !account) {
    throw new Error('Instagram account not found in database.')
  }

  const igUserId = account.platform_account_id

  if (!params.mediaItems || params.mediaItems.length === 0) {
    throw new Error(
      'Instagram requires at least one photo or video attachment. Text-only posts are not supported on Instagram.'
    )
  }

  // Generate 1-hour signed URLs for each media item
  const mediaUrls: Array<{ signedUrl: string; isVideo: boolean }> = []
  for (const item of params.mediaItems) {
    const { data: signedData, error: signedError } = await supabase.storage
      .from('media')
      .createSignedUrl(item.storagePath, 3600)

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to access media file from storage: ${signedError?.message}`)
    }

    const isVideo = item.mimeType?.startsWith('video/') || item.isReelOrVideo || false
    mediaUrls.push({ signedUrl: signedData.signedUrl, isVideo })
  }

  let finalContainerId = ''

  // CASE 1: Single Media Post
  if (mediaUrls.length === 1) {
    const item = mediaUrls[0]

    const bodyPayload: Record<string, any> = {
      caption: params.caption,
    }

    if (item.isVideo) {
      bodyPayload.media_type = 'REELS'
      bodyPayload.video_url = item.signedUrl
    } else {
      bodyPayload.image_url = item.signedUrl
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${igUserId}/media?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      }
    )

    const containerData = await containerRes.json()
    if (containerData.error) {
      const tr = translatePlatformError('instagram', containerData.error.message)
      throw new Error(`${tr.plainMessage} (${containerData.error.message})`)
    }

    finalContainerId = containerData.id

    // Wait for video processing if video
    if (item.isVideo) {
      await waitForContainer(finalContainerId, accessToken)
    }
  }
  // CASE 2: Carousel Post (2 to 10 items)
  else {
    const itemsToProcess = mediaUrls.slice(0, 10)
    const childIds: string[] = []

    for (const item of itemsToProcess) {
      const childPayload: Record<string, any> = {
        is_carousel_item: true,
      }

      if (item.isVideo) {
        childPayload.media_type = 'VIDEO'
        childPayload.video_url = item.signedUrl
      } else {
        childPayload.image_url = item.signedUrl
      }

      const childRes = await fetch(
        `https://graph.facebook.com/${META_API_VERSION}/${igUserId}/media?access_token=${encodeURIComponent(
          accessToken
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(childPayload),
        }
      )

      const childData = await childRes.json()
      if (childData.error) {
        const tr = translatePlatformError('instagram', childData.error.message)
        throw new Error(`${tr.plainMessage} (${childData.error.message})`)
      }

      const childId = childData.id
      if (item.isVideo) {
        await waitForContainer(childId, accessToken)
      }
      childIds.push(childId)
    }

    // Create Carousel parent container
    const carouselRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${igUserId}/media?access_token=${encodeURIComponent(
        accessToken
      )}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          media_type: 'CAROUSEL',
          children: childIds,
          caption: params.caption,
        }),
      }
    )

    const carouselData = await carouselRes.json()
    if (carouselData.error) {
      const tr = translatePlatformError('instagram', carouselData.error.message)
      throw new Error(`${tr.plainMessage} (${carouselData.error.message})`)
    }

    finalContainerId = carouselData.id
  }

  // 3. Publish the container
  const publishRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${igUserId}/media_publish?creation_id=${encodeURIComponent(
      finalContainerId
    )}&access_token=${encodeURIComponent(accessToken)}`,
    { method: 'POST' }
  )

  const publishData = await publishRes.json()
  if (publishData.error) {
    const tr = translatePlatformError('instagram', publishData.error.message)
    throw new Error(`${tr.plainMessage} (${publishData.error.message})`)
  }

  const postId = publishData.id

  // 4. Retrieve live permalink
  let liveUrl = `https://www.instagram.com/p/${postId}`
  try {
    const permalinkRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${postId}?fields=permalink&access_token=${encodeURIComponent(
        accessToken
      )}`
    )
    const permalinkData = await permalinkRes.json()
    if (permalinkData.permalink) {
      liveUrl = permalinkData.permalink
    }
  } catch {
    // Keep fallback permalink
  }

  return { postId, liveUrl }
}
