import { describe, expect, it } from 'vitest'
import {
  buildWeekSkeleton,
  mergeGeneratedDaysIntoAccumulator,
  resolveExplicitHolidayDays,
  resolveDaysToGenerateFromSelection,
} from './excelGenerationPlan.js'

describe('resolveDaysToGenerateFromSelection', () => {
  it('genera exactamente los días marcados aunque el contexto mencione otros días', () => {
    const result = resolveDaysToGenerateFromSelection(
      new Set(['LUNES', 'MIÉRCOLES']),
      'El jueves quiero menos hombro. El lunes ya lo hicimos distinto la semana anterior.',
    )

    expect([...result.daysToGenerate]).toEqual(['LUNES', 'MIÉRCOLES'])
  })

  it('no permite que una frase de contexto desmarque un día elegido expresamente', () => {
    const result = resolveDaysToGenerateFromSelection(
      new Set(['LUNES']),
      'No generes el lunes como la semana pasada; quiero una propuesta nueva.',
    )

    expect([...result.daysToGenerate]).toEqual(['LUNES'])
    expect([...result.daysPreserved]).toEqual([])
  })

  it('mantiene una referencia de preservación solo si el día no está seleccionado', () => {
    const result = resolveDaysToGenerateFromSelection(
      new Set(['MIÉRCOLES']),
      'El lunes ya está hecho; diseña el miércoles.',
    )

    expect([...result.daysToGenerate]).toEqual(['MIÉRCOLES'])
    expect([...result.daysPreserved]).toEqual(['LUNES'])
  })
})

describe('resolveExplicitHolidayDays', () => {
  it('solo autoriza cierres afirmativos ligados a un día concreto', () => {
    expect([...resolveExplicitHolidayDays('El lunes es festivo; el centro está cerrado el jueves.')])
      .toEqual(['LUNES', 'JUEVES'])
    expect([...resolveExplicitHolidayDays('El lunes no es festivo. Jueves: festivo por confirmar.')])
      .toEqual([])
  })

  it('no contagia un festivo al día que abre con normalidad', () => {
    expect([
      ...resolveExplicitHolidayDays(
        'El lunes es festivo y el martes abrimos normal.',
      ),
    ]).toEqual(['LUNES'])
    expect([
      ...resolveExplicitHolidayDays(
        'Lunes festivo, martes con horario normal.',
      ),
    ]).toEqual(['LUNES'])
  })

  it('rechaza incertidumbre y conserva una lista afirmativa real', () => {
    expect([
      ...resolveExplicitHolidayDays(
        'El lunes quizá sea festivo, está por decidir.',
      ),
    ]).toEqual([])
    expect([
      ...resolveExplicitHolidayDays('Lunes y martes son festivos.'),
    ]).toEqual(['LUNES', 'MARTES'])
    expect([
      ...resolveExplicitHolidayDays('Cerramos lunes y martes.'),
    ]).toEqual(['LUNES', 'MARTES'])
  })
})

describe('mergeGeneratedDaysIntoAccumulator — identidad del día', () => {
  it('rechaza que una llamada para lunes devuelva domingo o martes', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')
    expect(() =>
      mergeGeneratedDaysIntoAccumulator(
        acc,
        { dias: [{ nombre: 'MARTES', evofuncional: 'No debe entrar' }] },
        new Set(['LUNES']),
      ),
    ).toThrow(/era para LUNES/)
    expect(acc.dias[0].evofuncional).toBe('')
  })

  it('rechaza una fecha distinta cuando la respuesta declara fecha', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')
    expect(() =>
      mergeGeneratedDaysIntoAccumulator(
        acc,
        { dias: [{ nombre: 'LUNES', fecha: '2026-08-03', evofuncional: 'No debe entrar' }] },
        new Set(['LUNES']),
        { LUNES: '2026-07-27' },
      ),
    ).toThrow(/fecha solicitada era 2026-07-27/)
  })

  it('fusiona únicamente una respuesta con el día esperado', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')
    mergeGeneratedDaysIntoAccumulator(
      acc,
      { dias: [{ nombre: 'lunes', evofuncional: 'Back Squat 5x3' }] },
      new Set(['LUNES']),
    )
    expect(acc.dias[0]).toMatchObject({
      nombre: 'lunes',
      evofuncional: 'Back Squat 5x3',
    })
  })

  it('no permite que QA borre una sesión válida inventando FESTIVO', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')
    acc.dias[0].evofuncional = 'Back Squat 5x3'
    acc.dias[0].feedback_funcional = 'Mantén técnica y carga.'
    acc.dias[0].wodbuster = 'Sesión de fuerza.'

    mergeGeneratedDaysIntoAccumulator(
      acc,
      {
        dias: [
          {
            nombre: 'LUNES',
            evofuncional: 'FESTIVO',
            feedback_funcional: '',
            wodbuster: 'FESTIVO',
          },
        ],
      },
      new Set(['LUNES']),
    )

    expect(acc.dias[0].evofuncional).toBe('Back Squat 5x3')
    expect(acc.dias[0].feedback_funcional).toBe('Mantén técnica y carga.')
    expect(acc.dias[0].wodbuster).toBe('Sesión de fuerza.')
  })

  it('bloquea también una frase FESTIVO no exacta inventada por QA', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')
    acc.dias[0].evofuncional = 'Back Squat 5x3'
    acc.dias[0].feedback_funcional = 'Mantén técnica y carga.'
    acc.dias[0].wodbuster = 'Sesión de fuerza.'

    mergeGeneratedDaysIntoAccumulator(
      acc,
      {
        dias: [
          {
            nombre: 'LUNES',
            evofuncional: 'FESTIVO — Sin sesión',
            feedback_funcional: '',
            wodbuster: 'FESTIVO — Centro cerrado',
          },
        ],
      },
      new Set(['LUNES']),
    )

    expect(acc.dias[0].evofuncional).toBe('Back Squat 5x3')
    expect(acc.dias[0].feedback_funcional).toBe('Mantén técnica y carga.')
    expect(acc.dias[0].wodbuster).toBe('Sesión de fuerza.')
  })

  it('solo crea FESTIVO cuando el día está autorizado explícitamente', () => {
    const acc = buildWeekSkeleton(5, 'fuerza')

    mergeGeneratedDaysIntoAccumulator(
      acc,
      {
        dias: [
          {
            nombre: 'LUNES',
            evofuncional: 'FESTIVO',
            feedback_funcional: '',
            wodbuster: 'FESTIVO',
          },
        ],
      },
      new Set(['LUNES']),
      {},
      { allowHolidayCreation: true, allowedHolidayDays: new Set(['LUNES']) },
    )

    expect(acc.dias[0].evofuncional).toBe('FESTIVO')
    expect(acc.dias[0].wodbuster).toBe('FESTIVO')
  })
})
