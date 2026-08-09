-- Issue #16: auditable WodBuster Data API mirror and reconciliation support.
alter table public.mc_wodbuster_reservations
  add column if not exists cancelled_at timestamptz,
  add column if not exists late_cancellation boolean not null default false;

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

create index if not exists mc_wb_coach_session_start_idx
  on public.mc_wodbuster_coach_sessions(org_id, starts_at, coach_external_id);

alter table public.mc_wodbuster_coach_sessions enable row level security;
revoke all on table public.mc_wodbuster_coach_sessions from anon, authenticated;

-- Service role owns ingestion. Admins get an explicit read-only health/audit view.
grant select on table public.mc_wodbuster_coach_sessions to authenticated;
create policy mc_wb_coach_sessions_admin_read on public.mc_wodbuster_coach_sessions
  for select to authenticated using (public.mc_is_admin());

create index if not exists mc_wb_res_status_start_idx
  on public.mc_wodbuster_reservations(org_id, status, starts_at);

comment on table public.mc_wodbuster_coach_sessions is
  'Server-only mirror of CuantoEnsenan; raw contains no integration credential.';
