import { describe, expect, it } from 'vitest'
import { METHOD_EVO_V1, METHOD_EVO_V1_PROMPT } from './methodEvoV1.js'
import { validateEvoSessionContract } from './validators/validateEvoSession.js'
import { validateEvoWeek } from './validators/validateEvoWeek.js'

describe('Método EVO 1.3 — contrato y validadores', () => {
  it('expone versión, estado y IDs de regla únicos', () => {
    expect(METHOD_EVO_V1.meta.version).toBe('1.3.0')
    expect(METHOD_EVO_V1.meta.status).toBe('active')
    const ids = METHOD_EVO_V1.global_rules.map((rule) => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    const validatorIds = METHOD_EVO_V1.validators.map((validator) => validator.id)
    expect(new Set(validatorIds).size).toBe(validatorIds.length)
    expect(validatorIds).toContain('VAL-OUTPUT-003')
  })

  it('renderiza la identidad correcta de EvoFit', () => {
    expect(METHOD_EVO_V1_PROMPT).toContain('Clase completa de fuerza, accesorios y acondicionamiento con menor complejidad técnica, no menor exigencia')
    expect(METHOD_EVO_V1_PROMPT).toContain('barra y porcentajes')
    expect(METHOD_EVO_V1_PROMPT).toContain('bloque de aprendizaje de halterofilia')
    expect(METHOD_EVO_V1_PROMPT).not.toMatch(/nadie sale destrozado|fuerza funcional básica/i)
  })

  it('define un feedback natural que explica intención y sensación', () => {
    expect(METHOD_EVO_V1.feedback_rules.required).toEqual([
      'daily_intent',
      'expected_session_feeling',
    ])
    expect(METHOD_EVO_V1_PROMPT).toContain('párrafo fluido de 3-5 frases y 35-90 palabras')
    expect(METHOD_EVO_V1_PROMPT).toContain('encabezados rígidos OBJETIVO / SENSACIONES / ANTICIPACIÓN')
  })

  it('acepta una sesión canónica de fuerza + intervalos con descanso proporcional', () => {
    const session = `A) FUERZA — 15 MIN
Back Squat
5 series x 4 repeticiones @75-80%
Descanso: 2:00-2:30

B) INTERVALOS — 13 MIN
5 rondas:
2 min de trabajo / 45 seg de descanso
5 Burpees
10 Wall Balls
No se realiza el último descanso.`
    const result = validateEvoSessionContract(session)
    expect(result.valid).toBe(true)
    expect(result.warnings.map((entry) => entry.code)).toContain('VAL-MATERIAL-002')
  })

  it('detecta secciones visibles prohibidas y AMRAP mal rotulado', () => {
    const session = `BIENVENIDA
CALENTAMIENTO — 8 MIN
A) FUERZA — 12 MIN
Back Squat
B) POR TIEMPO — TC 12 MIN
AMRAP 12 MIN
10 Burpees`
    const result = validateEvoSessionContract(session)
    expect(result.valid).toBe(false)
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OUTPUT-001')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-FORMAT-001')
  })

  it('calcula intervalos sin último descanso', () => {
    const bad = `A) INTERVALOS — 20 MIN
5 rondas:
2 min de trabajo / 2 min de descanso
No se realiza el último descanso.`
    const result = validateEvoSessionContract(bad)
    expect(result.valid).toBe(false)
    expect(result.errors.find((entry) => entry.code === 'VAL-TIME-001')?.message).toContain('18 min')
  })

  it('exige que la salida empiece en A/B/C y que cada título tenga duración', () => {
    const prefixed = `0'-8' CALENTAMIENTO\nA) FUERZA\nBack Squat`
    const result = validateEvoSessionContract(prefixed)
    expect(result.valid).toBe(false)
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OUTPUT-001')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OUTPUT-002')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OUTPUT-003')
  })

  it('permite porcentajes sobre RM sin confundirlos con pedir un nuevo RM', () => {
    const session = `A) FUERZA — 15 MIN\nBack Squat\n5 series x 5 repeticiones @75 % RM`
    expect(validateEvoSessionContract(session).valid).toBe(true)
    expect(validateEvoSessionContract(`${session}\nNo buscar RM hoy.`).valid).toBe(true)

    const invalid = `${session}\nApuntad un nuevo RM al terminar.`
    expect(validateEvoSessionContract(invalid).errors.map((entry) => entry.code)).toContain('VAL-RECORD-001')
  })

  it('bloquea una clase fuera de oferta y feedback sin sesión', () => {
    const week = {
      dias: [
        {
          nombre: 'MARTES',
          evobasics: 'A) TÉCNICA — 10 MIN\nBack Squat\nB) FUERZA — 15 MIN\nBack Squat\n4 x 5 @RIR 2',
          feedback_basics: '',
          evohybrix: '(no programada esta semana)',
          feedback_hybrix: 'Feedback inventado',
        },
      ],
    }
    const result = validateEvoWeek(week)
    expect(result.valid).toBe(false)
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OFFER-001')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-OFFER-002')
  })

  it('permite que la oferta semanal elegida sustituya el calendario temporal del método', () => {
    const week = {
      dias: [
        {
          nombre: 'MARTES',
          evobasics: 'A) TÉCNICA — 10 MIN\nBack Squat\nB) FUERZA — 15 MIN\nBack Squat\n4 x 5 @RIR 2',
          feedback_basics: '',
        },
      ],
    }
    const offer = {
      EvoFuncional: [],
      EvoBasics: ['martes'],
      EvoFit: [],
      EvoHybrix: [],
      EvoFuerza: [],
      'EvoGimnástica': [],
      EvoTodos: [],
    }

    expect(validateEvoWeek(week, { offer }).valid).toBe(true)
  })

  it('bloquea detalles organizativos inventados en el feedback', () => {
    const week = {
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: 'A) FUERZA — 15 MIN\nBack Squat\n5 x 5 @75 % RM',
          feedback_funcional: 'Montad cinco parejas en el RowErg y cambiad cada minuto.',
        },
      ],
    }
    const result = validateEvoWeek(week)
    expect(result.valid).toBe(false)
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-FEEDBACK-001')
  })

  it('aplica la identidad completa de EvoFit como error publicable', () => {
    const valid = `A) FUERZA — 15 MIN
Peso muerto con barra
5 x 4 @75-80 % RM
B) ACCESORIOS — 8 MIN
3 vueltas con calidad: Press landmine + Dominada estricta / Ring Row
C) AMRAP — 8 MIN
6 Burpees over line
8 Box Step-over
10 Sit-ups`
    expect(validateEvoSessionContract(valid, { classKey: 'evofit' }).valid).toBe(true)

    const invalid = `A) TÉCNICA — 12 MIN
Drills de Clean
B) AMRAP — 12 MIN
10 Burpees`
    const result = validateEvoSessionContract(invalid, { classKey: 'evofit' })
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-FIT-002')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-FIT-003')
  })

  it('permite variar EvoFit con dos bloques largos de fuerza', () => {
    const session = `A) FUERZA PRINCIPAL — 15 MIN
Barbell Floor Press
6 x 3 @80-85 % RM
Descanso 2 min

B) FUERZA COMPLEMENTARIA — 15 MIN
5 rondas con calidad:
5 Strict Pull-Up / 8 Ring Row
8+8 Reverse Lunge
20'' Hollow Hold`
    expect(validateEvoSessionContract(session, { classKey: 'evofit' }).valid).toBe(true)
  })

  it('bloquea descansos largos vacíos y permite combinar fuerza con accesorio', () => {
    const emptyRest = `A) FUERZA — 16 MIN
Back Squat
Cada 4' x 4 series:
2 reps @85 % RM`
    expect(validateEvoSessionContract(emptyRest, { mesocycleWeek: 5 }).errors.map((entry) => entry.code)).toContain(
      'VAL-STRENGTH-001',
    )

    const combined = `A) FUERZA — 15 MIN
Cada 3' x 5 series:
3 Barbell Floor Press @85 % RM
+
3-5 Strict Pull-Up @RIR 1-2`
    expect(validateEvoSessionContract(combined, { mesocycleWeek: 5 }).valid).toBe(true)

    const week6Test = `A) FUERZA TEST — 15 MIN
Back Squat RM
Cada 3' x 5 series finales:
1 repetición`
    expect(validateEvoSessionContract(week6Test, { mesocycleWeek: 6 }).valid).toBe(true)
  })

  it('detecta una semana de Funcional dominada por intervalos repetidos', () => {
    const intervalSession = `A) INTERVALOS — 14 MIN
5 rondas · 2' trabajo / 1' descanso
8 Slam Ball
10 Sit-Ups`
    const week = {
      semana: 5,
      mesociclo: 'fuerza',
      dias: ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES'].map((nombre) => ({
        nombre,
        evofuncional: intervalSession,
        feedback_funcional: '',
      })),
    }
    const result = validateEvoWeek(week)
    expect(result.valid).toBe(false)
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-VARIETY-002')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-VARIETY-003')
    expect(result.errors.map((entry) => entry.code)).toContain('VAL-VARIETY-004')
  })

  it('no confunde una carrera metafórica y trata estaciones logísticas como aviso', () => {
    const week = {
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: 'A) FUERZA — 15 MIN\nBack Squat\n5 x 5 @75 % RM',
          feedback_funcional: 'No quiero que esto se convierta en una carrera. Montad estaciones si ayuda al espacio.',
        },
      ],
    }
    const result = validateEvoWeek(week)
    expect(result.valid).toBe(true)
    expect(result.warnings.map((entry) => entry.code)).toContain('VAL-FEEDBACK-001')
  })
})
