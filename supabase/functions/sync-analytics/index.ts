import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { getValidYouTubeAccessToken as getValidYouTubeToken } from '../_shared/youtube.ts'
import { getValidMetaToken } from '../_shared/meta.ts'
import { getValidTikTokToken } from '../_shared/tiktok.ts'
import { getValidLinkedInToken } from '../_shared/linkedin.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()
  const startedAt = new Date().toISOString()

  try {
    const todayDate = new Date().toISOString().split('T')[0]

    // Fetch all connected social accounts
    const { data: accounts, error: accError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('status', 'connected')

    if (accError) throw accError

    const results = []

    for (const acc of accounts || []) {
      const platform = acc.platform
      let followers = 0
      let views = 0
      let likes = 0
      let extra: Record<string, any> = {}

      try {
        // 1. YouTube Stats
        if (platform === 'youtube') {
          const accessToken = await getValidYouTubeToken(acc.id)
          const res = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true',
            { headers: { Authorization: `Bearer ${accessToken}` } }
          )
          const data = await res.json()
          const stats = data.items?.[0]?.statistics
          if (stats) {
            followers = parseInt(stats.subscriberCount || '0', 10)
            views = parseInt(stats.viewCount || '0', 10)
            extra = {
              videoCount: parseInt(stats.videoCount || '0', 10),
              hiddenSubscriberCount: stats.hiddenSubscriberCount,
            }
          }
        }
        // 2. Facebook Page Stats
        else if (platform === 'facebook') {
          const pageToken = await getValidMetaToken(acc.id)
          const pageId = acc.platform_account_id
          const res = await fetch(
            `https://graph.facebook.com/v23.0/${pageId}?fields=followers_count,fan_count&access_token=${encodeURIComponent(pageToken)}`
          )
          const data = await res.json()
          if (!data.error) {
            followers = data.followers_count || data.fan_count || 0
            extra = { fanCount: data.fan_count }
          }
        }
        // 3. Instagram Stats
        else if (platform === 'instagram') {
          const token = await getValidMetaToken(acc.id)
          const igUserId = acc.platform_account_id

          // Try Facebook Graph API endpoint first (for professional IG connected to FB page)
          let fetched = false
          try {
            const res = await fetch(
              `https://graph.facebook.com/v23.0/${igUserId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`
            )
            const data = await res.json()
            if (!data.error && data.followers_count !== undefined) {
              followers = data.followers_count || 0
              extra = { mediaCount: data.media_count }
              fetched = true
            }
          } catch (_) {}

          // Fallback to Instagram Graph API (for standalone IG OAuth token)
          if (!fetched) {
            try {
              const res = await fetch(
                `https://graph.instagram.com/me?fields=account_type,media_count&access_token=${encodeURIComponent(token)}`
              )
              const data = await res.json()
              if (!data.error) {
                extra = { mediaCount: data.media_count, accountType: data.account_type }
              }
            } catch (_) {}
          }
        }
        // 4. TikTok Stats
        else if (platform === 'tiktok') {
          const token = await getValidTikTokToken(acc.id)
          const res = await fetch(
            'https://open.tiktokapis.com/v2/user/info/?fields=follower_count,likes_count,video_count',
            { headers: { Authorization: `Bearer ${token}` } }
          )
          const data = await res.json()
          const user = data.data?.user
          if (user) {
            followers = user.follower_count || 0
            likes = user.likes_count || 0
            extra = { videoCount: user.video_count }
          }
        }
        // 5. LinkedIn Stats
        else if (platform === 'linkedin') {
          const token = await getValidLinkedInToken(acc.id)
          try {
            const res = await fetch('https://api.linkedin.com/v2/userinfo', {
              headers: { Authorization: `Bearer ${token}` },
            })
            const data = await res.json()
            if (data.sub) {
              extra = { openIdSub: data.sub, name: data.name }
            }
          } catch (_) {}
        }

        // Upsert today's metric row
        await supabase.from('account_metrics_daily').upsert(
          {
            account_id: acc.id,
            recorded_date: todayDate,
            followers_count: followers,
            views_count: views,
            likes_count: likes,
            comments_count: 0,
            shares_count: 0,
            extra_metrics: extra,
          },
          { onConflict: 'account_id,recorded_date' }
        )

        results.push({ account: acc.account_name, platform, followers, views, likes })
      } catch (err: any) {
        console.warn(`Failed to sync metrics for ${acc.account_name}:`, err.message)
        results.push({ account: acc.account_name, platform, error: err.message })
      }
    }

    // Record job run
    await supabase.from('job_runs').insert({
      job_name: 'sync-analytics',
      status: 'success',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: { count: results.length, date: todayDate, results },
    })

    return new Response(
      JSON.stringify({
        message: `Synced metrics for ${results.length} accounts on ${todayDate}`,
        date: todayDate,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Metrics sync error:', err)
    await supabase.from('job_runs').insert({
      job_name: 'sync-analytics',
      status: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      details: { error: err.message },
    })
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
