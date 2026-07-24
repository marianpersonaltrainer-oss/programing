import { describe, expect, it } from 'vitest'
import { validateEvoWeek } from './validators/validateEvoWeek.js'
import { detectIntervalStructure } from './validators/evoIntervalDetection.js'
import { validateOfficialLibrary, assertOfficialLibrary } from './validators/validateOfficialLibrary.js'
import {
  filterGenerationContextWeeks,
  rejectContaminatedContextRows,
  validateFeedbackContext,
} from './validators/validateGenerationContext.js'
import {
  buildPartialWeekSummary,
  validatePartialGenerationCoherence,
} from './validators/buildPartialWeekSummary.js'
import { assertPe2WeekLockMatch } from '../../lib/pe2WeekLock.js'
import { validateEvoSessionContract } from './validators/validateEvoSession.js'
import { validateEvoSessionSemantics } from './validators/validateEvoSessionSemantics.js'
import { readDurationMinutes } from './validators/evoDurationUtils.js'
import { METHOD_EVO_V1 } from './methodEvoV1.js'

const OFFER_FUNCIONAL_LMX = {
  EvoFuncional: ['lunes', 'martes', 'miércoles'],
  EvoBasics: [],
  EvoFit: [],
  EvoHybrix: [],
  EvoFuerza: [],
  'EvoGimnástica': [],
  EvoTodos: [],
}

const intervalBlock = `A) INTERVALOS — 14 MIN
5 rondas:
2 min de trabajo / 1 min de descanso
8 Slam Ball
10 Sit-Ups
No se realiza el último descanso.`

const igygSession = `A) POR TIEMPO — TC 18 MIN
IGYG — 6 rondas:
40'' trabajo / 20'' descanso
10 Wall Ball
12 Sit-Up`

const stationSession = `A) POR TIEMPO — TC 20 MIN
4 estaciones · 3 min trabajo / 1 min cambio
10 KB Swing
12 Box Step-over
200 m RowErg
10 Burpees`

function day(name, sessions = {}) {
  return { nombre: name, ...sessions }
}

