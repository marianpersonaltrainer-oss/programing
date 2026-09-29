import { describe, expect, it } from 'vitest'
import { CoachTrialBriefError, normalizeCoachTrialBrief } from './coachTrialBriefIntake.js'

const valid = {
  id: 'brief-001',
  coachId: '00000000-0000-4000-8000-000000000001',
  trialReference: 'trial-001',
  sessionAt: '2026-09-28T17:00:00.000Z',
  classLabel: 'EVO Basics',
  source: 'calendly',
  occurredAt: '2026-09-28T08:00:00.000Z',
  brief: { objective: 'Ganar seguridad al empezar.', observe: 'Explicar el ritmo de la clase con calma.' },
}

describe('coach trial brief intake', () => {
  it('acepta un resumen operativo mínimo asociado a una prueba concreta', () => {
    expect(normalizeCoachTrialBrief(valid)).toEqual(expect.objectContaining({
      coachId: valid.coachId,
      trialReference: 'trial-001',
      source: 'calendly',
      brief: valid.brief,
    }))
  })

  it('rechaza conversaciones, contacto y otros datos que el coach no necesita', () => {
    expect(() => normalizeCoachTrialBrief({ ...valid, conversation: 'chat entero' })).toThrow(CoachTrialBriefError)
    expect(() => normalizeCoachTrialBrief({ ...valid, brief: { objective: 'Ganar seguridad', phone: '600000000' } })).toThrow('brief.brief.phone_forbidden')
  })
})
