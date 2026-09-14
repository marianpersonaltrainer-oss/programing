import { describe, expect, it } from 'vitest'
import {
  createWeeklyBriefingRequest,
  ProgrammingAgentVpsQueueError,
} from './programmingAgentVpsQueue.js'

const valid = {
  fingerprint: 'weekly-briefing-2026-09-14-abc123',
  target: {
    mesocycle: 'Base',
    week: 2,
    cycleStartDate: '2026-09-07',
    targetWeekStartDate: '2026-09-14',
  },
  contextPack: 'Contexto de programación ya verificado.',
  userInstructions: 'Protege la fatiga acumulada.',
  generationDays: ['LUNES', 'MIÉRCOLES'],
  weeklyOffer: {
    dias: {
      LUNES: ['evofuncional'],
      MIÉRCOLES: ['evofuncional', 'evofit'],
    },
  },
}

describe('contrato de la cola propia del Agente Programador', () => {
  it('acepta solo un encargo semanal acotado y sin acciones externas', () => {
    expect(createWeeklyBriefingRequest(valid)).toEqual({
      requestType: 'weekly_briefing',
      fingerprint: valid.fingerprint,
      target: {
        mesocycle: 'Base',
        week: 2,
        cycleStartDate: '2026-09-07',
        targetWeekStartDate: '2026-09-14',
      generationDays: ['LUNES', 'MIÉRCOLES'],
      weeklyOffer: { version: 1, ...valid.weeklyOffer },
      draftScope: 'weekly_architecture',
      },
      requestPayload: {
        contextPack: valid.contextPack,
        userInstructions: valid.userInstructions,
      },
    })
  })

  it('rechaza un encargo sin fechas verificables, contexto o días EVO', () => {
    for (const value of [
      { ...valid, contextPack: '' },
      { ...valid, target: { ...valid.target, targetWeekStartDate: 'mañana' } },
      { ...valid, generationDays: ['DOMINGO'] },
      { ...valid, weeklyOffer: { dias: { LUNES: ['evofuncional'] } } },
      { ...valid, draftScope: 'one_class' },
      { ...valid, fingerprint: 'corto' },
    ]) {
      expect(() => createWeeklyBriefingRequest(value)).toThrow(ProgrammingAgentVpsQueueError)
    }
  })
})
