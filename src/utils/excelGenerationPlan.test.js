import { describe, expect, it } from 'vitest'
import { resolveDaysToGenerateFromSelection } from './excelGenerationPlan.js'

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
