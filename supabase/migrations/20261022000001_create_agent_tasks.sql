-- Create agent_tasks table for screen-based AI agents (Claude Computer Use, Codex, browser agents)
CREATE TABLE IF NOT EXISTS public.agent_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    title TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    target_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    media_type TEXT NOT NULL DEFAULT 'none' CHECK (media_type IN ('none', 'image', 'video')),
    media_prompt TEXT,
    media_tool_url TEXT,
    post_content TEXT,
    target_url TEXT,
    instructions TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_tasks_status_date ON public.agent_tasks(status, target_date ASC);

-- Enable RLS
ALTER TABLE public.agent_tasks ENABLE ROW LEVEL SECURITY;

-- Allow read & write for dashboard users
DROP POLICY IF EXISTS "Allow all users access to agent_tasks" ON public.agent_tasks;
CREATE POLICY "Allow all users access to agent_tasks"
    ON public.agent_tasks FOR ALL
    USING (true)
    WITH CHECK (true);
