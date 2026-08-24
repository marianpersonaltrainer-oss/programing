-- Fase 1: sustituye la autorización legacy profiles.role/org_id por
-- memberships + capabilities, conservando el comportamiento de Programming.
--
-- Reversible: las políticas conservan sus nombres. El rollback consiste en
-- reaplicar únicamente las definiciones de políticas de
-- 20260629150000_pe2_structured_auth.sql y retirar
-- private.evo_has_active_membership(uuid).

create or replace function private.evo_has_active_membership(
  target_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.evo_memberships memberships
      where memberships.user_id = (select auth.uid())
        and memberships.organization_id = target_organization_id
        and memberships.status = 'active'
    );
$$;

revoke all on function private.evo_has_active_membership(uuid)
  from public, anon, authenticated;
grant execute on function private.evo_has_active_membership(uuid)
  to authenticated, service_role;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (private.evo_has_active_membership(id));

drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.evo_has_capability(org_id, 'programming.manage')
  );

drop policy if exists pe2_programmer_state_own on public.pe2_programmer_state;
create policy pe2_programmer_state_own
  on public.pe2_programmer_state
  for all
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.evo_has_capability(org_id, 'programming.manage')
  )
  with check (
    user_id = (select auth.uid())
    and private.evo_has_capability(org_id, 'programming.manage')
  );

drop policy if exists pe2_weeks_programmer_all on public.pe2_weeks;
create policy pe2_weeks_programmer_all
  on public.pe2_weeks
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_weeks_coach_select_published on public.pe2_weeks;
create policy pe2_weeks_coach_select_published
  on public.pe2_weeks
  for select
  to authenticated
  using (
    private.evo_has_capability(org_id, 'programming.read_published')
    and status = 'ready'
    and published_week_id is not null
  );

drop policy if exists pe2_class_types_programmer_all on public.pe2_class_types;
create policy pe2_class_types_programmer_all
  on public.pe2_class_types
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_exercises_programmer_all on public.pe2_exercises;
create policy pe2_exercises_programmer_all
  on public.pe2_exercises
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_sessions_programmer_all on public.pe2_sessions;
create policy pe2_sessions_programmer_all
  on public.pe2_sessions
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_blocks_programmer_all on public.pe2_blocks;
create policy pe2_blocks_programmer_all
  on public.pe2_blocks
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_block_items_programmer_all on public.pe2_block_items;
create policy pe2_block_items_programmer_all
  on public.pe2_block_items
  for all
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.manage'))
  with check (private.evo_has_capability(org_id, 'programming.manage'));

drop policy if exists pe2_sessions_coach_select_published on public.pe2_sessions;
create policy pe2_sessions_coach_select_published
  on public.pe2_sessions
  for select
  to authenticated
  using (
    private.evo_has_capability(org_id, 'programming.read_published')
    and exists (
      select 1
      from public.pe2_weeks weeks
      where weeks.id = pe2_sessions.week_id
        and weeks.status = 'ready'
        and weeks.published_week_id is not null
    )
  );

drop policy if exists pe2_blocks_coach_select_published on public.pe2_blocks;
create policy pe2_blocks_coach_select_published
  on public.pe2_blocks
  for select
  to authenticated
  using (
    private.evo_has_capability(org_id, 'programming.read_published')
    and exists (
      select 1
      from public.pe2_sessions sessions
      join public.pe2_weeks weeks on weeks.id = sessions.week_id
      where sessions.id = pe2_blocks.session_id
        and weeks.status = 'ready'
        and weeks.published_week_id is not null
    )
  );

drop policy if exists pe2_block_items_coach_select_published on public.pe2_block_items;
create policy pe2_block_items_coach_select_published
  on public.pe2_block_items
  for select
  to authenticated
  using (
    private.evo_has_capability(org_id, 'programming.read_published')
    and exists (
      select 1
      from public.pe2_blocks blocks
      join public.pe2_sessions sessions on sessions.id = blocks.session_id
      join public.pe2_weeks weeks on weeks.id = sessions.week_id
      where blocks.id = pe2_block_items.block_id
        and weeks.status = 'ready'
        and weeks.published_week_id is not null
    )
  );

drop policy if exists pe2_class_types_coach_select on public.pe2_class_types;
create policy pe2_class_types_coach_select
  on public.pe2_class_types
  for select
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.read_published'));

drop policy if exists pe2_exercises_coach_select on public.pe2_exercises;
create policy pe2_exercises_coach_select
  on public.pe2_exercises
  for select
  to authenticated
  using (private.evo_has_capability(org_id, 'programming.read_published'));

drop policy if exists shift_notes_insert_own on public.shift_notes;
create policy shift_notes_insert_own
  on public.shift_notes
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.evo_has_capability(org_id, 'coach.workspace.access')
  );

drop policy if exists shift_notes_select_authorized on public.shift_notes;
create policy shift_notes_select_authorized
  on public.shift_notes
  for select
  to authenticated
  using (
    (
      private.evo_has_capability(org_id, 'coach.workspace.access')
      and created_at >= (
        date_trunc('day', timezone('Europe/Madrid', now()))
        at time zone 'Europe/Madrid'
      )
      and created_at < (
        (date_trunc('day', timezone('Europe/Madrid', now())) + interval '1 day')
        at time zone 'Europe/Madrid'
      )
    )
    or private.evo_has_capability(org_id, 'programming.manage')
  );

drop policy if exists shift_protocol_logs_insert_own on public.shift_protocol_logs;
create policy shift_protocol_logs_insert_own
  on public.shift_protocol_logs
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and private.evo_has_capability(org_id, 'coach.workspace.access')
  );

drop policy if exists shift_protocol_logs_select_authorized on public.shift_protocol_logs;
create policy shift_protocol_logs_select_authorized
  on public.shift_protocol_logs
  for select
  to authenticated
  using (
    (
      user_id = (select auth.uid())
      and private.evo_has_capability(org_id, 'coach.workspace.access')
      and created_at >= (
        date_trunc('day', timezone('Europe/Madrid', now()))
        at time zone 'Europe/Madrid'
      )
      and created_at < (
        (date_trunc('day', timezone('Europe/Madrid', now())) + interval '1 day')
        at time zone 'Europe/Madrid'
      )
    )
    or private.evo_has_capability(org_id, 'programming.manage')
  );

comment on function private.evo_has_active_membership(uuid) is
  'Comprueba una membership EVO activa sin depender de profiles.role/org_id.';
