-- Corrige la ambigüedad entre columnas de la cola y parámetros OUT de la RPC.
-- La migración original ya se aplicó; esta versión reemplaza solo la reclamación.
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
  from public.programming_agent_requests as request_row
  where request_row.expires_at > now()
    and (
      request_row.status = 'queued'
      or (
        request_row.status = 'processing'
        and request_row.lease_expires_at < now()
        and request_row.attempt_count < 3
      )
    )
  order by request_row.created_at asc
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

revoke all on function public.claim_programming_agent_request() from public;
grant execute on function public.claim_programming_agent_request() to service_role;
