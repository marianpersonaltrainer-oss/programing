-- EVO-S Fase 1: evidencia inmutable de cambios de identidad.
--
-- Esta migración no cambia memberships, roles ni capacidades existentes.
-- Registra automáticamente altas, modificaciones y bajas con identificadores
-- técnicos, sin copiar nombres, emails, secretos o perfiles completos.

create table if not exists public.evo_identity_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_database_role text not null default current_user,
  entity_type text not null
    check (entity_type in ('membership', 'role_capability')),
  action text not null
    check (action in ('insert', 'update', 'delete')),
  subject_user_id uuid,
  organization_id uuid,
  role_key text,
  capability_key text,
  previous_status text,
  next_status text
);

comment on table public.evo_identity_audit_log is
  'Registro técnico append-only de cambios en memberships y capacidades. Sin PII descriptiva.';

create index if not exists evo_identity_audit_entity_occurred_idx
  on public.evo_identity_audit_log (entity_type, occurred_at desc);

create index if not exists evo_identity_audit_subject_occurred_idx
  on public.evo_identity_audit_log (subject_user_id, occurred_at desc)
  where subject_user_id is not null;

alter table public.evo_identity_audit_log enable row level security;
alter table public.evo_identity_audit_log force row level security;

revoke all on table public.evo_identity_audit_log
  from public, anon, authenticated, service_role;
revoke all on sequence public.evo_identity_audit_log_id_seq
  from public, anon, authenticated, service_role;

create or replace function private.evo_audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.evo_identity_audit_log (
    actor_user_id,
    actor_database_role,
    entity_type,
    action,
    subject_user_id,
    organization_id,
    role_key,
    previous_status,
    next_status
  ) values (
    (select auth.uid()),
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      current_user
    ),
    'membership',
    lower(tg_op),
    case when tg_op = 'DELETE' then old.user_id else new.user_id end,
    case when tg_op = 'DELETE' then old.organization_id else new.organization_id end,
    case when tg_op = 'DELETE' then old.role_key else new.role_key end,
    case when tg_op in ('UPDATE', 'DELETE') then old.status end,
    case when tg_op in ('INSERT', 'UPDATE') then new.status end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.evo_audit_membership_change()
  from public, anon, authenticated, service_role;

drop trigger if exists evo_audit_membership_change on public.evo_memberships;
create trigger evo_audit_membership_change
  after insert or update or delete on public.evo_memberships
  for each row execute function private.evo_audit_membership_change();

create or replace function private.evo_audit_role_capability_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.evo_identity_audit_log (
    actor_user_id,
    actor_database_role,
    entity_type,
    action,
    role_key,
    capability_key
  ) values (
    (select auth.uid()),
    coalesce(
      nullif(current_setting('request.jwt.claim.role', true), ''),
      current_user
    ),
    'role_capability',
    lower(tg_op),
    case when tg_op = 'DELETE' then old.role_key else new.role_key end,
    case when tg_op = 'DELETE' then old.capability_key else new.capability_key end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.evo_audit_role_capability_change()
  from public, anon, authenticated, service_role;

drop trigger if exists evo_audit_role_capability_change
  on public.evo_role_capabilities;
create trigger evo_audit_role_capability_change
  after insert or update or delete on public.evo_role_capabilities
  for each row execute function private.evo_audit_role_capability_change();

create or replace function private.evo_prevent_identity_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'evo_identity_audit_log_is_append_only';
end;
$$;

revoke all on function private.evo_prevent_identity_audit_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists evo_prevent_identity_audit_mutation
  on public.evo_identity_audit_log;
create trigger evo_prevent_identity_audit_mutation
  before update or delete on public.evo_identity_audit_log
  for each row execute function private.evo_prevent_identity_audit_mutation();
