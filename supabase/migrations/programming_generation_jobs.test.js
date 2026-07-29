import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260729000701_programming_generation_jobs.sql', import.meta.url),
  'utf8',
).toLowerCase()
const stepContractSql = readFileSync(
  new URL(
    './20260729000707_programming_generation_step_contract.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase()
const finalizeSql = readFileSync(
  new URL(
    './20260729000713_finalize_programming_generation_job.sql',
    import.meta.url,
  ),
  'utf8',
).toLowerCase()

function functionBodyFrom(source, name) {
  const start = source.indexOf(`create or replace function public.${name}`)
  expect(start, `${name} debe existir`).toBeGreaterThanOrEqual(0)
  const end = source.indexOf('\n$$;', start)
  expect(end, `${name} debe cerrar su cuerpo`).toBeGreaterThan(start)
  return source.slice(start, end + 4)
}

function functionBody(name) {
  return functionBodyFrom(sql, name)
}

function tableBody(name, nextName) {
  const start = sql.indexOf(`create table if not exists public.${name}`)
  expect(start, `${name} debe existir`).toBeGreaterThanOrEqual(0)
  const endMarker = nextName
    ? `create table if not exists public.${nextName}`
    : 'create unique index'
  const end = sql.indexOf(endMarker, start)
  expect(end, `${name} debe cerrar su definición`).toBeGreaterThan(start)
  return sql.slice(start, end)
}

describe('migración de jobs persistentes de generación', () => {
  it('conserva el contrato de programmingGenerationJobs.js', () => {
    const jobs = tableBody(
      'programming_generation_jobs',
      'programming_generation_steps',
    )
    const steps = tableBody('programming_generation_steps')

    for (const column of [
      'idempotency_key text not null',
      'fingerprint text not null',
      "status text not null default 'queued'",
      "target jsonb not null default '{}'::jsonb",
      "configuration jsonb not null default '{}'::jsonb",
      'current_day text',
      "completed_days text[] not null default '{}'::text[]",
      'partial_week jsonb',
      'error jsonb',
      'revision integer not null default 0',
      'created_at timestamptz',
      'updated_at timestamptz',
      'completed_at timestamptz',
    ]) {
      expect(jobs).toContain(column)
    }
    for (const status of [
      'queued',
      'preparing',
      'generating',
      'ready',
      'failed',
      'cancelled',
    ]) {
      expect(jobs).toContain(`'${status}'`)
    }

    for (const column of [
      'job_id uuid not null',
      'day_key text not null',
      'attempt_count integer not null default 0',
      'request_id text not null',
      "request_ids text[] not null default '{}'::text[]",
      'provider_request_id text',
      'model text',
      'duration_ms integer',
      'input_tokens integer',
      'output_tokens integer',
      'result jsonb',
      'error jsonb',
      'started_at timestamptz',
      'completed_at timestamptz',
      'updated_at timestamptz',
    ]) {
      expect(steps).toContain(column)
    }

    expect(jobs).not.toContain('request_fingerprint')
    expect(jobs).not.toContain('mesociclo text')
    expect(jobs).not.toContain('final_week')
    expect(steps).not.toContain('idempotency_key')
    expect(steps).not.toContain('finished_at')
    expect(sql).not.toMatch(
      /\bdrop\s+table\s+(?:if\s+exists\s+)?public\.programming_generation_/,
    )
    expect(sql).not.toMatch(
      /\bdelete\s+from\s+public\.programming_generation_/,
    )
  })

  it('añade unicidad e índices para recuperación, estado y leases', () => {
    for (const index of [
      'programming_generation_jobs_idempotency_uidx',
      'programming_generation_jobs_fingerprint_idx',
      'programming_generation_jobs_status_idx',
      'programming_generation_jobs_active_lease_idx',
      'programming_generation_steps_job_day_uidx',
      'programming_generation_steps_job_request_uidx',
      'programming_generation_steps_request_history_idx',
      'programming_generation_steps_job_status_idx',
      'programming_generation_steps_active_lease_idx',
      'programming_generation_steps_provider_request_idx',
    ]) {
      expect(sql).toContain(`index if not exists ${index}`)
    }
    expect(sql).toContain(
      'on public.programming_generation_steps (job_id, day_key)',
    )
    expect(sql).toContain(
      'on public.programming_generation_jobs using hash (fingerprint)',
    )
    expect(sql).toContain(
      'on public.programming_generation_steps (job_id, request_id)',
    )
    expect(sql).toContain(
      'on public.programming_generation_steps using gin (request_ids)',
    )
  })

  it('expone el contrato RPC exacto usado por el endpoint', () => {
    const claim = functionBody('claim_programming_generation_step')
    const complete = functionBody('complete_programming_generation_step')
    const fail = functionBody('fail_programming_generation_step')

    expect(claim).toMatch(
      /p_job_id uuid,\s*p_day_key text,\s*p_request_id text,\s*p_lease_seconds integer/,
    )
    expect(complete).toMatch(
      /p_job_id uuid,\s*p_day_key text,\s*p_lease_token uuid,\s*p_result jsonb,\s*p_model text,\s*p_request_id text,\s*p_provider_request_id text,\s*p_duration_ms integer,\s*p_partial_week jsonb default null,\s*p_input_tokens integer default null,\s*p_output_tokens integer default null/,
    )
    expect(fail).toMatch(
      /p_job_id uuid,\s*p_day_key text,\s*p_lease_token uuid,\s*p_error jsonb,\s*p_model text,\s*p_request_id text,\s*p_provider_request_id text,\s*p_duration_ms integer/,
    )

    for (const key of [
      "'claimed'",
      "'acquired'",
      "'reused'",
      "'alreadycomplete'",
      "'leasetoken'",
      "'job'",
      "'step'",
    ]) {
      expect(claim).toContain(key)
    }
  })

  it('mantiene tablas y RPC cerradas salvo para service_role', () => {
    expect(sql).toContain(
      'alter table public.programming_generation_jobs enable row level security',
    )
    expect(sql).toContain(
      'alter table public.programming_generation_steps enable row level security',
    )
    expect(sql).toContain('from public, anon, authenticated')
    expect(sql).toContain('grant select, insert, update on table')
    expect(sql).toContain('to service_role;')
    expect(sql).not.toContain('create policy')
    expect(sql).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,180}\bto\s+(?:anon|authenticated)\b/,
    )

    for (const name of [
      'claim_programming_generation_step',
      'complete_programming_generation_step',
      'fail_programming_generation_step',
    ]) {
      const body = functionBody(name)
      expect(body).toContain('security invoker')
      expect(body).toContain('set search_path = pg_catalog, public')
      expect(sql).toContain(`revoke all on function public.${name}`)
      expect(sql).toContain(`grant execute on function public.${name}`)
    }
    expect(sql).not.toContain('security definer')
    expect(sql.match(/grant execute on function public\./g)).toHaveLength(3)
    expect(sql).not.toMatch(
      /grant\s+execute[\s\S]{0,220}\bto\s+(?:public|anon|authenticated)\b/,
    )
  })

  it('claim serializa el job, respeta el orden y no duplica intentos', () => {
    const body = functionBody('claim_programming_generation_step')

    expect(body).toContain('for update')
    expect(body).toContain('generation_day_out_of_order')
    expect(body).toContain('generation_request_id_conflict')
    expect(body).toContain('v_step.request_id = v_request_id')
    expect(body).toContain('v_step.lease_expires_at > v_now')
    expect(body).toContain('v_job.lease_expires_at > v_now')
    expect(body).toContain(
      'greatest(15, least(coalesce(p_lease_seconds, 90), 120))',
    )
    expect(body).toContain('attempt_count = attempt_count + 1')
    expect(body).toContain(
      'when v_request_id = any(request_ids) then request_ids',
    )
    expect(body).toContain('revision = revision + 1')
    expect(body).toContain("'acquired', true")
    expect(body).toContain("'alreadycomplete', true")
    expect(body).not.toContain("'genstep_'")
    expect(body).not.toContain('generation_request_id_already_used')
  })

  it('complete valida request y lease y guarda el día antes del job', () => {
    const body = functionBody('complete_programming_generation_step')
    const stepUpdate = body.indexOf(
      'update public.programming_generation_steps',
    )
    const jobUpdate = body.indexOf('update public.programming_generation_jobs')

    expect(body).toContain("if v_step.status = 'completed'")
    expect(body).toContain("'idempotent', true")
    expect(body).toContain(
      'v_step.request_id is distinct from v_request_id',
    )
    expect(body).toContain(
      'v_step.lease_token is distinct from p_lease_token',
    )
    expect(body).toContain("v_job.status <> 'generating'")
    expect(body).toContain(
      'v_job.lease_token is distinct from p_lease_token',
    )
    expect(body).toContain('v_step.lease_expires_at <= v_now')
    expect(body).toContain('v_job.lease_expires_at <= v_now')
    expect(body).toContain('p_partial_week')
    expect(body).toContain('p_input_tokens')
    expect(body).toContain('p_output_tokens')
    expect(body).toContain('jsonb_set(')
    expect(body).toContain('result = p_result')
    expect(body).toContain(
      'input_tokens = greatest(coalesce(p_input_tokens, 0), 0)',
    )
    expect(body).toContain(
      'output_tokens = greatest(coalesce(p_output_tokens, 0), 0)',
    )
    expect(body).toContain("status = 'generating'")
    expect(body).toContain(
      'current_day = case when v_all_days_complete then null else v_next_day end',
    )
    expect(body).toContain('completed_at = null')
    expect(body).toContain("'alldayscomplete', v_all_days_complete")
    expect(body).not.toContain("status = 'ready'")
    expect(body).toContain('completed_days = v_completed_days')
    expect(body).toContain('partial_week = v_partial_week')
    expect(body).toContain('revision = revision + 1')
    expect(stepUpdate).toBeGreaterThanOrEqual(0)
    expect(jobUpdate).toBeGreaterThan(stepUpdate)
  })

  it('alinea el contrato step con una migración complementaria', () => {
    expect(stepContractSql).toContain(
      'create or replace function public.complete_programming_generation_step',
    )
    expect(stepContractSql).toContain("status = 'generating'")
    expect(stepContractSql).toContain(
      'current_day = case when v_all_days_complete then null else v_next_day end',
    )
    expect(stepContractSql).toContain('completed_at = null')
    expect(stepContractSql).toContain("'alldayscomplete', v_all_days_complete")
    expect(stepContractSql).not.toContain("status = 'ready'")
    expect(stepContractSql).toContain(
      'grant execute on function public.complete_programming_generation_step',
    )
  })

  it('finaliza de forma autoritativa, idempotente y cerrada a service_role', () => {
    const body = functionBodyFrom(
      finalizeSql,
      'finalize_programming_generation_job',
    )

    expect(body).toContain('for update')
    expect(body).toContain('generation_job_active_lease')
    expect(body).toContain('generation_job_incomplete')
    expect(body).toContain('generation_job_revision_conflict')
    expect(body).toContain('generation_job_ready_conflict')
    expect(body).toContain("completed_step.status = 'completed'")
    expect(body).toContain('jsonb_typeof(completed_step.result)')
    expect(body).toContain("if v_job.status = 'ready'")
    expect(body).toContain("'idempotent', true")
    expect(body).toContain("status = 'ready'")
    expect(body).toContain('where id = v_job.id')
    expect(body).toContain('and revision = p_expected_revision')
    expect(finalizeSql).toContain(
      'revoke all on function public.finalize_programming_generation_job',
    )
    expect(finalizeSql).toContain(
      'grant execute on function public.finalize_programming_generation_job',
    )
    expect(finalizeSql).toContain('to service_role;')
    expect(finalizeSql).not.toMatch(
      /grant\s+execute[\s\S]{0,220}\bto\s+(?:public|anon|authenticated)\b/,
    )
  })

  it('fail libera el lease sin borrar el progreso parcial', () => {
    const body = functionBody('fail_programming_generation_step')

    expect(body).toContain("if v_step.status = 'failed'")
    expect(body).toContain("'idempotent', true")
    expect(body).toContain(
      'v_step.request_id is distinct from v_request_id',
    )
    expect(body).toContain(
      'v_step.lease_token is distinct from p_lease_token',
    )
    expect(body).toContain("v_job.status <> 'generating'")
    expect(body).toContain("status = 'failed'")
    expect(body).toContain('current_day = v_day_key')
    expect(body).toContain('error = p_error')
    expect(body).toContain('revision = revision + 1')
    expect(body).toContain('lease_token = null')
    expect(body).not.toContain('partial_week = null')
  })
})
