create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  handle text unique not null,
  display_name text not null,
  bio text default '',
  visibility text not null default 'public' check (visibility in ('private', 'followers', 'public')),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  brand text not null,
  model text not null,
  year integer,
  plate text,
  fuel_type text,
  odometer integer not null default 0,
  color text,
  notes text default '',
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.vehicle_members (
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer', 'editor', 'owner')),
  primary key (vehicle_id, user_id)
);

create table if not exists public.trip_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  trip_date date not null,
  route_type text default '',
  start_km integer not null,
  end_km integer not null,
  distance_km numeric generated always as (greatest(end_km - start_km, 0)) stored,
  duration_min integer default 0,
  note text default '',
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  fuel_date date not null,
  odometer integer not null,
  quantity numeric not null,
  unit_price numeric not null,
  total_price numeric not null,
  energy_type text not null,
  station text default '',
  is_full boolean not null default true,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  maintenance_date date not null,
  odometer integer not null,
  maintenance_type text not null,
  cost numeric not null default 0,
  garage text default '',
  note text default '',
  next_due_km integer,
  next_due_date date,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.observations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  observed_at date not null,
  category text not null,
  title text not null,
  content text not null,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_profile_id)
);

create table if not exists public.vehicle_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, vehicle_id)
);

create or replace function public.is_vehicle_member(target_vehicle uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.vehicle_members vm
    where vm.vehicle_id = target_vehicle and vm.user_id = auth.uid()
  );
$$;

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_members enable row level security;
alter table public.trip_logs enable row level security;
alter table public.fuel_logs enable row level security;
alter table public.maintenance_logs enable row level security;
alter table public.observations enable row level security;
alter table public.user_follows enable row level security;
alter table public.vehicle_follows enable row level security;

create policy "profiles readable by visibility"
on public.profiles for select
using (
  visibility = 'public'
  or id = auth.uid()
  or (
    visibility = 'followers'
    and exists (
      select 1 from public.user_follows uf
      where uf.followed_profile_id = profiles.id and uf.follower_id = auth.uid()
    )
  )
);

create policy "profiles self manage"
on public.profiles for all
using (id = auth.uid())
with check (id = auth.uid());

create policy "vehicles readable by relationship"
on public.vehicles for select
using (
  visibility = 'public'
  or owner_id = auth.uid()
  or public.is_vehicle_member(id)
  or (
    visibility = 'followers'
    and exists (
      select 1 from public.vehicle_follows vf
      where vf.vehicle_id = vehicles.id and vf.follower_id = auth.uid()
    )
  )
);

create policy "vehicles insert by owner"
on public.vehicles for insert
with check (owner_id = auth.uid());

create policy "vehicles update by owner or editor"
on public.vehicles for update
using (owner_id = auth.uid() or public.is_vehicle_member(id))
with check (owner_id = auth.uid() or public.is_vehicle_member(id));

create policy "vehicle members readable by participants"
on public.vehicle_members for select
using (user_id = auth.uid() or public.is_vehicle_member(vehicle_id));

create policy "vehicle members managed by owner"
on public.vehicle_members for all
using (exists (select 1 from public.vehicles v where v.id = vehicle_members.vehicle_id and v.owner_id = auth.uid()))
with check (exists (select 1 from public.vehicles v where v.id = vehicle_members.vehicle_id and v.owner_id = auth.uid()));

create policy "trip logs readable by vehicle access"
on public.trip_logs for select
using (exists (select 1 from public.vehicles v where v.id = trip_logs.vehicle_id and (v.visibility = 'public' or v.owner_id = auth.uid() or public.is_vehicle_member(v.id))));

create policy "trip logs writable by owner or editor"
on public.trip_logs for all
using (author_id = auth.uid() or public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = trip_logs.vehicle_id and v.owner_id = auth.uid()))
with check (author_id = auth.uid() and (public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = trip_logs.vehicle_id and v.owner_id = auth.uid())));

create policy "fuel logs readable by vehicle access"
on public.fuel_logs for select
using (exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and (v.visibility = 'public' or v.owner_id = auth.uid() or public.is_vehicle_member(v.id))));

create policy "fuel logs writable by owner or editor"
on public.fuel_logs for all
using (author_id = auth.uid() or public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.owner_id = auth.uid()))
with check (author_id = auth.uid() and (public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = fuel_logs.vehicle_id and v.owner_id = auth.uid())));

create policy "maintenance logs readable by vehicle access"
on public.maintenance_logs for select
using (exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and (v.visibility = 'public' or v.owner_id = auth.uid() or public.is_vehicle_member(v.id))));

create policy "maintenance logs writable by owner or editor"
on public.maintenance_logs for all
using (author_id = auth.uid() or public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.owner_id = auth.uid()))
with check (author_id = auth.uid() and (public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = maintenance_logs.vehicle_id and v.owner_id = auth.uid())));

create policy "observations readable by vehicle access"
on public.observations for select
using (exists (select 1 from public.vehicles v where v.id = observations.vehicle_id and (v.visibility = 'public' or v.owner_id = auth.uid() or public.is_vehicle_member(v.id))));

create policy "observations writable by owner or editor"
on public.observations for all
using (author_id = auth.uid() or public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = observations.vehicle_id and v.owner_id = auth.uid()))
with check (author_id = auth.uid() and (public.is_vehicle_member(vehicle_id) or exists (select 1 from public.vehicles v where v.id = observations.vehicle_id and v.owner_id = auth.uid())));

create policy "user follows self manage"
on public.user_follows for all
using (follower_id = auth.uid())
with check (follower_id = auth.uid());

create policy "vehicle follows self manage"
on public.vehicle_follows for all
using (follower_id = auth.uid())
with check (follower_id = auth.uid());
