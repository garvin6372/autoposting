-- ====================================================================
-- SOCIALHUB COMPLETE DATABASE MIGRATION
-- Project: SocialHub (Private Multi-Channel Orchestration)
-- Target: Supabase Postgres with Row Level Security (RLS)
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ====================================================================
-- 2. TABLES & INDEXES
-- ====================================================================

-- 2.1 Social Accounts (one row per connected account)
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('youtube', 'facebook', 'instagram', 'tiktok', 'linkedin', 'linkedin_page', 'x')),
    platform_account_id TEXT NOT NULL,
    account_name TEXT NOT NULL,
    username TEXT,
    profile_picture_url TEXT,
    status TEXT NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'needs_reconnect', 'error')),
    access_expires_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_user_platform_account UNIQUE (user_id, platform, platform_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_id ON public.social_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON public.social_accounts(status);

-- 2.2 Account Tokens (ENCRYPTED platform tokens - NEVER visible to web client)
CREATE TABLE IF NOT EXISTS public.account_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE UNIQUE,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    token_iv TEXT NOT NULL,
    token_tag TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.3 OAuth States (Short-lived 10 min connection tokens for PKCE & CSRF)
CREATE TABLE IF NOT EXISTS public.oauth_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    state TEXT NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    code_verifier TEXT,
    return_url TEXT,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);

-- 2.4 Pending Connections (temporary storage for Pages/Instagram selection popups)
CREATE TABLE IF NOT EXISTS public.pending_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.5 Media Library (user uploads with dimension & duration metadata)
CREATE TABLE IF NOT EXISTS public.media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    width INTEGER,
    height INTEGER,
    duration_seconds NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_user_id ON public.media(user_id);

-- 2.6 Posts (main draft & scheduled master records)
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'partly_failed', 'failed')),
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON public.posts(scheduled_at);

-- 2.7 Post Media Join Table (attachments in ordered sequence)
CREATE TABLE IF NOT EXISTS public.post_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_post_media UNIQUE (post_id, media_id)
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media(post_id);

-- 2.8 Post Targets (one row per post x account)
CREATE TABLE IF NOT EXISTS public.post_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    custom_content TEXT,
    platform_options JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'publishing', 'processing', 'published', 'failed')),
    live_url TEXT,
    plain_error TEXT,
    raw_error TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_targets_post_id ON public.post_targets(post_id);
CREATE INDEX IF NOT EXISTS idx_post_targets_status ON public.post_targets(status);

-- 2.9 Daily Account Metrics (historical followers, views, likes, etc.)
CREATE TABLE IF NOT EXISTS public.account_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL,
    followers_count BIGINT DEFAULT 0,
    views_count BIGINT DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    shares_count BIGINT DEFAULT 0,
    extra_metrics JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_account_recorded_date UNIQUE (account_id, recorded_date)
);

CREATE INDEX IF NOT EXISTS idx_account_metrics_account_date ON public.account_metrics_daily(account_id, recorded_date);

-- 2.10 Platform Posts (synced feed items for "best posts" and analytics)
CREATE TABLE IF NOT EXISTS public.platform_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
    external_post_id TEXT NOT NULL,
    caption TEXT,
    thumbnail_url TEXT,
    live_url TEXT,
    views_count BIGINT DEFAULT 0,
    likes_count BIGINT DEFAULT 0,
    comments_count BIGINT DEFAULT 0,
    shares_count BIGINT DEFAULT 0,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_account_external_post UNIQUE (account_id, external_post_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_posts_account_id ON public.platform_posts(account_id);

-- 2.11 Job Runs (Alarm-clock execution diary for troubleshooting)
CREATE TABLE IF NOT EXISTS public.job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
    details JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name ON public.job_runs(job_name, started_at DESC);

-- ====================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS across all tables
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- 3.1 social_accounts policies
CREATE POLICY "Users can view own social accounts"
    ON public.social_accounts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own social accounts"
    ON public.social_accounts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own social accounts"
    ON public.social_accounts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own social accounts"
    ON public.social_accounts FOR DELETE
    USING (auth.uid() = user_id);

-- 3.2 account_tokens: STRICTEST SECURITY.
-- NO SELECT/INSERT/UPDATE/DELETE policy for authenticated or anon!
-- ONLY the Edge Functions using service_role key can read/write this table.

-- 3.3 media policies
CREATE POLICY "Users can view own media"
    ON public.media FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own media"
    ON public.media FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own media"
    ON public.media FOR DELETE
    USING (auth.uid() = user_id);

-- 3.4 posts policies
CREATE POLICY "Users can view own posts"
    ON public.posts FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
    ON public.posts FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
    ON public.posts FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
    ON public.posts FOR DELETE
    USING (auth.uid() = user_id);

-- 3.5 post_media policies
CREATE POLICY "Users can view own post_media"
    ON public.post_media FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_media.post_id AND posts.user_id = auth.uid()));

CREATE POLICY "Users can insert own post_media"
    ON public.post_media FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_media.post_id AND posts.user_id = auth.uid()));

CREATE POLICY "Users can delete own post_media"
    ON public.post_media FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_media.post_id AND posts.user_id = auth.uid()));

-- 3.6 post_targets policies
CREATE POLICY "Users can view own post targets"
    ON public.post_targets FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_targets.post_id AND posts.user_id = auth.uid()));

CREATE POLICY "Users can insert own post targets"
    ON public.post_targets FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_targets.post_id AND posts.user_id = auth.uid()));

CREATE POLICY "Users can update own post targets"
    ON public.post_targets FOR UPDATE
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_targets.post_id AND posts.user_id = auth.uid()));

CREATE POLICY "Users can delete own post targets"
    ON public.post_targets FOR DELETE
    USING (EXISTS (SELECT 1 FROM public.posts WHERE posts.id = post_targets.post_id AND posts.user_id = auth.uid()));

-- 3.7 account_metrics_daily policies
CREATE POLICY "Users can view metrics for own accounts"
    ON public.account_metrics_daily FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.social_accounts WHERE social_accounts.id = account_metrics_daily.account_id AND social_accounts.user_id = auth.uid()));

-- 3.8 platform_posts policies
CREATE POLICY "Users can view platform posts for own accounts"
    ON public.platform_posts FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.social_accounts WHERE social_accounts.id = platform_posts.account_id AND social_accounts.user_id = auth.uid()));

-- 3.9 job_runs policies
CREATE POLICY "Authenticated users can view job runs"
    ON public.job_runs FOR SELECT
    TO authenticated
    USING (true);

-- ====================================================================
-- 4. STORAGE BUCKET CONFIGURATION
-- ====================================================================

-- Insert private 'media' bucket into storage.buckets if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'media',
    'media',
    false,
    52428800, -- 50 MB limit (Supabase free plan)
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'];

-- Storage RLS: Users can only upload and access files in their own folder (auth.uid())
CREATE POLICY "Users can upload media to own folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own uploaded media"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own uploaded media"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);
