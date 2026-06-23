-- ═══════════════════════════════════════════════════════════════════════
-- RED ON — SCHEMA EXTENSIONS
-- Missing tables referenced by the frontend but not yet in the database.
-- Execute in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. STICKER PACKS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sticker_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE sticker_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sticker_packs_select_all" ON sticker_packs;
DROP POLICY IF EXISTS "sticker_packs_insert_own" ON sticker_packs;

CREATE POLICY "sticker_packs_select_all" ON sticker_packs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "sticker_packs_insert_own" ON sticker_packs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── 2. STICKERS ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id UUID NOT NULL REFERENCES sticker_packs(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stickers_select_all" ON stickers;
CREATE POLICY "stickers_select_all" ON stickers
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 3. MUSIC LIBRARY ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS music_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  duration INTEGER DEFAULT 0,
  file_url TEXT NOT NULL,
  cover_url TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE music_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "music_library_select_all" ON music_library;
CREATE POLICY "music_library_select_all" ON music_library
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 4. CALLS (history / audit log) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  caller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  callee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  call_type TEXT CHECK (call_type IN ('audio', 'video')) DEFAULT 'audio',
  status TEXT CHECK (status IN ('missed', 'answered', 'ended', 'rejected', 'cancelled')) DEFAULT 'ended',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration INTEGER DEFAULT 0
);

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "calls_select_participant" ON calls;
DROP POLICY IF EXISTS "calls_insert_own" ON calls;

CREATE POLICY "calls_select_participant" ON calls
  FOR SELECT USING (
    caller_id = auth.uid() OR callee_id = auth.uid()
  );

CREATE POLICY "calls_insert_own" ON calls
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── 5. ENCUESTAS (surveys / community polls) ────────────────────────

CREATE TABLE IF NOT EXISTS encuestas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  multiple_choice BOOLEAN DEFAULT false,
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE encuestas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "encuestas_select_all" ON encuestas;
DROP POLICY IF EXISTS "encuestas_insert_own" ON encuestas;

CREATE POLICY "encuestas_select_all" ON encuestas
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "encuestas_insert_own" ON encuestas
  FOR INSERT WITH CHECK (created_by = auth.uid());

-- ─── 6. POLL OPTIONS (choices within an encuesta) ────────────────────

CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encuesta_id UUID NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  image_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poll_options_select_all" ON poll_options;
CREATE POLICY "poll_options_select_all" ON poll_options
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 7. POLL VOTES (individual user votes) ──────────────────────────

CREATE TABLE IF NOT EXISTS poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  encuesta_id UUID NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, encuesta_id, option_id)
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poll_votes_insert_own" ON poll_votes;
DROP POLICY IF EXISTS "poll_votes_select_all" ON poll_votes;

CREATE POLICY "poll_votes_select_all" ON poll_votes
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "poll_votes_insert_own" ON poll_votes
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 8. INTEREST NEWS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS interest_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT '',
  source TEXT DEFAULT '',
  time TIMESTAMPTZ DEFAULT now(),
  likes INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE interest_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "interest_news_select_all" ON interest_news;
CREATE POLICY "interest_news_select_all" ON interest_news
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── 9. PRODUCT ITEMS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT DEFAULT '',
  sales_count INTEGER DEFAULT 0,
  image TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product_items_select_all" ON product_items;
DROP POLICY IF EXISTS "product_items_insert_own" ON product_items;

CREATE POLICY "product_items_select_all" ON product_items
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "product_items_insert_own" ON product_items
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 10. STORIES (24-hour stories) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  thumbnail TEXT DEFAULT '',
  text TEXT DEFAULT '',
  type TEXT CHECK (type IN ('image', 'video')) DEFAULT 'image',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '24 hours')
);

ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stories_select_all" ON stories;
DROP POLICY IF EXISTS "stories_insert_own" ON stories;
DROP POLICY IF EXISTS "stories_delete_own" ON stories;

CREATE POLICY "stories_select_all" ON stories
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "stories_insert_own" ON stories
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "stories_delete_own" ON stories
  FOR DELETE USING (user_id = auth.uid());

-- ─── 11. STORY VIEWS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS story_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "story_views_insert_own" ON story_views;
CREATE POLICY "story_views_insert_own" ON story_views
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── 12. PROFILE VISITS (emprendedor analytics) ──────────────────────

CREATE TABLE IF NOT EXISTS profile_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profile_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profile_visits_insert_own" ON profile_visits;
CREATE POLICY "profile_visits_insert_own" ON profile_visits
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── 13. LINK CLICKS (emprendedor analytics) ─────────────────────────

CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "link_clicks_insert_own" ON link_clicks;
CREATE POLICY "link_clicks_insert_own" ON link_clicks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── INDEXES ─────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_stickers_pack ON stickers(pack_id);
CREATE INDEX IF NOT EXISTS idx_music_category ON music_library(category);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON poll_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_encuesta ON poll_votes(encuesta_id);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
CREATE INDEX IF NOT EXISTS idx_profile_visits_profile ON profile_visits(profile_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_profile ON link_clicks(profile_id);

-- ═══════════════════════════════════════════════════════════════════════
-- VERIFICATION: List all tables and their row counts
-- Uncomment to run:
-- SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables ORDER BY tablename;
-- ═══════════════════════════════════════════════════════════════════════
