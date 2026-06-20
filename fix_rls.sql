-- FIX RLS: Permitir acceso público (desarrollo)
-- Solo para desarrollo, mientras no hay Supabase Auth integrado

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_all" ON profiles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "chats_select_participant" ON chats;
DROP POLICY IF EXISTS "chats_insert_own" ON chats;
CREATE POLICY "chats_all" ON chats FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "messages_select_participant" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_all" ON messages FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "momentos_all" ON momentos FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "interest_news_select_all" ON interest_news;
DROP POLICY IF EXISTS "interest_news_insert_all" ON interest_news;
CREATE POLICY "interest_news_all" ON interest_news FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "product_items_select_all" ON product_items;
DROP POLICY IF EXISTS "product_items_insert_own" ON product_items;
DROP POLICY IF EXISTS "product_items_update_own" ON product_items;
CREATE POLICY "product_items_all" ON product_items FOR ALL USING (true) WITH CHECK (true);

-- También en tablas existentes sin políticas
CREATE POLICY "contacts_all" ON contacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "calls_all" ON calls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "encuestas_all" ON encuestas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "stickers_all" ON stickers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "story_views_all" ON story_views FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "reactions_all" ON reactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "votos_all" ON votos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "stories_all" ON stories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "polls_all" ON polls FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "chat_participants_all" ON chat_participants FOR ALL USING (true) WITH CHECK (true);
