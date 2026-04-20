create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  display_name text not null,
  handle text unique not null,
  bio text default '',
  visibility text not null default 'public' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app_users(id) on delete cascade,
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists vehicle_members (
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer', 'editor', 'owner')),
  created_at timestamptz not null default now(),
  primary key (vehicle_id, user_id)
);

create table if not exists trip_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  author_id uuid not null references app_users(id) on delete cascade,
  title text not null,
  trip_date date not null,
  route_type text default '',
  start_km integer not null,
  end_km integer not null,
  duration_min integer default 0,
  note text default '',
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  author_id uuid not null references app_users(id) on delete cascade,
  fuel_date date not null,
  odometer integer not null,
  quantity numeric(10,2) not null,
  unit_price numeric(10,3) not null,
  total_price numeric(10,2) not null,
  energy_type text not null,
  station text default '',
  is_full boolean not null default true,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  author_id uuid not null references app_users(id) on delete cascade,
  maintenance_date date not null,
  odometer integer not null,
  maintenance_type text not null,
  cost numeric(10,2) not null default 0,
  garage text default '',
  note text default '',
  next_due_km integer,
  next_due_date date,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists observations (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  author_id uuid not null references app_users(id) on delete cascade,
  observed_at date not null,
  category text not null,
  title text not null,
  content text not null,
  visibility text not null default 'private' check (visibility in ('private', 'followers', 'public')),
  created_at timestamptz not null default now()
);

create table if not exists user_follows (
  follower_id uuid not null references app_users(id) on delete cascade,
  followed_user_id uuid not null references app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_user_id)
);

create table if not exists vehicle_follows (
  follower_id uuid not null references app_users(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, vehicle_id)
);

create index if not exists idx_vehicles_owner_id on vehicles(owner_id);
create index if not exists idx_trip_logs_vehicle_id on trip_logs(vehicle_id);
create index if not exists idx_fuel_logs_vehicle_id on fuel_logs(vehicle_id);
create index if not exists idx_maintenance_logs_vehicle_id on maintenance_logs(vehicle_id);
create index if not exists idx_observations_vehicle_id on observations(vehicle_id);
