-- Migration: Add push_tokens table for FCM push notification tokens
-- Tokens persist in Postgres (not SQLite) so they survive Render deploys

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device TEXT DEFAULT 'android-fcm',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, token)
);

-- Secure: users can only read/insert their own tokens
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own push token"
  ON public.push_tokens FOR INSERT
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can read their own push token"
  ON public.push_tokens FOR SELECT
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can delete their own push token"
  ON public.push_tokens FOR DELETE
  USING (auth.uid() = profile_id);

-- Index for fast lookup by profile_id
CREATE INDEX IF NOT EXISTS idx_push_tokens_profile ON public.push_tokens(profile_id);
