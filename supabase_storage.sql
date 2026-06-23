-- ═══════════════════════════════════════════════════════════════
-- RED ON — SUPABASE STORAGE BUCKET + RLS
-- Run this AFTER creating the bucket via Dashboard or API.
--
-- How to create the bucket:
--   Option A: Supabase Dashboard → Storage → New bucket
--     Name: voice-notes
--     Public bucket: YES (uncheck "Restrict file uploads")
--
--   Option B: API (use service_role key):
--     curl -X POST https://akgsylutbpgolurkcavh.supabase.co/storage/v1/bucket \
--       -H "Authorization: Bearer <SUPABASE_SERVICE_KEY>" \
--       -H "Content-Type: application/json" \
--       -d '{"name":"voice-notes","public":true,"file_size_limit":10485760,"allowed_mime_types":["audio/webm","audio/mp4","audio/ogg","audio/mpeg","audio/wav"]}'
--
--   Option C: Node.js script:
--     node scripts/create-voice-notes-bucket.js
--
-- ═══════════════════════════════════════════════════════════════

-- ─── RLS ON storage.objects ─────────────────────────────────────
-- Enables row-level security for storage operations (uploads/delete via SDK).
-- Note: getPublicUrl() returns a URL that bypasses these policies.
-- If stricter security is needed, use signed URLs instead.

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to upload files to voice-notes
DROP POLICY IF EXISTS "voice_notes_insert_own" ON storage.objects;
CREATE POLICY "voice_notes_insert_own" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND auth.role() = 'authenticated'
  );

-- Allow authenticated users to read files in voice-notes (for download/play)
DROP POLICY IF EXISTS "voice_notes_select_all" ON storage.objects;
CREATE POLICY "voice_notes_select_all" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'voice-notes'
    AND auth.role() = 'authenticated'
  );

-- Allow owner to delete their own uploads (name starts with voice-{userId}-)
DROP POLICY IF EXISTS "voice_notes_delete_own" ON storage.objects;
CREATE POLICY "voice_notes_delete_own" ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'voice-notes'
    AND name LIKE 'voice-' || auth.uid() || '-%'
  );

-- Allow authenticated users to update files (same owner rule)
DROP POLICY IF EXISTS "voice_notes_update_own" ON storage.objects;
CREATE POLICY "voice_notes_update_own" ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'voice-notes'
    AND name LIKE 'voice-' || auth.uid() || '-%'
  );
