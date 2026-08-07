-- Mi Camino EVO / Nucleus EVO foundation
-- Safe to apply to staging first. No production data migration is included here.

create extension if not exists pgcrypto;

create or replace function public.mc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.mc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function public.mc_is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('coach','programmer','admin')
  );
$$;

create table if not exists public.mc_people (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete set null,
  wodbuster_user_id text,
  full_name text not null,
  email text,
  joined_at timestamptz,
  status text not null default 'active' check (status in ('active','paused','inactive')),
  agreed_weekly_frequency smallint check (agreed_weekly_frequency between 1 and 7),
  exposure_coach_id uuid references public.profiles(id) on delete set null,
  exposure_coach_count integer not null default 0,
  last_attended_at timestamptz,
  next_reserved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, wodbuster_user_id)
);

create or replace function public.mc_my_person_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id from public.mc_people p where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.mc_my_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.org_id from public.profiles p where p.id = auth.uid() limit 1),
    (select m.org_id from public.mc_people m where m.user_id = auth.uid() limit 1)
  );
$$;

create table if not exists public.mc_plan_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null,
  name text not null,
  kind text not null check (kind in ('journey_0_90','bridge_90_180','plan_b','resource_sequence')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, template_key)
);

create table if not exists public.mc_plan_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.mc_plan_templates(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  published_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists public.mc_enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  plan_version_id uuid references public.mc_plan_versions(id) on delete set null,
  journey_key text not null,
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  start_date date not null,
  target_end_date date,
  current_stage text,
  primary_barrier text,
  hypothesis_confirmed boolean,
  outcome_status text,
  completed_at timestamptz,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_enrollments_person_status_idx on public.mc_enrollments(person_id, status);

create table if not exists public.mc_checkins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  enrollment_id uuid references public.mc_enrollments(id) on delete cascade,
  period_key text not null,
  difficulty text check (difficulty in ('easy','adjusted','difficult')),
  energy text check (energy in ('low','normal','good')),
  maintain_next_week text check (maintain_next_week in ('yes','yes_plan_b','not_sure')),
  extra jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (person_id, period_key)
);

create table if not exists public.mc_observations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  enrollment_id uuid references public.mc_enrollments(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete restrict,
  checkpoint text not null check (checkpoint in ('first_class','week_2','day_30','day_60','week_11','manual')),
  categories text[] not null default '{}',
  note text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_plan_b_catalog (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_b_key text not null,
  name text not null,
  family text not null check (family in ('B1','B2','B3')),
  active boolean not null default true,
  level_min smallint not null default 1,
  level_max smallint not null default 3,
  duration_min smallint,
  equipment text[] not null default '{}',
  goal_tags text[] not null default '{}',
  stage_tags text[] not null default '{}',
  safety_exclusions text[] not null default '{}',
  instructions jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, plan_b_key, version)
);

create table if not exists public.mc_plan_b_activations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  enrollment_id uuid references public.mc_enrollments(id) on delete cascade,
  catalog_id uuid references public.mc_plan_b_catalog(id) on delete set null,
  trigger_reason text not null,
  trigger_source text not null default 'rules',
  status text not null default 'offered' check (status in ('offered','accepted','completed','dismissed','safety_blocked','expired')),
  offered_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.mc_resources (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  resource_key text not null,
  title text not null,
  resource_type text not null check (resource_type in ('card','guide','checkin','reflection','video','link')),
  active boolean not null default true,
  trigger_tags text[] not null default '{}',
  body jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, resource_key, version)
);

create table if not exists public.mc_resource_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  resource_id uuid not null references public.mc_resources(id) on delete cascade,
  enrollment_id uuid references public.mc_enrollments(id) on delete set null,
  status text not null default 'available' check (status in ('available','opened','completed','dismissed')),
  delivered_at timestamptz not null default now(),
  opened_at timestamptz,
  completed_at timestamptz,
  unique (person_id, resource_id, enrollment_id)
);

