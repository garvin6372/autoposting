import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getUserFromAuthHeader } from '../_shared/supabaseAdmin.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()

  try {
    const { postId } = await req.json()
    if (!postId) {
      return new Response(JSON.stringify({ error: 'postId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Update post to publishing
    await supabase
      .from('posts')
      .update({ status: 'publishing', updated_at: new Date().toISOString() })
      .eq('id', postId)

    // 2. Fetch targets
    const { data: targets, error: targetError } = await supabase
      .from('post_targets')
      .select('id')
      .eq('post_id', postId)

    if (targetError) throw targetError

    // 3. Dispatch each target
    const targetResults = []
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    for (const target of targets || []) {
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
        targetResults.push(resJson)
      } catch (err: any) {
        targetResults.push({ targetId: target.id, error: err.message })
      }
    }

    return new Response(JSON.stringify({ success: true, postId, targets: targetResults }), {
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
