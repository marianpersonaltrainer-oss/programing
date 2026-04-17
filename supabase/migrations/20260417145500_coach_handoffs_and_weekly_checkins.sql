create table if not exists public.daily_handoffs (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references auth.users(id),
  coach_name text not null,
  class_time text not null,
  class_type text not null,
  energy_level smallint check (energy_level between 1 and 5),
  had_incident boolean default false,
  note text,
  created_at timestamptz default now()
);

create table if not exists public.weekly_checkins (
  id uuid default gen_random_uuid() primary key,
  coach_id uuid references auth.users(id),
  coach_name text not null,
  week_iso text not null,
  mood_score smallint check (mood_score between 1 and 5),
  feedback_text text,
  highlights text,
  improvements text,
  created_at timestamptz default now(),
  unique (coach_id, week_iso)
);

alter table public.daily_handoffs enable row level security;
alter table public.weekly_checkins enable row level security;

drop policy if exists coaches_see_today on public.daily_handoffs;
create policy coaches_see_today
  on public.daily_handoffs
  for select
  using (
    auth.uid() is not null
    and timezone('Europe/Madrid', created_at)::date = timezone('Europe/Madrid', now())::date
  );

drop policy if exists coaches_insert_own on public.daily_handoffs;
create policy coaches_insert_own
  on public.daily_handoffs
  for insert
  with check (coach_id = auth.uid());

drop policy if exists admins_see_all_handoffs on public.daily_handoffs;
create policy admins_see_all_handoffs
  on public.daily_handoffs
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

drop policy if exists weekly_checkins_insert_own on public.weekly_checkins;
create policy weekly_checkins_insert_own
  on public.weekly_checkins
  for insert
  with check (coach_id = auth.uid());

drop policy if exists weekly_checkins_select_own on public.weekly_checkins;
create policy weekly_checkins_select_own
  on public.weekly_checkins
  for select
  using (coach_id = auth.uid());

drop policy if exists weekly_checkins_admin_read on public.weekly_checkins;
create policy weekly_checkins_admin_read
  on public.weekly_checkins
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );
