import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { CANONICAL_APPROVED_EVO_WEEK } from '../domain/method/fixtures/canonicalApprovedWeek.js'
import {
  analyzeWeeklyProgramXlsx,
  buildEvoMethodAdminGate,
  isIntentionalOffDay,
  scoreForValidationOutcome,
} from './analyzeWeeklyProgramXlsx.js'

async function workbookBufferForFunctionalDays(sessionsByDay) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('S5')
  sheet.getCell('A1').value = 'Semana adversarial Método EVO'
  let row = 2
  for (const [day, session] of sessionsByDay) {
    sheet.getRow(row).getCell(1).value = day
    for (const [index, classDef] of EVO_SESSION_CLASS_DEFS.entries()) {
      sheet.getRow(row + 1).getCell(index + 1).value = classDef.label
      sheet.getRow(row + 2).getCell(index + 1).value =
        classDef.key === 'evofuncional' ? session : '(no programada esta semana)'
    }
    row += 3
  }
  return workbook.xlsx.writeBuffer()
}

async function workbookBufferForWeek(weekData) {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`S${weekData.semana || 'X'}`)
  sheet.getCell('A1').value = weekData.titulo
  let row = 2
  for (const day of weekData.dias || []) {
    sheet.getRow(row).getCell(1).value = day.nombre
    for (const [index, classDef] of EVO_SESSION_CLASS_DEFS.entries()) {
      sheet.getRow(row + 1).getCell(index + 1).value = classDef.label
      sheet.getRow(row + 2).getCell(index + 1).value =
        day[classDef.key] || '(no programada esta semana)'
      sheet.getRow(row + 3).getCell(index + 1).value = day[classDef.feedbackKey]
        ? `FEEDBACK ${classDef.label}\n${day[classDef.feedbackKey]}`
        : ''
    }
    row += 4
  }
  return workbook.xlsx.writeBuffer()
}

describe('análisis administrativo aplica las puertas del Método EVO', () => {
  it('no confunde el descanso entre series con una celda de día OFF', () => {
    expect(isIntentionalOffDay('A) FUERZA — 15 MIN\nBack Squat\nDescanso 2 min')).toBe(false)
    expect(isIntentionalOffDay('DESCANSO')).toBe(true)
    expect(isIntentionalOffDay('FESTIVO — Gimnasio cerrado')).toBe(true)
  })

  it('impide que una semana bloqueada o pendiente muestre una nota de aprobación', () => {
    expect(scoreForValidationOutcome(94, { key: 'bloqueado' })).toBe(49)
    expect(scoreForValidationOutcome(94, { key: 'revision_necesaria' })).toBe(79)
    expect(scoreForValidationOutcome(94, { key: 'aprobado' })).toBe(94)
  })

  it('bloquea descanso excesivo, intervalos consecutivos y arquitectura copiada', async () => {
    const monday = `A) FUERZA — 15 MIN
Back Squat
5 x 3 @80 % RM

B) INTERVALOS — 14 MIN
5 rondas · 2' ON / 1' OFF
6 Burpees`
    const tuesday = `A) FUERZA — 15 MIN
Deadlift
5 x 3 @80 % RM

B) INTERVALOS — 15 MIN
4 rondas · 3' ON / 1' OFF
8 Sit-Ups`
    const wednesday = tuesday.replace('Deadlift', 'Strict Press')
    const buffer = await workbookBufferForFunctionalDays([
      ['LUNES', monday],
      ['MARTES', tuesday],
      ['MIÉRCOLES', wednesday],
    ])

    const result = await analyzeWeeklyProgramXlsx({
      buffer,
      mesocycle: 'fuerza',
      week: 5,
      scope: { partialWeek: true, activeClassesOnly: true, experienciaEvo: false },
    })

    expect(result.validationOutcome).toEqual({ key: 'bloqueado', label: 'BLOQUEADO' })
    expect(result.scoreDisplay).toBeLessThan(50)
    expect(result.scoreRaw).toBeGreaterThanOrEqual(result.scoreDisplay)
    expect(result.kpi.importRecommended).toBe(false)
    expect(result.blockingReasons.join('\n')).toContain('[VAL-DENSITY-001]')
    expect(result.blockingReasons.join('\n')).toContain('[VAL-VARIETY-003]')
    expect(result.blockingReasons.join('\n')).toContain('[VAL-ARCHITECTURE-001]')
    expect(result.methodValidation.valid).toBe(false)
  })

  it('aprueba una semana canónica útil y suma correctamente la duración de sus partes', async () => {
    const buffer = await workbookBufferForWeek(CANONICAL_APPROVED_EVO_WEEK)
    const result = await analyzeWeeklyProgramXlsx({
      buffer,
      mesocycle: 'fuerza',
      week: 5,
      scope: { partialWeek: true, activeClassesOnly: true, experienciaEvo: false },
    })

    expect(result.validationOutcome).toEqual({ key: 'aprobado', label: 'APROBADO' })
    expect(result.scoreDisplay).toBeGreaterThanOrEqual(80)
    expect(result.blockingReasons).toEqual([])
    expect(result.pendingCorrections).toEqual([])
    expect(result.alerts).toEqual([])
    expect(
      result.parseDiagnostics.tiemposInferidosSesionNuCoreSample.map((entry) => entry.minInferidos),
    ).toEqual([30, 30, 28, 30, 30])
  })

  it('usa la oferta guardada y bloquea una clase ofertada que falta', () => {
    const gate = buildEvoMethodAdminGate({
      oferta_semanal: {
        version: 1,
        dias: {
          LUNES: ['evofuncional'],
          MARTES: [],
          MIÉRCOLES: [],
          JUEVES: [],
          VIERNES: [],
          SÁBADO: [],
        },
      },
      dias: [
        { nombre: 'LUNES', evofuncional: '(no programada esta semana)' },
        { nombre: 'MARTES' },
        { nombre: 'MIÉRCOLES' },
        { nombre: 'JUEVES' },
        { nombre: 'VIERNES' },
        { nombre: 'SÁBADO' },
      ],
    })

    expect(gate.validation.valid).toBe(false)
    expect(gate.blockingReasons.join('\n')).toContain('[VAL-OFFER-004]')
  })
})
