-- Base mínima de Auth/RLS compartida por Programming V2 y Control de turno.
-- Idempotente para entornos que ya ejecutaron pe2_structured_auth y segura para
-- producción con esquema histórico desalineado: no modifica pe2_weeks ni tablas coach_*.

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
alter table public.profiles add column if not exists role text;
alter table public.profiles add column if not exists org_id uuid references public.organizations (id);
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
alter table public.profiles alter column role set default 'coach';

create index if not exists profiles_org_idx on public.profiles (org_id);

create or replace function public.pe2_my_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.org_id
  from public.profiles profile
  where profile.id = (select auth.uid());
$$;

create or replace function public.pe2_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profile.role
  from public.profiles profile
  where profile.id = (select auth.uid());
$$;

revoke all on function public.pe2_my_org() from public, anon;
revoke all on function public.pe2_my_role() from public, anon;
grant execute on function public.pe2_my_org() to authenticated;
grant execute on function public.pe2_my_role() to authenticated;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
grant select on table public.organizations to authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (id = (select public.pe2_my_org()));

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_programmer_org on public.profiles;
drop policy if exists profiles_select_authorized on public.profiles;
create policy profiles_select_authorized
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      (select public.pe2_my_role()) = 'programmer'
      and org_id = (select public.pe2_my_org())
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
