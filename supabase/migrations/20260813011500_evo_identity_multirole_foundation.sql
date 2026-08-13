-- EVO-S Fase 1: identidad multirrol y capacidades.
--
-- Migración aditiva y compatible con Programming actual:
-- - profiles.role y profiles.org_id permanecen como puente legacy;
-- - no cambia ninguna ruta, sesión ni comportamiento visible;
-- - las nuevas asignaciones solo pueden escribirse desde un contexto privilegiado;
-- - un usuario autenticado puede consultar exclusivamente sus memberships.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text,
  org_id uuid references public.organizations (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.evo_roles (
  role_key text primary key check (role_key ~ '^[a-z][a-z0-9_]*$'),
  label text not null,
  description text,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.evo_capabilities (
  capability_key text primary key check (capability_key ~ '^[a-z][a-z0-9_.]*$'),
  description text not null,
  data_class text not null default 'P1'
    check (data_class in ('P0', 'P1', 'P2', 'P3', 'P4')),
  created_at timestamptz not null default now()
);

create table if not exists public.evo_role_capabilities (
  role_key text not null references public.evo_roles (role_key) on delete cascade,
  capability_key text not null references public.evo_capabilities (capability_key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_key, capability_key)
);

create table if not exists public.evo_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role_key text not null references public.evo_roles (role_key),
  status text not null default 'active' check (status in ('active', 'inactive')),
  source text not null default 'manual',
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id, role_key)
);

-- Las funciones SECURITY DEFINER viven fuera de los esquemas expuestos por la
-- API. Se crea antes de cualquier función/trigger que dependa de él.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create index if not exists evo_memberships_user_org_status_idx
  on public.evo_memberships (user_id, organization_id, status);

create index if not exists evo_memberships_org_role_status_idx
  on public.evo_memberships (organization_id, role_key, status);

insert into public.evo_roles (role_key, label, description)
values
  ('admin', 'Administración', 'Administración técnica autorizada de EVO-S.'),
  ('coach', 'Coach', 'Puesto de trabajo operativo de EVO Coach.'),
  ('programmer', 'Programming', 'Gestión del módulo deportivo Programming.'),
  ('client', 'Cliente', 'Experiencia privada de Mi Camino EVO.'),
  ('direction', 'Dirección', 'Capa reservada de Dirección y decisiones.')
on conflict (role_key) do nothing;

insert into public.evo_capabilities (capability_key, description, data_class)
values
  ('coach.workspace.access', 'Acceder al puesto de trabajo EVO Coach.', 'P1'),
  ('programming.read_published', 'Consultar programación publicada autorizada.', 'P1'),
  ('programming.manage', 'Gestionar el módulo deportivo Programming.', 'P1'),
  ('identity.manage', 'Administrar memberships, roles y capacidades.', 'P2')
on conflict (capability_key) do nothing;

insert into public.evo_role_capabilities (role_key, capability_key)
values
  ('coach', 'coach.workspace.access'),
  ('coach', 'programming.read_published'),
  ('programmer', 'programming.read_published'),
  ('programmer', 'programming.manage'),
  ('admin', 'identity.manage')
on conflict (role_key, capability_key) do nothing;

-- Puente de compatibilidad: refleja el único rol legacy sin retirarlo ni
-- convertir todavía las pantallas actuales a memberships.
insert into public.evo_memberships (
  user_id,
  organization_id,
  role_key,
  status,
  source
)
select
  profiles.id,
  profiles.org_id,
  profiles.role,
  'active',
  'legacy_profiles'
from public.profiles
where profiles.org_id is not null
  and profiles.role in ('admin', 'coach', 'programmer')
on conflict (user_id, organization_id, role_key) do nothing;

-- Mientras Programming siga leyendo profiles.role, los cambios autorizados en
-- el puente legacy deben reflejarse en memberships sin crear dos autoridades
-- divergentes. Los usuarios finales no pueden editar role u org_id por los
-- grants de columna definidos más abajo.
create or replace function private.evo_sync_legacy_profile_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
    and old.org_id is not null
    and old.role in ('admin', 'coach', 'programmer')
    and (
      old.org_id is distinct from new.org_id
      or old.role is distinct from new.role
    )
  then
    update public.evo_memberships
    set status = 'inactive', updated_at = now()
    where user_id = old.id
      and organization_id = old.org_id
      and role_key = old.role
      and source = 'legacy_profiles';
  end if;

  if new.org_id is not null
    and new.role in ('admin', 'coach', 'programmer')
  then
    insert into public.evo_memberships (
      user_id,
      organization_id,
      role_key,
      status,
      source
    )
    values (
      new.id,
      new.org_id,
      new.role,
      'active',
      'legacy_profiles'
    )
    on conflict (user_id, organization_id, role_key)
    do update set status = 'active', updated_at = now();
  end if;

  return new;
