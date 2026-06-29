-- Programación V2 Fase 1 — sesiones estructuradas, org/profiles, auth RLS.
-- Aditivo: no DROP/RENAME tablas existentes. Solo drop policy if exists + create.

-- ── Organización y perfiles (solo si no existen) ─────────────────────────────

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'coach',
  org_id uuid references public.organizations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists org_id uuid references public.organizations (id);
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- ── Helpers RLS V2 ───────────────────────────────────────────────────────────

create or replace function public.pe2_my_org()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from public.profiles where id = auth.uid();
$$;

create or replace function public.pe2_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

grant execute on function public.pe2_my_org() to authenticated;
grant execute on function public.pe2_my_role() to authenticated;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (id = public.pe2_my_org());

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ── Slot activo del programador (fuente única, no localStorage) ──────────────

create table if not exists public.pe2_programmer_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  mesociclo text not null default 'fuerza',
  semana integer not null default 1 check (semana >= 1),
  phase text,
  updated_at timestamptz not null default now()
);

create index if not exists pe2_programmer_state_org_idx
  on public.pe2_programmer_state (org_id);

alter table public.pe2_programmer_state enable row level security;

drop policy if exists pe2_programmer_state_own on public.pe2_programmer_state;
create policy pe2_programmer_state_own
  on public.pe2_programmer_state
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and org_id = public.pe2_my_org()
    and public.pe2_my_role() = 'programmer'
  )
  with check (
    user_id = auth.uid()
    and org_id = public.pe2_my_org()
    and public.pe2_my_role() = 'programmer'
  );

-- ── pe2_weeks: org_id + RLS por rol ─────────────────────────────────────────

alter table public.pe2_weeks add column if not exists org_id uuid references public.organizations (id);

create index if not exists pe2_weeks_org_slot_idx
  on public.pe2_weeks (org_id, mesociclo, semana, updated_at desc);

drop policy if exists pe2_weeks_select_anon on public.pe2_weeks;
drop policy if exists pe2_weeks_insert_anon on public.pe2_weeks;
drop policy if exists pe2_weeks_update_anon on public.pe2_weeks;
drop policy if exists pe2_weeks_delete_anon on public.pe2_weeks;

drop policy if exists pe2_weeks_programmer_all on public.pe2_weeks;
create policy pe2_weeks_programmer_all
  on public.pe2_weeks
  for all
  to authenticated
  using (
    public.pe2_my_role() = 'programmer'
    and org_id = public.pe2_my_org()
  )
  with check (
    public.pe2_my_role() = 'programmer'
    and org_id = public.pe2_my_org()
  );

drop policy if exists pe2_weeks_coach_select_published on public.pe2_weeks;
create policy pe2_weeks_coach_select_published
  on public.pe2_weeks
  for select
  to authenticated
  using (
    public.pe2_my_role() = 'coach'
    and org_id = public.pe2_my_org()
    and status = 'ready'
    and published_week_id is not null
  );

-- ── Catálogo (contexto IA, no motor de reglas) ───────────────────────────────

create table if not exists public.pe2_class_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  slug text not null,
  label text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  dna jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (org_id, slug)
);

create table if not exists public.pe2_exercises (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id),
  name text not null,
  aliases text[] not null default '{}',
  pattern text check (pattern in ('squat', 'hinge', 'push', 'pull', 'core', 'full')),
  equipment text[] not null default '{}',
  video_url text,
  cues text,
  created_at timestamptz not null default now()
);

create index if not exists pe2_exercises_org_name_idx
  on public.pe2_exercises (org_id, name);

-- ── Sesiones estructuradas ───────────────────────────────────────────────────

