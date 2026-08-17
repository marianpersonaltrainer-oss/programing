import { describe, expect, it } from 'vitest'
import {
  createMiCaminoProjectionEnvelope,
  MiCaminoProjectionContractError,
  validateMiCaminoProjectionEnvelope,
} from './miCaminoProjectionEnvelope.js'

const PROJECTION_ID = '018f1f4d-7b6c-7d8e-9f10-111213141530'
const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141531'
const PERSON_ID = '018f1f4d-7b6c-7d8e-9f10-111213141532'
const ACTION_ID = '018f1f4d-7b6c-7d8e-9f10-111213141533'

function validInput(overrides = {}) {
  return {
    projection_id: PROJECTION_ID,
    organization_id: ORG_ID,
    person_id: PERSON_ID,
    entry_mode: 'new',
    journey_day: 12,
    stage_key: 'concierge_0_14',
    next_action: {
      action_id: ACTION_ID,
      kind: 'approved_content',
      title: 'Revisa tu siguiente paso',
      status: 'available',
      due_at: null,
      reference_id: 'content:welcome:version:1',
    },
    progress: {
      confirmed_attendance_count: 3,
      completed_action_count: 2,
      total_action_count: 4,
      next_milestone_key: null,
    },
    freshness: {
      status: 'fresh',
      source: 'nucleus',
      source_updated_at: '2026-08-17T09:00:00.000Z',
      observed_at: '2026-08-17T09:00:05.000Z',
    },
    data_class: 'P2',
    schema_version: 1,
    updated_at: '2026-08-17T09:00:05.000Z',
    ...overrides,
  }
}

describe('Mi Camino 0→30 customer projection contract', () => {
  it('crea una proyección privada, versionada e inmutable', () => {
    const projection = createMiCaminoProjectionEnvelope(validInput())

    expect(projection).toMatchObject({
      projection_id: PROJECTION_ID,
      entry_mode: 'new',
      journey_day: 12,
      data_class: 'P2',
      schema_version: 1,
    })
    expect(Object.isFrozen(projection)).toBe(true)
    expect(Object.isFrozen(projection.next_action)).toBe(true)
    expect(Object.isFrozen(projection.progress)).toBe(true)
    expect(Object.isFrozen(projection.freshness)).toBe(true)
  })

  it('limita una alta nueva al slice piloto 0→30', () => {
    for (const journeyDay of [-1, 31, null]) {
      const result = validateMiCaminoProjectionEnvelope(validInput({ journey_day: journeyDay }))
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('journey_day:outside_pilot_slice')
    }
  })

  it('no finge un Día 0 para una persona veterana', () => {
    const veteran = createMiCaminoProjectionEnvelope(validInput({
      entry_mode: 'veteran',
      journey_day: null,
      stage_key: 'veteran_next_hito',
    }))
    expect(veteran.journey_day).toBeNull()

    expect(validateMiCaminoProjectionEnvelope(validInput({
      entry_mode: 'veteran',
      journey_day: 0,
    })).errors).toContain('journey_day:must_be_null_for_veteran')
  })

  it('mantiene la proyección en P2 y rechaza campos privados inventados', () => {
    const result = validateMiCaminoProjectionEnvelope(validInput({
      data_class: 'P1',
      private_health_note: 'no debe entrar en la proyección',
    }))
    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'data_class:must_be_p2',
      'projection.private_health_note:unknown_field',
    ]))
  })

  it('valida progreso agregado sin convertir reservas en asistencia', () => {
    const result = validateMiCaminoProjectionEnvelope(validInput({
      progress: {
        confirmed_attendance_count: 2,
        completed_action_count: 5,
        total_action_count: 4,
        next_milestone_key: null,
        reservation_count: 8,
      },
    }))
    expect(result.errors).toEqual(expect.arrayContaining([
      'progress.completed_action_count:above_total',
      'progress.reservation_count:unknown_field',
    ]))
  })

  it('expone frescura neutral y detecta tiempos contradictorios', () => {
    const stale = createMiCaminoProjectionEnvelope(validInput({
      freshness: {
        status: 'stale',
        source: 'nucleus',
        source_updated_at: null,
        observed_at: '2026-08-17T09:00:05.000Z',
      },
    }))
    expect(stale.freshness.status).toBe('stale')

    const invalid = validateMiCaminoProjectionEnvelope(validInput({
      freshness: {
        status: 'fresh',
        source: 'nucleus',
        source_updated_at: '2026-08-17T09:01:00.000Z',
        observed_at: '2026-08-17T09:00:00.000Z',
      },
    }))
    expect(invalid.errors).toContain('freshness.observed_at:before_source_updated_at')
  })

  it('falla cerrado con identidad, acción o versión inválidas', () => {
    expect(() => createMiCaminoProjectionEnvelope(validInput({
      organization_id: 'staging',
      next_action: { ...validInput().next_action, title: '' },
      schema_version: 0,
    }))).toThrow(MiCaminoProjectionContractError)
  })
})
