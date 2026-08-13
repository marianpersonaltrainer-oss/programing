-- Nucleus EVO-S: almacén canónico de eventos V1.
--
-- Alcance: persistencia append-only, idempotencia y aislamiento server-side.
-- No crea productores, reglas, tareas ni eventos reales.
--
-- Rollback en staging (destructivo, solo si todavía no contiene eventos):
--   drop table public.evo_events;
--   drop function private.evo_prevent_canonical_event_mutation();

create table if not exists public.evo_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type text not null,
  occurred_at timestamptz not null,
  observed_at timestamptz not null default now(),
  source text not null,
  organization_id uuid not null references public.organizations (id),
  person_id uuid,
  external_id text,
  schema_version integer not null default 1,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  correlation_id uuid not null,
  causation_id uuid,
  source_updated_at timestamptz,
  reconciled_at timestamptz,
  sync_status text not null default 'pending',

  constraint evo_events_event_type_format_check check (
    event_type ~ '^[a-z][a-z0-9]*([._-][a-z0-9]+)+$'
    and char_length(event_type) between 3 and 160
  ),
  constraint evo_events_source_format_check check (
    source ~ '^[a-z][a-z0-9_-]+$'
    and char_length(source) between 2 and 64
  ),
  constraint evo_events_external_id_length_check check (
    external_id is null
    or char_length(btrim(external_id)) between 1 and 240
  ),
  constraint evo_events_schema_version_check check (
    schema_version between 1 and 2147483647
  ),
  constraint evo_events_payload_object_check check (
    jsonb_typeof(payload) = 'object'
  ),
  constraint evo_events_payload_size_check check (
    octet_length(payload::text) <= 65536
  ),
  constraint evo_events_idempotency_key_check check (
    char_length(btrim(idempotency_key)) between 1 and 240
  ),
  constraint evo_events_sync_status_check check (
    sync_status in ('pending', 'synced', 'error', 'reconciled')
  ),
  constraint evo_events_observation_order_check check (
    occurred_at <= observed_at
  ),
  constraint evo_events_causation_not_self_check check (
    causation_id is null or causation_id <> event_id
  ),
  constraint evo_events_reconciled_timestamp_check check (
    sync_status <> 'reconciled' or reconciled_at is not null
  )
);

create unique index if not exists evo_events_idempotency_uidx
  on public.evo_events (organization_id, source, idempotency_key);

create index if not exists evo_events_org_occurred_idx
  on public.evo_events (organization_id, occurred_at desc);

create index if not exists evo_events_org_type_occurred_idx
  on public.evo_events (organization_id, event_type, occurred_at desc);

create index if not exists evo_events_correlation_idx
  on public.evo_events (correlation_id, occurred_at);

create index if not exists evo_events_pending_sync_idx
  on public.evo_events (observed_at)
  where sync_status in ('pending', 'error');

alter table public.evo_events enable row level security;
alter table public.evo_events force row level security;

-- Sin políticas de cliente: anon/authenticated quedan cerrados por RLS y grants.
revoke all on table public.evo_events
  from public, anon, authenticated, service_role;
grant select, insert on table public.evo_events
  to service_role;

create or replace function private.evo_prevent_canonical_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'evo_events_are_append_only'
    using errcode = '55000';
end;
$$;

revoke all on function private.evo_prevent_canonical_event_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists evo_prevent_canonical_event_mutation
  on public.evo_events;
create trigger evo_prevent_canonical_event_mutation
  before update or delete on public.evo_events
  for each row execute function private.evo_prevent_canonical_event_mutation();

comment on table public.evo_events is
  'Nucleus EVO-S: hechos canónicos inmutables, versionados e idempotentes.';

comment on column public.evo_events.person_id is
  'Identificador EVO opcional; no presupone que la persona sea auth.users.';

comment on column public.evo_events.payload is
  'Payload mínimo del hecho. Los productores deben validarlo con el contrato versionado.';
