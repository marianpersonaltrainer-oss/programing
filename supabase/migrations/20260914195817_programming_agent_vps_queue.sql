-- Cola privada Programing EVO -> Agente Programador propio (VPS).
--
-- Solo la usan las funciones de Vercel y el trabajador autenticado del VPS.
-- No se expone a anon/authenticated y no publica ni modifica semanas.

create table if not exists public.programming_agent_requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type = 'weekly_briefing'),
  fingerprint text not null check (char_length(fingerprint) between 16 and 512),
  target jsonb not null check (jsonb_typeof(target) = 'object'),
  request_payload jsonb not null check (jsonb_typeof(request_payload) = 'object'),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  response_payload jsonb,
  error_code text,
  attempt_count integer not null default 0 check (attempt_count between 0 and 3),
  lease_expires_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint programming_agent_requests_response_check check (
    (status = 'completed' and response_payload is not null and error_code is null and completed_at is not null)
    or (status = 'failed' and response_payload is null and error_code is not null)
    or (status in ('queued', 'processing') and response_payload is null and error_code is null)
  ),
  constraint programming_agent_requests_lease_check check (
    (status = 'processing' and lease_expires_at is not null)
    or (status <> 'processing' and lease_expires_at is null)
  )
);

create unique index if not exists programming_agent_requests_fingerprint_active_uidx
  on public.programming_agent_requests (fingerprint)
  where status in ('queued', 'processing');

create index if not exists programming_agent_requests_claim_idx
  on public.programming_agent_requests (status, expires_at, created_at);

alter table public.programming_agent_requests enable row level security;
revoke all on table public.programming_agent_requests from anon, authenticated;
grant select, insert, update, delete on table public.programming_agent_requests to service_role;

create or replace function public.set_programming_agent_request_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists programming_agent_requests_set_updated_at
  on public.programming_agent_requests;
create trigger programming_agent_requests_set_updated_at
before update on public.programming_agent_requests
for each row execute function public.set_programming_agent_request_updated_at();

-- Claim is atomic: a second worker cannot receive the same queued request.
create or replace function public.claim_programming_agent_request()
returns table (
  id uuid,
  request_type text,
  fingerprint text,
  target jsonb,
  request_payload jsonb,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  candidate public.programming_agent_requests%rowtype;
begin
  select *
  into candidate
  from public.programming_agent_requests
  where expires_at > now()
    and (
      status = 'queued'
      or (status = 'processing' and lease_expires_at < now() and attempt_count < 3)
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.programming_agent_requests
  set status = 'processing',
      attempt_count = candidate.attempt_count + 1,
      lease_expires_at = now() + interval '5 minutes',
      completed_at = null,
      error_code = null
  where programming_agent_requests.id = candidate.id
  returning
    programming_agent_requests.id,
    programming_agent_requests.request_type,
    programming_agent_requests.fingerprint,
    programming_agent_requests.target,
    programming_agent_requests.request_payload,
    programming_agent_requests.created_at,
    programming_agent_requests.expires_at
  into id, request_type, fingerprint, target, request_payload, created_at, expires_at;

  return next;
end;
$$;

create or replace function public.complete_programming_agent_request(
  p_request_id uuid,
  p_response_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  changed integer;
begin
  if p_response_payload is null or jsonb_typeof(p_response_payload) <> 'object' then
    raise exception 'invalid_response_payload';
  end if;

  update public.programming_agent_requests
  set status = 'completed',
      response_payload = p_response_payload,
      completed_at = now(),
      lease_expires_at = null
  where id = p_request_id
    and status = 'processing'
    and lease_expires_at > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

create or replace function public.fail_programming_agent_request(
  p_request_id uuid,
  p_error_code text
)
returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  changed integer;
begin
  if p_error_code !~ '^[a-z][a-z0-9_]{0,119}$' then
    raise exception 'invalid_error_code';
  end if;

  update public.programming_agent_requests
  set status = 'failed',
      error_code = p_error_code,
      lease_expires_at = null
  where id = p_request_id
    and status = 'processing'
    and lease_expires_at > now();
  get diagnostics changed = row_count;
  return changed = 1;
end;
$$;

revoke all on function public.set_programming_agent_request_updated_at() from public;
revoke all on function public.claim_programming_agent_request() from public;
revoke all on function public.complete_programming_agent_request(uuid, jsonb) from public;
revoke all on function public.fail_programming_agent_request(uuid, text) from public;
grant execute on function public.claim_programming_agent_request() to service_role;
grant execute on function public.complete_programming_agent_request(uuid, jsonb) to service_role;
grant execute on function public.fail_programming_agent_request(uuid, text) to service_role;

comment on table public.programming_agent_requests is
  'Cola privada para borradores del Agente Programador propio en VPS. Solo service_role; nunca publica ni modifica programación.';
