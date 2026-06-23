-- =============================================================
-- Migration: Agregar columna anim_meta a tabla momentos
-- Ejecutar en la consola SQL de Supabase (SQL Editor)
-- =============================================================

ALTER TABLE momentos ADD COLUMN IF NOT EXISTS anim_meta JSONB DEFAULT '{}'::jsonb;
