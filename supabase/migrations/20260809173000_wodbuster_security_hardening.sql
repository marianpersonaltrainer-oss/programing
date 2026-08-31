-- Hardening/compatibility cleanup for staging environments that already had an early Mi Camino foundation.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.mc_shared_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

revoke all on function private.mc_shared_is_admin() from public, anon;
grant execute on function private.mc_shared_is_admin() to authenticated;

-- Remove broader legacy admin policies on the raw integration tables; ingestion uses service-role.
drop policy if exists mc_wb_events_admin_all on public.mc_wodbuster_events;
drop policy if exists mc_wb_res_admin_all on public.mc_wodbuster_reservations;
drop policy if exists mc_wb_att_admin_all on public.mc_wodbuster_attendance;
drop policy if exists mc_sync_admin_all on public.mc_sync_state;

-- Recreate one read-only admin policy per raw table.
drop policy if exists mc_shared_wb_events_admin_read on public.mc_wodbuster_events;
create policy mc_shared_wb_events_admin_read on public.mc_wodbuster_events
  for select to authenticated using (private.mc_shared_is_admin());

drop policy if exists mc_shared_wb_res_admin_read on public.mc_wodbuster_reservations;
create policy mc_shared_wb_res_admin_read on public.mc_wodbuster_reservations
  for select to authenticated using (private.mc_shared_is_admin());

drop policy if exists mc_shared_wb_att_admin_read on public.mc_wodbuster_attendance;
create policy mc_shared_wb_att_admin_read on public.mc_wodbuster_attendance
  for select to authenticated using (private.mc_shared_is_admin());

drop policy if exists mc_shared_wb_coach_admin_read on public.mc_wodbuster_coach_sessions;
create policy mc_shared_wb_coach_admin_read on public.mc_wodbuster_coach_sessions
  for select to authenticated using (private.mc_shared_is_admin());

drop policy if exists mc_shared_sync_admin_read on public.mc_sync_state;
create policy mc_shared_sync_admin_read on public.mc_sync_state
  for select to authenticated using (private.mc_shared_is_admin());

-- Early staging migration used shorter duplicate index names. Keep the canonical originals.
drop index if exists public.mc_wb_res_user_start_idx;
drop index if exists public.mc_wb_att_user_date_idx;
create index if not exists mc_wodbuster_reservations_user_start_idx
  on public.mc_wodbuster_reservations(org_id, wodbuster_user_id, starts_at);
create index if not exists mc_wodbuster_attendance_user_date_idx
  on public.mc_wodbuster_attendance(org_id, wodbuster_user_id, attended_at);

-- Remove only the temporary exposed helper created during pre-PR staging validation.
drop function if exists public.mc_shared_is_admin();
