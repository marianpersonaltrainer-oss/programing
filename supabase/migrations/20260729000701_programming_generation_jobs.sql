-- Programming EVO · jobs persistentes de generación semanal por día.
-- Aplicada en producción como 20260729000701.
--
-- Esta migración es aditiva y conserva el contrato que ya consume
-- api/lib/programmingGenerationJobs.js:
--   jobs: idempotency_key, fingerprint, target, configuration, status,
--         current_day, completed_days, partial_week, error y revision;
--   steps: un resultado durable por job y día.
--
-- Las RPC reclaman, completan o fallan un único día bajo lease. Todas se
-- ejecutan como invoker y solo service_role recibe acceso explícito.

create table if not exists public.programming_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  fingerprint text not null,

  status text not null default 'queued',
  target jsonb not null default '{}'::jsonb,
  configuration jsonb not null default '{}'::jsonb,
  current_day text,
  completed_days text[] not null default '{}'::text[],
  partial_week jsonb,
  error jsonb,
  revision integer not null default 0,

  lease_token uuid,
  lease_expires_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint programming_generation_jobs_idempotency_key_check
    check (
      btrim(idempotency_key) <> ''
      and char_length(idempotency_key) <= 220
    ),
  constraint programming_generation_jobs_fingerprint_check
    check (
      btrim(fingerprint) <> ''
      and char_length(fingerprint) <= 24000
    ),
  constraint programming_generation_jobs_status_check
    check (
      status in (
        'queued',
        'preparing',
        'generating',
        'ready',
        'failed',
        'cancelled'
      )
    ),
  constraint programming_generation_jobs_target_check
    check (jsonb_typeof(target) = 'object'),
  constraint programming_generation_jobs_configuration_check
    check (jsonb_typeof(configuration) = 'object'),
  constraint programming_generation_jobs_current_day_check
    check (
      current_day is null
      or current_day in (
        'LUNES',
        'MARTES',
        'MIÉRCOLES',
        'JUEVES',
        'VIERNES',
        'SÁBADO'
      )
    ),
  constraint programming_generation_jobs_completed_days_check
    check (
      completed_days <@ array[
        'LUNES',
        'MARTES',
        'MIÉRCOLES',
        'JUEVES',
        'VIERNES',
        'SÁBADO'
      ]::text[]
    ),
  constraint programming_generation_jobs_partial_week_check
    check (partial_week is null or jsonb_typeof(partial_week) = 'object'),
  constraint programming_generation_jobs_error_check
    check (error is null or jsonb_typeof(error) = 'object'),
  constraint programming_generation_jobs_revision_check
    check (revision >= 0),
  constraint programming_generation_jobs_lease_pair_check
    check ((lease_token is null) = (lease_expires_at is null)),
  constraint programming_generation_jobs_ready_check
    check (
      status <> 'ready'
      or (
        completed_at is not null
        and partial_week is not null
      )
    )
);

create table if not exists public.programming_generation_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null
    references public.programming_generation_jobs (id)
    on delete cascade,
  day_key text not null,

  status text not null default 'pending',
  attempt_count integer not null default 0,
  retriable boolean not null default true,

  lease_token uuid,
  lease_expires_at timestamptz,

  request_id text not null,
  request_ids text[] not null default '{}'::text[],
  provider_request_id text,
  provider_request_ids text[] not null default '{}'::text[],
  model text,
  duration_ms integer,
  input_tokens integer,
  output_tokens integer,

  result jsonb,
  error jsonb,

  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint programming_generation_steps_day_key_check
    check (
      day_key in (
        'LUNES',
        'MARTES',
        'MIÉRCOLES',
        'JUEVES',
        'VIERNES',
        'SÁBADO'
      )
    ),
  constraint programming_generation_steps_status_check
    check (status in ('pending', 'running', 'completed', 'failed')),
  constraint programming_generation_steps_attempt_count_check
    check (attempt_count >= 0),
  constraint programming_generation_steps_request_id_check
    check (
      btrim(request_id) <> ''
      and char_length(request_id) <= 200
      and request_id = any(request_ids)
    ),
  constraint programming_generation_steps_lease_pair_check
    check ((lease_token is null) = (lease_expires_at is null)),
  constraint programming_generation_steps_running_lease_check
    check (status <> 'running' or lease_token is not null),
  constraint programming_generation_steps_duration_check
    check (duration_ms is null or duration_ms >= 0),
  constraint programming_generation_steps_tokens_check
    check (
      (input_tokens is null or input_tokens >= 0)
      and (output_tokens is null or output_tokens >= 0)
    ),
  constraint programming_generation_steps_result_check
    check (result is null or jsonb_typeof(result) = 'object'),
  constraint programming_generation_steps_error_check
    check (error is null or jsonb_typeof(error) = 'object')
);

