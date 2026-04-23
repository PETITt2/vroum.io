-- ============================================================
-- VROUM.IO — Migration : contrainte unique sur username
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- 1. Ajouter la contrainte unique sur username
--    (évite que deux utilisateurs aient le même pseudo → nécessaire pour l'invitation par pseudo)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- 2. Mettre à jour le trigger de création de compte
--    pour s'assurer que le username est bien stocké
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 3. Permettre à tout utilisateur connecté de lire les profils
--    (nécessaire pour la recherche par pseudo lors d'une invitation)
DROP POLICY IF EXISTS "profiles_read_members" ON public.profiles;
CREATE POLICY "profiles_read_all_authenticated" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- 4. Permettre à l'utilisateur de modifier son propre profil
DROP POLICY IF EXISTS "profiles_own" ON public.profiles;
CREATE POLICY "profiles_own_all" ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ============================================================
-- VÉRIFICATION : affiche les profils existants
-- ============================================================
-- SELECT id, username FROM public.profiles ORDER BY username;
