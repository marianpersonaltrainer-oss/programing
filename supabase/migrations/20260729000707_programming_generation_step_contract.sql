-- Alineación aditiva del contrato step, aplicada en producción como
-- 20260729000707.
--
-- Completar el último step guarda todos los días, pero no marca el job como
-- ready: la finalización posterior añade la metadata semanal definitiva con
-- control de revisión desde /api/programming-generation-jobs.

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
      'allDaysComplete', v_job.current_day is null,
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
  'Completa y persiste un día bajo lease. El último día queda en generating hasta la finalización explícita con metadata completa.';
