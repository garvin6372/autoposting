DO $$
DECLARE
  v_user_id UUID := 'de51aad4-5ee2-4fe2-8500-da8ad6792900';
  v_auto1_id UUID;
  v_auto2_id UUID;
BEGIN
  -- Insert automation 1
  INSERT INTO instagram_automations (
    user_id, name, match_any_post, keywords, whole_word_match, dm_trigger_enabled,
    dm_message, link_button_title, link_button_url, public_reply_enabled, public_reply_messages,
    is_active, trigger_count, dm_sent_count
  ) VALUES (
    v_user_id, 'Free AI Strategy Guide', true, ARRAY['GUIDE', 'AI', 'FREE'], true, true,
    'Hey {username}! 👋 Thanks for your comment! Here is the direct link to our Complete 2026 AI Strategy Playbook:',
    'Download Free Guide', 'https://socialhub.app/free-guide',
    true, ARRAY['Sent you a DM! Check your inbox 🚀', 'Just messaged you the playbook @{username}! 📬', 'Check your DMs for the free guide! ✨'],
    true, 142, 138
  ) RETURNING id INTO v_auto1_id;

  -- Insert automation 2
  INSERT INTO instagram_automations (
    user_id, name, match_any_post, keywords, whole_word_match, dm_trigger_enabled,
    dm_message, link_button_title, link_button_url, public_reply_enabled, public_reply_messages,
    is_active, trigger_count, dm_sent_count
  ) VALUES (
    v_user_id, 'Exclusive 20% Discount Promo', true, ARRAY['PROMO', 'DISCOUNT', 'SAVE'], true, false,
    'Hey {username}! 🎉 Here is your exclusive 20% discount coupon code: VIP20. Tap below to claim it at checkout!',
    'Claim 20% Off', 'https://socialhub.app/checkout?coupon=VIP20',
    true, ARRAY['Coupon code sent to your DMs @{username}! 🎁', 'Check your messages for your discount! ✨'],
    true, 89, 87
  ) RETURNING id INTO v_auto2_id;

  -- Insert sample logs
  INSERT INTO instagram_automation_logs (
    user_id, automation_id, commenter_username, comment_text, matched_keyword,
    dm_status, dm_message_sent, public_reply_status, public_reply_text, created_at
  ) VALUES 
  (
    v_user_id, v_auto1_id, 'sarah_tech', 'Can you please send me the GUIDE?', 'GUIDE',
    'sent', 'Hey sarah_tech! 👋 Thanks for your comment! Here is the direct link...', 'sent', 'Sent you a DM! Check your inbox 🚀', now() - interval '12 minutes'
  ),
  (
    v_user_id, v_auto1_id, 'alex_creates', 'Love this breakdown! need that AI guide link', 'AI',
    'sent', 'Hey alex_creates! 👋 Thanks for your comment! Here is the direct link...', 'sent', 'Just messaged you the playbook @alex_creates! 📬', now() - interval '45 minutes'
  ),
  (
    v_user_id, v_auto2_id, 'design_pro', 'Is there any DISCOUNT code currently available?', 'DISCOUNT',
    'sent', 'Hey design_pro! 🎉 Here is your exclusive 20% discount coupon code...', 'sent', 'Coupon code sent to your DMs @design_pro! 🎁', now() - interval '2 hours'
  );
END $$;
