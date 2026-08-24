import { describe, expect, it } from 'vitest'
import {
  NucleusEventRecorderError,
  recordNucleusEvent,
} from './nucleusEventRecorder.js'

const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141517'

function input(overrides = {}) {
  return {
    event_type: 'nucleus.pilot.recorded',
    occurred_at: '2026-08-13T15:30:00.000Z',
    observed_at: '2026-08-13T15:30:01.000Z',
    source: 'programming',
    organization_id: ORG_ID,
    person_id: null,
    external_id: 'pilot:one',
    schema_version: 1,
    payload: { pilot: true, contract_version: 1 },
    idempotency_key: 'nucleus-pilot:one',
    causation_id: null,
    source_updated_at: null,
    reconciled_at: null,
    sync_status: 'synced',
    ...overrides,
  }
}

function inMemorySupabase({ writeError = null, lookupError = null } = {}) {
  const rows = new Map()
  const keyFor = (row) => [
    row.organization_id,
    row.source,
    row.idempotency_key,
  ].join('|')

  return {
    rows,
    from(table) {
      if (table !== 'evo_events') throw new Error('unexpected_table')
      return {
        insert(row) {
          return {
            select() {
              return {
                async single() {
                  if (writeError) return { data: null, error: writeError }
                  const key = keyFor(row)
                  if (rows.has(key)) {
                    return { data: null, error: { code: '23505' } }
                  }
                  rows.set(key, structuredClone(row))
                  return { data: structuredClone(row), error: null }
                },
              }
            },
          }
        },
        select() {
          const filters = {}
          const query = {
            eq(field, value) {
              filters[field] = value
              return query
            },
            async maybeSingle() {
              if (lookupError) return { data: null, error: lookupError }
              const key = [
                filters.organization_id,
                filters.source,
                filters.idempotency_key,
              ].join('|')
              return {
                data: rows.has(key) ? structuredClone(rows.get(key)) : null,
                error: null,
              }
            },
          }
          return query
        },
      }
    },
  }
}

describe('Nucleus event recorder', () => {
  it('crea un evento canónico con identidad determinista', async () => {
    const supabase = inMemorySupabase()

    const result = await recordNucleusEvent(supabase, input())

    expect(result.created).toBe(true)
    expect(result.event).toMatchObject({
      event_type: 'nucleus.pilot.recorded',
      organization_id: ORG_ID,
      idempotency_key: 'nucleus-pilot:one',
    })
    expect(result.event.event_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(result.event.correlation_id).toBe(result.event.event_id)
  })

  it('devuelve el evento existente en un reintento idéntico', async () => {
    const supabase = inMemorySupabase()
    const first = await recordNucleusEvent(supabase, input())
    const retry = await recordNucleusEvent(supabase, input())

    expect(first.created).toBe(true)
    expect(retry.created).toBe(false)
    expect(retry.event).toEqual(first.event)
    expect(supabase.rows.size).toBe(1)
  })

  it('trata como idénticas las fechas equivalentes normalizadas por PostgreSQL', async () => {
    const supabase = inMemorySupabase()
    const first = await recordNucleusEvent(supabase, input())
    const stored = [...supabase.rows.values()][0]
    stored.occurred_at = '2026-08-13T15:30:00+00:00'

    const retry = await recordNucleusEvent(supabase, input())

    expect(first.created).toBe(true)
    expect(retry.created).toBe(false)
    expect(retry.event.event_id).toBe(first.event.event_id)
    expect(supabase.rows.size).toBe(1)
  })

  it('resuelve concurrencia sin duplicar el hecho', async () => {
    const supabase = inMemorySupabase()
    const results = await Promise.all(
      Array.from({ length: 20 }, () => recordNucleusEvent(supabase, input())),
    )

    expect(results.filter((result) => result.created)).toHaveLength(1)
    expect(results.filter((result) => !result.created)).toHaveLength(19)
    expect(new Set(results.map((result) => result.event.event_id)).size).toBe(1)
    expect(supabase.rows.size).toBe(1)
  })

  it('rechaza reutilizar la clave con otro payload', async () => {
    const supabase = inMemorySupabase()
    await recordNucleusEvent(supabase, input())

    await expect(recordNucleusEvent(supabase, input({
      payload: { pilot: true, contract_version: 2 },
    }))).rejects.toMatchObject({
      code: 'nucleus_event_idempotency_conflict',
      status: 409,
    })
  })

  it('rechaza payload inválido antes de consultar Supabase', async () => {
    let calls = 0
    const supabase = { from: () => { calls += 1 } }

    await expect(recordNucleusEvent(supabase, input({
      payload: { nested: { serviceRoleSecret: 'forbidden' } },
    }))).rejects.toMatchObject({
      code: 'invalid_nucleus_event',
      status: 400,
    })
    expect(calls).toBe(0)
  })

  it('falla cerrado y no filtra el error de base de datos', async () => {
    const supabase = inMemorySupabase({
      writeError: { code: '42501', message: 'sensitive database detail' },
    })

    let thrown
    try {
      await recordNucleusEvent(supabase, input())
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBeInstanceOf(NucleusEventRecorderError)
    expect(thrown).toMatchObject({
      code: 'nucleus_event_write_unavailable',
      status: 503,
    })
    expect(thrown.message).not.toContain('sensitive database detail')
  })

  it('falla cerrado si el conflicto no puede reconciliarse', async () => {
    const supabase = inMemorySupabase({ lookupError: { code: 'timeout' } })
    await recordNucleusEvent(supabase, input())

    await expect(recordNucleusEvent(supabase, input())).rejects.toMatchObject({
      code: 'nucleus_event_lookup_unavailable',
      status: 503,
    })
  })
})
