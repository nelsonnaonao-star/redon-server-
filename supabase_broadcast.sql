-- ─── Broadcast Channels (Listas de Difusión) ───────────────────────
-- Run this SQL in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS broadcast_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  admin_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_subscribers (
  channel_id UUID REFERENCES broadcast_channels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  subscribed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS broadcast_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES broadcast_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE broadcast_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_messages ENABLE ROW LEVEL SECURITY;

-- Channels: authenticated users can read all (for discovery)
DROP POLICY IF EXISTS "broadcast_channels_select" ON broadcast_channels;
CREATE POLICY "broadcast_channels_select" ON broadcast_channels
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "broadcast_channels_insert" ON broadcast_channels;
CREATE POLICY "broadcast_channels_insert" ON broadcast_channels
  FOR INSERT WITH CHECK (auth.uid() = admin_id);

-- Subscribers: users manage their own subscriptions
DROP POLICY IF EXISTS "broadcast_subscribers_select" ON broadcast_subscribers;
CREATE POLICY "broadcast_subscribers_select" ON broadcast_subscribers
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "broadcast_subscribers_insert" ON broadcast_subscribers;
CREATE POLICY "broadcast_subscribers_insert" ON broadcast_subscribers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "broadcast_subscribers_delete" ON broadcast_subscribers;
CREATE POLICY "broadcast_subscribers_delete" ON broadcast_subscribers
  FOR DELETE USING (auth.uid() = user_id);

-- Messages: read if subscriber/admin, insert if admin
DROP POLICY IF EXISTS "broadcast_messages_select" ON broadcast_messages;
CREATE POLICY "broadcast_messages_select" ON broadcast_messages
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (
      EXISTS (SELECT 1 FROM broadcast_subscribers WHERE channel_id = broadcast_messages.channel_id AND user_id = auth.uid())
      OR
      EXISTS (SELECT 1 FROM broadcast_channels WHERE id = broadcast_messages.channel_id AND admin_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "broadcast_messages_insert" ON broadcast_messages;
CREATE POLICY "broadcast_messages_insert" ON broadcast_messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM broadcast_channels WHERE id = channel_id AND admin_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_broadcast_subscribers_user ON broadcast_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_subscribers_channel ON broadcast_subscribers(channel_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_messages_channel ON broadcast_messages(channel_id);