create table if not exists public.mc_milestone_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  milestone_key text not null,
  name text not null,
  category text not null check (category in ('continuity','evolution','community','special')),
  active boolean not null default true,
  trigger_type text not null check (trigger_type in ('attendance_count','journey_day','validated_unlock','manual','challenge')),
  trigger_config jsonb not null default '{}'::jsonb,
  requires_validation boolean not null default false,
  public_recognition boolean not null default true,
  priority smallint not null default 50,
  badge_art_key text,
  coach_copy text,
  customer_copy text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, milestone_key, version)
);

create table if not exists public.mc_milestone_awards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  milestone_definition_id uuid not null references public.mc_milestone_definitions(id) on delete restrict,
  status text not null default 'earned' check (status in ('earned','pending_validation','validated','celebrated','deferred','cancelled')),
  earned_at timestamptz not null default now(),
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz,
  celebrated_by uuid references public.profiles(id) on delete set null,
  celebrated_at timestamptz,
  evidence jsonb not null default '{}'::jsonb,
  unique (person_id, milestone_definition_id)
);

create table if not exists public.mc_coach_tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  task_type text not null check (task_type in ('first_class','quick_contact','checkpoint_review','milestone_recognition','unlock_validation','sensitive_review','manual')),
  assigned_coach_id uuid references public.profiles(id) on delete set null,
  assignment_reason text,
  due_at timestamptz,
  status text not null default 'open' check (status in ('open','accepted','completed','closed_with_incident','cancelled')),
  priority smallint not null default 50,
  briefing jsonb not null default '{}'::jsonb,
  recommended_action jsonb not null default '{}'::jsonb,
  outcome text,
  outcome_detail jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mc_coach_tasks_assigned_status_idx on public.mc_coach_tasks(assigned_coach_id, status, due_at);

create table if not exists public.mc_goal_cycles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.mc_people(id) on delete cascade,
  source_enrollment_id uuid references public.mc_enrollments(id) on delete set null,
  cycle_type text not null default 'bridge_90_180',
  goal_key text not null,
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  start_date date not null,
  target_end_date date,
  recommended_frequency smallint check (recommended_frequency between 1 and 7),
  current_action jsonb not null default '{}'::jsonb,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mc_challenges (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  challenge_key text not null,
  name text not null,
  challenge_type text not null check (challenge_type in ('personal','collective','teams')),
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  start_at timestamptz,
  end_at timestamptz,
  rules jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, challenge_key, version)
);

create table if not exists public.mc_challenge_progress (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  challenge_id uuid not null references public.mc_challenges(id) on delete cascade,
  person_id uuid references public.mc_people(id) on delete cascade,
  team_key text,
  progress numeric not null default 0,
  contribution numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (challenge_id, person_id, team_key)
);

create table if not exists public.mc_wodbuster_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_event_id text not null,
  event_type text not null,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  payload jsonb not null,
  processing_status text not null default 'pending' check (processing_status in ('pending','processed','ignored','failed')),
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
  raw jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (org_id, external_reservation_id)
);

create index if not exists mc_wodbuster_reservations_user_start_idx on public.mc_wodbuster_reservations(org_id, wodbuster_user_id, starts_at);

create table if not exists public.mc_wodbuster_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_attendance_id text not null,
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

create index if not exists mc_wodbuster_attendance_user_date_idx on public.mc_wodbuster_attendance(org_id, wodbuster_user_id, attended_at);

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

create table if not exists public.mc_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  setting_key text not null,
  value jsonb not null,
  version integer not null default 1,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (org_id, setting_key)
);

