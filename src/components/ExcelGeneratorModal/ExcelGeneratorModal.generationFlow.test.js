import { describe, expect, it, vi } from 'vitest'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { buildProgrammingGenerationRecoveryState } from '../../utils/programmingGenerationRecovery.js'
import { runPersistentDayGeneration } from '../../utils/persistentDayGeneration.js'

function generatedDay(day, marker, selectedClasses = ['evofuncional']) {
  const dia = { nombre: day }
  for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
    dia[key] =
      selectedClasses.includes(key)
        ? `A) Fuerza ${marker}\nB) Metcon controlado de doce minutos`
        : '(no programada esta semana)'
    dia[feedbackKey] = selectedClasses.includes(key) ? `Escala ${marker}.` : ''
  }
  dia.wodbuster = ''
  return { dia }
}

function snapshotAfterTwoDays() {
  const monday = generatedDay('LUNES', 'lunes')
  const tuesday = generatedDay('MARTES', 'martes')
  return {
    job: {
      id: 'job-flow',
      idempotencyKey: 'idem-flow',
      fingerprint: 'fp-flow',
      status: 'generating',
      target: {
        mesocycle: 'FUERZA',
        week: 4,
        cycleId: 'FUERZA:2026-07-06',
        weekStartDate: '2026-07-27',
      },
      configuration: {
        generationDays: [
          'LUNES',
          'MARTES',
          'MIÉRCOLES',
          'JUEVES',
          'VIERNES',
        ],
        weeklyOffer: {
          version: 1,
          dias: {
            LUNES: ['evofuncional'],
            MARTES: ['evofuncional'],
            MIÉRCOLES: ['evofuncional', 'evobasics', 'evofit'],
            JUEVES: ['evofuncional', 'evohybrix'],
            VIERNES: ['evofuncional', 'evofit'],
          },
        },
        briefingContextPack: 'Contexto Supabase verificado.',
        briefingInputFingerprint: 'planning-flow',
        contextSelection: { selectedWeekIds: ['s1', 's2'] },
        contextVerified: true,
        proposalSource: 'manual',
        proposalTitle: 'Progresión de fuerza',
        proposalNarrative: 'Continuidad técnica con carga controlada.',
        proposalAccepted: true,
      },
      completedDays: ['LUNES', 'MARTES'],
      partialWeek: {
        titulo: 'Progresión de fuerza',
        semana: 4,
        mesociclo: 'FUERZA',
        dias: [monday.dia, tuesday.dia],
      },
      currentDay: 'MIÉRCOLES',
      revision: 4,
    },
    steps: [
      { day: 'LUNES', status: 'completed', result: monday },
      { day: 'MARTES', status: 'completed', result: tuesday },
    ],
  }
}

describe('ExcelGeneratorModal generation flow', () => {
  it('recarga una semana real de cinco días, restaura el planning y genera solo los tres pendientes', async () => {
    const recovery = buildProgrammingGenerationRecoveryState(
      snapshotAfterTwoDays(),
    )
    const classesByDay = {
      MIÉRCOLES: ['evofuncional', 'evobasics', 'evofit'],
      JUEVES: ['evofuncional', 'evohybrix'],
      VIERNES: ['evofuncional', 'evofit'],
    }
    const generateDay = vi.fn(async (day) =>
      generatedDay(day, day.toLowerCase(), classesByDay[day]),
    )
    let editorWeek = recovery.job.partialWeek

    const result = await runPersistentDayGeneration({
      days: recovery.configuration.generationDays,
      completedDays: recovery.job.completedDays,
      generateDay,
      persistDay: async ({ result: generated }) => {
        editorWeek = {
          ...editorWeek,
          dias: [...editorWeek.dias, generated.dia],
        }
      },
    })

    expect(recovery).toMatchObject({
      contextReady: true,
      proposalReady: true,
      canResume: true,
      pendingDays: ['MIÉRCOLES', 'JUEVES', 'VIERNES'],
    })
    expect(generateDay).toHaveBeenCalledTimes(3)
    expect(generateDay).toHaveBeenNthCalledWith(
      1,
      'MIÉRCOLES',
      expect.objectContaining({
        completedDays: ['LUNES', 'MARTES'],
      }),
    )
    expect(result.completedDays).toEqual([
      'LUNES',
      'MARTES',
      'MIÉRCOLES',
      'JUEVES',
      'VIERNES',
    ])
    expect(editorWeek.dias.map((day) => day.nombre)).toEqual([
      'LUNES',
      'MARTES',
      'MIÉRCOLES',
      'JUEVES',
      'VIERNES',
    ])
    expect(editorWeek.dias[2].evofuncional).toMatch(/miércoles/)
    expect(editorWeek.dias[2].evobasics).toMatch(/miércoles/)
    expect(editorWeek.dias[3].evohybrix).toMatch(/jueves/)
    expect(editorWeek.dias[4].evofit).toMatch(/viernes/)
  })

  it('no inicia el día siguiente hasta que el anterior está persistido', async () => {
    const order = []
    await runPersistentDayGeneration({
      days: ['LUNES', 'MARTES'],
      generateDay: async (day) => {
        order.push(`generate:${day}`)
        return generatedDay(day, day.toLowerCase())
      },
      persistDay: async ({ day }) => {
        order.push(`persist:${day}`)
      },
    })

    expect(order).toEqual([
      'generate:LUNES',
      'persist:LUNES',
      'generate:MARTES',
      'persist:MARTES',
    ])
  })
})
