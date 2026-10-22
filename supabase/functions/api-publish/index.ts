import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

const DEFAULT_FIXED_KEY = 'sh_live_7c4f9a1b8e2d3c5f6a0b4d8e'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // ====================================================================
  // 1. AUTHENTICATION: FIXED API KEY VERIFICATION
  // ====================================================================
  const expectedApiKey = Deno.env.get('SOCIALHUB_API_KEY') || DEFAULT_FIXED_KEY
  const incomingApiKey =
    req.headers.get('x-api-key') ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    new URL(req.url).searchParams.get('api_key')

  if (!incomingApiKey || incomingApiKey !== expectedApiKey) {
    return new Response(
      JSON.stringify({
        error: 'Unauthorized: Invalid or missing API key. Please pass your key in the x-api-key header.',
        hint: 'Use header: x-api-key: <YOUR_API_KEY>',
      }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = getSupabaseAdmin()

  // Handle GET: Information & Connected Platforms Health Check
  if (req.method === 'GET') {
    const { data: accounts } = await supabase
      .from('social_accounts')
      .select('id, platform, platform_account_id, account_name, username, status')
      .eq('status', 'connected')

    return new Response(
      JSON.stringify({
        status: 'online',
        service: 'SocialHub Universal Publishing API',
        version: '1.0.0',
        connectedAccountsCount: accounts?.length || 0,
        connectedAccounts: accounts || [],
        usage: {
          endpoint: 'POST /functions/v1/api-publish',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'sh_live_...',
          },
          examplePayload: {
            content: 'Hello World! 🚀 #socialhub',
            platforms: ['youtube', 'facebook', 'instagram', 'tiktok', 'linkedin'],
            scheduledAt: null,
            mediaUrl: 'https://example.com/video.mp4',
            options: {
              youtube: { title: 'My Video Title', privacy: 'public' },
              tiktok: { privacy: 'PUBLIC_TO_EVERYONE' },
            },
          },
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Handle POST: Create and Publish or Schedule Post
  try {
    const body = await req.json()
    const {
      content = '',
      platforms = ['all'],
      accountIds,
      mediaUrl,
      mediaUrls = [],
      scheduledAt,
      options = {},
    } = body

    // 1. Resolve Target Connected Accounts
    let accountQuery = supabase
      .from('social_accounts')
      .select('id, platform, platform_account_id, account_name, user_id')
      .eq('status', 'connected')

    if (accountIds && Array.isArray(accountIds) && accountIds.length > 0) {
      accountQuery = accountQuery.in('id', accountIds)
    } else if (platforms && !platforms.includes('all')) {
      accountQuery = accountQuery.in('platform', platforms)
    }

    const { data: targetAccounts, error: accErr } = await accountQuery
    if (accErr) throw accErr

    if (!targetAccounts || targetAccounts.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No connected social accounts found matching the requested platforms.',
          requestedPlatforms: platforms,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Default user ID from first account or admin
    const userId = targetAccounts[0].user_id

    // 2. Process Media Attachments (from mediaUrl or mediaUrls)
    const mediaIds: string[] = []
    const allMediaUrls: string[] = []
    if (mediaUrl) allMediaUrls.push(mediaUrl)
    if (Array.isArray(mediaUrls)) {
      for (const u of mediaUrls) {
        if (u && !allMediaUrls.includes(u)) allMediaUrls.push(u)
      }
    }

    for (const url of allMediaUrls) {
      try {
        console.log(`Downloading media attachment: ${url}`)
        const mediaRes = await fetch(url)
        if (!mediaRes.ok) {
          throw new Error(`Failed to download media (${mediaRes.status} ${mediaRes.statusText})`)
        }

        const buffer = await mediaRes.arrayBuffer()
        const mimeType = mediaRes.headers.get('content-type') || 'image/jpeg'
        const cleanName = url.split('/').pop()?.split('?')[0] || `media_${Date.now()}`
        const storagePath = `${userId}/${Date.now()}_${cleanName}`

        // Upload to private Supabase Storage
        const { error: uploadErr } = await supabase.storage
          .from('media')
          .upload(storagePath, new Uint8Array(buffer), {
            contentType: mimeType,
            upsert: true,
          })

        if (uploadErr) throw uploadErr

        // Insert row in public.media
        const { data: mediaRow, error: mediaInsertErr } = await supabase
          .from('media')
          .insert({
            user_id: userId,
            storage_path: storagePath,
            file_name: cleanName,
            mime_type: mimeType,
            file_size_bytes: buffer.byteLength,
          })
          .select('id')
          .single()

        if (mediaInsertErr) throw mediaInsertErr
        if (mediaRow?.id) mediaIds.push(mediaRow.id)
      } catch (mediaErr: any) {
        console.warn(`Media download warning for ${url}:`, mediaErr.message)
      }
    }

    // 3. Create Master Post Record
    const isScheduled = !!scheduledAt && new Date(scheduledAt).getTime() > Date.now()
    const scheduledIso = isScheduled ? new Date(scheduledAt).toISOString() : null

    const { data: post, error: postErr } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: content || '',
        status: isScheduled ? 'scheduled' : 'publishing',
        scheduled_at: scheduledIso,
      })
      .select('id')
      .single()

    if (postErr) throw postErr

    // 4. Attach Media to Post
    if (mediaIds.length > 0) {
      const mediaLinks = mediaIds.map((mId, idx) => ({
        post_id: post.id,
        media_id: mId,
        position: idx,
      }))
      await supabase.from('post_media').insert(mediaLinks)
    }

    // 5. Create Target Rows per Account with Platform Options
    const targetRows = targetAccounts.map((acc) => ({
      post_id: post.id,
      account_id: acc.id,
      platform_options: options,
      status: isScheduled ? 'pending' : 'publishing',
    }))

    const { data: insertedTargets, error: targetInsertErr } = await supabase
      .from('post_targets')
      .insert(targetRows)
      .select('id, account_id')

    if (targetInsertErr) throw targetInsertErr

    // 6. Handle Execution: Immediate Live Publishing vs Scheduled
    if (isScheduled) {
      return new Response(
        JSON.stringify({
          success: true,
          mode: 'scheduled',
          postId: post.id,
          scheduledAt: scheduledIso,
          targetCount: targetAccounts.length,
          targets: targetAccounts.map((a) => ({
            accountId: a.id,
            platform: a.platform,
            accountName: a.account_name,
            status: 'scheduled',
          })),
          message: `Post successfully scheduled for ${scheduledIso}. The background scheduler will publish it automatically.`,
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Immediate Live Publishing: Dispatch to publish-target Edge Function
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    const liveResults = []

    for (const target of insertedTargets || []) {
      const acc = targetAccounts.find((a) => a.id === target.account_id)
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/publish-target`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({ targetId: target.id }),
        })
        const resJson = await res.json()

        // Fetch updated target for live_url or error
        const { data: updatedTarget } = await supabase
          .from('post_targets')
          .select('status, live_url, plain_error')
          .eq('id', target.id)
          .single()

        liveResults.push({
          accountId: acc?.id,
          accountName: acc?.account_name,
          platform: acc?.platform,
          status: updatedTarget?.status || 'published',
          liveUrl: updatedTarget?.live_url || resJson?.liveUrl || null,
          error: updatedTarget?.plain_error || resJson?.error || null,
        })
      } catch (dispErr: any) {
        liveResults.push({
          accountId: acc?.id,
          accountName: acc?.account_name,
          platform: acc?.platform,
          status: 'failed',
          error: dispErr.message,
        })
      }
    }

    // Update master post status based on targets
    const hasAnySuccess = liveResults.some((r) => r.status === 'published')
    await supabase
      .from('posts')
      .update({
        status: hasAnySuccess ? 'published' : 'failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', post.id)

    return new Response(
      JSON.stringify({
        success: hasAnySuccess,
        mode: 'live',
        postId: post.id,
        targetCount: targetAccounts.length,
        results: liveResults,
        message: hasAnySuccess
          ? 'Post published live to targeted platforms!'
          : 'Posting failed across targeted platforms. Check error details in results.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('api-publish error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
