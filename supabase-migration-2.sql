-- ============================================================
-- VROUM.IO — Migration 2 : adresses sur les trajets
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS start_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS end_address   TEXT DEFAULT '';