end;
$$;

revoke all on function private.evo_sync_legacy_profile_membership()
  from public, anon, authenticated, service_role;

drop trigger if exists evo_sync_legacy_profile_membership on public.profiles;
create trigger evo_sync_legacy_profile_membership
  after insert or update of role, org_id on public.profiles
  for each row
  execute function private.evo_sync_legacy_profile_membership();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.evo_roles enable row level security;
alter table public.evo_capabilities enable row level security;
alter table public.evo_role_capabilities enable row level security;
alter table public.evo_memberships enable row level security;

drop policy if exists evo_roles_authenticated_read on public.evo_roles;
create policy evo_roles_authenticated_read
  on public.evo_roles
  for select
  to authenticated
  using (true);

drop policy if exists evo_capabilities_authenticated_read on public.evo_capabilities;
create policy evo_capabilities_authenticated_read
  on public.evo_capabilities
  for select
  to authenticated
  using (true);

drop policy if exists evo_role_capabilities_authenticated_read on public.evo_role_capabilities;
create policy evo_role_capabilities_authenticated_read
  on public.evo_role_capabilities
  for select
  to authenticated
  using (true);

drop policy if exists evo_memberships_select_own on public.evo_memberships;
create policy evo_memberships_select_own
  on public.evo_memberships
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Cierra la escalada legacy: la política profiles_update_own solo limita filas,
-- no columnas. Un usuario puede editar su nombre, pero nunca role u org_id.
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name) on table public.profiles to authenticated;
grant all on table public.profiles to service_role;

revoke all on table public.evo_roles from public, anon, authenticated;
revoke all on table public.evo_capabilities from public, anon, authenticated;
revoke all on table public.evo_role_capabilities from public, anon, authenticated;
revoke all on table public.evo_memberships from public, anon, authenticated;

grant select on table public.evo_roles to authenticated;
grant select on table public.evo_capabilities to authenticated;
grant select on table public.evo_role_capabilities to authenticated;
grant select on table public.evo_memberships to authenticated;

grant all on table public.evo_roles to service_role;
grant all on table public.evo_capabilities to service_role;
grant all on table public.evo_role_capabilities to service_role;
grant all on table public.evo_memberships to service_role;

-- Endurece los helpers legacy que todavía consumen las políticas de
-- Programming. Se mantienen durante la transición, pero dejan de heredar
-- EXECUTE de PUBLIC y no resuelven objetos desde un search_path mutable.
create or replace function public.pe2_my_org()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.org_id
  from public.profiles profiles
  where profiles.id = (select auth.uid());
$$;

create or replace function public.pe2_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select profiles.role
  from public.profiles profiles
  where profiles.id = (select auth.uid());
$$;

revoke all on function public.pe2_my_org()
  from public, anon, authenticated;
revoke all on function public.pe2_my_role()
  from public, anon, authenticated;
grant execute on function public.pe2_my_org()
  to authenticated, service_role;
grant execute on function public.pe2_my_role()
  to authenticated, service_role;

create or replace function private.evo_has_capability(
  target_organization_id uuid,
  requested_capability text
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
      join public.evo_role_capabilities role_capabilities
        on role_capabilities.role_key = memberships.role_key
      where memberships.user_id = (select auth.uid())
        and memberships.organization_id = target_organization_id
        and memberships.status = 'active'
        and role_capabilities.capability_key = requested_capability
    );
$$;

revoke all on function private.evo_has_capability(uuid, text)
  from public, anon, authenticated;
grant execute on function private.evo_has_capability(uuid, text)
  to authenticated, service_role;

-- RPC intencional: devuelve solo las capacidades activas del usuario actual.
create or replace function public.evo_my_capabilities()
returns table (organization_id uuid, capability_key text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct
    memberships.organization_id,
    role_capabilities.capability_key
  from public.evo_memberships memberships
  join public.evo_role_capabilities role_capabilities
    on role_capabilities.role_key = memberships.role_key
  where memberships.user_id = (select auth.uid())
    and memberships.status = 'active';
$$;

revoke all on function public.evo_my_capabilities()
  from public, anon, authenticated;
grant execute on function public.evo_my_capabilities()
  to authenticated, service_role;

comment on column public.profiles.role is
  'LEGACY: conservar solo durante la transición a evo_memberships; no usar como nueva autoridad.';

comment on column public.profiles.org_id is
  'LEGACY: organización primaria provisional; la autoridad multiorganización es evo_memberships.';

comment on table public.evo_memberships is
  'Identidad multirrol por organización. Sustituye progresivamente profiles.role.';