create unique index if not exists programming_generation_jobs_idempotency_uidx
  on public.programming_generation_jobs (idempotency_key);

create index if not exists programming_generation_jobs_fingerprint_idx
  on public.programming_generation_jobs using hash (fingerprint);

create index if not exists programming_generation_jobs_status_idx
  on public.programming_generation_jobs (status, updated_at desc);

create index if not exists programming_generation_jobs_active_lease_idx
  on public.programming_generation_jobs (lease_expires_at)
  where lease_token is not null;

create unique index if not exists programming_generation_steps_job_day_uidx
  on public.programming_generation_steps (job_id, day_key);

create unique index if not exists programming_generation_steps_job_request_uidx
  on public.programming_generation_steps (job_id, request_id);

create index if not exists programming_generation_steps_request_history_idx
  on public.programming_generation_steps using gin (request_ids);

create index if not exists programming_generation_steps_job_status_idx
  on public.programming_generation_steps (job_id, status, created_at);

create index if not exists programming_generation_steps_active_lease_idx
  on public.programming_generation_steps (lease_expires_at)
  where status = 'running';

create index if not exists programming_generation_steps_provider_request_idx
  on public.programming_generation_steps (provider_request_id)
  where provider_request_id is not null;

create or replace function public.programming_generation_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists programming_generation_jobs_set_updated_at
  on public.programming_generation_jobs;
create trigger programming_generation_jobs_set_updated_at
  before update on public.programming_generation_jobs
  for each row
  execute function public.programming_generation_set_updated_at();

drop trigger if exists programming_generation_steps_set_updated_at
  on public.programming_generation_steps;
create trigger programming_generation_steps_set_updated_at
  before update on public.programming_generation_steps
  for each row
  execute function public.programming_generation_set_updated_at();

