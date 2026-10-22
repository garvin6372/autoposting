import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { handleCors, corsHeaders } from '../_shared/cors.ts'
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts'
import { decryptPacked } from '../_shared/encryption.ts'

const GRAPH_VERSION = Deno.env.get('META_GRAPH_VERSION') || 'v24.0'

function getGraphApiBase(token = ''): string {
  if (token && token.startsWith('IGA')) {
    return `https://graph.instagram.com/${GRAPH_VERSION}`
  }
  return `https://graph.facebook.com/${GRAPH_VERSION}`
}

interface WebhookCommentChange {
  id?: string
  text?: string
  from?: {
    id: string
    username: string
  }
  media?: {
    id: string
  }
}

// Helper: match keywords against comment text
function matchKeywords(text: string, keywords: string[], wholeWord = true): string | null {
  if (!keywords || keywords.length === 0) return null
  const cleanedText = text.toLowerCase()
  for (const rawKw of keywords) {
    const kw = rawKw.trim().toLowerCase()
    if (!kw) continue
    if (wholeWord) {
      // Word boundary match
      const regex = new RegExp(`(^|\\s|[.,!?;])${kw}($|\\s|[.,!?;])`, 'i')
      if (regex.test(cleanedText)) return rawKw
    } else {
      if (cleanedText.includes(kw)) return rawKw
    }
  }
  return null
}

// Helper: pick random public reply variant
function pickPublicReply(replies: string[], username: string): string {
  if (!replies || replies.length === 0) {
    return `Sent you a DM @${username}! Check your inbox 📬`
  }
  const chosen = replies[Math.floor(Math.random() * replies.length)]
  return chosen.replace(/{username}/gi, username)
}

// Helper: interpolate DM template variables
function interpolateMessage(template: string, username: string): string {
  return template.replace(/{username}/gi, username)
}

serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const url = new URL(req.url)
  const supabase = getSupabaseAdmin()

  // ====================================================================
  // 1. GET: META WEBHOOK VERIFICATION HANDSHAKE
  // ====================================================================
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const verifyToken = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    const expectedToken = Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || 'socialhub_ig_verify_token'

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      console.log('[Instagram Webhook] Verification successful!')
      return new Response(challenge || 'OK', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      })
    }

    return new Response(
      JSON.stringify({
        status: 'online',
        service: 'SocialHub Instagram Auto-DM Webhook Engine',
        version: '1.0.0',
        webhookVerifyEndpoint: true,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // ====================================================================
  // 2. POST: WEBHOOK EVENTS & INTERACTIVE SIMULATION / SCAN
  // ====================================================================
  if (req.method === 'POST') {
    let body: any
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // A) SUBSCRIBE ACCOUNTS TO WEBHOOKS (Meta Graph API subscribed_apps)
    // ------------------------------------------------------------------
    // ------------------------------------------------------------------
    // A) TEST API CALL FOR META PERMISSIONS (instagram_manage_comments)
    // ------------------------------------------------------------------
    if (body.action === 'make_test_api_call') {
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform_account_id, username')
        .eq('platform', 'instagram')

      const callResults: any[] = []

      for (const acc of accounts || []) {
        const { data: tokenRow } = await supabase
          .from('account_tokens')
          .select('encrypted_access_token, token_iv, token_tag')
          .eq('account_id', acc.id)
          .single()

        if (!tokenRow) continue

        const token = await decryptPacked(tokenRow.encrypted_access_token, tokenRow.token_iv, tokenRow.token_tag)
        const apiBase = getGraphApiBase(token)

        try {
          // 1. Fetch user's media
          const mediaRes = await fetch(`${apiBase}/me/media?fields=id,caption,permalink&limit=3&access_token=${token}`)
          const mediaJson = await mediaRes.json()

          let commentsJson: any = null
          let testedMediaId: string | null = null

          if (mediaJson.data && mediaJson.data.length > 0) {
            testedMediaId = mediaJson.data[0].id
            // 2. Fetch comments on that media — this fulfills the instagram_manage_comments requirement!
            const commRes = await fetch(`${apiBase}/${testedMediaId}/comments?fields=id,text,from,timestamp&access_token=${token}`)
            commentsJson = await commRes.json()
          }

          callResults.push({
            username: acc.username,
            apiBase,
            mediaFetched: mediaJson.data?.length || 0,
            testedMediaId,
            commentsResponse: commentsJson,
            mediaResponse: mediaJson,
          })
        } catch (err: any) {
          callResults.push({ username: acc.username, error: err.message })
        }
      }

      return new Response(JSON.stringify({ success: true, callResults }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.action === 'debug_tokens') {
      const { data: accounts } = await supabase.from('social_accounts').select('id, platform_account_id, username').eq('platform', 'instagram')
      const debugResults: any[] = []
      for (const acc of accounts || []) {
        const { data: tokenRow } = await supabase.from('account_tokens').select('encrypted_access_token, token_iv, token_tag').eq('account_id', acc.id).single()
        if (!tokenRow) continue
        const token = await decryptPacked(tokenRow.encrypted_access_token, tokenRow.token_iv, tokenRow.token_tag)
        
        // 1. Try graph.facebook.com debug_token
        const fbRes = await fetch(`https://graph.facebook.com/v24.0/debug_token?input_token=${token}&access_token=${token}`)
        const fbJson = await fbRes.json()

        // 2. Try graph.instagram.com /me
        const igRes = await fetch(`https://graph.instagram.com/v24.0/me?fields=id,user_id,username&access_token=${token}`)
        const igJson = await igRes.json()

        debugResults.push({
          username: acc.username,
          platform_account_id: acc.platform_account_id,
          token_prefix: token.substring(0, 10),
          facebook_debug: { scopes: fbJson.data?.scopes || [], is_valid: fbJson.data?.is_valid, error: fbJson.error },
          instagram_graph: igJson,
        })
      }
      return new Response(JSON.stringify({ debugResults }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (body.action === 'subscribe_all' || body.action === 'subscribe_account') {
      let query = supabase.from('social_accounts').select('id, platform_account_id, username, account_name').eq('platform', 'instagram')
      if (body.account_id) {
        query = query.eq('id', body.account_id)
      }

      const { data: accounts, error: accErr } = await query
      if (accErr || !accounts || accounts.length === 0) {
        return new Response(JSON.stringify({ error: accErr?.message || 'No connected Instagram accounts found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const results: any[] = []

      for (const acc of accounts) {
        const { data: tokenRow } = await supabase
          .from('account_tokens')
          .select('encrypted_access_token, token_iv, token_tag')
          .eq('account_id', acc.id)
          .single()

        if (!tokenRow) {
          results.push({ account: acc.username, error: 'No token found' })
          continue
        }

        try {
          const token = await decryptPacked(tokenRow.encrypted_access_token, tokenRow.token_iv, tokenRow.token_tag)
          const apiBase = getGraphApiBase(token)

          // 1. Subscribe Instagram Account (try me/subscribed_apps or platform_account_id)
          const targetId = token.startsWith('IGA') ? 'me' : acc.platform_account_id
          const subRes = await fetch(`${apiBase}/${targetId}/subscribed_apps`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              subscribed_fields: ['comments', 'messages'],
            }),
          })
          const subJson = await subRes.json()

          // 2. Verify subscription status
          const checkRes = await fetch(`${apiBase}/${targetId}/subscribed_apps?access_token=${token}`)
          const checkJson = await checkRes.json()

          results.push({
            username: acc.username,
            platform_account_id: acc.platform_account_id,
            subscribeResponse: subJson,
            currentSubscriptions: checkJson,
            success: subRes.ok && !subJson.error,
          })
        } catch (err: any) {
          results.push({ username: acc.username, error: err.message })
        }
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ------------------------------------------------------------------
    // B) SIMULATION / TEST TRIGGER (From Dashboard UI)
    // ------------------------------------------------------------------
    if (body.action === 'simulate') {
      const {
        comment_text = '',
        commenter_username = 'instagram_user',
        automation_id,
        user_id,
      } = body

      let query = supabase.from('instagram_automations').select('*').eq('is_active', true)
      if (automation_id) {
        query = query.eq('id', automation_id)
      } else if (user_id) {
        query = query.eq('user_id', user_id)
      }

      const { data: automations, error: autoErr } = await query
      if (autoErr) {
        return new Response(JSON.stringify({ error: autoErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      let matchedAuto: any = null
      let matchedKw: string | null = null

      for (const auto of automations || []) {
        const kw = matchKeywords(comment_text, auto.keywords, auto.whole_word_match ?? true)
        if (kw) {
          matchedAuto = auto
          matchedKw = kw
          break
        }
      }

      if (!matchedAuto) {
        return new Response(
          JSON.stringify({
            matched: false,
            message: 'No active automation matched the comment keywords.',
            testedComment: comment_text,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const generatedDm = interpolateMessage(matchedAuto.dm_message, commenter_username)
      const generatedPublicReply = matchedAuto.public_reply_enabled
        ? pickPublicReply(matchedAuto.public_reply_messages, commenter_username)
        : null

      // Record simulated execution in logs
      const { data: logEntry } = await supabase
        .from('instagram_automation_logs')
        .insert({
          user_id: matchedAuto.user_id,
          automation_id: matchedAuto.id,
          account_id: matchedAuto.account_id,
          comment_id: 'sim_comm_' + Date.now(),
          commenter_username,
          comment_text,
          matched_keyword: matchedKw,
          dm_status: 'sent',
          dm_message_sent: generatedDm,
          public_reply_status: matchedAuto.public_reply_enabled ? 'sent' : 'skipped',
          public_reply_text: generatedPublicReply,
        })
        .select()
        .single()

      // Increment stats
      await supabase
        .from('instagram_automations')
        .update({
          trigger_count: (matchedAuto.trigger_count || 0) + 1,
          dm_sent_count: (matchedAuto.dm_sent_count || 0) + 1,
        })
        .eq('id', matchedAuto.id)

      return new Response(
        JSON.stringify({
          matched: true,
          automation: matchedAuto,
          matchedKeyword: matchedKw,
          simulatedDm: generatedDm,
          linkButton: matchedAuto.link_button_title
            ? { title: matchedAuto.link_button_title, url: matchedAuto.link_button_url }
            : null,
          simulatedPublicReply: generatedPublicReply,
          log: logEntry,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ------------------------------------------------------------------
    // B) MANUAL RECENT COMMENTS SCAN (Poll & Auto-Reply)
    // ------------------------------------------------------------------
    if (body.action === 'poll_comments') {
      const { account_id, media_id } = body
      if (!account_id || !media_id) {
        return new Response(
          JSON.stringify({ error: 'Missing account_id or media_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 1. Get decrypted token
      const { data: tokenRow } = await supabase
        .from('account_tokens')
        .select('encrypted_access_token, token_iv, token_tag')
        .eq('account_id', account_id)
        .single()

      if (!tokenRow) {
        return new Response(
          JSON.stringify({ error: 'Account credentials not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const accessToken = await decryptPacked(
        tokenRow.encrypted_access_token,
        tokenRow.token_iv,
        tokenRow.token_tag
      )

      // 2. Fetch comments from Instagram Graph API
      const apiBase = getGraphApiBase(accessToken)
      const commentsRes = await fetch(
        `${apiBase}/${media_id}/comments?fields=id,text,from,timestamp&order=reverse_chronological&limit=25&access_token=${accessToken}`
      )
      const commentsJson = await commentsRes.json()

      if (!commentsRes.ok || commentsJson.error) {
        return new Response(
          JSON.stringify({ error: commentsJson.error?.message || 'Failed to fetch comments' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const comments = commentsJson.data || []

      // 3. Get active automations for this account or post
      const { data: automations } = await supabase
        .from('instagram_automations')
        .select('*')
        .eq('account_id', account_id)
        .eq('is_active', true)

      let repliesSent = 0
      const processed: any[] = []

      for (const comment of comments) {
        const commentId = comment.id
        const commentText = comment.text || ''
        const commenterUsername = comment.from?.username || 'user'
        const commenterId = comment.from?.id

        // Check if we already replied to this comment
        const { data: existingLog } = await supabase
          .from('instagram_automation_logs')
          .select('id')
          .eq('comment_id', commentId)
          .maybeSingle()

        if (existingLog) continue

        // Check matches
        for (const auto of automations || []) {
          if (!auto.match_any_post && auto.post_id && auto.post_id !== media_id) continue

          const kw = matchKeywords(commentText, auto.keywords, auto.whole_word_match ?? true)
          if (!kw) continue

          // MATCH! Execute replies
          const dmText = interpolateMessage(auto.dm_message, commenterUsername)
          const publicReplyText = auto.public_reply_enabled
            ? pickPublicReply(auto.public_reply_messages, commenterUsername)
            : null

          // 1. Send private reply
          let dmStatus = 'sent'
          let dmError: string | null = null
          try {
            const dmPayload: any = {
              recipient: { comment_id: commentId },
            }

            if (auto.link_button_title && auto.link_button_url) {
              dmPayload.message = {
                attachment: {
                  type: 'template',
                  payload: {
                    template_type: 'button',
                    text: dmText.slice(0, 640),
                    buttons: [
                      {
                        type: 'web_url',
                        url: auto.link_button_url,
                        title: auto.link_button_title.slice(0, 20),
                      },
                    ],
                  },
                },
              }
            } else {
              dmPayload.message = { text: dmText }
            }

            const igUserId = comment.from?.id || 'me'
            const dmResp = await fetch(`${apiBase}/${igUserId}/messages`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify(dmPayload),
            })
            const dmRespJson = await dmResp.json()
            if (!dmResp.ok || dmRespJson.error) {
              dmStatus = 'failed'
              dmError = dmRespJson.error?.message || 'Graph API error'
            }
          } catch (err: any) {
            dmStatus = 'failed'
            dmError = err.message
          }

          // 2. Send public comment reply
          let publicReplyStatus = auto.public_reply_enabled ? 'sent' : 'skipped'
          if (auto.public_reply_enabled && publicReplyText) {
            try {
              const replyResp = await fetch(`${apiBase}/${commentId}/replies`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ message: publicReplyText }),
              })
              const replyJson = await replyResp.json()
              if (!replyResp.ok || replyJson.error) {
                publicReplyStatus = 'failed'
              }
            } catch {
              publicReplyStatus = 'failed'
            }
          }

          // 3. Log
          await supabase.from('instagram_automation_logs').insert({
            user_id: auto.user_id,
            automation_id: auto.id,
            account_id,
            comment_id: commentId,
            commenter_username: commenterUsername,
            commenter_id: commenterId,
            comment_text: commentText,
            post_id: media_id,
            matched_keyword: kw,
            dm_status: dmStatus,
            dm_message_sent: dmText,
            public_reply_status: publicReplyStatus,
            public_reply_text: publicReplyText,
            error_message: dmError,
          })

          repliesSent++
          processed.push({ commentId, commenterUsername, matchedKeyword: kw, dmStatus })
          break
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          scannedCommentsCount: comments.length,
          repliesSent,
          processed,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ------------------------------------------------------------------
    // C) META INSTAGRAM WEBHOOK EVENT RECEIVER
    // ------------------------------------------------------------------
    if (body.object === 'instagram' && Array.isArray(body.entry)) {
      console.log('[Instagram Webhook] Received webhook payload from Meta')

      for (const entry of body.entry) {
        const instagramBusinessId = entry.id
        const changes = entry.changes || []

        for (const change of changes) {
          if (change.field !== 'comments') continue

          const val: WebhookCommentChange = change.value || {}
          const commentId = val.id
          const commentText = val.text || ''
          const commenterUsername = val.from?.username || ''
          const mediaId = val.media?.id || ''

          if (!commentId || !commentText) continue

          // Find connected account by platform_account_id or fallback to active instagram accounts
          let { data: account } = await supabase
            .from('social_accounts')
            .select('id, user_id, username, platform_account_id')
            .eq('platform', 'instagram')
            .eq('platform_account_id', instagramBusinessId)
            .maybeSingle()

          if (!account) {
            console.warn(`[Instagram Webhook] Finding fallback connected Instagram account for ${instagramBusinessId}`)
            const { data: fallbackAccounts } = await supabase
              .from('social_accounts')
              .select('id, user_id, username, platform_account_id')
              .eq('platform', 'instagram')
              .eq('status', 'connected')
              .limit(1)

            account = fallbackAccounts?.[0] || null
          }

          if (!account) {
            console.warn(`[Instagram Webhook] No connected account found for ${instagramBusinessId}`)
            continue
          }

          // Find active automations (for this account or general)
          const { data: automations } = await supabase
            .from('instagram_automations')
            .select('*')
            .or(`account_id.eq.${account.id},account_id.is.null`)
            .eq('is_active', true)

          for (const auto of automations || []) {
            // Check post targeting
            if (!auto.match_any_post) {
              if (auto.post_id && auto.post_id !== mediaId) {
                // If auto has a post_url, check if it might match or let it pass if post_id is empty
                continue
              }
            }

            const kw = matchKeywords(commentText, auto.keywords, auto.whole_word_match ?? true)
            if (!kw) continue

            // Check self-comment (Meta prohibits accounts from DMing themselves)
            const cleanAccName = (account.username || '').replace('@', '').toLowerCase()
            if (cleanAccName && commenterUsername.toLowerCase() === cleanAccName) {
              console.log(`[Instagram Webhook] Skipping self-comment by account owner @${commenterUsername}`)
              await supabase.from('instagram_automation_logs').insert({
                user_id: account.user_id,
                automation_id: auto.id,
                account_id: account.id,
                comment_id: commentId,
                commenter_username: commenterUsername,
                comment_text: commentText,
                post_id: mediaId,
                matched_keyword: kw,
                dm_status: 'skipped',
                error_message: 'Skipped: Meta does not allow an Instagram account to DM itself. Please test from a secondary/personal Instagram account.',
              })
              continue
            }

            // Decrypt access token
            const { data: tokenRow } = await supabase
              .from('account_tokens')
              .select('encrypted_access_token, token_iv, token_tag')
              .eq('account_id', account.id)
              .single()

            if (!tokenRow) break

            const accessToken = await decryptPacked(
              tokenRow.encrypted_access_token,
              tokenRow.token_iv,
              tokenRow.token_tag
            )

            const dmText = interpolateMessage(auto.dm_message, commenterUsername)
            const publicReplyText = auto.public_reply_enabled
              ? pickPublicReply(auto.public_reply_messages, commenterUsername)
              : null

            const apiBase = getGraphApiBase(accessToken)
            let dmStatus = 'sent'
            let dmError: string | null = null
            try {
              const dmPayload: any = {
                recipient: { comment_id: commentId },
              }

              if (auto.link_button_title && auto.link_button_url) {
                dmPayload.message = {
                  attachment: {
                    type: 'template',
                    payload: {
                      template_type: 'button',
                      text: dmText.slice(0, 640),
                      buttons: [
                        {
                          type: 'web_url',
                          url: auto.link_button_url,
                          title: auto.link_button_title.slice(0, 20),
                        },
                      ],
                    },
                  },
                }
              } else {
                dmPayload.message = { text: dmText }
              }

              const igUserId = val.from?.id || 'me'
              const dmResp = await fetch(`${apiBase}/${igUserId}/messages`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(dmPayload),
              })
              const dmRespJson = await dmResp.json()
              if (!dmResp.ok || dmRespJson.error) {
                dmStatus = 'failed'
                dmError = dmRespJson.error?.message || 'Graph API error'
              }
            } catch (err: any) {
              dmStatus = 'failed'
              dmError = err.message
            }

            // Send public comment reply
            let publicReplyStatus = auto.public_reply_enabled ? 'sent' : 'skipped'
            if (auto.public_reply_enabled && publicReplyText) {
              try {
                const replyResp = await fetch(`${apiBase}/${commentId}/replies`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                  },
                  body: JSON.stringify({ message: publicReplyText }),
                })
                const replyJson = await replyResp.json()
                if (!replyResp.ok || replyJson.error) {
                  publicReplyStatus = 'failed'
                }
              } catch {
                publicReplyStatus = 'failed'
              }
            }

            // Record log
            await supabase.from('instagram_automation_logs').insert({
              user_id: account.user_id,
              automation_id: auto.id,
              account_id: account.id,
              comment_id: commentId,
              commenter_username: commenterUsername,
              comment_text: commentText,
              post_id: mediaId,
              matched_keyword: kw,
              dm_status: dmStatus,
              dm_message_sent: dmText,
              public_reply_status: publicReplyStatus,
              public_reply_text: publicReplyText,
              error_message: dmError,
            })

            // Increment stats
            await supabase
              .from('instagram_automations')
              .update({
                trigger_count: (auto.trigger_count || 0) + 1,
                dm_sent_count: (auto.dm_sent_count || 0) + (dmStatus === 'sent' ? 1 : 0),
              })
              .eq('id', auto.id)

            break
          }
        }
      }

      return new Response(JSON.stringify({ success: true, processed: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({ error: 'Unrecognized request action or webhook format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
})