create table if not exists public.mc_audit_log (
  id bigserial primary key,
  org_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

-- Updated-at triggers
create trigger mc_people_touch before update on public.mc_people for each row execute function public.mc_touch_updated_at();
create trigger mc_plan_templates_touch before update on public.mc_plan_templates for each row execute function public.mc_touch_updated_at();
create trigger mc_enrollments_touch before update on public.mc_enrollments for each row execute function public.mc_touch_updated_at();
create trigger mc_plan_b_catalog_touch before update on public.mc_plan_b_catalog for each row execute function public.mc_touch_updated_at();
create trigger mc_resources_touch before update on public.mc_resources for each row execute function public.mc_touch_updated_at();
create trigger mc_milestone_definitions_touch before update on public.mc_milestone_definitions for each row execute function public.mc_touch_updated_at();
create trigger mc_coach_tasks_touch before update on public.mc_coach_tasks for each row execute function public.mc_touch_updated_at();
create trigger mc_goal_cycles_touch before update on public.mc_goal_cycles for each row execute function public.mc_touch_updated_at();
create trigger mc_challenges_touch before update on public.mc_challenges for each row execute function public.mc_touch_updated_at();
create trigger mc_challenge_progress_touch before update on public.mc_challenge_progress for each row execute function public.mc_touch_updated_at();
create trigger mc_sync_state_touch before update on public.mc_sync_state for each row execute function public.mc_touch_updated_at();

-- RLS
alter table public.mc_people enable row level security;
alter table public.mc_plan_templates enable row level security;
alter table public.mc_plan_versions enable row level security;
alter table public.mc_enrollments enable row level security;
alter table public.mc_checkins enable row level security;
alter table public.mc_observations enable row level security;
alter table public.mc_plan_b_catalog enable row level security;
alter table public.mc_plan_b_activations enable row level security;
alter table public.mc_resources enable row level security;
alter table public.mc_resource_deliveries enable row level security;
alter table public.mc_milestone_definitions enable row level security;
alter table public.mc_milestone_awards enable row level security;
alter table public.mc_coach_tasks enable row level security;
alter table public.mc_goal_cycles enable row level security;
alter table public.mc_challenges enable row level security;
alter table public.mc_challenge_progress enable row level security;
alter table public.mc_wodbuster_events enable row level security;
alter table public.mc_wodbuster_reservations enable row level security;
alter table public.mc_wodbuster_attendance enable row level security;
alter table public.mc_sync_state enable row level security;
alter table public.mc_settings enable row level security;
alter table public.mc_audit_log enable row level security;

-- Admin access to configuration and operational data.
create policy mc_people_admin_all on public.mc_people for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_templates_admin_all on public.mc_plan_templates for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_versions_admin_all on public.mc_plan_versions for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_enrollments_admin_all on public.mc_enrollments for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_checkins_admin_all on public.mc_checkins for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_observations_admin_all on public.mc_observations for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_plan_b_catalog_admin_all on public.mc_plan_b_catalog for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_plan_b_act_admin_all on public.mc_plan_b_activations for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_resources_admin_all on public.mc_resources for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_resource_deliveries_admin_all on public.mc_resource_deliveries for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_milestone_defs_admin_all on public.mc_milestone_definitions for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_milestone_awards_admin_all on public.mc_milestone_awards for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_coach_tasks_admin_all on public.mc_coach_tasks for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_goal_cycles_admin_all on public.mc_goal_cycles for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_challenges_admin_all on public.mc_challenges for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_challenge_progress_admin_all on public.mc_challenge_progress for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_wb_events_admin_all on public.mc_wodbuster_events for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_wb_res_admin_all on public.mc_wodbuster_reservations for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_wb_att_admin_all on public.mc_wodbuster_attendance for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_sync_admin_all on public.mc_sync_state for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_settings_admin_all on public.mc_settings for all to authenticated using (public.mc_is_admin()) with check (public.mc_is_admin());
create policy mc_audit_admin_read on public.mc_audit_log for select to authenticated using (public.mc_is_admin());

-- Customer: own experience only.
create policy mc_people_self_read on public.mc_people for select to authenticated using (user_id = auth.uid());
create policy mc_enrollments_self_read on public.mc_enrollments for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_checkins_self_read on public.mc_checkins for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_checkins_self_insert on public.mc_checkins for insert to authenticated with check (person_id = public.mc_my_person_id() and org_id = public.mc_my_org_id());
create policy mc_plan_b_act_self_read on public.mc_plan_b_activations for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_plan_b_act_self_update on public.mc_plan_b_activations for update to authenticated using (person_id = public.mc_my_person_id()) with check (person_id = public.mc_my_person_id());
create policy mc_resource_deliveries_self_read on public.mc_resource_deliveries for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_resource_deliveries_self_update on public.mc_resource_deliveries for update to authenticated using (person_id = public.mc_my_person_id()) with check (person_id = public.mc_my_person_id());
create policy mc_milestone_awards_self_read on public.mc_milestone_awards for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_goal_cycles_self_read on public.mc_goal_cycles for select to authenticated using (person_id = public.mc_my_person_id());
create policy mc_challenge_progress_self_read on public.mc_challenge_progress for select to authenticated using (person_id = public.mc_my_person_id());

-- Published configuration can be read by signed-in customers/coaches in the same org.
create policy mc_templates_org_read on public.mc_plan_templates for select to authenticated using (active and org_id = public.mc_my_org_id());
create policy mc_versions_published_read on public.mc_plan_versions for select to authenticated using (
  status = 'published' and exists (
    select 1 from public.mc_plan_templates t where t.id = template_id and t.org_id = public.mc_my_org_id()
  )
);
create policy mc_plan_b_catalog_org_read on public.mc_plan_b_catalog for select to authenticated using (active and org_id = public.mc_my_org_id());
create policy mc_resources_org_read on public.mc_resources for select to authenticated using (active and org_id = public.mc_my_org_id());
create policy mc_milestone_defs_org_read on public.mc_milestone_definitions for select to authenticated using (active and org_id = public.mc_my_org_id());
create policy mc_challenges_org_read on public.mc_challenges for select to authenticated using (status = 'active' and org_id = public.mc_my_org_id());
create policy mc_settings_org_read on public.mc_settings for select to authenticated using (org_id = public.mc_my_org_id());

-- Coaches see only assigned actionable tasks and may record the small outcome.
create policy mc_coach_tasks_assigned_read on public.mc_coach_tasks for select to authenticated using (assigned_coach_id = auth.uid() and public.mc_is_coach());
create policy mc_coach_tasks_assigned_update on public.mc_coach_tasks for update to authenticated using (assigned_coach_id = auth.uid() and public.mc_is_coach()) with check (assigned_coach_id = auth.uid() and public.mc_is_coach());
create policy mc_observations_coach_insert on public.mc_observations for insert to authenticated with check (coach_id = auth.uid() and org_id = public.mc_my_org_id() and public.mc_is_coach());
create policy mc_observations_coach_own_read on public.mc_observations for select to authenticated using (coach_id = auth.uid() and public.mc_is_coach());
create policy mc_milestone_awards_coach_read on public.mc_milestone_awards for select to authenticated using (public.mc_is_coach() and org_id = public.mc_my_org_id());
create policy mc_milestone_awards_coach_update on public.mc_milestone_awards for update to authenticated using (public.mc_is_coach() and org_id = public.mc_my_org_id()) with check (public.mc_is_coach() and org_id = public.mc_my_org_id());

-- Helpful customer state view. Security is still enforced by underlying RLS.
create or replace view public.mc_my_current_state
with (security_invoker = true)
as
select
  p.id as person_id,
  p.full_name,
  p.agreed_weekly_frequency,
  p.last_attended_at,
  p.next_reserved_at,
  e.id as enrollment_id,
  e.journey_key,
  e.current_stage,
  e.start_date,
  e.target_end_date,
  e.state
from public.mc_people p
left join lateral (
  select e1.* from public.mc_enrollments e1
  where e1.person_id = p.id and e1.status = 'active'
  order by e1.created_at desc
  limit 1
) e on true
where p.user_id = auth.uid();

grant select on public.mc_my_current_state to authenticated;
