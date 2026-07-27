import { describe, expect, it } from 'vitest'
import { mergeDayFromAiPatch } from './mergeDayFromAiPatch.js'

describe('mergeDayFromAiPatch', () => {
  it('no permite que una autocorrección borre una clase válida inventando FESTIVO', () => {
    const previous = {
      nombre: 'LUNES',
      evofuncional: 'A) Back Squat · 15 min',
      feedback_funcional: 'Carga progresiva y técnica.',
    }

    expect(
      mergeDayFromAiPatch(previous, {
        nombre: 'LUNES',
        evofuncional: 'FESTIVO',
        feedback_funcional: '',
        wodbuster: 'FESTIVO',
      }),
    ).toEqual(previous)
  })

  it('conserva un FESTIVO que ya existía legítimamente', () => {
    const previous = { nombre: 'LUNES', evofuncional: 'FESTIVO', feedback_funcional: '' }
    expect(mergeDayFromAiPatch(previous, { evofuncional: 'FESTIVO' }).evofuncional).toBe('FESTIVO')
  })

  it('bloquea también FESTIVO con descripción cuando intenta borrar una clase', () => {
    const previous = {
      nombre: 'LUNES',
      evofuncional: 'A) Back Squat · 15 min',
      feedback_funcional: 'Carga progresiva y técnica.',
      wodbuster: 'Sesión real.',
    }
    expect(
      mergeDayFromAiPatch(previous, {
        evofuncional: 'FESTIVO — Sin sesión',
        feedback_funcional: '',
        wodbuster: 'FESTIVO — Centro cerrado',
      }),
    ).toEqual(previous)
  })

  it('permite crear FESTIVO solo con autorización explícita', () => {
    const previous = {
      nombre: 'LUNES',
      evofuncional: 'Back Squat 5x3',
      feedback_funcional: 'Mantén técnica.',
      wodbuster: 'Sesión de fuerza.',
    }
    const next = mergeDayFromAiPatch(
      previous,
      {
        evofuncional: 'FESTIVO',
        feedback_funcional: '',
        wodbuster: 'FESTIVO',
      },
      { allowHolidayCreation: true },
    )

    expect(next.evofuncional).toBe('FESTIVO')
    expect(next.feedback_funcional).toBe('')
    expect(next.wodbuster).toBe('FESTIVO')
  })
})
