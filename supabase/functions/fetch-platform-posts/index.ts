import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { getValidYouTubeAccessToken } from '../_shared/youtube.ts'
import { getValidMetaToken } from '../_shared/meta.ts'
import { getValidTikTokToken } from '../_shared/tiktok.ts'
import { getValidLinkedInToken } from '../_shared/linkedin.ts'

export interface PlatformPostItem {
  id: string
  accountId: string
  accountName: string
  platform: 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'linkedin'
  title: string
  caption?: string
  thumbnailUrl: string
  liveUrl: string
  publishedAt: string
  views: number
  likes: number
  comments: number
  shares: number
  mediaType?: 'video' | 'image' | 'carousel' | 'text'
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()

  try {
    let targetPlatform: string | null = null
    try {
      const body = await req.json()
      targetPlatform = body?.platform || null
    } catch (_) {}

    // Fetch all connected accounts
    let query = supabase
      .from('social_accounts')
      .select('id, platform, platform_account_id, account_name, username, profile_picture_url, status')
      .eq('status', 'connected')

    if (targetPlatform && targetPlatform !== 'all') {
      query = query.eq('platform', targetPlatform)
    }

    const { data: accounts, error: accErr } = await query
    if (accErr) throw accErr

    const allPosts: PlatformPostItem[] = []
    const warnings: Array<{ account: string; platform: string; message: string }> = []

    for (const acc of accounts || []) {
      const platform = acc.platform

      try {
        // ====================================================================
        // 1. YOUTUBE LIVE POSTS & VIDEO ANALYTICS
        // ====================================================================
        if (platform === 'youtube') {
          try {
            const accessToken = await getValidYouTubeAccessToken(acc.id)

            // Step 1: Get Uploads Playlist ID
            const channelRes = await fetch(
              'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            const channelData = await channelRes.json()
            const uploadsPlaylistId =
              channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads

            if (uploadsPlaylistId) {
              // Step 2: Get Recent Playlist Items (up to 20 videos)
              const playlistRes = await fetch(
                `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
              )
              const playlistData = await playlistRes.json()
              const videoIds = (playlistData.items || [])
                .map((it: any) => it.contentDetails?.videoId)
                .filter(Boolean)

              if (videoIds.length > 0) {
                // Step 3: Get Video Statistics & Snippets
                const videosRes = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoIds.join(',')}`,
                  { headers: { Authorization: `Bearer ${accessToken}` } }
                )
                const videosData = await videosRes.json()

                for (const v of videosData.items || []) {
                  const snip = v.snippet
                  const stats = v.statistics
                  const thumb =
                    snip?.thumbnails?.maxres?.url ||
                    snip?.thumbnails?.standard?.url ||
                    snip?.thumbnails?.high?.url ||
                    snip?.thumbnails?.medium?.url ||
                    snip?.thumbnails?.default?.url ||
                    ''

                  allPosts.push({
                    id: v.id,
                    accountId: acc.id,
                    accountName: acc.account_name,
                    platform: 'youtube',
                    title: snip?.title || 'YouTube Video',
                    caption: snip?.description || '',
                    thumbnailUrl: thumb,
                    liveUrl: `https://www.youtube.com/watch?v=${v.id}`,
                    publishedAt: snip?.publishedAt || new Date().toISOString(),
                    views: parseInt(stats?.viewCount || '0', 10),
                    likes: parseInt(stats?.likeCount || '0', 10),
                    comments: parseInt(stats?.commentCount || '0', 10),
                    shares: 0,
                    mediaType: 'video',
                  })
                }
              }
            }
          } catch (ytErr: any) {
            console.warn(`YouTube token error for ${acc.account_name}:`, ytErr.message)
            // Flag account in social_accounts so UI knows it needs reconnection
            await supabase
              .from('social_accounts')
              .update({
                status: 'needs_reconnect',
                last_error: 'Google authorization expired. Please reconnect in Accounts.',
                updated_at: new Date().toISOString(),
              })
              .eq('id', acc.id)

            warnings.push({
              account: acc.account_name,
              platform: 'youtube',
              message: 'Google authorization expired. Please reconnect this YouTube channel in Accounts.',
            })
          }
        }

        // ====================================================================
        // 2. FACEBOOK PAGE POSTS & ENGAGEMENTS
        // ====================================================================
        else if (platform === 'facebook') {
          const pageToken = await getValidMetaToken(acc.id)
          const pageId = acc.platform_account_id

          const fbRes = await fetch(
            `https://graph.facebook.com/v23.0/${pageId}/published_posts?fields=id,message,created_time,permalink_url,attachments{media,type,url},shares,reactions.summary(total_count),comments.summary(total_count)&limit=20&access_token=${encodeURIComponent(pageToken)}`
          )
          const fbData = await fbRes.json()

          if (!fbData.error && fbData.data) {
            for (const item of fbData.data) {
              const attach = item.attachments?.data?.[0]
              const thumb = attach?.media?.image?.src || ''
              const reactions = item.reactions?.summary?.total_count || 0
              const comments = item.comments?.summary?.total_count || 0
              const shares = item.shares?.count || 0

              allPosts.push({
                id: item.id,
                accountId: acc.id,
                accountName: acc.account_name,
                platform: 'facebook',
                title: item.message || 'Facebook Post',
                caption: item.message || '',
                thumbnailUrl: thumb,
                liveUrl: item.permalink_url || `https://www.facebook.com/${item.id}`,
                publishedAt: item.created_time || new Date().toISOString(),
                views: 0,
                likes: reactions,
                comments: comments,
                shares: shares,
                mediaType: attach?.type?.includes('video') ? 'video' : thumb ? 'image' : 'text',
              })
            }
          }
        }

        // ====================================================================
        // 3. INSTAGRAM FEED & REELS
        // ====================================================================
        else if (platform === 'instagram') {
          const token = await getValidMetaToken(acc.id)
          const igUserId = acc.platform_account_id

          let fetched = false

          // Strategy A: Instagram Business Account via Facebook Graph API
          try {
            const igRes = await fetch(
              `https://graph.facebook.com/v23.0/${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=20&access_token=${encodeURIComponent(token)}`
            )
            const igData = await igRes.json()

            if (!igData.error && igData.data) {
              for (const item of igData.data) {
                const thumb =
                  item.media_type === 'VIDEO'
                    ? item.thumbnail_url || item.media_url || ''
                    : item.media_url || ''

                allPosts.push({
                  id: item.id,
                  accountId: acc.id,
                  accountName: acc.account_name,
                  platform: 'instagram',
                  title: item.caption || 'Instagram Post',
                  caption: item.caption || '',
                  thumbnailUrl: thumb,
                  liveUrl: item.permalink || `https://www.instagram.com/p/${item.id}/`,
                  publishedAt: item.timestamp || new Date().toISOString(),
                  views: 0,
                  likes: item.like_count || 0,
                  comments: item.comments_count || 0,
                  shares: 0,
                  mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
                })
              }
              fetched = true
            }
          } catch (_) {}

          // Strategy B: Instagram Basic Display / Standalone Account
          if (!fetched) {
            try {
              const igRes = await fetch(
                `https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=20&access_token=${encodeURIComponent(token)}`
              )
              const igData = await igRes.json()
              if (!igData.error && igData.data) {
                for (const item of igData.data) {
                  const thumb =
                    item.media_type === 'VIDEO'
                      ? item.thumbnail_url || item.media_url || ''
                      : item.media_url || ''

                  allPosts.push({
                    id: item.id,
                    accountId: acc.id,
                    accountName: acc.account_name,
                    platform: 'instagram',
                    title: item.caption || 'Instagram Post',
                    caption: item.caption || '',
                    thumbnailUrl: thumb,
                    liveUrl: item.permalink || `https://www.instagram.com/p/${item.id}/`,
                    publishedAt: item.timestamp || new Date().toISOString(),
                    views: 0,
                    likes: 0,
                    comments: 0,
                    shares: 0,
                    mediaType: item.media_type === 'VIDEO' ? 'video' : 'image',
                  })
                }
              }
            } catch (_) {}
          }
        }

        // ====================================================================
        // 4. TIKTOK NATIVE VIDEOS
        // ====================================================================
        else if (platform === 'tiktok') {
          const token = await getValidTikTokToken(acc.id)
          const ttRes = await fetch('https://open.tiktokapis.com/v2/video/list/', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              max_count: 20,
              fields: [
                'id',
                'title',
                'video_description',
                'create_time',
                'share_url',
                'cover_image_url',
                'like_count',
                'comment_count',
                'share_count',
                'view_count',
              ],
            }),
          })
          const ttData = await ttRes.json()
          const videoList = ttData.data?.videos || []

          for (const v of videoList) {
            allPosts.push({
              id: v.id,
              accountId: acc.id,
              accountName: acc.account_name,
              platform: 'tiktok',
              title: v.title || v.video_description || 'TikTok Video',
              caption: v.video_description || '',
              thumbnailUrl: v.cover_image_url || '',
              liveUrl: v.share_url || `https://www.tiktok.com/@${acc.username}/video/${v.id}`,
              publishedAt: v.create_time
                ? new Date(v.create_time * 1000).toISOString()
                : new Date().toISOString(),
              views: v.view_count || 0,
              likes: v.like_count || 0,
              comments: v.comment_count || 0,
              shares: v.share_count || 0,
              mediaType: 'video',
            })
          }
        }

