-- Migration: Add audio/voice-note columns, edit/delete columns, and RLS policy for messages

ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_duration REAL DEFAULT 0;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'audio/webm';

-- RLS policy: only the sender can update a message
-- (Drop first because Supabase uses PG <15 where IF NOT EXISTS is not supported)
DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE
  USING (auth.uid() = sender_id);
