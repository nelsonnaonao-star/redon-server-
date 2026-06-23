-- =============================================================
-- Migration: Crear tablas profile_visits y link_clicks
-- Ejecutar en la consola SQL de Supabase (SQL Editor)
-- =============================================================

-- 1. Tabla de visitas al perfil
CREATE TABLE IF NOT EXISTS profile_visits (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visitor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas rápidas por perfil
CREATE INDEX IF NOT EXISTS idx_profile_visits_profile_id ON profile_visits(profile_id);

-- Seguridad: solo lectura de conteos, inserción desde el cliente autenticado
ALTER TABLE profile_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera autenticado puede insertar visitas"
  ON profile_visits FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Cada usuario puede ver sus propias visitas"
  ON profile_visits FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- 2. Tabla de clics en enlaces
CREATE TABLE IF NOT EXISTS link_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  link_url TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_profile_id ON link_clicks(profile_id);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera autenticado puede insertar clics"
  ON link_clicks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Cada usuario puede ver sus propios clics"
  ON link_clicks FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());
