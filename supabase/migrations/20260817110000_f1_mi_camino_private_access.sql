-- Fase 1: base mínima, privada y aditiva para Mi Camino 0→30.
--
-- No contiene datos reales ni sustituye ninguna pantalla existente. Los datos
-- P2 se escriben exclusivamente desde servicios de confianza; el cliente solo
-- puede leer su propia proyección, o la Administración autorizada de su org.
--
-- Rollback: revocar los grants, retirar las políticas y eliminar estas dos
-- tablas en staging únicamente, siempre que todavía no se hayan cargado datos.

insert into public.evo_capabilities (capability_key, description, data_class)
values
  ('mi_camino.read_own', 'Leer el propio recorrido de Mi Camino.', 'P2'),
  ('mi_camino.manage', 'Gestionar Mi Camino dentro de la organización.', 'P2')
on conflict (capability_key) do nothing;

insert into public.evo_role_capabilities (role_key, capability_key)
values
  ('client', 'mi_camino.read_own'),
  ('admin', 'mi_camino.manage')
on conflict (role_key, capability_key) do nothing;

create table if not exists public.mi_camino_person_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  person_id uuid not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id),
  unique (organization_id, person_id)
);

create index if not exists mi_camino_person_access_active_lookup_idx
  on public.mi_camino_person_access (organization_id, user_id, person_id)
  where status = 'active';

create table if not exists public.mi_camino_projections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  person_id uuid not null,
  entry_mode text not null check (entry_mode in ('new', 'veteran')),
  journey_day integer check (journey_day between 0 and 30),
  stage_key text not null check (stage_key ~ '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$'),
  next_action jsonb not null check (jsonb_typeof(next_action) = 'object'),
  progress jsonb not null check (jsonb_typeof(progress) = 'object'),
  freshness jsonb not null check (jsonb_typeof(freshness) = 'object'),
  schema_version integer not null default 1 check (schema_version > 0),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, person_id),
  constraint mi_camino_projections_entry_mode_day_check check (
    (entry_mode = 'new' and journey_day is not null)
    or (entry_mode = 'veteran' and journey_day is null)
  )
);

create index if not exists mi_camino_projections_person_lookup_idx
  on public.mi_camino_projections (organization_id, person_id);

comment on table public.mi_camino_person_access is
  'Vínculo privado de Auth a Persona para Mi Camino; no se expone al navegador.';
comment on table public.mi_camino_projections is
  'Proyección P2 mínima para Mi Camino; no almacenar salud, notas internas ni texto libre sensible.';

create or replace function private.evo_can_read_mi_camino_projection(
  target_organization_id uuid,
  target_person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      private.evo_has_capability(target_organization_id, 'mi_camino.manage')
      or (
        private.evo_has_capability(target_organization_id, 'mi_camino.read_own')
        and exists (
          select 1
          from public.mi_camino_person_access access_map
          where access_map.organization_id = target_organization_id
            and access_map.person_id = target_person_id
            and access_map.user_id = (select auth.uid())
            and access_map.status = 'active'
        )
      )
    );
$$;

revoke all on function private.evo_can_read_mi_camino_projection(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.evo_can_read_mi_camino_projection(uuid, uuid)
  to authenticated, service_role;

alter table public.mi_camino_person_access enable row level security;
alter table public.mi_camino_person_access force row level security;
alter table public.mi_camino_projections enable row level security;
alter table public.mi_camino_projections force row level security;

drop policy if exists mi_camino_projections_select_private on public.mi_camino_projections;
create policy mi_camino_projections_select_private
  on public.mi_camino_projections
  for select
  to authenticated
  using (
    private.evo_can_read_mi_camino_projection(organization_id, person_id)
  );

revoke all on table public.mi_camino_person_access
  from public, anon, authenticated;
revoke all on table public.mi_camino_projections
  from public, anon, authenticated;

grant select on table public.mi_camino_projections to authenticated;
grant all on table public.mi_camino_person_access to service_role;
grant all on table public.mi_camino_projections to service_role;

-- Operaciones atómicas para el endpoint server-side. Se mantienen en public
-- porque el endpoint usa RPC, pero ningún cliente web puede ejecutarlas.
create or replace function public.evo_provision_mi_camino_access(
  target_user_id uuid,
  target_organization_id uuid,
  projection jsonb,
  actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_person_id uuid := (projection ->> 'person_id')::uuid;
  existing_person_id uuid;
begin
  select access_map.person_id
    into existing_person_id
  from public.mi_camino_person_access access_map
  where access_map.organization_id = target_organization_id
    and access_map.user_id = target_user_id
  for update;

  if existing_person_id is not null and existing_person_id <> target_person_id then
    raise exception 'mi_camino_person_access_conflict' using errcode = 'P0001';
  end if;

  insert into public.evo_memberships (
    user_id, organization_id, role_key, status, source, assigned_by, updated_at
  ) values (
    target_user_id, target_organization_id, 'client', 'active',
    'mi_camino_admin', actor_user_id, now()
  ) on conflict (user_id, organization_id, role_key)
  do update set status = 'active', source = 'mi_camino_admin',
    assigned_by = excluded.assigned_by, updated_at = now();

  insert into public.mi_camino_person_access (
    organization_id, user_id, person_id, status, updated_at
  ) values (
    target_organization_id, target_user_id, target_person_id, 'active', now()
  ) on conflict (organization_id, user_id)
  do update set status = 'active', updated_at = now();

  insert into public.mi_camino_projections (
    id, organization_id, person_id, entry_mode, journey_day, stage_key,
    next_action, progress, freshness, schema_version, updated_at
  ) values (
    (projection ->> 'projection_id')::uuid,
    target_organization_id,
    target_person_id,
    projection ->> 'entry_mode',
    case when projection ->> 'journey_day' is null then null else (projection ->> 'journey_day')::integer end,
    projection ->> 'stage_key',
    projection -> 'next_action',
    projection -> 'progress',
    projection -> 'freshness',
    (projection ->> 'schema_version')::integer,
    (projection ->> 'updated_at')::timestamptz
  ) on conflict (organization_id, person_id)
  do update set entry_mode = excluded.entry_mode, journey_day = excluded.journey_day,
    stage_key = excluded.stage_key, next_action = excluded.next_action,
    progress = excluded.progress, freshness = excluded.freshness,
    schema_version = excluded.schema_version, updated_at = excluded.updated_at;
end;
$$;

create or replace function public.evo_set_mi_camino_access_status(
  target_user_id uuid,
  target_organization_id uuid,
  next_status text,
  actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if next_status not in ('active', 'inactive') then
    raise exception 'invalid_mi_camino_access_status' using errcode = '22023';
  end if;

  update public.mi_camino_person_access
  set status = next_status, updated_at = now()
  where organization_id = target_organization_id and user_id = target_user_id;

  update public.evo_memberships
  set status = next_status, assigned_by = actor_user_id, updated_at = now()
  where organization_id = target_organization_id
    and user_id = target_user_id
    and role_key = 'client';
end;
$$;

revoke all on function public.evo_provision_mi_camino_access(uuid, uuid, jsonb, uuid)
  from public, anon, authenticated;
revoke all on function public.evo_set_mi_camino_access_status(uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.evo_provision_mi_camino_access(uuid, uuid, jsonb, uuid)
  to service_role;
grant execute on function public.evo_set_mi_camino_access_status(uuid, uuid, text, uuid)
  to service_role;