-- Reclama exactamente el primer día pendiente. p_request_id identifica la
-- operación lógica job+día: mientras el lease está activo devuelve el mismo
-- token; tras fallo o vencimiento adquiere otro lease sin duplicar el step.
create or replace function public.claim_programming_generation_step(
  p_job_id uuid,
  p_day_key text,
  p_request_id text,
  p_lease_seconds integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.programming_generation_jobs%rowtype;
  v_step public.programming_generation_steps%rowtype;
  v_step_found boolean := false;
  v_now timestamptz := clock_timestamp();
  v_day_key text := upper(btrim(coalesce(p_day_key, '')));
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_selected_days text[];
  v_first_pending_day text;
  v_lease_seconds integer;
  v_lease_token uuid;
begin
  if p_job_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_id_required';
  end if;
  if v_day_key = '' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_day_required';
  end if;
  if v_request_id = '' or char_length(v_request_id) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_request_id_invalid';
  end if;

  v_lease_seconds := greatest(15, least(coalesce(p_lease_seconds, 90), 120));

  select *
  into v_job
  from public.programming_generation_jobs
  where id = p_job_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_not_found';
  end if;
  if v_job.status = 'cancelled' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_cancelled';
  end if;

  select coalesce(
    array_agg(days.day_key order by days.ordinality),
    '{}'::text[]
  )
  into v_selected_days
  from (
    select
      upper(btrim(source.value)) as day_key,
      source.ordinality
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_job.configuration -> 'generationDays') = 'array'
          then v_job.configuration -> 'generationDays'
        else '[]'::jsonb
      end
    ) with ordinality as source(value, ordinality)
  ) as days
  where days.day_key = any(array[
    'LUNES',
    'MARTES',
    'MIÉRCOLES',
    'JUEVES',
    'VIERNES',
    'SÁBADO'
  ]::text[]);

  if cardinality(v_selected_days) = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_days_missing';
  end if;
  if not (v_day_key = any(v_selected_days)) then
    raise exception using
      errcode = 'P0001',
      message = 'generation_day_not_selected';
  end if;

  select *
  into v_step
  from public.programming_generation_steps
  where job_id = v_job.id
    and day_key = v_day_key
  for update;
  v_step_found := found;

  if v_job.status = 'ready'
     or v_day_key = any(v_job.completed_days)
     or (v_step_found and v_step.status = 'completed') then
    return jsonb_build_object(
      'claimed', false,
      'acquired', false,
      'alreadyComplete', true,
      'reason', 'day_already_completed',
      'leaseToken', null,
      'result', case when v_step_found then v_step.result else null end,
      'partialWeek', v_job.partial_week,
      'providerRequestId', case
        when v_step_found then v_step.provider_request_id
        else null
      end,
      'completedDays', to_jsonb(v_job.completed_days),
      'job', to_jsonb(v_job),
      'step', case when v_step_found then to_jsonb(v_step) else null end
    );
  end if;

  select pending.day_key
  into v_first_pending_day
  from unnest(v_selected_days) with ordinality
    as pending(day_key, ordinal_position)
  where not (pending.day_key = any(v_job.completed_days))
  order by pending.ordinal_position
  limit 1;

  if v_first_pending_day is null then
    return jsonb_build_object(
      'claimed', false,
      'acquired', false,
      'alreadyComplete', true,
      'reason', 'day_already_completed',
      'leaseToken', null,
      'result', case when v_step_found then v_step.result else null end,
      'partialWeek', v_job.partial_week,
      'providerRequestId', case
        when v_step_found then v_step.provider_request_id
        else null
      end,
      'completedDays', to_jsonb(v_job.completed_days),
      'job', to_jsonb(v_job),
      'step', case when v_step_found then to_jsonb(v_step) else null end
    );
  end if;
  if v_first_pending_day <> v_day_key then
    raise exception using
      errcode = 'P0001',
      message = format(
        'generation_day_out_of_order:expected=%s',
        v_first_pending_day
      );
  end if;

  if exists (
    select 1
    from public.programming_generation_steps as used
    where used.job_id = v_job.id
      and used.day_key <> v_day_key
      and v_request_id = any(used.request_ids)
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'generation_request_id_conflict';
  end if;

  if v_step_found
     and v_step.status = 'running'
     and v_step.lease_token is not null
     and v_step.lease_expires_at > v_now then
    if v_step.request_id = v_request_id then
      return jsonb_build_object(
        'claimed', true,
        'acquired', true,
        'reused', true,
        'alreadyComplete', false,
        'leaseToken', v_step.lease_token,
        'job', to_jsonb(v_job),
        'step', to_jsonb(v_step)
      );
    end if;

    return jsonb_build_object(
      'claimed', false,
      'acquired', false,
      'reused', false,
      'alreadyComplete', false,
      'reason', 'generation_step_already_running',
      'leaseToken', null,
      'job', to_jsonb(v_job),
      'step', to_jsonb(v_step)
    );
  end if;

  if v_job.lease_token is not null
     and v_job.lease_expires_at > v_now then
    return jsonb_build_object(
      'claimed', false,
      'acquired', false,
      'reused', false,
      'alreadyComplete', false,
      'reason', 'generation_job_lease_active',
      'leaseToken', null,
      'job', to_jsonb(v_job),
      'step', case when v_step_found then to_jsonb(v_step) else null end
    );
  end if;

  if not v_step_found then
    insert into public.programming_generation_steps (
      job_id,
      day_key,
      status,
      request_id,
      request_ids
    )
    values (
      v_job.id,
      v_day_key,
      'pending',
      v_request_id,
      array[v_request_id]
    )
    returning * into v_step;
  end if;

  v_lease_token := gen_random_uuid();

  update public.programming_generation_steps
  set
    status = 'running',
    attempt_count = attempt_count + 1,
    retriable = true,
    lease_token = v_lease_token,
    lease_expires_at =
      v_now + make_interval(secs => v_lease_seconds),
    request_id = v_request_id,
    request_ids = case
      when v_request_id = any(request_ids) then request_ids
      else array_append(request_ids, v_request_id)
    end,
    provider_request_id = null,
    model = null,
    duration_ms = null,
    input_tokens = null,
    output_tokens = null,
    result = null,
    error = null,
    started_at = v_now,
    completed_at = null
  where id = v_step.id
  returning * into v_step;

  update public.programming_generation_jobs
  set
    status = 'generating',
    current_day = v_day_key,
    error = null,
    revision = revision + 1,
    lease_token = v_lease_token,
    lease_expires_at = v_step.lease_expires_at,
    completed_at = null
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'claimed', true,
    'acquired', true,
    'reused', false,
    'alreadyComplete', false,
    'leaseToken', v_step.lease_token,
    'job', to_jsonb(v_job),
    'step', to_jsonb(v_step)
  );
