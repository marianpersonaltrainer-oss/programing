import { describe, expect, it } from 'vitest'
import {
  buildProgrammingGenerationRecoveryState,
} from './programmingGenerationRecovery.js'

function completedStep(day, session) {
  return {
    day,
    status: 'completed',
    result: {
      dia: {
        nombre: day,
        evofuncional: session,
      },
    },
  }
}

describe('programmingGenerationRecovery', () => {
  it('remonta con la UI vacía y continúa solo desde el tercer día', () => {
    const recovery = buildProgrammingGenerationRecoveryState({
      job: {
        id: 'job-reload',
        idempotencyKey: 'idem-reload',
        fingerprint: 'fp-reload',
        status: 'generating',
        target: {
          mesocycle: 'FUERZA',
          week: 4,
          cycleId: 'FUERZA:2026-07-06',
          weekStartDate: '2026-07-27',
        },
        configuration: {
          generationDays: ['LUNES', 'MARTES', 'MIÉRCOLES'],
          weeklyOffer: {
            version: 1,
            dias: {
              LUNES: ['evofuncional'],
              MARTES: ['evofuncional'],
              MIÉRCOLES: ['evofuncional'],
            },
          },
          instructions: 'Mantener el volumen.',
          briefingContextPack: 'Contexto verificado\nARQUITECTURA SEMANAL',
          briefingInputFingerprint: 'planning-fp',
          contextSelection: { selectedWeekIds: ['week-1', 'week-2'] },
          contextVerified: true,
          proposalSource: 'ai',
          proposalTitle: 'Fuerza estable',
          proposalNarrative: 'Dos días completados y uno pendiente.',
          proposalSuggestedFocus: 'Técnica',
          proposalAccepted: true,
        },
        currentDay: 'MIÉRCOLES',
        completedDays: ['LUNES', 'MARTES'],
        revision: 4,
      },
      steps: [
        completedStep('LUNES', 'A) Sentadilla\nB) Metcon de 12 minutos'),
        completedStep('MARTES', 'A) Peso muerto\nB) Intervalos'),
      ],
    })

    expect(recovery).toMatchObject({
      contextReady: true,
      proposalReady: true,
      canResume: true,
      pendingDays: ['MIÉRCOLES'],
      job: {
        jobId: 'job-reload',
        completedDays: ['LUNES', 'MARTES'],
      },
    })
    expect(recovery.offerSelection.LUNES.evofuncional).toBe(true)
    expect(recovery.generationDaySelection).toMatchObject({
      LUNES: true,
      MARTES: true,
      MIÉRCOLES: true,
    })
    expect(recovery.job.partialWeek.dias[0].evofuncional).toMatch(
      /Sentadilla/,
    )
  })

  it('no ofrece continuar un job cancelado', () => {
    const recovery = buildProgrammingGenerationRecoveryState({
      job: {
        id: 'job-cancelled',
        status: 'cancelled',
        target: { mesocycle: 'MIXTO', week: 2 },
        configuration: {},
        completedDays: [],
        revision: 1,
      },
      steps: [],
    })

    expect(recovery.job.phase).toBe('cancelled')
    expect(recovery.canResume).toBe(false)
  })
})
