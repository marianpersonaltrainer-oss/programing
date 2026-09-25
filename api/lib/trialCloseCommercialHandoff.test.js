import { describe, expect, it } from 'vitest'
import { toCommercialTrialHandoff } from './trialCloseCommercialHandoff.js'

const event = {
  event_id: 'cefe3d4a-4ef9-4b9d-95a9-70c05960c1dc',
  event_type: 'trial.close.recorded',
  occurred_at: '2026-09-25T11:30:00.000Z',
  organization_id: '4c0b7390-986d-4ef2-9fd3-3f87e6f2fdb2',
  external_id: 'referencia-interna-001',
  payload: {
    coach_id: 'coach-001',
    attendance: 'vino',
    entry_point: 'EVO Basics',
    priority: 'Moverse con seguridad y confianza',
    adaptations: 'Necesitó modificar un ejercicio.',
    reason: 'Observación técnica interna del entrenador.',
  },
}

describe('relevo comercial del cierre de prueba', () => {
  it('solo expone el mínimo comercial y exige vinculación manual', () => {
    expect(toCommercialTrialHandoff(event)).toEqual({
      schema_version: 1,
      source_event_id: event.event_id,
      source_occurred_at: '2026-09-25T11:30:00.000Z',
      organization_id: event.organization_id,
      person_reference: 'referencia-interna-001',
      attendance: 'vino',
      commercial_state: 'trial_completed_requires_review',
      manual_lead_link_required: true,
      recommended_entry_point: 'EVO Basics',
      initial_priority: 'Moverse con seguridad y confianza',
      excluded_fields: ['coach_id', 'adaptations', 'reason'],
    })
  })

  it('no arrastra recomendación para una prueba no realizada', () => {
    const handoff = toCommercialTrialHandoff({
      ...event,
      payload: { ...event.payload, attendance: 'no vino' },
    })

    expect(handoff).toMatchObject({
      attendance: 'no vino',
      commercial_state: 'trial_not_completed_requires_review',
      recommended_entry_point: null,
      initial_priority: null,
    })
  })

  it('falla cerrado si el evento no cumple el contrato', () => {
    expect(toCommercialTrialHandoff({ ...event, event_type: 'other.event' })).toBeNull()
    expect(toCommercialTrialHandoff({ ...event, external_id: '' })).toBeNull()
    expect(toCommercialTrialHandoff({ ...event, occurred_at: 'not-a-date' })).toBeNull()
    expect(toCommercialTrialHandoff({
      ...event,
      payload: { ...event.payload, entry_point: '' },
    })).toBeNull()
  })
})
