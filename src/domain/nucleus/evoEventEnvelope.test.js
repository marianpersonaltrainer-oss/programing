import { describe, expect, it } from 'vitest'
import {
  createEvoEventEnvelope,
  EvoEventContractError,
  validateEvoEventEnvelope,
} from './evoEventEnvelope.js'

const EVENT_ID = '018f1f4d-7b6c-7d8e-9f10-111213141516'
const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141517'
const PERSON_ID = '018f1f4d-7b6c-7d8e-9f10-111213141518'

function validInput(overrides = {}) {
  return {
    event_id: EVENT_ID,
    event_type: 'programming.week.published',
    occurred_at: '2026-08-13T12:00:00+02:00',
    observed_at: '2026-08-13T10:00:05.000Z',
    source: 'programming',
    organization_id: ORG_ID,
    person_id: PERSON_ID,
    external_id: 'week:42:version:3',
    schema_version: 1,
    payload: { week_id: 42, version: 3 },
    idempotency_key: 'programming:week:42:version:3:published',
    correlation_id: EVENT_ID,
    causation_id: null,
    source_updated_at: '2026-08-13T09:59:58.000Z',
    reconciled_at: null,
    sync_status: 'pending',
    ...overrides,
  }
}

describe('EVO-S canonical event envelope', () => {
  it('normaliza el sobre recomendado y lo hace inmutable', () => {
    const event = createEvoEventEnvelope(validInput())

    expect(event.occurred_at).toBe('2026-08-13T10:00:00.000Z')
    expect(event.correlation_id).toBe(EVENT_ID)
    expect(Object.isFrozen(event)).toBe(true)
    expect(Object.isFrozen(event.payload)).toBe(true)
    expect(() => { event.payload.version = 4 }).toThrow()
  })

  it('completa identidad, observación, correlación y versión sin proveedor', () => {
    const generated = '018f1f4d-7b6c-7d8e-9f10-111213141519'
    const event = createEvoEventEnvelope({
      event_type: 'programming.week.published',
      occurred_at: '2026-08-13T10:00:00.000Z',
      source: 'programming',
      organization_id: ORG_ID,
      person_id: null,
      external_id: 'week:42:version:3',
      payload: {},
      idempotency_key: 'programming:week:42:version:3:published',
    }, {
      generateId: () => generated,
      now: () => new Date('2026-08-13T10:00:01.000Z'),
    })

    expect(event).toMatchObject({
      event_id: generated,
      correlation_id: generated,
      schema_version: 1,
      sync_status: 'pending',
      observed_at: '2026-08-13T10:00:01.000Z',
      causation_id: null,
      reconciled_at: null,
    })
  })

  it('exige una clave de idempotencia estable', () => {
    expect(validateEvoEventEnvelope(validInput({ idempotency_key: '' }))).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.arrayContaining(['idempotency_key:invalid_length']),
      }),
    )
  })

  it('rechaza causalidad autorreferente y observación anterior al hecho', () => {
    const result = validateEvoEventEnvelope(validInput({
      causation_id: EVENT_ID,
      occurred_at: '2026-08-13T10:00:10.000Z',
      observed_at: '2026-08-13T10:00:05.000Z',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'causation_id:self_reference',
      'observed_at:before_occurred_at',
    ]))
  })

  it('rechaza secretos en cualquier profundidad del payload', () => {
    expect(() => createEvoEventEnvelope(validInput({
      payload: {
        safe: true,
        nested: { anthropicApiKey: 'must-not-enter-events' },
      },
    }))).toThrow(EvoEventContractError)
  })

  it('exige evidencia temporal cuando un evento queda reconciliado', () => {
    const result = validateEvoEventEnvelope(validInput({
      sync_status: 'reconciled',
      reconciled_at: null,
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain(
      'reconciled_at:required_for_reconciled_status',
    )
  })

  it('acepta solo JSON plano, finito y acotado', () => {
    const invalid = validateEvoEventEnvelope(validInput({
      payload: {
        invalid_number: Number.POSITIVE_INFINITY,
        invalid_date: new Date(),
      },
    }))

    expect(invalid.ok).toBe(false)
    expect(invalid.errors).toEqual(expect.arrayContaining([
      'payload.invalid_number:non_finite_number',
      'payload.invalid_date:not_json_compatible',
    ]))
  })

  it('rechaza estados, versiones, tipos y campos no contractuales', () => {
    const result = validateEvoEventEnvelope(validInput({
      event_type: 'Published Week',
      schema_version: 0,
      sync_status: 'done',
      silent_overwrite: true,
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'event_type:invalid_format',
      'schema_version:invalid_version',
      'sync_status:invalid_status',
      'silent_overwrite:unknown_field',
    ]))
  })

  it('mantiene external_id opcional pero organización obligatoria', () => {
    expect(validateEvoEventEnvelope(validInput({ external_id: null })).ok).toBe(true)
    expect(validateEvoEventEnvelope(validInput({ organization_id: null }))).toEqual(
      expect.objectContaining({
        ok: false,
        errors: expect.arrayContaining(['organization_id:invalid_uuid']),
      }),
    )
  })
})
