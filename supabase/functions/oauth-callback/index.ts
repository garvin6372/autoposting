import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { encrypt, packEncrypted } from '../_shared/encryption.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'

function createRedirectResponse(redirectUrl: string): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  })
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const isPost = req.method === 'POST'
  let code: string | null = null
  let state: string | null = null
  let errorParam: string | null = null
  let errorDesc: string | null = null
  let incomingRedirectUri: string | null = null

  if (isPost) {
    try {
      const body = await req.json()
      code = body.code || null
      state = body.state || null
      errorParam = body.error || null
      errorDesc = body.error_description || null
      incomingRedirectUri = body.redirectUri || null
    } catch {
      // ignore
    }
  } else {
    const url = new URL(req.url)
    code = url.searchParams.get('code')
    const rawState = url.searchParams.get('state')
    state = rawState ? rawState.trim() : null
    errorParam = url.searchParams.get('error')
    errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error_message') || url.searchParams.get('error_reason')
  }

  console.log('oauth-callback invoked. isPost:', isPost, 'hasCode:', !!code, 'hasState:', !!state)

  const defaultReturnUrl = 'http://localhost:8080/accounts'

  if (errorParam) {
    const errorMsg = encodeURIComponent(errorDesc || errorParam || 'OAuth cancelled')
    if (isPost) {
      return new Response(JSON.stringify({ error: decodeURIComponent(errorMsg) }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return createRedirectResponse(`${defaultReturnUrl}?error=${errorMsg}`)
  }

  if (!state || !code) {
    console.error('Missing code or state in callback:', { isPost, code: !!code, state: !!state })
    if (isPost) {
      return new Response(JSON.stringify({ error: 'missing_code_or_state' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return createRedirectResponse(`${defaultReturnUrl}?error=missing_code_or_state`)
  }

  const supabase = getSupabaseAdmin()

  // 1. Verify and consume the state ticket
  const { data: stateRecord, error: stateError } = await supabase
    .from('oauth_states')
    .select('*')
    .eq('state', state)
    .maybeSingle()

  if (stateError || !stateRecord) {
    console.error('State ticket not found:', stateError || 'null')
    return createRedirectResponse(`${defaultReturnUrl}?error=session_expired`)
  }

  const platform = stateRecord.platform
  const userId = stateRecord.user_id
  const returnUrl = stateRecord.return_url || defaultReturnUrl
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

  try {
    // =========================================================
    // A. YOUTUBE / GOOGLE
    // =========================================================
    if (platform === 'youtube') {
      const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
      const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')

      if (!clientId || !clientSecret) {
        throw new Error('Google credentials missing in Supabase Secrets')
      }

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      })

      const tokenData = await tokenRes.json()
      if (tokenData.error) {
        throw new Error(tokenData.error_description || tokenData.error)
      }

      const accessToken = tokenData.access_token
      const refreshToken = tokenData.refresh_token || ''
      const expiresInSeconds = tokenData.expires_in || 3600

      // Get channel info
      const channelRes = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      const channelData = await channelRes.json()
      const channel = channelData.items?.[0]

      const platformAccountId = channel?.id || 'yt_' + Date.now()
      const accountName = channel?.snippet?.title || 'YouTube Channel'
      const username = channel?.snippet?.customUrl || ''
      const profilePic = channel?.snippet?.thumbnails?.default?.url || ''

      const encryptedAccess = await encrypt(accessToken)
      const encryptedRefresh = refreshToken ? await encrypt(refreshToken) : null
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

      const { data: account, error: accountError } = await supabase
        .from('social_accounts')
        .upsert(
          {
            user_id: userId,
            platform: 'youtube',
            platform_account_id: platformAccountId,
            account_name: accountName,
            username,
            profile_picture_url: profilePic,
            status: 'connected',
            access_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,platform_account_id' }
        )
        .select('id')
        .single()

      if (accountError) throw new Error(accountError.message)

      await supabase.from('account_tokens').upsert(
        {
          account_id: account.id,
          encrypted_access_token: encryptedAccess.encrypted,
          encrypted_refresh_token: encryptedRefresh ? packEncrypted(encryptedRefresh) : null,
          token_iv: encryptedAccess.iv,
          token_tag: encryptedAccess.tag,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' }
      )
    }
    // =========================================================
    // B. META (FACEBOOK PAGES)
    // =========================================================
    else if (platform === 'facebook') {
      const appId = Deno.env.get('META_APP_ID')
      const appSecret = Deno.env.get('META_APP_SECRET')

      if (!appId || !appSecret) {
        throw new Error('Meta credentials (META_APP_ID, META_APP_SECRET) missing in Supabase Secrets.')
      }

      // Exchange short-lived code for user access token
      const metaRedirectUri = incomingRedirectUri || stateRecord.return_url || redirectUri
      const tokenRes = await fetch(
        `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(
          metaRedirectUri
        )}&client_secret=${appSecret}&code=${code}`
      )
      const tokenData = await tokenRes.json()
      if (tokenData.error) throw new Error(tokenData.error.message)

      const userAccessToken = tokenData.access_token

      // Fetch all Facebook Pages managed by user with linked Instagram accounts
      const pagesRes = await fetch(
        `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}&access_token=${userAccessToken}`
      )
      const pagesData = await pagesRes.json()
      if (pagesData.error) throw new Error(pagesData.error.message)

      const pages = pagesData.data || []
      if (pages.length === 0) {
        throw new Error('No managed Facebook Pages found on this Facebook account.')
      }

      for (const page of pages) {
        // 1. Connect Facebook Page
        const encryptedPageToken = await encrypt(page.access_token)
        const pagePic = page.picture?.data?.url || ''

        const { data: pageAccount, error: pageErr } = await supabase
          .from('social_accounts')
          .upsert(
            {
              user_id: userId,
              platform: 'facebook',
              platform_account_id: page.id,
              account_name: page.name,
              username: page.name,
              profile_picture_url: pagePic,
              status: 'connected',
              access_expires_at: null, // Page tokens do not expire while user is admin
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,platform,platform_account_id' }
          )
          .select('id')
          .single()

        if (!pageErr && pageAccount) {
          await supabase.from('account_tokens').upsert(
            {
              account_id: pageAccount.id,
              encrypted_access_token: encryptedPageToken.encrypted,
              token_iv: encryptedPageToken.iv,
              token_tag: encryptedPageToken.tag,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'account_id' }
          )
        }

        // 2. Connect linked Instagram Professional account if present
        if (page.instagram_business_account) {
          const ig = page.instagram_business_account
          const { data: igAccount, error: igErr } = await supabase
            .from('social_accounts')
            .upsert(
              {
                user_id: userId,
                platform: 'instagram',
                platform_account_id: ig.id,
                account_name: ig.username || `${page.name} Instagram`,
                username: ig.username ? `@${ig.username}` : null,
                profile_picture_url: ig.profile_picture_url || pagePic,
                status: 'connected',
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,platform,platform_account_id' }
            )
            .select('id')
            .single()

          if (!igErr && igAccount) {
            await supabase.from('account_tokens').upsert(
              {
                account_id: igAccount.id,
                encrypted_access_token: encryptedPageToken.encrypted,
                token_iv: encryptedPageToken.iv,
                token_tag: encryptedPageToken.tag,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'account_id' }
            )
          }
        }
      }
    }
    // =========================================================
    // C. INSTAGRAM (DIRECT OR BUSINESS ONBOARDING)
    // =========================================================
    else if (platform === 'instagram') {
      const instagramAppId = Deno.env.get('INSTAGRAM_APP_ID')
      const instagramAppSecret = Deno.env.get('INSTAGRAM_APP_SECRET')
      const metaAppId = Deno.env.get('META_APP_ID')
      const metaAppSecret = Deno.env.get('META_APP_SECRET')

      const serverRedirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`
      const effectiveRedirectUri = isPost
        ? (incomingRedirectUri || stateRecord.return_url || serverRedirectUri)
        : serverRedirectUri

      // PATH 1: Dedicated Instagram App credentials (api.instagram.com)
      if (instagramAppId && instagramAppSecret) {
        const form = new FormData()
        form.append('client_id', instagramAppId)
        form.append('client_secret', instagramAppSecret)
        form.append('grant_type', 'authorization_code')
        form.append('redirect_uri', effectiveRedirectUri)
        form.append('code', code)

        const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
          method: 'POST',
          body: form,
        })
        const tokenData = await tokenRes.json()
        if (tokenData.error_message || tokenData.error) {
          throw new Error(tokenData.error_message || tokenData.error?.message || 'Failed to exchange Instagram code')
        }

        const shortLivedToken = tokenData.access_token
        const igUserId = tokenData.user_id

        let finalAccessToken = shortLivedToken
        let expiresInSeconds = tokenData.expires_in || 5184000
        try {
          const longTokenRes = await fetch(
            `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${instagramAppSecret}&access_token=${shortLivedToken}`
          )
          const longTokenData = await longTokenRes.json()
          if (longTokenData.access_token) {
            finalAccessToken = longTokenData.access_token
            expiresInSeconds = longTokenData.expires_in || 5184000
          }
        } catch (e) {
          console.warn('Long token exchange warning:', e)
        }

        let username = 'Instagram Account'
        let profilePic = ''
        try {
          const profileRes = await fetch(
            `https://graph.instagram.com/me?fields=user_id,username,profile_picture_url&access_token=${finalAccessToken}`
          )
          const profileData = await profileRes.json()
          if (profileData.username) {
            username = profileData.username
            profilePic = profileData.profile_picture_url || ''
          }
        } catch (e) {
          console.warn('Profile fetch warning:', e)
        }

        const encryptedAccess = await encrypt(finalAccessToken)
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

        const { data: igAccount, error: igErr } = await supabase
          .from('social_accounts')
          .upsert(
            {
              user_id: userId,
              platform: 'instagram',
              platform_account_id: String(igUserId || Date.now()),
              account_name: username,
              username: username ? `@${username}` : null,
              profile_picture_url: profilePic,
              status: 'connected',
              access_expires_at: expiresAt,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,platform,platform_account_id' }
          )
          .select('id')
          .single()

        if (igErr) throw new Error(igErr.message)

        await supabase.from('account_tokens').upsert(
          {
            account_id: igAccount.id,
            encrypted_access_token: encryptedAccess.encrypted,
            token_iv: encryptedAccess.iv,
            token_tag: encryptedAccess.tag,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'account_id' }
        )
      }
      // PATH 2: Meta Business Login for Instagram (IG_API_ONBOARDING via Meta Graph API)
      else if (metaAppId && metaAppSecret) {
        const tokenRes = await fetch(
          `https://graph.facebook.com/v23.0/oauth/access_token?client_id=${metaAppId}&redirect_uri=${encodeURIComponent(
            effectiveRedirectUri
          )}&client_secret=${metaAppSecret}&code=${code}`
        )
        const tokenData = await tokenRes.json()
        if (tokenData.error) throw new Error(tokenData.error.message)

        const userAccessToken = tokenData.access_token

        // Fetch pages and linked Instagram Business accounts
        const pagesRes = await fetch(
          `https://graph.facebook.com/v23.0/me/accounts?fields=id,name,access_token,picture{url},instagram_business_account{id,username,profile_picture_url}&access_token=${userAccessToken}`
        )
        const pagesData = await pagesRes.json()
        if (pagesData.error) throw new Error(pagesData.error.message)

        const pages = pagesData.data || []
        let connectedCount = 0

        for (const page of pages) {
          if (page.instagram_business_account) {
            const ig = page.instagram_business_account
            const encryptedPageToken = await encrypt(page.access_token)
            const pagePic = page.picture?.data?.url || ''

            const { data: igAccount, error: igErr } = await supabase
              .from('social_accounts')
              .upsert(
                {
                  user_id: userId,
                  platform: 'instagram',
                  platform_account_id: ig.id,
                  account_name: ig.username || `${page.name} Instagram`,
                  username: ig.username ? `@${ig.username}` : null,
                  profile_picture_url: ig.profile_picture_url || pagePic,
                  status: 'connected',
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,platform,platform_account_id' }
              )
              .select('id')
              .single()

            if (!igErr && igAccount) {
              await supabase.from('account_tokens').upsert(
                {
                  account_id: igAccount.id,
                  encrypted_access_token: encryptedPageToken.encrypted,
                  token_iv: encryptedPageToken.iv,
                  token_tag: encryptedPageToken.tag,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'account_id' }
              )
              connectedCount++
            }
          }
        }

        if (connectedCount === 0) {
          // If no linked account on pages edge, check /me edge directly
          const meRes = await fetch(
            `https://graph.facebook.com/v23.0/me?fields=id,name,instagram_business_account{id,username,profile_picture_url}&access_token=${userAccessToken}`
          )
          const meData = await meRes.json()
          const ig = meData.instagram_business_account
          if (ig) {
            const encryptedToken = await encrypt(userAccessToken)
            const { data: igAccount, error: igErr } = await supabase
              .from('social_accounts')
              .upsert(
                {
                  user_id: userId,
                  platform: 'instagram',
                  platform_account_id: ig.id,
                  account_name: ig.username || 'Instagram Business',
                  username: ig.username ? `@${ig.username}` : null,
                  profile_picture_url: ig.profile_picture_url || '',
                  status: 'connected',
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id,platform,platform_account_id' }
              )
              .select('id')
              .single()

            if (!igErr && igAccount) {
              await supabase.from('account_tokens').upsert(
                {
                  account_id: igAccount.id,
                  encrypted_access_token: encryptedToken.encrypted,
                  token_iv: encryptedToken.iv,
                  token_tag: encryptedToken.tag,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: 'account_id' }
              )
              connectedCount++
            }
          }
        }

        if (connectedCount === 0) {
          throw new Error('No Instagram Professional / Business account found. Please ensure your Instagram profile is converted to a Professional or Creator account.')
        }
      } else {
        throw new Error('Meta/Instagram credentials missing in Supabase Secrets.')
      }
    }
    // =========================================================
    // D. TIKTOK (DIRECT POST API v2)
    // =========================================================
    else if (platform === 'tiktok') {
      const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')
      const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')

      if (!clientKey || !clientSecret) {
        throw new Error('TikTok credentials (TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET) missing in Supabase Secrets.')
      }

      const effectiveRedirectUri = isPost
        ? (incomingRedirectUri || stateRecord.return_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`)
        : `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

      const codeVerifier = stateRecord.code_verifier || ''

      const tokenParams = new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: effectiveRedirectUri,
        code_verifier: codeVerifier,
      })

      const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      })

      const tokenData = await tokenRes.json()
      if (tokenData.error || tokenData.error_description) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange TikTok authorization code')
      }

      const accessToken = tokenData.access_token
      const refreshToken = tokenData.refresh_token
      const expiresInSeconds = tokenData.expires_in || 86400
      const openId = tokenData.open_id

      // Fetch user profile
      const userRes = await fetch(
        'https://open.tiktokapis.com/v2/user/info/?fields=open_id,avatar_url,display_name,union_id,username',
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const userData = await userRes.json()
      const userInfo = userData?.data?.user

      const platformAccountId = openId || userInfo?.open_id || 'tiktok_' + Date.now()
      const accountName = userInfo?.display_name || userInfo?.username || 'TikTok Account'
      const username = userInfo?.username ? `@${userInfo.username}` : null
      const profilePic = userInfo?.avatar_url || ''

      const encryptedAccess = await encrypt(accessToken)
      const encryptedRefresh = refreshToken ? await encrypt(refreshToken) : null
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

      const { data: account, error: accountError } = await supabase
        .from('social_accounts')
        .upsert(
          {
            user_id: userId,
            platform: 'tiktok',
            platform_account_id: platformAccountId,
            account_name: accountName,
            username,
            profile_picture_url: profilePic,
            status: 'connected',
            access_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,platform_account_id' }
        )
        .select('id')
        .single()

      if (accountError) throw new Error(accountError.message)

      await supabase.from('account_tokens').upsert(
        {
          account_id: account.id,
          encrypted_access_token: encryptedAccess.encrypted,
          encrypted_refresh_token: encryptedRefresh ? packEncrypted(encryptedRefresh) : null,
          token_iv: encryptedAccess.iv,
          token_tag: encryptedAccess.tag,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' }
      )
    }
    // =========================================================
    // E. LINKEDIN (PERSONAL PROFILES & PAGES)
    // =========================================================
    else if (platform === 'linkedin') {
      const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')
      const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')

      if (!clientId || !clientSecret) {
        throw new Error('LinkedIn credentials (LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET) missing in Supabase Secrets.')
      }

      const effectiveRedirectUri = isPost
        ? (incomingRedirectUri || stateRecord.return_url || `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`)
        : `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`

      const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: effectiveRedirectUri,
      })

      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenParams.toString(),
      })

      const tokenData = await tokenRes.json()
      if (tokenData.error || tokenData.error_description) {
        throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange LinkedIn code')
      }

      const accessToken = tokenData.access_token
      const refreshToken = tokenData.refresh_token
      const expiresInSeconds = tokenData.expires_in || 5184000 // 60 days

      // Fetch user profile via OpenID userinfo endpoint
      const userRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const userData = await userRes.json()

      const personId = userData.sub || 'linkedin_' + Date.now()
      const authorUrn = `urn:li:person:${personId}`
      const accountName = userData.name || `${userData.given_name || ''} ${userData.family_name || ''}`.trim() || 'LinkedIn Member'
      const username = userData.email || userData.name || null
      const profilePic = userData.picture || ''

      const encryptedAccess = await encrypt(accessToken)
      const encryptedRefresh = refreshToken ? await encrypt(refreshToken) : null
      const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString()

      // 1. Save Personal Profile
      const { data: account, error: accountError } = await supabase
        .from('social_accounts')
        .upsert(
          {
            user_id: userId,
            platform: 'linkedin',
            platform_account_id: authorUrn,
            account_name: accountName,
            username,
            profile_picture_url: profilePic,
            status: 'connected',
            access_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,platform,platform_account_id' }
        )
        .select('id')
        .single()

      if (accountError) throw new Error(accountError.message)

      await supabase.from('account_tokens').upsert(
        {
          account_id: account.id,
          encrypted_access_token: encryptedAccess.encrypted,
          encrypted_refresh_token: encryptedRefresh ? packEncrypted(encryptedRefresh) : null,
          token_iv: encryptedAccess.iv,
          token_tag: encryptedAccess.tag,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id' }
      )
    }

    // Delete used state ticket
    await supabase.from('oauth_states').delete().eq('state', state)

    if (isPost) {
      return new Response(JSON.stringify({ success: true, platform }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const separator = returnUrl.includes('?') ? '&' : '?'
    return createRedirectResponse(`${returnUrl}${separator}connected=${platform}`)
  } catch (err: any) {
    console.error('OAuth callback execution error:', err)
    if (isPost) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const separator = returnUrl.includes('?') ? '&' : '?'
    return createRedirectResponse(`${returnUrl}${separator}error=${encodeURIComponent(err.message)}`)
  }
})
