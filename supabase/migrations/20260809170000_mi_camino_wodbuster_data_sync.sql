-- Issue #16: shared, auditable WodBuster Data API mirror.
-- This migration contains data-ingestion infrastructure only; no Mi Camino UI/product tables.

create extension if not exists pgcrypto;

create or replace function public.mc_shared_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function public.mc_shared_is_admin() from public, anon;
grant execute on function public.mc_shared_is_admin() to authenticated;

create table if not exists public.mc_people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  wodbuster_user_id text,
  full_name text not null,
  email text,
  joined_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, wodbuster_user_id)
);

alter table public.mc_people
  add column if not exists wodbuster_user_id text,
  add column if not exists joined_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists mc_people_org_wodbuster_uidx
  on public.mc_people(org_id, wodbuster_user_id)
  where wodbuster_user_id is not null;

create table if not exists public.mc_wodbuster_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_event_id text not null,
  event_type text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'pending',
  processing_error text,
  processed_at timestamptz,
  unique (org_id, external_event_id)
);

create table if not exists public.mc_wodbuster_reservations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_reservation_id text not null,
  wodbuster_user_id text not null,
  external_class_id text,
  class_name text,
  coach_external_id text,
  coach_name text,
  starts_at timestamptz,
  status text not null,
  cancelled_at timestamptz,
  late_cancellation boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, external_reservation_id)
);

alter table public.mc_wodbuster_reservations
  add column if not exists cancelled_at timestamptz,
  add column if not exists late_cancellation boolean not null default false;

create table if not exists public.mc_wodbuster_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_attendance_id text not null,
  external_reservation_id text,
  wodbuster_user_id text not null,
  external_class_id text,
  class_name text,
  coach_external_id text,
  coach_name text,
  attended_at timestamptz not null,
  confirmed boolean not null default true,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, external_attendance_id)
);

alter table public.mc_wodbuster_attendance
  add column if not exists external_reservation_id text;

create table if not exists public.mc_wodbuster_coach_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_class_id text not null,
  coach_external_id text not null,
  coach_name text,
  class_name text,
  starts_at timestamptz,
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, external_class_id, coach_external_id)
);

create table if not exists public.mc_sync_state (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null,
  sync_key text not null,
  cursor text,
  last_started_at timestamptz,
  last_completed_at timestamptz,
  last_status text,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (org_id, source, sync_key)
);

create index if not exists mc_wb_res_user_start_idx
  on public.mc_wodbuster_reservations(org_id, wodbuster_user_id, starts_at);
create index if not exists mc_wb_res_status_start_idx
  on public.mc_wodbuster_reservations(org_id, status, starts_at);
create index if not exists mc_wb_att_user_date_idx
  on public.mc_wodbuster_attendance(org_id, wodbuster_user_id, attended_at);
create index if not exists mc_wb_coach_session_start_idx
  on public.mc_wodbuster_coach_sessions(org_id, starts_at, coach_external_id);
create index if not exists mc_wb_events_occurred_idx
  on public.mc_wodbuster_events(org_id, occurred_at);

alter table public.mc_people enable row level security;
alter table public.mc_wodbuster_events enable row level security;
alter table public.mc_wodbuster_reservations enable row level security;
alter table public.mc_wodbuster_attendance enable row level security;
alter table public.mc_wodbuster_coach_sessions enable row level security;
alter table public.mc_sync_state enable row level security;

-- Raw WodBuster mirrors are never available to anonymous users.
revoke all on table public.mc_wodbuster_events from anon;
revoke all on table public.mc_wodbuster_reservations from anon;
revoke all on table public.mc_wodbuster_attendance from anon;
revoke all on table public.mc_wodbuster_coach_sessions from anon;
revoke all on table public.mc_sync_state from anon;

-- Authenticated users need SELECT privilege for RLS to decide; only admins get rows here.
grant select on table public.mc_wodbuster_events to authenticated;
grant select on table public.mc_wodbuster_reservations to authenticated;
grant select on table public.mc_wodbuster_attendance to authenticated;
grant select on table public.mc_wodbuster_coach_sessions to authenticated;
grant select on table public.mc_sync_state to authenticated;

drop policy if exists mc_shared_wb_events_admin_read on public.mc_wodbuster_events;
create policy mc_shared_wb_events_admin_read on public.mc_wodbuster_events
  for select to authenticated using (public.mc_shared_is_admin());

drop policy if exists mc_shared_wb_res_admin_read on public.mc_wodbuster_reservations;
create policy mc_shared_wb_res_admin_read on public.mc_wodbuster_reservations
  for select to authenticated using (public.mc_shared_is_admin());

drop policy if exists mc_shared_wb_att_admin_read on public.mc_wodbuster_attendance;
create policy mc_shared_wb_att_admin_read on public.mc_wodbuster_attendance
  for select to authenticated using (public.mc_shared_is_admin());

drop policy if exists mc_shared_wb_coach_admin_read on public.mc_wodbuster_coach_sessions;
create policy mc_shared_wb_coach_admin_read on public.mc_wodbuster_coach_sessions
  for select to authenticated using (public.mc_shared_is_admin());

drop policy if exists mc_shared_sync_admin_read on public.mc_sync_state;
create policy mc_shared_sync_admin_read on public.mc_sync_state
  for select to authenticated using (public.mc_shared_is_admin());

comment on table public.mc_wodbuster_events is 'Server-side mirror/audit of WodBuster snapshots; never stores integration credentials.';
comment on table public.mc_wodbuster_reservations is 'Normalized reservation/cancel/no-show state from CuantoEntrenan.';
comment on table public.mc_wodbuster_attendance is 'Confirmed attendance only; reservation is never treated as attendance.';
comment on table public.mc_wodbuster_coach_sessions is 'Normalized class/coach sessions from CuantoEnsenan.';
comment on table public.mc_sync_state is 'Health and reconciliation state for shared external data sources.';
