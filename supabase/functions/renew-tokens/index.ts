import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { encrypt, decryptPacked } from '../_shared/encryption.ts'

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const supabase = getSupabaseAdmin()
  const url = new URL(req.url)

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const force = body.force === true || url.searchParams.get('force') === 'true'
  const filterAccountId = body.account_id || url.searchParams.get('account_id')

  try {
    let query = supabase.from('account_tokens').select('*, social_accounts(*)')

    if (filterAccountId) {
      query = query.eq('account_id', filterAccountId)
    } else if (!force) {
      // Find tokens expiring within the next 48 hours
      const thresholdIso = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      query = query.not('expires_at', 'is', null).lte('expires_at', thresholdIso)
    }

    const { data: targetTokens, error } = await query
    if (error) throw error

    if (!targetTokens || targetTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'All connected account tokens are healthy and up to date.', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const results: any[] = []

    for (const record of targetTokens) {
      const platform = record.social_accounts?.platform
      const accountId = record.account_id
      const username = record.social_accounts?.username || record.social_accounts?.account_name

      try {
        // ----------------------------------------------------
        // 1. INSTAGRAM REFRESH (Long-lived tokens via graph.instagram.com)
        // ----------------------------------------------------
        if (platform === 'instagram') {
          const accessToken = await decryptPacked(
            record.encrypted_access_token,
            record.token_iv,
            record.token_tag
          )

          if (accessToken && accessToken.startsWith('IGA')) {
            const res = await fetch(
              `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
            )
            const data = await res.json()

            if (data.access_token) {
              const encryptedAccess = await encrypt(data.access_token)
              const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()

              await supabase
                .from('account_tokens')
                .update({
                  encrypted_access_token: encryptedAccess.encrypted,
                  token_iv: encryptedAccess.iv,
                  token_tag: encryptedAccess.tag,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('account_id', accountId)

              results.push({ accountId, platform, username, status: 'renewed', expiresAt })
            } else {
              results.push({
                accountId,
                platform,
                username,
                status: 'error',
                error: data.error?.message || 'Failed to refresh Instagram token',
              })
            }
          } else {
            results.push({
              accountId,
              platform,
              username,
              status: 'skipped',
              reason: 'Connected via Facebook Page token (Perpetual / Non-expiring)',
            })
          }
        }
        // ----------------------------------------------------
        // 2. FACEBOOK REFRESH (Perpetual Page Tokens)
        // ----------------------------------------------------
        else if (platform === 'facebook') {
          results.push({
            accountId,
            platform,
            username,
            status: 'skipped',
            reason: 'Facebook Page Access Token is perpetual while user is admin.',
          })
        }
        // ----------------------------------------------------
        // 3. REFRESH-TOKEN BASED PLATFORMS (YouTube, TikTok, LinkedIn)
        // ----------------------------------------------------
        else {
          if (!record.encrypted_refresh_token) {
            results.push({ accountId, platform, username, status: 'skipped', reason: 'No refresh token stored' })
            continue
          }

          const refreshToken = await decryptPacked(
            record.encrypted_refresh_token,
            record.token_iv,
            record.token_tag
          )

          // A. Google / YouTube Refresh
          if (platform === 'youtube') {
            const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
            const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
            if (!clientId || !clientSecret) {
              results.push({ accountId, platform, username, status: 'error', error: 'Missing GOOGLE_CLIENT_ID/SECRET' })
              continue
            }

            const res = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
              }).toString(),
            })

            const data = await res.json()
            if (data.access_token) {
              const encryptedAccess = await encrypt(data.access_token)
              const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString()

              await supabase
                .from('account_tokens')
                .update({
                  encrypted_access_token: encryptedAccess.encrypted,
                  token_iv: encryptedAccess.iv,
                  token_tag: encryptedAccess.tag,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('account_id', accountId)

              results.push({ accountId, platform, username, status: 'renewed', expiresAt })
            } else {
              results.push({ accountId, platform, username, status: 'error', error: data.error_description || data.error })
            }
          }
          // B. TikTok Refresh
          else if (platform === 'tiktok') {
            const clientKey = Deno.env.get('TIKTOK_CLIENT_KEY')
            const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET')
            if (!clientKey || !clientSecret) {
              results.push({ accountId, platform, username, status: 'error', error: 'Missing TIKTOK_CLIENT_KEY/SECRET' })
              continue
            }

            const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_key: clientKey,
                client_secret: clientSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
              }).toString(),
            })

            const data = await res.json()
            if (data.access_token) {
              const encryptedAccess = await encrypt(data.access_token)
              const encryptedNewRefresh = data.refresh_token ? await encrypt(data.refresh_token) : null
              const expiresAt = new Date(Date.now() + (data.expires_in || 86400) * 1000).toISOString()

              await supabase
                .from('account_tokens')
                .update({
                  encrypted_access_token: encryptedAccess.encrypted,
                  encrypted_refresh_token: encryptedNewRefresh ? encryptedNewRefresh.encrypted : record.encrypted_refresh_token,
                  token_iv: encryptedAccess.iv,
                  token_tag: encryptedAccess.tag,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('account_id', accountId)

              results.push({ accountId, platform, username, status: 'renewed', expiresAt })
            } else {
              results.push({ accountId, platform, username, status: 'error', error: data.error_description || data.error })
            }
          }
          // C. LinkedIn Refresh
          else if (platform === 'linkedin') {
            const clientId = Deno.env.get('LINKEDIN_CLIENT_ID')
            const clientSecret = Deno.env.get('LINKEDIN_CLIENT_SECRET')
            if (!clientId || !clientSecret) {
              results.push({ accountId, platform, username, status: 'error', error: 'Missing LINKEDIN_CLIENT_ID/SECRET' })
              continue
            }

            const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
                client_id: clientId,
                client_secret: clientSecret,
              }).toString(),
            })

            const data = await res.json()
            if (data.access_token) {
              const encryptedAccess = await encrypt(data.access_token)
              const encryptedNewRefresh = data.refresh_token ? await encrypt(data.refresh_token) : null
              const expiresAt = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString()

              await supabase
                .from('account_tokens')
                .update({
                  encrypted_access_token: encryptedAccess.encrypted,
                  encrypted_refresh_token: encryptedNewRefresh ? encryptedNewRefresh.encrypted : record.encrypted_refresh_token,
                  token_iv: encryptedAccess.iv,
                  token_tag: encryptedAccess.tag,
                  expires_at: expiresAt,
                  updated_at: new Date().toISOString(),
                })
                .eq('account_id', accountId)

              results.push({ accountId, platform, username, status: 'renewed', expiresAt })
            } else {
              results.push({ accountId, platform, username, status: 'error', error: data.error_description || data.error })
            }
          }
        }
      } catch (tokenErr: any) {
        console.error(`Error renewing token for account ${accountId}:`, tokenErr)
        results.push({ accountId, platform, username, status: 'error', error: tokenErr.message })
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} token renewal evaluations.`,
        renewals: results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