end;
$$;

-- Completa un día solo si conserva el lease. p_partial_week es opcional para
-- que el endpoint pueda guardar su agregado exacto; si se omite, la RPC crea
-- un agregado durable por day_key antes de responder.
create or replace function public.complete_programming_generation_step(
  p_job_id uuid,
  p_day_key text,
  p_lease_token uuid,
  p_result jsonb,
  p_model text,
  p_request_id text,
  p_provider_request_id text,
  p_duration_ms integer,
  p_partial_week jsonb default null,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.programming_generation_jobs%rowtype;
  v_step public.programming_generation_steps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day_key text := upper(btrim(coalesce(p_day_key, '')));
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_provider_request_id text :=
    nullif(btrim(coalesce(p_provider_request_id, '')), '');
  v_model text := nullif(btrim(coalesce(p_model, '')), '');
  v_selected_days text[];
  v_completed_days text[];
  v_partial_week jsonb;
  v_next_day text;
  v_all_days_complete boolean;
begin
  if p_job_id is null or p_lease_token is null or v_day_key = '' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_completion_identity_required';
  end if;
  if v_request_id = '' or char_length(v_request_id) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_request_id_invalid';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_day_result_invalid';
  end if;
  if p_partial_week is not null
     and jsonb_typeof(p_partial_week) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_partial_week_invalid';
  end if;
  if v_provider_request_id is not null
     and char_length(v_provider_request_id) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_provider_request_id_invalid';
  end if;
  if v_model is not null and char_length(v_model) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_model_invalid';
  end if;

  select *
  into v_job
  from public.programming_generation_jobs
  where id = p_job_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_not_found';
  end if;

  select *
  into v_step
  from public.programming_generation_steps
  where job_id = p_job_id
    and day_key = v_day_key
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_not_found';
  end if;

  if v_step.status = 'completed' then
    if v_step.request_id is distinct from v_request_id then
      raise exception using
        errcode = 'P0001',
        message = 'generation_step_request_conflict';
    end if;

    return jsonb_build_object(
      'completed', true,
      'idempotent', true,
      'job', to_jsonb(v_job),
      'step', to_jsonb(v_step)
    );
  end if;

  if v_step.request_id is distinct from v_request_id then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_request_conflict';
  end if;
  if v_step.status <> 'running'
     or v_job.status <> 'generating'
     or v_step.lease_token is distinct from p_lease_token
     or v_job.lease_token is distinct from p_lease_token
     or v_job.current_day is distinct from v_day_key
     or v_step.lease_expires_at <= v_now
     or v_job.lease_expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_lease_lost';
  end if;

  select coalesce(
    array_agg(days.day_key order by days.ordinality),
    '{}'::text[]
  )
  into v_selected_days
  from (
    select
      upper(btrim(source.value)) as day_key,
      source.ordinality
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_job.configuration -> 'generationDays') = 'array'
          then v_job.configuration -> 'generationDays'
        else '[]'::jsonb
      end
    ) with ordinality as source(value, ordinality)
  ) as days
  where days.day_key = any(array[
    'LUNES',
    'MARTES',
    'MIÉRCOLES',
    'JUEVES',
    'VIERNES',
    'SÁBADO'
  ]::text[]);

  v_completed_days := case
    when v_day_key = any(v_job.completed_days)
      then v_job.completed_days
    else array_append(v_job.completed_days, v_day_key)
  end;
  v_all_days_complete :=
    cardinality(v_selected_days) > 0
    and v_selected_days <@ v_completed_days;
  v_partial_week := coalesce(
    p_partial_week,
    jsonb_set(
      coalesce(v_job.partial_week, '{}'::jsonb),
      array[v_day_key],
      p_result,
      true
    )
  );

  select pending.day_key
  into v_next_day
  from unnest(v_selected_days) with ordinality
    as pending(day_key, ordinal_position)
  where not (pending.day_key = any(v_completed_days))
  order by pending.ordinal_position
  limit 1;

  update public.programming_generation_steps
  set
    status = 'completed',
    retriable = false,
    lease_token = null,
    lease_expires_at = null,
    provider_request_id = v_provider_request_id,
    provider_request_ids = case
      when v_provider_request_id is null
        or v_provider_request_id = any(provider_request_ids)
        then provider_request_ids
      else array_append(provider_request_ids, v_provider_request_id)
    end,
    model = v_model,
    duration_ms = greatest(coalesce(p_duration_ms, 0), 0),
    input_tokens = greatest(coalesce(p_input_tokens, 0), 0),
    output_tokens = greatest(coalesce(p_output_tokens, 0), 0),
    result = p_result,
    error = null,
    completed_at = v_now
  where id = v_step.id
  returning * into v_step;

  update public.programming_generation_jobs
  set
    -- Completar el último día no finaliza el job. La API de jobs aplica
    -- después la metadata semanal definitiva mediante revisión optimista.
    status = 'generating',
    current_day = case when v_all_days_complete then null else v_next_day end,
    completed_days = v_completed_days,
    partial_week = v_partial_week,
    error = null,
    revision = revision + 1,
    lease_token = null,
    lease_expires_at = null,
    completed_at = null
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'completed', true,
    'idempotent', false,
    'allDaysComplete', v_all_days_complete,
    'job', to_jsonb(v_job),
    'step', to_jsonb(v_step)
  );
