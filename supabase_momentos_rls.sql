-- RLS policies for momentos table
ALTER TABLE momentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "momentos_insert_own" ON momentos;
DROP POLICY IF EXISTS "momentos_select_all" ON momentos;
DROP POLICY IF EXISTS "momentos_delete_own" ON momentos;

CREATE POLICY "momentos_insert_own" ON momentos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "momentos_select_all" ON momentos
  FOR SELECT USING (true);

CREATE POLICY "momentos_delete_own" ON momentos
  FOR DELETE USING (auth.uid() = user_id);
