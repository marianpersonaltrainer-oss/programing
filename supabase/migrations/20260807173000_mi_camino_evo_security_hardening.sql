-- Mi Camino EVO security hardening after staging advisor pass.

create or replace function public.mc_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Helper functions are used by authenticated RLS policies. They must never be callable by anon/public.
revoke all on function public.mc_is_admin() from public, anon;
revoke all on function public.mc_is_coach() from public, anon;
revoke all on function public.mc_my_org_id() from public, anon;
revoke all on function public.mc_my_person_id() from public, anon;

grant execute on function public.mc_is_admin() to authenticated;
grant execute on function public.mc_is_coach() to authenticated;
grant execute on function public.mc_my_org_id() to authenticated;
grant execute on function public.mc_my_person_id() to authenticated;

-- Mi Camino has no anonymous customer-data surface. Public access always begins at Supabase Auth.
revoke all on table public.mc_people from anon;
revoke all on table public.mc_plan_templates from anon;
revoke all on table public.mc_plan_versions from anon;
revoke all on table public.mc_enrollments from anon;
revoke all on table public.mc_checkins from anon;
revoke all on table public.mc_observations from anon;
revoke all on table public.mc_plan_b_catalog from anon;
revoke all on table public.mc_plan_b_activations from anon;
revoke all on table public.mc_resources from anon;
revoke all on table public.mc_resource_deliveries from anon;
revoke all on table public.mc_milestone_definitions from anon;
revoke all on table public.mc_milestone_awards from anon;
revoke all on table public.mc_coach_tasks from anon;
revoke all on table public.mc_goal_cycles from anon;
revoke all on table public.mc_challenges from anon;
revoke all on table public.mc_challenge_progress from anon;
revoke all on table public.mc_wodbuster_events from anon;
revoke all on table public.mc_wodbuster_reservations from anon;
revoke all on table public.mc_wodbuster_attendance from anon;
revoke all on table public.mc_sync_state from anon;
revoke all on table public.mc_settings from anon;
revoke all on table public.mc_audit_log from anon;
revoke all on table public.mc_my_current_state from anon;
