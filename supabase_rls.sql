-- ═══════════════════════════════════════════════════════════════
-- RED ON — SUPABASE RLS POLICIES (PRODUCTION)
-- Replace fix_rls.sql with proper auth.uid() row-level security.
-- Execute this in the Supabase SQL Editor (one block at a time
-- if a table doesn't exist yet).
-- ═══════════════════════════════════════════════════════════════

-- ─── PROFILES ─────────────────────────────────────────────────
-- All authenticated users can SEARCH profiles (needed for "add contact").
-- Only the owner can INSERT/UPDATE/DELETE their own row.

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_delete_own" ON profiles
  FOR DELETE USING (id = auth.uid());

-- ─── CHATS ─────────────────────────────────────────────────────
-- User can SELECT only chats they participate in.
-- Any authenticated user can INSERT a new chat.

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_select_participant" ON chats;
DROP POLICY IF EXISTS "chats_insert_all" ON chats;
DROP POLICY IF EXISTS "chats_update_own" ON chats;

CREATE POLICY "chats_select_participant" ON chats
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = chats.id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "chats_insert_all" ON chats
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── CHAT PARTICIPANTS ─────────────────────────────────────────
-- User sees own participations. Can insert rows containing own ID.

ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_participants_select_own" ON chat_participants;
DROP POLICY IF EXISTS "chat_participants_insert_own" ON chat_participants;

CREATE POLICY "chat_participants_select_own" ON chat_participants
  FOR SELECT USING (profile_id = auth.uid());

CREATE POLICY "chat_participants_insert_own" ON chat_participants
  FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ─── MESSAGES ──────────────────────────────────────────────────
-- SELECT only if user is a participant in the chat.
-- INSERT only as yourself (sender_id = auth.uid()).

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;

CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants
      WHERE chat_id = messages.chat_id AND profile_id = auth.uid()
    )
  );

CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- ─── CONTACTS ──────────────────────────────────────────────────
-- User manages own contact list only.

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_select_own" ON contacts;
DROP POLICY IF EXISTS "contacts_insert_own" ON contacts;
DROP POLICY IF EXISTS "contacts_delete_own" ON contacts;

CREATE POLICY "contacts_select_own" ON contacts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "contacts_insert_own" ON contacts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "contacts_delete_own" ON contacts
  FOR DELETE USING (user_id = auth.uid());

-- ─── MOMENTOS (Stories) ────────────────────────────────────────
-- Public read for authenticated users (like social stories).
-- Owner manages their own momentos.

ALTER TABLE momentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "momentos_select_all" ON momentos;
DROP POLICY IF EXISTS "momentos_insert_own" ON momentos;
DROP POLICY IF EXISTS "momentos_update_own" ON momentos;
DROP POLICY IF EXISTS "momentos_delete_own" ON momentos;

CREATE POLICY "momentos_select_all" ON momentos
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "momentos_insert_own" ON momentos
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "momentos_update_own" ON momentos
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "momentos_delete_own" ON momentos
  FOR DELETE USING (user_id = auth.uid());

-- ─── MOMENTO VIEWS ─────────────────────────────────────────────
-- Insert your own views. View count is aggregated server-side.

ALTER TABLE momento_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "momento_views_insert_own" ON momento_views;

CREATE POLICY "momento_views_select_all" ON momento_views
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "momento_views_insert_own" ON momento_views
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ─── MOMENTO REACTIONS ─────────────────────────────────────────
-- Manage your own reactions.

ALTER TABLE momento_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "momento_reactions_select_all" ON momento_reactions;
DROP POLICY IF EXISTS "momento_reactions_insert_own" ON momento_reactions;
DROP POLICY IF EXISTS "momento_reactions_update_own" ON momento_reactions;
DROP POLICY IF EXISTS "momento_reactions_delete_own" ON momento_reactions;

CREATE POLICY "momento_reactions_select_all" ON momento_reactions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "momento_reactions_insert_own" ON momento_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "momento_reactions_update_own" ON momento_reactions
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "momento_reactions_delete_own" ON momento_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ─── BUSINESSES ────────────────────────────────────────────────
-- Public read. Owner inserts/updates/deletes.

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "businesses_select_all" ON businesses;
DROP POLICY IF EXISTS "businesses_insert_own" ON businesses;
DROP POLICY IF EXISTS "businesses_update_own" ON businesses;
DROP POLICY IF EXISTS "businesses_delete_own" ON businesses;

CREATE POLICY "businesses_select_all" ON businesses
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "businesses_insert_own" ON businesses
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "businesses_update_own" ON businesses
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "businesses_delete_own" ON businesses
  FOR DELETE USING (user_id = auth.uid());

-- ─── CALLS (call history) ─────────────────────────────────────
-- Participants see their own calls.

ALTER TABLE calls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "calls_select_participant" ON calls;
DROP POLICY IF EXISTS "calls_insert_own" ON calls;

CREATE POLICY "calls_select_participant" ON calls
  FOR SELECT USING (
    caller_id = auth.uid() OR callee_id = auth.uid()
  );

CREATE POLICY "calls_insert_own" ON calls
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ─── OPTIONAL TABLES (create if they exist) ────────────────────
-- Each block is wrapped in DO $$ ... EXCEPTION handlers so it
-- won't fail if the table doesn't exist yet.

DO $$ BEGIN
  ALTER TABLE IF EXISTS interest_news ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "interest_news_select_all" ON interest_news;
  CREATE POLICY "interest_news_select_all" ON interest_news
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS product_items ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "product_items_select_all" ON product_items;
  CREATE POLICY "product_items_select_all" ON product_items
    FOR SELECT USING (auth.role() = 'authenticated');
  DROP POLICY IF EXISTS "product_items_insert_own" ON product_items;
  CREATE POLICY "product_items_insert_own" ON product_items
    FOR INSERT WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS encuestas ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "encuestas_select_all" ON encuestas;
  CREATE POLICY "encuestas_select_all" ON encuestas
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS stickers ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "stickers_select_all" ON stickers;
  CREATE POLICY "stickers_select_all" ON stickers
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS sticker_packs ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "sticker_packs_select_all" ON sticker_packs;
  CREATE POLICY "sticker_packs_select_all" ON sticker_packs
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE IF EXISTS music_library ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "music_library_select_all" ON music_library;
  CREATE POLICY "music_library_select_all" ON music_library
    FOR SELECT USING (auth.role() = 'authenticated');
EXCEPTION WHEN undefined_table THEN null;
END $$;
