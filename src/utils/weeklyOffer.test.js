import { describe, expect, it } from 'vitest'
import {
  buildCurrentWeeklyOfferSelection,
  getSelectedClassKeysForDay,
  getSelectedOfferDays,
  parseWeeklyOfferSelection,
  serializeWeeklyOfferSelection,
  weeklyOfferSelectionFromWeekData,
  weeklyOfferSelectionToValidationOffer,
} from './weeklyOffer.js'

describe('oferta semanal editable', () => {
  it('carga exactamente la oferta confirmada para el 27 de julio al 2 de agosto', () => {
    const selection = buildCurrentWeeklyOfferSelection()

    expect(getSelectedClassKeysForDay(selection, 'LUNES')).toEqual([
      'evofuncional',
      'evobasics',
      'evofit',
      'evohybrix',
    ])
    expect(getSelectedClassKeysForDay(selection, 'MARTES')).toEqual([
      'evofuncional',
      'evofit',
      'evogimnastica',
    ])
    expect(getSelectedClassKeysForDay(selection, 'MIÉRCOLES')).toEqual([
      'evofuncional',
      'evobasics',
      'evofit',
      'evohybrix',
    ])
    expect(getSelectedClassKeysForDay(selection, 'JUEVES')).toEqual(['evofuncional', 'evofit'])
    expect(getSelectedClassKeysForDay(selection, 'VIERNES')).toEqual([
      'evofuncional',
      'evobasics',
      'evofit',
    ])
    expect(getSelectedClassKeysForDay(selection, 'SÁBADO')).toEqual([])
    expect(getSelectedOfferDays(selection)).toEqual([
      'LUNES',
      'MARTES',
      'MIÉRCOLES',
      'JUEVES',
      'VIERNES',
    ])
  })

  it('guarda y recupera la selección sin perder días vacíos', () => {
    const original = buildCurrentWeeklyOfferSelection()
    const serialized = serializeWeeklyOfferSelection(original)
    const parsed = parseWeeklyOfferSelection(serialized)

    expect(parsed).toEqual(original)
    expect(serialized.dias.SÁBADO).toEqual([])
  })

  it('convierte la selección a la oferta exacta del validador', () => {
    const offer = weeklyOfferSelectionToValidationOffer(buildCurrentWeeklyOfferSelection())

    expect(offer.EvoFuncional).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes'])
    expect(offer.EvoBasics).toEqual(['lunes', 'miércoles', 'viernes'])
    expect(offer.EvoFit).toEqual(['lunes', 'martes', 'miércoles', 'jueves', 'viernes'])
    expect(offer.EvoHybrix).toEqual(['lunes', 'miércoles'])
    expect(offer['EvoGimnástica']).toEqual(['martes'])
    expect(offer.EvoFuerza).toEqual([])
    expect(offer.EvoTodos).toEqual([])
  })

  it('reconstruye la oferta de un histórico que aún no guardaba metadatos', () => {
    const selection = weeklyOfferSelectionFromWeekData({
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: 'A) FUERZA — 15 MIN\nBack Squat',
          evofit: '(no programada esta semana)',
        },
      ],
    })

    expect(getSelectedClassKeysForDay(selection, 'LUNES')).toEqual(['evofuncional'])
    expect(getSelectedOfferDays(selection)).toEqual(['LUNES'])
  })
})