create table if not exists public.pe2_sessions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.pe2_weeks (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  class_type_id uuid not null references public.pe2_class_types (id),
  weekday smallint not null check (weekday between 1 and 6),
  parent_session_id uuid references public.pe2_sessions (id) on delete set null,
  title text not null default '',
  objective text,
  dominant_pattern text,
  briefing text,
  est_minutes integer,
  status text not null default 'empty'
    check (status in ('empty', 'ai_draft', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pe2_sessions_mother_slot
  on public.pe2_sessions (week_id, class_type_id, weekday)
  where parent_session_id is null;

create index if not exists pe2_sessions_week_idx
  on public.pe2_sessions (week_id, weekday, class_type_id);

create table if not exists public.pe2_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.pe2_sessions (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  kind text not null check (kind in ('warmup', 'A', 'B', 'C')),
  name text not null default '',
  dose text,
  duration_min integer,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pe2_blocks_session_idx
  on public.pe2_blocks (session_id, sort_order);

create table if not exists public.pe2_block_items (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references public.pe2_blocks (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  exercise_ref uuid references public.pe2_exercises (id) on delete set null,
  raw_text text not null default '',
  prescription text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists pe2_block_items_block_idx
  on public.pe2_block_items (block_id, sort_order);

-- updated_at en sesiones
create or replace function public.pe2_sessions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pe2_sessions_set_updated_at on public.pe2_sessions;
create trigger pe2_sessions_set_updated_at
  before update on public.pe2_sessions
  for each row
  execute function public.pe2_sessions_set_updated_at();

-- ── RLS pe2_* por rol ────────────────────────────────────────────────────────

alter table public.pe2_class_types enable row level security;
alter table public.pe2_exercises enable row level security;
alter table public.pe2_sessions enable row level security;
alter table public.pe2_blocks enable row level security;
alter table public.pe2_block_items enable row level security;

-- programmer CRUD
drop policy if exists pe2_class_types_programmer_all on public.pe2_class_types;
create policy pe2_class_types_programmer_all on public.pe2_class_types for all to authenticated
  using (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org())
  with check (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org());

drop policy if exists pe2_exercises_programmer_all on public.pe2_exercises;
create policy pe2_exercises_programmer_all on public.pe2_exercises for all to authenticated
  using (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org())
  with check (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org());

drop policy if exists pe2_sessions_programmer_all on public.pe2_sessions;
create policy pe2_sessions_programmer_all on public.pe2_sessions for all to authenticated
  using (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org())
  with check (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org());

drop policy if exists pe2_blocks_programmer_all on public.pe2_blocks;
create policy pe2_blocks_programmer_all on public.pe2_blocks for all to authenticated
  using (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org())
  with check (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org());

drop policy if exists pe2_block_items_programmer_all on public.pe2_block_items;
create policy pe2_block_items_programmer_all on public.pe2_block_items for all to authenticated
  using (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org())
  with check (public.pe2_my_role() = 'programmer' and org_id = public.pe2_my_org());

-- coach SELECT preparado (solo semanas publicadas al Hub)
drop policy if exists pe2_sessions_coach_select_published on public.pe2_sessions;
create policy pe2_sessions_coach_select_published on public.pe2_sessions for select to authenticated
  using (
    public.pe2_my_role() = 'coach'
    and org_id = public.pe2_my_org()
    and exists (
      select 1 from public.pe2_weeks w
      where w.id = pe2_sessions.week_id
        and w.status = 'ready'
        and w.published_week_id is not null
    )
  );

drop policy if exists pe2_blocks_coach_select_published on public.pe2_blocks;
create policy pe2_blocks_coach_select_published on public.pe2_blocks for select to authenticated
  using (
    public.pe2_my_role() = 'coach'
    and org_id = public.pe2_my_org()
    and exists (
      select 1 from public.pe2_sessions s
      join public.pe2_weeks w on w.id = s.week_id
      where s.id = pe2_blocks.session_id
        and w.status = 'ready'
        and w.published_week_id is not null
    )
  );

drop policy if exists pe2_block_items_coach_select_published on public.pe2_block_items;
create policy pe2_block_items_coach_select_published on public.pe2_block_items for select to authenticated
  using (
    public.pe2_my_role() = 'coach'
    and org_id = public.pe2_my_org()
    and exists (
      select 1 from public.pe2_blocks b
      join public.pe2_sessions s on s.id = b.session_id
      join public.pe2_weeks w on w.id = s.week_id
      where b.id = pe2_block_items.block_id
        and w.status = 'ready'
        and w.published_week_id is not null
    )
  );

drop policy if exists pe2_class_types_coach_select on public.pe2_class_types;
create policy pe2_class_types_coach_select on public.pe2_class_types for select to authenticated
  using (public.pe2_my_role() = 'coach' and org_id = public.pe2_my_org());

drop policy if exists pe2_exercises_coach_select on public.pe2_exercises;
create policy pe2_exercises_coach_select on public.pe2_exercises for select to authenticated
  using (public.pe2_my_role() = 'coach' and org_id = public.pe2_my_org());