describe('EVO generation safeguards — adversarial', () => {
  it('1. bloquea intervalos en días consecutivos', () => {
    const week = {
      dias: [
        day('LUNES', { evofuncional: intervalBlock, feedback_funcional: '' }),
        day('MARTES', { evofuncional: intervalBlock, feedback_funcional: '' }),
      ],
    }
    const result = validateEvoWeek(week, { offer: OFFER_FUNCIONAL_LMX, validateOfferCompleteness: false })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'VAL-INTERVAL-002')).toBe(true)
  })

  it('2. bloquea más de dos días interválicos por modalidad', () => {
    const week = {
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES'].map((nombre) =>
        day(nombre, { evofuncional: intervalBlock, feedback_funcional: '' }),
      ),
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-INTERVAL-001')).toBe(true)
  })

  it('3. detecta IGYG como patrón interválico aunque no diga INTERVALOS', () => {
    expect(detectIntervalStructure(igygSession).isInterval).toBe(true)
    const week = {
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES'].map((nombre) =>
        day(nombre, { evofit: igygSession, feedback_fit: '' }),
      ),
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-INTERVAL-001')).toBe(true)
  })

  it('4. detecta estaciones con trabajo/descanso como intervalos', () => {
    expect(detectIntervalStructure(stationSession).isInterval).toBe(true)
    const week = {
      dias: [
        day('LUNES', { evohybrix: stationSession, feedback_hybrix: '' }),
        day('MIÉRCOLES', { evohybrix: stationSession, feedback_hybrix: '' }),
        day('VIERNES', { evohybrix: stationSession, feedback_hybrix: '' }),
      ],
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-INTERVAL-001')).toBe(true)
  })

  it('5. bloquea descanso incoherente con el esfuerzo en fuerza', () => {
    const session = `A) FUERZA — 16 MIN
Back Squat
Cada 4' x 4 series:
2 reps @85 % RM`
    const result = validateEvoSessionContract(session, { mesocycleWeek: 5 })
    expect(result.errors.some((e) => e.code === 'VAL-STRENGTH-001')).toBe(true)
  })

  it('6. bloquea formato repetido tres veces en la semana', () => {
    const amrap = `A) AMRAP — 12 MIN
10 Burpees
20 Sit-Up`
    const week = {
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES'].map((nombre) =>
        day(nombre, { evofuncional: amrap, feedback_funcional: '' }),
      ),
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-VARIETY-001' && /AMRAP/i.test(e.message))).toBe(true)
  })

  it('7. bloquea patrón de fuerza repetido', () => {
    const strength = `A) FUERZA — 15 MIN
Back Squat
5 x 5 @75 % RM`
    const week = {
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES'].map((nombre) =>
        day(nombre, { evofit: strength, feedback_fit: '' }),
      ),
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-VARIETY-001' && /back_squat/i.test(e.message))).toBe(true)
  })

  it('8. bloquea familia de movimiento repetida en días consecutivos', () => {
    const squatDay = `A) FUERZA — 15 MIN
Back Squat
5 x 5 @75 % RM
B) AMRAP — 10 MIN
20 Air Squat`
    const week = {
      dias: [
        day('LUNES', { evofuncional: squatDay, feedback_funcional: '' }),
        day('MARTES', { evofuncional: squatDay, feedback_funcional: '' }),
      ],
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-VARIETY-001')).toBe(true)
  })

  it('9. bloquea fatiga acumulada en días consecutivos', () => {
    const shoulder = `A) FUERZA — 15 MIN
Strict Press
5 x 5 @RIR 2
B) AMRAP — 10 MIN
10 Handstand Push-Up`
    const week = {
      dias: [
        day('LUNES', { evofuncional: shoulder, feedback_funcional: '' }),
        day('MARTES', { evofuncional: shoulder, feedback_funcional: '' }),
      ],
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-FATIGUE-001')).toBe(true)
  })

  it('10. bloquea duración imposible (>62 min en bloques)', () => {
    const longSession = `A) FUERZA — 25 MIN
Back Squat
B) AMRAP — 25 MIN
10 Burpees
C) INTERVALOS — 20 MIN
5 rondas · 2' trabajo / 1' descanso`
    const week = { dias: [day('LUNES', { evofuncional: longSession, feedback_funcional: '' })] }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-TIME-002')).toBe(true)
  })

  it('11. eleva conflicto de material compartido a error bloqueante', () => {
    const rowSession = `A) INTERVALOS — 12 MIN
5 rondas · 2' trabajo / 1' descanso
500 m RowErg`
    const week = {
      dias: [
        day('LUNES', {
          evofuncional: rowSession,
          feedback_funcional: '',
          evofit: rowSession,
          feedback_fit: '',
        }),
      ],
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-MATERIAL-001')).toBe(true)
  })

  it('12. bloquea clase ofertada ausente', () => {
    const week = {
      dias: [day('LUNES', { evofuncional: intervalBlock, feedback_funcional: '' })],
    }
    const result = validateEvoWeek(week, { offer: OFFER_FUNCIONAL_LMX })
    expect(result.errors.some((e) => e.code === 'VAL-OFFER-003')).toBe(true)
  })

  it('13. rechaza feedback de otra semana o clase', () => {
    const bad = validateFeedbackContext(
      { mesociclo: 'resistencia', semana: 2, dayName: 'Martes', classKey: 'evofit', text: 'Nota' },
      { mesociclo: 'fuerza', semana: 5, dayName: 'Lunes', classKey: 'evofuncional' },
    )
    expect(bad.valid).toBe(false)
    expect(bad.errors.some((e) => e.code === 'VAL-FEEDBACK-002')).toBe(true)
  })

  it('14. bloquea FESTIVO no autorizado', () => {
    const week = {
      dias: [day('LUNES', { evofuncional: 'FESTIVO — Sin sesión', feedback_funcional: '' })],
    }
    const result = validateEvoWeek(week, { authorizedFestivoDays: [], validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-FESTIVO-001')).toBe(true)
  })

  it('15. filtra contaminación de contexto (otro mesociclo / semana futura)', () => {
    const rows = [
      { mesociclo: 'fuerza', semana: 3, data: { dias: [] }, status: 'published' },
      { mesociclo: 'resistencia', semana: 2, data: { dias: [] }, status: 'published' },
      { mesociclo: 'fuerza', semana: 6, data: { dias: [] }, status: 'published' },
      { mesociclo: 'fuerza', semana: 4, data: { dias: [] }, status: 'draft', is_draft: true },
    ]
    const filtered = rejectContaminatedContextRows(rows, { mesociclo: 'fuerza', targetSemana: 5 })
    expect(filtered.kept.map((r) => r.semana)).toEqual([3])
    expect(filterGenerationContextWeeks(rows, { mesociclo: 'fuerza', targetSemana: 5 }).length).toBe(0)
  })

  it('16. bloquea generación sin biblioteca oficial', () => {
    expect(validateOfficialLibrary([]).ok).toBe(false)
    expect(validateOfficialLibrary(null).code).toBe('LIB-OFFICIAL-001')
    expect(() => assertOfficialLibrary([])).toThrow(/biblioteca oficial/i)
  })

  it('17. evita repetición en generación parcial', () => {
    const existing = {
      dias: [day('LUNES', { evofuncional: intervalBlock, feedback_funcional: '' })],
    }
    const summary = buildPartialWeekSummary(existing)
    const repeat = validatePartialGenerationCoherence(summary, {
      dayName: 'MIÉRCOLES',
      classKey: 'evofuncional',
      session: intervalBlock,
    })
    expect(repeat.valid).toBe(false)
    expect(repeat.errors.some((e) => e.code === 'VAL-PARTIAL-001')).toBe(true)
  })

  it('18. rechaza escritura concurrente con lock_version obsoleto', () => {
    const stale = assertPe2WeekLockMatch({ lock_version: 4 }, 3)
    expect(stale.ok).toBe(false)
    expect(stale.code).toBe('PE2-LOCK-001')
    const missing = assertPe2WeekLockMatch(null, 2)
    expect(missing.ok).toBe(false)
  })

  it('19. permite FESTIVO solo con autorización explícita del día', () => {
    const week = {
      dias: [day('LUNES', { evofuncional: 'FESTIVO — Sin sesión', feedback_funcional: '' })],
    }
    const blocked = validateEvoWeek(week, { authorizedFestivoDays: [], validateOfferCompleteness: false })
    expect(blocked.valid).toBe(false)
    const allowed = validateEvoWeek(week, { authorizedFestivoDays: ['lunes'], validateOfferCompleteness: false })
    expect(allowed.errors.some((e) => e.code === 'VAL-FESTIVO-001')).toBe(false)
  })

  it('20. detecta EMOM como día interválico', () => {
    const emom = `A) FUERZA — HIP THRUST · 14 MIN
5 series
B) ACCESORIOS + ACONDICIONAMIENTO — EMOM 16 MIN
Cada minuto: 12 KB Swing`
    expect(detectIntervalStructure(emom).isInterval).toBe(true)
  })

  it('21. detecta EVERY N seg como interválico', () => {
    const every = `A) FUERZA — BACK SQUAT · 16 MIN
5 series
B) BLOQUE FINAL — EVERY 90 SEG × 8 RONDAS (12 MIN)
10 Wall Ball`
    expect(detectIntervalStructure(every).isInterval).toBe(true)
  })

  it('22. bloquea sesión demasiado corta por modalidad', () => {
    const shortFuncional = `A) FUERZA — BENT-OVER BARBELL ROW · 18 MIN
5 series · descanso 2 min`
    const week = { dias: [day('LUNES', { evofuncional: shortFuncional, feedback_funcional: '' })] }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-TIME-003')).toBe(true)
  })

  it('23. bloquea tiempos imposibles (rondas + descanso vs TC)', () => {
    const basicsWod = `C) APLICACIÓN — WOD · 8 MIN POR TIEMPO
6 rounds for time:
8 Landmine Squat
10 KB Swing
Descanso 60 seg después de cada ronda completa.`
    const result = validateEvoSessionSemantics(`A) FUERZA — GOBLET SQUAT · 10 MIN
4 series
B) SKILL — WALKING LUNGE · 10 MIN
Progresión
${basicsWod}`, { classKey: 'evobasics' })
    expect(result.errors.some((e) => e.code === 'VAL-TIME-004')).toBe(true)
  })

  it('24. bloquea identidad incorrecta en EvoGimnástica', () => {
    const session = `A) CAPACIDAD PRINCIPAL — POWER SNATCH DESDE SUELO · 18 MIN
Progresión técnica
B) REFUERZO — PINO EN PARED · 5 MIN`
    const result = validateEvoSessionSemantics(session, { classKey: 'evogimnastica' })
    expect(result.errors.some((e) => e.code === 'VAL-IDENTITY-001')).toBe(true)
  })

  it('25. bloquea repetición de ejercicio más de dos días por modalidad', () => {
    const fitDay = `A) FUERZA — HIP THRUST · 14 MIN
5 series
B) ACCESORIOS · 8 MIN
C) ACONDICIONAMIENTO · 8 MIN
10 Kettlebell Swing ruso`
    const week = {
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES'].map((nombre) =>
        day(nombre, { evofit: fitDay, feedback_fit: '' }),
      ),
    }
    const result = validateEvoWeek(week, { validateOfferCompleteness: false })
    expect(result.errors.some((e) => e.code === 'VAL-VARIETY-003')).toBe(true)
  })

  it('26. bloquea logística imposible (dos barras por persona)', () => {
    const session = `A) FUERZA — STRICT PRESS + HALTEROFILIA · 20 MIN
Dos barras por persona o pareja compartida.
Serie 1: Strict Press`
    const result = validateEvoSessionSemantics(session, { classKey: 'evofuncional' })
    expect(result.errors.some((e) => e.code === 'VAL-LOGISTICS-001')).toBe(true)
  })

  it('27. lee duración con separador · en títulos EVO', () => {
    expect(readDurationMinutes('A) FUERZA — BENT-OVER BARBELL ROW · 18 MIN')).toBe(18)
    expect(readDurationMinutes('PARTE ÚNICA — AMRAP 34 MIN')).toBe(34)
  })

  it('regression: método expone oferta e inventario base', () => {
    expect(METHOD_EVO_V1.current_context.offer).toBeTruthy()
    expect(METHOD_EVO_V1.current_context.inventory).toBeTruthy()
  })
})
