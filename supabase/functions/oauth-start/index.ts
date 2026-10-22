import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin, getUserFromAuthHeader } from '../_shared/supabaseAdmin.ts'

// Base64-url encoder for PKCE
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function generatePkcePair() {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32))
  const codeVerifier = base64UrlEncode(randomBytes.buffer)
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  const hash = await crypto.subtle.digest('SHA-256', data)
  const codeChallenge = base64UrlEncode(hash)
  return { codeVerifier, codeChallenge }
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { platform, returnUrl } = await req.json()
    if (!platform) {
      return new Response(JSON.stringify({ error: 'Platform is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const state = crypto.randomUUID()
    const { codeVerifier, codeChallenge } = await generatePkcePair()

    const supabase = getSupabaseAdmin()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const redirectUri = `${supabaseUrl}/functions/v1/oauth-callback`

    // Save one-time oauth state in database
    const { error: dbError } = await supabase.from('oauth_states').insert({
      state,
      user_id: user.id,
      platform,
      code_verifier: codeVerifier,
      return_url: returnUrl || 'http://localhost:8080/accounts',
    })

    if (dbError) {
      throw new Error(`Failed to save OAuth state: ${dbError.message}`)
    }

    let authUrl = ''

    switch (platform) {
      case 'youtube': {
        const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
        if (!clientId) throw new Error('GOOGLE_CLIENT_ID secret not configured')
        const scopes = [
          'https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.readonly',
          'https://www.googleapis.com/auth/yt-analytics.readonly',
        ].join(' ')
        authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&response_type=code&scope=${encodeURIComponent(
          scopes
        )}&access_type=offline&prompt=consent&state=${state}`
        break
      }

      case 'facebook': {
        const appId = Deno.env.get('META_APP_ID')
        if (!appId) throw new Error('META_APP_ID secret not configured')
        const metaRedirectUri = returnUrl || 'http://localhost:8080/accounts'
        const scopes = [
          'pages_show_list',
          'pages_manage_posts',
          'pages_read_engagement',
          'pages_manage_metadata',
          'instagram_basic',
          'instagram_content_publish',
          'instagram_manage_insights',
          'instagram_manage_comments',
          'instagram_manage_messages',
        ].join(',')
        authUrl = `https://www.facebook.com/v23.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
          metaRedirectUri
        )}&state=${state}&response_type=code&scope=${encodeURIComponent(scopes)}`
        break
      }

      case 'instagram': {
        const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID')
        if (!instagramAppId) {
          throw new Error('INSTAGRAM_APP_ID secret not configured. Please add your Instagram App ID to Supabase Secrets.')
        }

        const igRedirectUri = redirectUri
        const scopes = [
          'instagram_business_basic',
          'instagram_business_content_publish',
          'instagram_business_manage_comments',
          'instagram_business_manage_messages',
          'instagram_business_manage_insights',
        ].join(',')

        authUrl = `https://www.instagram.com/oauth/authorize?enable_fb_login=0&client_id=${instagramAppId}&redirect_uri=${encodeURIComponent(
          igRedirectUri
        )}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`
        break
      }

      case 'tiktok': {
        const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')
        if (!clientKey) throw new Error('TIKTOK_CLIENT_KEY secret not configured')
        const scopes = 'user.info.basic,video.upload,video.publish,user.info.profile,user.info.stats,video.list'
        authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${clientKey}&scope=${encodeURIComponent(
          scopes
        )}&response_type=code&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`
        break
      }

      case 'linkedin': {
        const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')
        if (!clientId) throw new Error('LINKEDIN_CLIENT_ID secret not configured')
        const scopes = 'openid profile email w_member_social'
        authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
          redirectUri
        )}&state=${state}&scope=${encodeURIComponent(scopes)}`
        break
      }

      default:
        throw new Error(`Platform "${platform}" is not supported yet`)
    }

    return new Response(JSON.stringify({ authUrl, state }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
