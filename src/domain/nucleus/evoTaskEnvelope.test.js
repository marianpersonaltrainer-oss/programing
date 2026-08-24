import { describe, expect, it } from 'vitest'
import {
  createEvoTaskEnvelope,
  EVO_TASK_STATUSES,
  EvoTaskContractError,
  validateEvoTaskEnvelope,
} from './evoTaskEnvelope.js'

const TASK_ID = '018f1f4d-7b6c-7d8e-9f10-111213141520'
const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141521'
const PERSON_ID = '018f1f4d-7b6c-7d8e-9f10-111213141522'
const EVIDENCE_ID = '018f1f4d-7b6c-7d8e-9f10-111213141523'

function validInput(overrides = {}) {
  return {
    task_id: TASK_ID,
    task_type: 'coach.shift.handover_review',
    source: 'programming',
    organization_id: ORG_ID,
    subject_person_id: null,
    assignee_id: null,
    status: 'pending',
    summary: 'Revisar el relevo del turno de tarde',
    data_class: 'P1',
    due_at: null,
    completed_at: null,
    evidence: [],
    schema_version: 1,
    idempotency_key: 'coach:shift:2026-08-17:handover-review',
    correlation_id: TASK_ID,
    causation_event_id: null,
    created_at: '2026-08-16T09:00:00.000Z',
    updated_at: '2026-08-16T09:00:00.000Z',
    ...overrides,
  }
}

function evidence(overrides = {}) {
  return {
    evidence_id: EVIDENCE_ID,
    kind: 'nucleus_event',
    reference_id: 'event:handover-reviewed:2026-08-17',
    data_class: 'P1',
    recorded_at: '2026-08-17T15:00:00.000Z',
    recorded_by_id: PERSON_ID,
    ...overrides,
  }
}

describe('EVO-S canonical task and evidence envelope', () => {
  it('crea una tarea pendiente versionada, trazable e inmutable', () => {
    const task = createEvoTaskEnvelope(validInput())

    expect(task).toMatchObject({
      task_id: TASK_ID,
      status: EVO_TASK_STATUSES.PENDING,
      data_class: 'P1',
      schema_version: 1,
      correlation_id: TASK_ID,
    })
    expect(Object.isFrozen(task)).toBe(true)
    expect(Object.isFrozen(task.evidence)).toBe(true)
  })

  it('genera identidad, tiempos y clasificación sin depender del proveedor', () => {
    const generatedTaskId = '018f1f4d-7b6c-7d8e-9f10-111213141524'
    const task = createEvoTaskEnvelope({
      task_type: 'coach.shift.handover_review',
      source: 'programming',
      organization_id: ORG_ID,
      summary: 'Revisar relevo',
      idempotency_key: 'coach:shift:handover-review:generated',
    }, {
      generateId: () => generatedTaskId,
      now: () => new Date('2026-08-16T10:00:00.000Z'),
    })

    expect(task).toMatchObject({
      task_id: generatedTaskId,
      correlation_id: generatedTaskId,
      status: 'pending',
      data_class: 'P1',
      created_at: '2026-08-16T10:00:00.000Z',
      updated_at: '2026-08-16T10:00:00.000Z',
    })
  })

  it('exige responsable y plazo al salir de pendiente', () => {
    const result = validateEvoTaskEnvelope(validInput({ status: 'assigned' }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'assignee_id:required_for_status',
      'due_at:required_for_status',
    ]))
  })

  it('exige evidencia referenciada y fecha al completar', () => {
    const result = validateEvoTaskEnvelope(validInput({
      status: 'completed',
      assignee_id: PERSON_ID,
      due_at: '2026-08-17T16:00:00.000Z',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'evidence:required_for_status',
      'completed_at:required_for_completed_status',
    ]))
  })

  it('acepta una tarea completada con evidencia mínima y sin payload incrustado', () => {
    const task = createEvoTaskEnvelope(validInput({
      status: 'completed',
      assignee_id: PERSON_ID,
      due_at: '2026-08-17T16:00:00.000Z',
      completed_at: '2026-08-17T15:00:00.000Z',
      updated_at: '2026-08-17T15:00:00.000Z',
      evidence: [evidence()],
    }))

    expect(task.evidence).toHaveLength(1)
    expect(task.evidence[0]).toEqual(evidence())
    expect(Object.isFrozen(task.evidence[0])).toBe(true)
  })

  it('rechaza contenido inline o campos secretos dentro de una evidencia', () => {
    expect(() => createEvoTaskEnvelope(validInput({
      evidence: [{
        ...evidence(),
        payload: { password: 'no-debe-guardarse' },
      }],
    }))).toThrow(EvoTaskContractError)
  })

  it('impide clasificar la tarea por debajo de su evidencia', () => {
    const result = validateEvoTaskEnvelope(validInput({
      data_class: 'P1',
      evidence: [evidence({ data_class: 'P3' })],
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toContain('data_class:below_evidence')
  })

  it('rechaza estados inventados, versiones inválidas y campos no contractuales', () => {
    const result = validateEvoTaskEnvelope(validInput({
      status: 'done',
      schema_version: 0,
      private_note: 'fuera del contrato',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'status:invalid_status',
      'schema_version:invalid_version',
      'private_note:unknown_field',
    ]))
  })

  it('mantiene la clave de idempotencia y la organización como obligatorias', () => {
    expect(validateEvoTaskEnvelope(validInput({ idempotency_key: '' })).errors)
      .toContain('idempotency_key:invalid_length')
    expect(validateEvoTaskEnvelope(validInput({ organization_id: null })).errors)
      .toContain('organization_id:invalid_uuid')
  })

  it('rechaza contradicciones temporales y cierre sin evidencia', () => {
    const result = validateEvoTaskEnvelope(validInput({
      status: 'closed_with_incident',
      assignee_id: PERSON_ID,
      due_at: '2026-08-15T16:00:00.000Z',
      updated_at: '2026-08-15T15:00:00.000Z',
    }))

    expect(result.ok).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'evidence:required_for_status',
      'due_at:before_created_at',
      'updated_at:before_created_at',
    ]))
  })
})
