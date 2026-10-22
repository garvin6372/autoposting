-- Create instagram_automations table
CREATE TABLE IF NOT EXISTS instagram_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'instagram',
  
  -- Target Post scope: specific post id or match all posts / reels
  match_any_post BOOLEAN NOT NULL DEFAULT true,
  post_id TEXT,
  post_url TEXT,
  
  -- Trigger Keywords
  keywords TEXT[] NOT NULL DEFAULT '{}',
  whole_word_match BOOLEAN NOT NULL DEFAULT true,
  dm_trigger_enabled BOOLEAN NOT NULL DEFAULT false,
  
  -- Action: Direct Message (Private Reply)
  dm_message TEXT NOT NULL,
  link_button_title TEXT,
  link_button_url TEXT,
  
  -- Action: Public Comment Reply
  public_reply_enabled BOOLEAN NOT NULL DEFAULT true,
  public_reply_messages TEXT[] NOT NULL DEFAULT '{}',
  
  -- Status and Metrics
  is_active BOOLEAN NOT NULL DEFAULT true,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  dm_sent_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create instagram_automation_logs table
CREATE TABLE IF NOT EXISTS instagram_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  automation_id UUID REFERENCES instagram_automations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES social_accounts(id) ON DELETE SET NULL,
  
  -- Incoming Comment / Event Data
  comment_id TEXT,
  commenter_username TEXT NOT NULL,
  commenter_id TEXT,
  comment_text TEXT NOT NULL,
  post_id TEXT,
  matched_keyword TEXT,
  
  -- Outcomes
  dm_status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'skipped'
  dm_message_sent TEXT,
  public_reply_status TEXT DEFAULT 'skipped', -- 'sent', 'failed', 'skipped'
  public_reply_text TEXT,
  error_message TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE instagram_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE instagram_automation_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can manage their own instagram automations" ON instagram_automations;
DROP POLICY IF EXISTS "Users can manage their own instagram automation logs" ON instagram_automation_logs;

-- Create policies for instagram_automations
CREATE POLICY "Users can manage their own instagram automations"
  ON instagram_automations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for instagram_automation_logs
CREATE POLICY "Users can manage their own instagram automation logs"
  ON instagram_automation_logs
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_ig_automations_user_id ON instagram_automations(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_automations_account_id ON instagram_automations(account_id);
CREATE INDEX IF NOT EXISTS idx_ig_automations_active ON instagram_automations(is_active);
CREATE INDEX IF NOT EXISTS idx_ig_logs_user_id ON instagram_automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ig_logs_automation_id ON instagram_automation_logs(automation_id);
CREATE INDEX IF NOT EXISTS idx_ig_logs_created_at ON instagram_automation_logs(created_at DESC);