        // ====================================================================
        // 5. LINKEDIN DIRECT POSTS & DATABASE FALLBACK
        // ====================================================================
        else if (platform === 'linkedin') {
          try {
            const token = await getValidLinkedInToken(acc.id)
            const authorUrn = acc.platform_account_id

            // Attempt 1: LinkedIn REST posts endpoint
            const liRes = await fetch(
              `https://api.linkedin.com/rest/posts?author=${encodeURIComponent(authorUrn)}&q=author&count=20`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'LinkedIn-Version': '202601',
                  'X-Restli-Protocol-Version': '2.0.0',
                },
              }
            )
            const liData = await liRes.json()

            if (liData.elements && liData.elements.length > 0) {
              for (const item of liData.elements) {
                const text = item.commentary || 'LinkedIn Post'
                allPosts.push({
                  id: item.id,
                  accountId: acc.id,
                  accountName: acc.account_name,
                  platform: 'linkedin',
                  title: text,
                  caption: text,
                  thumbnailUrl: '',
                  liveUrl: `https://www.linkedin.com/feed/update/${item.id}/`,
                  publishedAt: item.createdAt
                    ? new Date(item.createdAt).toISOString()
                    : new Date().toISOString(),
                  views: 0,
                  likes: 0,
                  comments: 0,
                  shares: 0,
                  mediaType: 'text',
                })
              }
            } else {
              warnings.push({
                account: acc.account_name,
                platform: 'linkedin',
                message: liData.message || (liData.elements ? 'No published posts found on this LinkedIn profile' : JSON.stringify(liData)),
              })
            }
          } catch (liErr: any) {
            console.warn('LinkedIn posts fetch error:', liErr.message)
          }

          // Fallback: Also check published post targets from database
          const { data: liTargets } = await supabase
            .from('post_targets')
            .select('id, live_url, published_at, posts(id, content)')
            .eq('account_id', acc.id)
            .eq('status', 'published')
            .order('published_at', { ascending: false })
            .limit(10)

          for (const target of liTargets || []) {
            if (!allPosts.some((p) => p.id === target.id)) {
              allPosts.push({
                id: target.id,
                accountId: acc.id,
                accountName: acc.account_name,
                platform: 'linkedin',
                title: (target.posts as any)?.content || 'LinkedIn Post',
                caption: (target.posts as any)?.content || '',
                thumbnailUrl: '',
                liveUrl: target.live_url || 'https://www.linkedin.com/feed/',
                publishedAt: target.published_at || new Date().toISOString(),
                views: 0,
                likes: 0,
                comments: 0,
                shares: 0,
                mediaType: 'text',
              })
            }
          }
        }
      } catch (err: any) {
        console.warn(`Error fetching live feed for ${acc.account_name} (${platform}):`, err.message)
      }
    }

    // Sort all posts chronologically (newest first)
    allPosts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return new Response(
      JSON.stringify({
        success: true,
        count: allPosts.length,
        posts: allPosts,
        warnings,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('fetch-platform-posts error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
