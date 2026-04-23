-- ============================================================
-- VROUM.IO — Supabase Schema
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profils utilisateurs (miroir de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Voitures
CREATE TABLE IF NOT EXISTS public.cars (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text,
  brand       text NOT NULL,
  model       text NOT NULL,
  year        text,
  color       text DEFAULT 'autre',
  plate       text,
  fuel_type   text DEFAULT 'Essence',
  initial_km  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Membres d'une voiture (partage)
CREATE TABLE IF NOT EXISTS public.car_members (
  car_id      uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'member', -- 'owner' | 'member'
  invited_by  uuid REFERENCES auth.users(id),
  joined_at   timestamptz DEFAULT now(),
  PRIMARY KEY (car_id, user_id)
);

-- Historique kilométrage
CREATE TABLE IF NOT EXISTS public.km_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id      uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  km          integer NOT NULL,
  note        text DEFAULT '',
  date        date NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- Entretiens
CREATE TABLE IF NOT EXISTS public.maintenance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id      uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  type        text NOT NULL,
  description text DEFAULT '',
  date        date NOT NULL,
  km          integer DEFAULT 0,
  cost        numeric DEFAULT 0,
  next_km     integer DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Pleins
CREATE TABLE IF NOT EXISTS public.fuels (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id          uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  date            date NOT NULL,
  liters          numeric NOT NULL,
  price_per_liter numeric DEFAULT 0,
  total_price     numeric DEFAULT 0,
  km              integer DEFAULT 0,
  consumption     numeric DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- Trajets
CREATE TABLE IF NOT EXISTS public.trips (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id      uuid REFERENCES public.cars(id) ON DELETE SET NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  name        text DEFAULT 'Trajet',
  date        date NOT NULL,
  duration    integer DEFAULT 0,    -- secondes
  distance    numeric DEFAULT 0,    -- km
  start_km    integer DEFAULT 0,
  end_km      integer DEFAULT 0,
  avg_speed   numeric DEFAULT 0,
  max_speed   numeric DEFAULT 0,
  route       jsonb DEFAULT '[]',   -- [[lat, lng, timestamp], ...]
  notes       text DEFAULT '',
  manual      boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

-- Notes / Observations
CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  car_id      uuid NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id),
  date        date NOT NULL,
  text        text NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.km_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes       ENABLE ROW LEVEL SECURITY;

-- Helpers: est-ce que l'utilisateur est membre de cette voiture ?
CREATE OR REPLACE FUNCTION public.is_car_member(p_car_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.car_members
    WHERE car_id = p_car_id AND user_id = auth.uid()
  );
$$;

-- Profiles
CREATE POLICY "profiles_own" ON public.profiles
  FOR ALL USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_read_members" ON public.profiles
  FOR SELECT USING (true); -- les usernames sont visibles pour les invitations

-- Cars: visible si membre
CREATE POLICY "cars_member_select" ON public.cars
  FOR SELECT USING (public.is_car_member(id));

CREATE POLICY "cars_owner_insert" ON public.cars
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "cars_owner_update" ON public.cars
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "cars_owner_delete" ON public.cars
  FOR DELETE USING (owner_id = auth.uid());

-- Car members
CREATE POLICY "car_members_select" ON public.car_members
  FOR SELECT USING (public.is_car_member(car_id));

CREATE POLICY "car_members_owner_insert" ON public.car_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.cars WHERE id = car_id AND owner_id = auth.uid())
    OR user_id = auth.uid() -- auto-insert lors de la création
  );

CREATE POLICY "car_members_owner_delete" ON public.car_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.cars WHERE id = car_id AND owner_id = auth.uid())
    OR user_id = auth.uid() -- se retirer soi-même
  );

-- Km history, maintenance, fuels, notes, trips : visibles aux membres de la voiture
CREATE POLICY "km_history_member" ON public.km_history
  FOR ALL USING (public.is_car_member(car_id)) WITH CHECK (public.is_car_member(car_id));

CREATE POLICY "maintenance_member" ON public.maintenance
  FOR ALL USING (public.is_car_member(car_id)) WITH CHECK (public.is_car_member(car_id));

CREATE POLICY "fuels_member" ON public.fuels
  FOR ALL USING (public.is_car_member(car_id)) WITH CHECK (public.is_car_member(car_id));

CREATE POLICY "notes_member" ON public.notes
  FOR ALL USING (public.is_car_member(car_id)) WITH CHECK (public.is_car_member(car_id));

-- Trips: visibles au propriétaire du trajet OU aux membres de la voiture
CREATE POLICY "trips_select" ON public.trips
  FOR SELECT USING (
    user_id = auth.uid()
    OR (car_id IS NOT NULL AND public.is_car_member(car_id))
  );

CREATE POLICY "trips_insert" ON public.trips
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "trips_delete" ON public.trips
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- TRIGGER : auto-créer le profil + s'ajouter comme owner
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger : quand une voiture est créée, ajouter le créateur comme owner
CREATE OR REPLACE FUNCTION public.handle_new_car()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.car_members (car_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_car_created ON public.cars;
CREATE TRIGGER on_car_created
  AFTER INSERT ON public.cars
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_car();
