-- ============================================================
-- VROUM.IO — Migration 3 : waypoints sur les trajets
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT '[]'::jsonb;
