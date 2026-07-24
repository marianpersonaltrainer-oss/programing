-- Esquema legacy mínimo para staging vacío (sin datos de producción).
-- Tablas que existían antes del primer archivo en supabase/migrations/.
-- Solo shells + RLS básico anon; las migraciones del repo completan el resto.

create table if not exists public.published_weeks (
  id uuid primary key default gen_random_uuid(),
  mesociclo text not null,
  semana integer not null,
  titulo text not null default '',
  data jsonb not null default '{}'::jsonb,
  is_active boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.published_weeks enable row level security;

drop policy if exists published_weeks_select_anon on public.published_weeks;
create policy published_weeks_select_anon on public.published_weeks for select to anon, authenticated using (true);

drop policy if exists published_weeks_insert_anon on public.published_weeks;
create policy published_weeks_insert_anon on public.published_weeks for insert to anon, authenticated with check (true);

drop policy if exists published_weeks_update_anon on public.published_weeks;
create policy published_weeks_update_anon on public.published_weeks for update to anon, authenticated using (true) with check (true);

create table if not exists public.coach_session_feedback (
  id uuid primary key default gen_random_uuid(),
  week_id uuid references public.published_weeks (id) on delete cascade,
  coach_name text,
  class_name text,
  feedback text,
  created_at timestamptz not null default now()
);

alter table public.coach_session_feedback enable row level security;

drop policy if exists coach_session_feedback_insert_anon on public.coach_session_feedback;
create policy coach_session_feedback_insert_anon on public.coach_session_feedback for insert to anon with check (true);

-- Referenciada por migraciones 20260417145500 antes de 20260629150000_pe2_structured_auth.sql
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'coach',
  org_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