end;
$$;

-- Registra el fallo del intento que conserva el lease. El agregado parcial se
-- mantiene intacto y el mismo request ID lógico puede reclamar otro lease.
create or replace function public.fail_programming_generation_step(
  p_job_id uuid,
  p_day_key text,
  p_lease_token uuid,
  p_error jsonb,
  p_model text,
  p_request_id text,
  p_provider_request_id text,
  p_duration_ms integer
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.programming_generation_jobs%rowtype;
  v_step public.programming_generation_steps%rowtype;
  v_now timestamptz := clock_timestamp();
  v_day_key text := upper(btrim(coalesce(p_day_key, '')));
  v_request_id text := btrim(coalesce(p_request_id, ''));
  v_provider_request_id text :=
    nullif(btrim(coalesce(p_provider_request_id, '')), '');
  v_model text := nullif(btrim(coalesce(p_model, '')), '');
  v_retriable boolean := case
    when lower(coalesce(p_error ->> 'retriable', 'true')) = 'false' then false
    else true
  end;
begin
  if p_job_id is null or p_lease_token is null or v_day_key = '' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_failure_identity_required';
  end if;
  if v_request_id = '' or char_length(v_request_id) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_request_id_invalid';
  end if;
  if p_error is null or jsonb_typeof(p_error) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_error_payload_invalid';
  end if;
  if v_provider_request_id is not null
     and char_length(v_provider_request_id) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_provider_request_id_invalid';
  end if;
  if v_model is not null and char_length(v_model) > 200 then
    raise exception using
      errcode = 'P0001',
      message = 'generation_model_invalid';
  end if;

  select *
  into v_job
  from public.programming_generation_jobs
  where id = p_job_id
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_not_found';
  end if;

  select *
  into v_step
  from public.programming_generation_steps
  where job_id = p_job_id
    and day_key = v_day_key
  for update;
  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_not_found';
  end if;

  if v_step.status = 'completed' then
    return jsonb_build_object(
      'failed', false,
      'alreadyComplete', true,
      'idempotent', true,
      'job', to_jsonb(v_job),
      'step', to_jsonb(v_step)
    );
  end if;
  if v_step.status = 'failed' then
    if v_step.request_id is distinct from v_request_id then
      raise exception using
        errcode = 'P0001',
        message = 'generation_step_request_conflict';
    end if;

    return jsonb_build_object(
      'failed', true,
      'alreadyComplete', false,
      'idempotent', true,
      'job', to_jsonb(v_job),
      'step', to_jsonb(v_step)
    );
  end if;

  if v_step.request_id is distinct from v_request_id then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_request_conflict';
  end if;
  if v_step.status <> 'running'
     or v_job.status <> 'generating'
     or v_step.lease_token is distinct from p_lease_token
     or v_job.lease_token is distinct from p_lease_token
     or v_job.current_day is distinct from v_day_key
     or v_step.lease_expires_at <= v_now
     or v_job.lease_expires_at <= v_now then
    raise exception using
      errcode = 'P0001',
      message = 'generation_step_lease_lost';
  end if;

  update public.programming_generation_steps
  set
    status = 'failed',
    retriable = v_retriable,
    lease_token = null,
    lease_expires_at = null,
    provider_request_id = v_provider_request_id,
    provider_request_ids = case
      when v_provider_request_id is null
        or v_provider_request_id = any(provider_request_ids)
        then provider_request_ids
      else array_append(provider_request_ids, v_provider_request_id)
    end,
    model = v_model,
    duration_ms = greatest(coalesce(p_duration_ms, 0), 0),
    result = null,
    error = p_error,
    completed_at = v_now
  where id = v_step.id
  returning * into v_step;

  update public.programming_generation_jobs
  set
    status = 'failed',
    current_day = v_day_key,
    error = p_error,
    revision = revision + 1,
    lease_token = null,
    lease_expires_at = null,
    completed_at = null
  where id = v_job.id
  returning * into v_job;

  return jsonb_build_object(
    'failed', true,
    'alreadyComplete', false,
    'idempotent', false,
    'job', to_jsonb(v_job),
    'step', to_jsonb(v_step)
  );
end;
$$;

-- Supabase 2026: la exposición por Data API necesita grants explícitos además
-- de RLS. No hay políticas para anon/authenticated; la API interna usa
-- service_role y las RPC SECURITY INVOKER conservan ese mismo límite.
alter table public.programming_generation_jobs enable row level security;
alter table public.programming_generation_steps enable row level security;

revoke all on table
  public.programming_generation_jobs,
  public.programming_generation_steps
from public, anon, authenticated;

grant select, insert, update on table
  public.programming_generation_jobs,
  public.programming_generation_steps
to service_role;

revoke all on function public.programming_generation_set_updated_at()
  from public, anon, authenticated;

revoke all on function public.claim_programming_generation_step(
  uuid,
  text,
  text,
  integer
) from public, anon, authenticated;
revoke all on function public.complete_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  jsonb,
  integer,
  integer
) from public, anon, authenticated;
revoke all on function public.fail_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.claim_programming_generation_step(
  uuid,
  text,
  text,
  integer
) to service_role;
grant execute on function public.complete_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  jsonb,
  integer,
  integer
) to service_role;
grant execute on function public.fail_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer
) to service_role;

comment on table public.programming_generation_jobs is
  'Jobs internos y persistentes de generación EVO. Contrato compatible con programmingGenerationJobs.js; solo service_role.';
comment on table public.programming_generation_steps is
  'Un resultado durable por job y día, con lease e historial de request IDs; solo service_role.';
comment on function public.claim_programming_generation_step(
  uuid,
  text,
  text,
  integer
) is
  'Reclama el primer día pendiente. Devuelve acquired, alreadyComplete, leaseToken y step.';
comment on function public.complete_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  jsonb,
  integer,
  integer
) is
  'Guarda atómicamente el resultado, uso y semana parcial antes de responder; los tres metadatos finales son opcionales.';
comment on function public.fail_programming_generation_step(
  uuid,
  text,
  uuid,
  jsonb,
  text,
  text,
  text,
  integer
) is
  'Registra un fallo conservando el progreso parcial y libera el lease del día.';
