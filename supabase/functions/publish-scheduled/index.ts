import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()

  try {
    const nowIso = new Date().toISOString()

    // 1. Find all scheduled posts due for publishing
    const { data: duePosts, error: fetchError } = await supabase
      .from('posts')
      .select('id, scheduled_at, content')
      .eq('status', 'scheduled')
      .lte('scheduled_at', nowIso)
      .order('scheduled_at', { ascending: true })
      .limit(20)

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled posts: ${fetchError.message}`)
    }

    if (!duePosts || duePosts.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No scheduled posts due for publishing.', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${duePosts.length} posts due for scheduled publishing.`)

    const results = []

    for (const post of duePosts) {
      try {
        // Mark as publishing immediately to prevent double execution
        await supabase
          .from('posts')
          .update({ status: 'publishing', updated_at: new Date().toISOString() })
          .eq('id', post.id)

        // Invoke publish-now edge function
        const publishNowUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/publish-now`
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

        const publishRes = await fetch(publishNowUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ postId: post.id }),
        })

        const resData = await publishRes.json().catch(() => ({}))
        results.push({ postId: post.id, status: 'dispatched', response: resData })
      } catch (postErr: any) {
        console.error(`Error dispatching post ${post.id}:`, postErr)
        await supabase
          .from('posts')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', post.id)
        results.push({ postId: post.id, status: 'error', error: postErr.message })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Successfully processed ${results.length} scheduled posts.`,
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('Scheduled publisher error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
