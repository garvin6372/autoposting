import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { publishVideoToYouTube } from '../_shared/youtube.ts'
import { publishToFacebookPage } from '../_shared/meta.ts'
import { publishToInstagram } from '../_shared/instagram.ts'
import { publishVideoToTikTok } from '../_shared/tiktok.ts'
import { publishToLinkedIn } from '../_shared/linkedin.ts'
import { translatePlatformError } from '../_shared/errors.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()

  try {
    const { targetId, pretendFail } = await req.json()
    if (!targetId) {
      return new Response(JSON.stringify({ error: 'targetId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Mark target as publishing
    await supabase
      .from('post_targets')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', targetId)

    // 2. Fetch target, post, and account details
    const { data: target, error: targetError } = await supabase
      .from('post_targets')
      .select('*, social_accounts(*), posts(*)')
      .eq('id', targetId)
      .single()

    if (targetError || !target) {
      throw new Error(`Target not found: ${targetError?.message}`)
    }

    const platform = target.social_accounts?.platform
    const isMockChannel = target.social_accounts?.platform_account_id?.startsWith('test_channel')

    // 3. Handle Rehearsal / Mock Channel
    if (isMockChannel || pretendFail || target.custom_content?.includes('[fail]') || target.posts?.content?.includes('#fail_test')) {
      if (pretendFail || target.custom_content?.includes('[fail]') || target.posts?.content?.includes('#fail_test')) {
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: 'Simulated rehearsal failure: Channel rate limit triggered (Testing Error Diagnostics).',
            raw_error: 'TEST_CHANNEL_SIMULATED_EXCEPTION: HTTP 429 Too Many Requests',
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } else {
        const liveUrl = `https://socialhub.internal/posts/live/${target.id.slice(0, 8)}`
        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else if (platform === 'youtube') {
      // 4. Live YouTube Publishing
      try {
        // Fetch attached video
        const { data: postMediaRows } = await supabase
          .from('post_media')
          .select('*, media(*)')
          .eq('post_id', target.post_id)
          .order('position', { ascending: true })

        const videoItem = postMediaRows?.find((pm) => pm.media?.mime_type?.startsWith('video/'))?.media

        if (!videoItem) {
          throw new Error('YouTube requires a video attachment. No video was found attached to this post.')
        }

        const ytOptions = target.platform_options?.youtube || {}
        const title = ytOptions.title || target.posts?.content?.slice(0, 70) || 'New YouTube Upload'
        const description = target.custom_content || target.posts?.content || ''

        const publishResult = await publishVideoToYouTube({
          accountId: target.account_id,
          title,
          description,
          privacyStatus: ytOptions.privacy || 'private',
          mediaStoragePath: videoItem.storage_path,
          mimeType: videoItem.mime_type,
          fileSizeBytes: videoItem.file_size_bytes,
        })

        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: publishResult.liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch (ytErr: any) {
        const translated = translatePlatformError('youtube', ytErr.message)
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: translated.plainMessage + ' ' + translated.actionableStep,
            raw_error: ytErr.message,
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else if (platform === 'facebook') {
      // 5. Live Facebook Page Publishing
      try {
        const { data: postMediaRows } = await supabase
          .from('post_media')
          .select('*, media(*)')
          .eq('post_id', target.post_id)
          .order('position', { ascending: true })

        const firstMedia = postMediaRows?.[0]?.media
        const message = target.custom_content || target.posts?.content || ''

        const publishResult = await publishToFacebookPage({
          accountId: target.account_id,
          message,
          mediaStoragePath: firstMedia?.storage_path,
          mimeType: firstMedia?.mime_type,
        })

        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: publishResult.liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch (fbErr: any) {
        console.error('Facebook publish error:', fbErr)
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: fbErr.message,
            raw_error: fbErr.message,
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else if (platform === 'instagram') {
      // 6. Live Instagram Publishing (Photos, Reels, Carousels)
      try {
        const { data: postMediaRows } = await supabase
          .from('post_media')
          .select('*, media(*)')
          .eq('post_id', target.post_id)
          .order('position', { ascending: true })

        const mediaItems = (postMediaRows || [])
          .filter((pm: any) => pm.media?.storage_path)
          .map((pm: any) => ({
            storagePath: pm.media.storage_path,
            mimeType: pm.media.mime_type,
          }))

        const caption = target.custom_content || target.posts?.content || ''

        const publishResult = await publishToInstagram({
          accountId: target.account_id,
          caption,
          mediaItems,
        })

        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: publishResult.liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch (igErr: any) {
        console.error('Instagram publish error:', igErr)
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: igErr.message,
            raw_error: igErr.message,
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else if (platform === 'tiktok') {
      // 7. Live TikTok Direct Post Publishing
      try {
        const { data: postMediaRows } = await supabase
          .from('post_media')
          .select('*, media(*)')
          .eq('post_id', target.post_id)
          .order('position', { ascending: true })

        const videoItem = postMediaRows?.find((pm: any) => pm.media?.mime_type?.startsWith('video/'))?.media

        if (!videoItem) {
          throw new Error('TikTok requires a video attachment. No video was found attached to this post.')
        }

        const tiktokOptions = target.platform_options?.tiktok || {}
        const caption = target.custom_content || target.posts?.content || ''

        const publishResult = await publishVideoToTikTok({
          accountId: target.account_id,
          title: caption,
          mediaStoragePath: videoItem.storage_path,
          mimeType: videoItem.mime_type,
          fileSizeBytes: videoItem.file_size_bytes,
          privacyLevel: tiktokOptions.privacy || 'SELF_ONLY',
          disableComment: tiktokOptions.disable_comment || false,
          disableDuet: tiktokOptions.disable_duet || false,
          disableStitch: tiktokOptions.disable_stitch || false,
        })

        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: publishResult.liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch (ttErr: any) {
        console.error('TikTok publish error:', ttErr)
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: ttErr.message,
            raw_error: ttErr.message,
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else if (platform === 'linkedin') {
      // 8. Live LinkedIn Publishing (Text & Media Posts)
      try {
        const { data: postMediaRows } = await supabase
          .from('post_media')
          .select('*, media(*)')
          .eq('post_id', target.post_id)
          .order('position', { ascending: true })

        const firstMedia = postMediaRows?.[0]?.media
        const message = target.custom_content || target.posts?.content || ''

        const publishResult = await publishToLinkedIn({
          accountId: target.account_id,
          message,
          mediaStoragePath: firstMedia?.storage_path,
          mimeType: firstMedia?.mime_type,
          fileSizeBytes: firstMedia?.file_size_bytes,
        })

        await supabase
          .from('post_targets')
          .update({
            status: 'published',
            live_url: publishResult.liveUrl,
            published_at: new Date().toISOString(),
            plain_error: null,
            raw_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      } catch (liErr: any) {
        console.error('LinkedIn publish error:', liErr)
        await supabase
          .from('post_targets')
          .update({
            status: 'failed',
            plain_error: liErr.message,
            raw_error: liErr.message,
            retry_count: (target.retry_count || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', targetId)
      }
    } else {
      // Default placeholder until subsequent tasks
      const liveUrl = `https://socialhub.internal/posts/live/${target.id.slice(0, 8)}`
      await supabase
        .from('post_targets')
        .update({
          status: 'published',
          live_url: liveUrl,
          published_at: new Date().toISOString(),
          plain_error: null,
          raw_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetId)
    }

    // 5. Update parent post status based on all targets
    const { data: allTargets } = await supabase
      .from('post_targets')
      .select('status')
      .eq('post_id', target.post_id)

    if (allTargets && allTargets.length > 0) {
      const allDone = allTargets.every((t) => t.status === 'published')
      const allFailed = allTargets.every((t) => t.status === 'failed')
      const anyFailed = allTargets.some((t) => t.status === 'failed')

      let newPostStatus = 'publishing'
      if (allDone) newPostStatus = 'published'
      else if (allFailed) newPostStatus = 'failed'
      else if (anyFailed) newPostStatus = 'partly_failed'

      await supabase
        .from('posts')
        .update({
          status: newPostStatus,
          published_at: allDone ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.post_id)
    }

    return new Response(JSON.stringify({ success: true, targetId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
