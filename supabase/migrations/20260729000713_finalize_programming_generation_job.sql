-- Finalización autoritativa del job semanal, aplicada en producción como
-- 20260729000713.
--
-- El navegador no puede escribir directamente el estado del job. Esta RPC
-- bloquea la fila, comprueba la revisión y demuestra que cada día solicitado
-- tiene un step completo antes de publicar la semana definitiva como ready.

create or replace function public.finalize_programming_generation_job(
  p_job_id uuid,
  p_expected_revision integer,
  p_partial_week jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_job public.programming_generation_jobs%rowtype;
  v_now timestamptz := clock_timestamp();
  v_selected_days text[];
  v_completed_step_count integer;
begin
  if p_job_id is null
     or p_expected_revision is null
     or p_expected_revision < 0
     or p_partial_week is null
     or jsonb_typeof(p_partial_week) <> 'object' then
    raise exception using
      errcode = 'P0001',
      message = 'invalid_generation_job_finalize_input';
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

  if (
    v_job.lease_token is not null
    and v_job.lease_expires_at > v_now
  ) or exists (
    select 1
    from public.programming_generation_steps as active_step
    where active_step.job_id = v_job.id
      and active_step.status = 'running'
      and active_step.lease_token is not null
      and active_step.lease_expires_at > v_now
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_active_lease';
  end if;

  select coalesce(
    array_agg(selected.day_key order by selected.first_ordinality),
    '{}'::text[]
  )
  into v_selected_days
  from (
    select
      upper(btrim(source.value)) as day_key,
      min(source.ordinality) as first_ordinality
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(v_job.configuration -> 'generationDays') = 'array'
          then v_job.configuration -> 'generationDays'
        else '[]'::jsonb
      end
    ) with ordinality as source(value, ordinality)
    where upper(btrim(source.value)) = any(array[
      'LUNES',
      'MARTES',
      'MIÉRCOLES',
      'JUEVES',
      'VIERNES',
      'SÁBADO'
    ]::text[])
    group by upper(btrim(source.value))
  ) as selected;

  if cardinality(v_selected_days) = 0
     or cardinality(v_job.completed_days) <> cardinality(v_selected_days)
     or not (v_selected_days <@ v_job.completed_days)
     or not (v_job.completed_days <@ v_selected_days) then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_incomplete',
      detail = 'completed_days does not match configuration.generationDays';
  end if;

  select count(*)
  into v_completed_step_count
  from public.programming_generation_steps as completed_step
  where completed_step.job_id = v_job.id
    and completed_step.day_key = any(v_selected_days)
    and completed_step.status = 'completed'
    and completed_step.result is not null
    and jsonb_typeof(completed_step.result) = 'object';

  if v_completed_step_count <> cardinality(v_selected_days) then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_incomplete',
      detail = 'not every configured day has a completed durable step';
  end if;

  if v_job.status = 'ready' then
    if v_job.partial_week = p_partial_week then
      return jsonb_build_object(
        'finalized', true,
        'idempotent', true,
        'job', to_jsonb(v_job)
      );
    end if;

    raise exception using
      errcode = 'P0001',
      message = 'generation_job_ready_conflict';
  end if;

  if v_job.status = 'cancelled' then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_not_finalizable';
  end if;

  if v_job.revision <> p_expected_revision then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_revision_conflict';
  end if;

  update public.programming_generation_jobs
  set
    status = 'ready',
    current_day = null,
    completed_days = v_selected_days,
    partial_week = p_partial_week,
    error = null,
    revision = revision + 1,
    lease_token = null,
    lease_expires_at = null,
    completed_at = v_now
  where id = v_job.id
    and revision = p_expected_revision
  returning * into v_job;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'generation_job_revision_conflict';
  end if;

  return jsonb_build_object(
    'finalized', true,
    'idempotent', false,
    'job', to_jsonb(v_job)
  );
end;
$$;

-- Restablece explícitamente el mínimo privilegio después de las migraciones
-- anteriores: service_role puede operar filas, pero no borrar los trabajos.
revoke all on table
  public.programming_generation_jobs,
  public.programming_generation_steps
from public, anon, authenticated, service_role;

grant select, insert, update on table
  public.programming_generation_jobs,
  public.programming_generation_steps
to service_role;

revoke all on function public.finalize_programming_generation_job(
  uuid,
  integer,
  jsonb
) from public, anon, authenticated, service_role;

grant execute on function public.finalize_programming_generation_job(
  uuid,
  integer,
  jsonb
) to service_role;

comment on function public.finalize_programming_generation_job(
  uuid,
  integer,
  jsonb
) is
  'Finaliza un job con CAS solo cuando todos los días configurados tienen steps durables completos; reintentos ready idénticos son idempotentes.';
