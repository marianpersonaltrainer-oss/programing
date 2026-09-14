import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(
  new URL('./20260914195817_programming_agent_vps_queue.sql', import.meta.url),
  'utf8',
).toLowerCase()

function functionBody(name) {
  const start = sql.indexOf(`create or replace function public.${name}`)
  expect(start, `${name} debe existir`).toBeGreaterThanOrEqual(0)
  const end = sql.indexOf('\n$$;', start)
  expect(end, `${name} debe cerrar su cuerpo`).toBeGreaterThan(start)
  return sql.slice(start, end + 4)
}

describe('migración de cola privada del Agente Programador VPS', () => {
  it('crea una cola privada, acotada y sin publicación', () => {
    expect(sql).toContain('create table if not exists public.programming_agent_requests')
    for (const column of [
      "request_type text not null check (request_type = 'weekly_briefing')",
      'fingerprint text not null',
      'target jsonb not null check (jsonb_typeof(target) = \'object\')',
      'request_payload jsonb not null check (jsonb_typeof(request_payload) = \'object\')',
      "status text not null default 'queued'",
      'response_payload jsonb',
      'attempt_count integer not null default 0 check (attempt_count between 0 and 3)',
      'lease_expires_at timestamptz',
      "expires_at timestamptz not null default (now() + interval '30 minutes')",
    ]) {
      expect(sql).toContain(column)
    }
    expect(sql).not.toMatch(/\b(?:publish|wodbuster_write|programacion_write)\b/)
  })

  it('no expone solicitudes, borradores ni RPC a clientes', () => {
    expect(sql).toContain('alter table public.programming_agent_requests enable row level security')
    expect(sql).toContain('revoke all on table public.programming_agent_requests from anon, authenticated')
    expect(sql).toContain('grant select, insert, update, delete on table public.programming_agent_requests to service_role')
    expect(sql).not.toContain('create policy')
    expect(sql).not.toMatch(
      /grant\s+(?:select|insert|update|delete|all)[\s\S]{0,180}\bto\s+(?:anon|authenticated)\b/,
    )
    expect(sql).not.toContain('security definer')

    for (const name of [
      'claim_programming_agent_request',
      'complete_programming_agent_request',
      'fail_programming_agent_request',
    ]) {
      const body = functionBody(name)
      expect(body).toContain('security invoker')
      expect(body).toContain('set search_path = pg_catalog, public')
      expect(sql).toContain(`revoke all on function public.${name}`)
      expect(sql).toContain(`grant execute on function public.${name}`)
    }
    expect(sql).not.toMatch(
      /grant\s+execute[\s\S]{0,220}\bto\s+(?:public|anon|authenticated)\b/,
    )
  })

  it('reclama una solicitud de forma atómica y limita los reintentos', () => {
    const claim = functionBody('claim_programming_agent_request')
    expect(claim).toContain('for update skip locked')
    expect(claim).toContain("status = 'queued'")
    expect(claim).toContain("status = 'processing' and lease_expires_at < now() and attempt_count < 3")
    expect(claim).toContain("status = 'processing'")
    expect(claim).toContain('attempt_count = candidate.attempt_count + 1')
    expect(claim).toContain("lease_expires_at = now() + interval '5 minutes'")
  })

  it('solo completa o falla la solicitud que mantiene un lease vigente', () => {
    const complete = functionBody('complete_programming_agent_request')
    const fail = functionBody('fail_programming_agent_request')
    for (const body of [complete, fail]) {
      expect(body).toContain("status = 'processing'")
      expect(body).toContain('lease_expires_at > now()')
      expect(body).toContain('lease_expires_at = null')
    }
    expect(complete).toContain("status = 'completed'")
    expect(complete).toContain('response_payload = p_response_payload')
    expect(fail).toContain("status = 'failed'")
    expect(fail).toContain('error_code = p_error_code')
  })
})
