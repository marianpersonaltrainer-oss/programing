import { describe, expect, it } from 'vitest'
import { METHOD_EVO_V1 } from '../methodEvoV1.js'
import {
  buildEvoSessionArchitecture,
  extractEvoRestDurations,
  extractEvoWorkRestPairs,
  intervalClockMinutesFromBlock,
  isEvoStrengthBlock,
  isEvoMetabolicIntervalSession,
  parseEvoDurationSeconds,
} from './evoQualitySignals.js'
import { validateEvoSessionContract } from './validateEvoSession.js'
import { validateEvoWeek } from './validateEvoWeek.js'

const codes = (result) => result.errors.map((entry) => entry.code)

describe('señales de calidad del Método EVO 1.3', () => {
  it('normaliza minutos, segundos, reloj, formato compuesto y números escritos', () => {
    expect(parseEvoDurationSeconds("2'")).toBe(120)
    expect(parseEvoDurationSeconds("45''")).toBe(45)
    expect(parseEvoDurationSeconds('2:30')).toBe(150)
    expect(parseEvoDurationSeconds('2’30”')).toBe(150)
    expect(parseEvoDurationSeconds('tres minutos')).toBe(180)
  })

  it('extrae trabajo/descanso en las redacciones habituales', () => {
    expect(extractEvoWorkRestPairs("5 x 2' ON / 45'' OFF")[0]).toMatchObject({
      workSeconds: 120,
      restSeconds: 45,
    })
    expect(extractEvoWorkRestPairs('trabajo 3 min + descanso 1 min')[0]).toMatchObject({
      workSeconds: 180,
      restSeconds: 60,
    })
    expect(extractEvoWorkRestPairs('work/rest 2’/45”')[0]).toMatchObject({
      workSeconds: 120,
      restSeconds: 45,
    })
    expect(extractEvoWorkRestPairs('2 min de trabajo y pausa de 45 segundos')[0]).toMatchObject({
      workSeconds: 120,
      restSeconds: 45,
    })
    expect(extractEvoWorkRestPairs("5 rondas: 2' carrera / 2' recuperación")[0]).toMatchObject({
      workSeconds: 120,
      restSeconds: 120,
    })
    expect(
      extractEvoWorkRestPairs(
        '5 rondas de 2 minutos de carrera con 2 minutos para recuperar',
      )[0],
    ).toMatchObject({ workSeconds: 120, restSeconds: 120 })
    expect(extractEvoWorkRestPairs('2 min de trabajo + 90 s para cambiar')[0]).toMatchObject({
      workSeconds: 120,
      restSeconds: 90,
    })
    expect(
      extractEvoWorkRestPairs(`A) INTERVALOS — 20 MIN
5 rondas:
2' carrera
2' recuperación`)[0],
    ).toMatchObject({ workSeconds: 120, restSeconds: 120 })

    for (const phrasing of [
      '2 minutos de trabajo seguidos de 1 minuto de pausa',
      'trabaja durante 2 minutos, seguidos de 1 minuto para recuperar',
      'trabaja 2 minutos. Recupera 1 minuto.',
      '2 minutos trabajando, 1 minuto recuperando',
      'trabajo durante 2 minutos; recuperación durante 1 minuto',
      '2 minutos de trabajo y después 1 minuto de descanso',
      'trabaja 2 minutos; luego recupera 1 minuto',
    ]) {
      expect(extractEvoWorkRestPairs(phrasing)[0], phrasing).toMatchObject({
        workSeconds: 120,
        restSeconds: 60,
      })
    }
  })

  it('bloquea 2/2 y 2/1, pero permite 2/45 y 3/1 de forma aislada', () => {
    const validate = (clock, rounds, pair) =>
      validateEvoSessionContract(`A) INTERVALOS — ${clock} MIN\n${rounds} rondas · ${pair}\n6 Burpees`)

    expect(validate(13, 5, "2' ON / 45'' OFF").valid).toBe(true)
    expect(validate(15, 4, 'trabajo 3 min + descanso 1 min').valid).toBe(true)
    expect(codes(validate(18, 5, '2 min de trabajo / 2 min de descanso'))).toContain('VAL-DENSITY-001')
    expect(codes(validate(14, 5, "2' trabajo / 1' descanso"))).toContain('VAL-DENSITY-001')

    const bare = `A) ACONDICIONAMIENTO — 14 MIN
5 x 2'/1'
6 Burpees`
    expect(codes(validateEvoSessionContract(bare))).toContain('VAL-DENSITY-001')

    const workPrefix = `A) ACONDICIONAMIENTO — 14 MIN
5 x trabajo 2 min + 1 min de descanso
6 Burpees`
    expect(codes(validateEvoSessionContract(workPrefix))).toContain('VAL-DENSITY-001')

    const multiline = `A) INTERVALOS — 18 MIN
5 rondas:
2' carrera
2' recuperación`
    expect(codes(validateEvoSessionContract(multiline))).toContain('VAL-DENSITY-001')

    for (const phrasing of [
      '2 minutos de trabajo seguidos de 1 minuto de pausa',
      'trabaja durante 2 minutos, seguidos de 1 minuto para recuperar',
      'trabaja 2 minutos. Recupera 1 minuto.',
      '2 minutos trabajando, 1 minuto recuperando',
      'trabajo durante 2 minutos; recuperación durante 1 minuto',
    ]) {
      const session = `A) INTERVALOS — 14 MIN
5 rondas:
${phrasing}
6 Burpees`
      expect(codes(validateEvoSessionContract(session)), phrasing).toContain('VAL-DENSITY-001')
    }

    for (const phrasing of [
      '2 minutos de trabajo seguidos de 45 segundos de pausa',
      'trabaja 2 minutos. Recupera 45 segundos.',
    ]) {
      const session = `A) INTERVALOS — 13 MIN
5 rondas:
${phrasing}
6 Burpees`
      expect(validateEvoSessionContract(session).valid, phrasing).toBe(true)
    }

    const strengthUse = `A) FUERZA — 15 MIN
Back Squat
5 x 3 @80 % RM
Trabaja 2 minutos. Recupera 1 minuto.`
    expect(codes(validateEvoSessionContract(strengthUse))).not.toContain('VAL-DENSITY-001')
    expect(codes(validateEvoSessionContract(strengthUse))).not.toContain('VAL-TIME-001')
  })

  it('calcula el reloj sin sumar el descanso posterior a la última ronda', () => {
    expect(intervalClockMinutesFromBlock("5 rondas · 2' ON / 45'' OFF")).toBe(13)
    expect(intervalClockMinutesFromBlock('4 x trabajo 3 min + descanso 1 min')).toBe(15)
    expect(intervalClockMinutesFromBlock("5 estaciones de 3'")).toBe(15)

    const unique = `PARTE ÚNICA — 15 MIN
5 rondas · 2' ON / 45'' OFF`
    expect(codes(validateEvoSessionContract(unique))).toContain('VAL-TIME-001')

    const stations = `PARTE ÚNICA — 14 MIN
5 estaciones de 3'`
    expect(codes(validateEvoSessionContract(stations))).toContain('VAL-TIME-001')
  })

  it('reconoce pausa, recuperación y entre series en descansos de fuerza', () => {
    const accessory = `A) ACCESORIOS — 12 MIN
Press con mancuernas
3 x 10 repeticiones
Recupera tres minutos entre series`
    expect(extractEvoRestDurations(accessory).map((entry) => entry.seconds)).toContain(180)
    expect(codes(validateEvoSessionContract(accessory))).toContain('VAL-STRENGTH-002')

    const moderate = `A) FUERZA — 15 MIN
Back Squat
4 x 6 @70 % RM
Pausa entre series: 3 min`
    expect(codes(validateEvoSessionContract(moderate))).toContain('VAL-STRENGTH-002')

    const accessoryWithRir = `A) ACCESORIOS — 12 MIN
Press con mancuernas
3 x 10 @RIR 2
2 min entre series`
    expect(codes(validateEvoSessionContract(accessoryWithRir))).toContain('VAL-STRENGTH-002')

    for (const reps of [6, 8]) {
      const accessory = `A) ACCESORIOS — 12 MIN
Press con mancuernas
3 x ${reps}
Descanso 2 min`
      expect(codes(validateEvoSessionContract(accessory))).toContain('VAL-STRENGTH-002')
    }

    const moderateRm = `A) FUERZA — 16 MIN
Back Squat
3 x 3 @80 % RM · RIR 2
Descanso 4 min`
    expect(codes(validateEvoSessionContract(moderateRm))).toContain('VAL-STRENGTH-002')
  })

  it('reconoce la fuerza por movimiento, carga y prescripción aunque el título no diga FUERZA', () => {
    const namedLift = `A) BACK SQUAT — 16 MIN
4 x 6 @70 % RM
Descanso 3 min`
    const genericMainMovement = `A) MOVIMIENTO PRINCIPAL — 16 MIN
Back Squat
4 x 6 @70 % RM
Descanso 3 min`
    const genericClock = `A) BÁSICO — 16 MIN
Back Squat
Cada 4' x 4 series @80 % RM`

    expect(isEvoStrengthBlock({ header: 'BACK SQUAT — 16 MIN', text: namedLift })).toBe(true)
    expect(codes(validateEvoSessionContract(namedLift))).toContain('VAL-STRENGTH-002')
    expect(codes(validateEvoSessionContract(genericMainMovement))).toContain('VAL-STRENGTH-002')
    expect(codes(validateEvoSessionContract(genericClock))).toContain('VAL-STRENGTH-001')
    expect(buildEvoSessionArchitecture(genericClock).shape).toBe('strength')
  })

  it('no confunde con fuerza un bloque de conditioning que contiene Back Squat cargado', () => {
    for (const conditioning of [
      `A) AMRAP — 16 MIN
4 rondas
6 Back Squat @70 % RM
10 Burpees`,
      `A) ACONDICIONAMIENTO — 16 MIN
4 x 6 Back Squat @70 % RM
12 calorías de remo`,
      `A) POR TIEMPO — TC 16 MIN
4 rondas
6 Back Squat @70 % RM
10 Burpees`,
    ]) {
      const [header, ...body] = conditioning.split('\n')
      expect(
        isEvoStrengthBlock({
          header: header.replace(/^A\)\s*/, ''),
          body: body.join('\n'),
          text: conditioning,
        }),
      ).toBe(false)
      expect(codes(validateEvoSessionContract(conditioning))).not.toContain('VAL-STRENGTH-001')
      expect(codes(validateEvoSessionContract(conditioning))).not.toContain('VAL-STRENGTH-002')
      expect(buildEvoSessionArchitecture(conditioning).shape).toBe('conditioning')
    }
  })

  it('no permite que el rótulo fuerza o la duración total oculten un ON/OFF metabólico', () => {
    const sledIntervals = `A) FUERZA — 16 MIN
Sled Push pesado
Por parejas
2:00 ON / 2:00 OFF x 4 rondas (16 min)`
    const [header, ...body] = sledIntervals.split('\n')

    expect(
      isEvoStrengthBlock({
        header: header.replace(/^A\)\s*/, ''),
        body: body.join('\n'),
        text: sledIntervals,
      }),
    ).toBe(false)
    expect(codes(validateEvoSessionContract(sledIntervals))).toContain('VAL-DENSITY-001')
    expect(codes(validateEvoSessionContract(sledIntervals))).not.toContain('VAL-STRENGTH-002')
  })

  it('detecta descansos excesivos de levantamientos olímpicos aunque el título no diga FUERZA', () => {
    for (const session of [
      `A) POWER CLEAN — 20 MIN
5 x 3 @75 % RM
Descanso 4 min`,
      `A) POTENCIA — 20 MIN
Hang Power Clean
5 x 3 @75 % RM
Descanso 4 min`,
      `A) TÉCNICA — 20 MIN
Power Snatch
5 x 3 @75 % RM
Descanso 4 min`,
      `A) POTENCIA — 20 MIN
Cargada y envión
5 x 3 @75 % RM
Descanso 4 min`,
    ]) {
      const [header, ...body] = session.split('\n')
      expect(
        isEvoStrengthBlock({
          header: header.replace(/^A\)\s*/, ''),
          body: body.join('\n'),
          text: session,
        }),
      ).toBe(true)
      expect(codes(validateEvoSessionContract(session))).toContain(
        'VAL-STRENGTH-002',
      )
    }

    const conditioning = `B) AMRAP 12 MIN
6 Power Clean @75 % RM
8 Burpees`
    expect(codes(validateEvoSessionContract(conditioning))).not.toContain(
      'VAL-STRENGTH-002',
    )
  })

  it('aplica el límite de descanso a cualquier serie cargada no metabólica', () => {
    for (const session of [
      `A) TREN INFERIOR — 15 MIN
Bulgarian Split Squat
3 x 10 @RPE 8
Descanso 3 min`,
      `A) PRESS CON MANCUERNAS — 15 MIN
DB Shoulder Press
3 x 10 @RIR 2
Descanso 3 min`,
      `A) HIPERTROFIA — 15 MIN
Lat Pulldown
4 x 8 · carga moderada
Pausa 3 min`,
    ]) {
      const [header, ...body] = session.split('\n')
      expect(
        isEvoStrengthBlock({
          header: header.replace(/^A\)\s*/, ''),
          body: body.join('\n'),
          text: session,
        }),
      ).toBe(true)
      expect(codes(validateEvoSessionContract(session))).toContain(
        'VAL-STRENGTH-002',
      )
    }
  })

  it('trata descansar el tiempo restante como intervalo y exige trabajo verificable', () => {
    const session = `A) ACONDICIONAMIENTO — 16 MIN
Cada 4' completar carrera y burpees; descansa el tiempo restante`
    expect(isEvoMetabolicIntervalSession(session)).toBe(true)
    expect(codes(validateEvoSessionContract(session))).toContain('VAL-DENSITY-002')

    const extendedEmom = `A) ACONDICIONAMIENTO — 15 MIN
E3MOM durante 15 min:
Carrera + Burpees
Descansa el tiempo restante`
    expect(isEvoMetabolicIntervalSession(extendedEmom)).toBe(true)
    expect(codes(validateEvoSessionContract(extendedEmom))).toContain('VAL-DENSITY-002')

    const technicalEmom = `A) TÉCNICA — 12 MIN
EMOM 12
1 Power Clean de calidad`
    expect(isEvoMetabolicIntervalSession(technicalEmom)).toBe(false)

    const strengthClock = `A) FUERZA — 15 MIN
Back Squat
5 x 3 @80 % RM
2 min de trabajo / 1 min de descanso`
    expect(codes(validateEvoSessionContract(strengthClock))).not.toContain('VAL-DENSITY-001')
    expect(codes(validateEvoSessionContract(strengthClock))).not.toContain('VAL-TIME-001')
  })

  it('cuenta IGYG pasivo y estaciones cronometradas, pero no un IGYG sin espera', () => {
    expect(
      isEvoMetabolicIntervalSession(`A) PAREJAS — 15 MIN\nIGYG por rondas completas\n8 Burpees`),
    ).toBe(true)
    expect(
      isEvoMetabolicIntervalSession(
        `A) ESTACIONES — 15 MIN\n5 estaciones de 3': 2'30'' trabajo + 30'' cambio`,
      ),
    ).toBe(true)
    expect(
      isEvoMetabolicIntervalSession(
        `A) PAREJAS — 15 MIN\nIGYG sin espera: mientras la pareja trabaja, completa una tarea paralela`,
      ),
    ).toBe(false)
    expect(
      isEvoMetabolicIntervalSession(
        `PARTE ÚNICA — 40 MIN\nRecorrido continuo por cinco estaciones, sin pausas ni reloj por estación`,
      ),
    ).toBe(false)
    for (const flow of [
      'Cambio de estación al completar',
      'Rotación al completar',
      'Transición libre',
    ]) {
      expect(
        isEvoMetabolicIntervalSession(
          `PARTE ÚNICA — 40 MIN\nCinco estaciones continuas\n${flow}`,
        ),
      ).toBe(false)
    }
  })

  it('bloquea dos bloques interválicos principales dentro de la misma sesión', () => {
    const session = `A) INTERVALOS — 13 MIN
5 rondas · 2' ON / 45'' OFF
6 Burpees

B) EMOM — 12 MIN
Minuto 1: 10 Wall Balls
Minuto 2: 8 Sit-Ups`
    expect(codes(validateEvoSessionContract(session))).toContain('VAL-DENSITY-003')
  })

  it('bloquea sesiones cuya suma visible no cabe en la clase', () => {
    const session = `A) FUERZA — 20 MIN
Back Squat
5 x 3 @80 % RM

B) ACCESORIOS — 14 MIN
Ring Row + Sit-Up

C) AMRAP — 20 MIN
Burpees + Wall Ball`
    expect(codes(validateEvoSessionContract(session))).toContain('VAL-TIME-002')

    const tooShort = `A) FUERZA — 10 MIN
Back Squat
B) AMRAP — 10 MIN
Burpees`
    expect(validateEvoSessionContract(tooShort).warnings.map((entry) => entry.code)).toContain(
      'VAL-TIME-003',
    )

    const shortHybrix = `PARTE ÚNICA — 25 MIN
Carrera + trineo por relevos`
    expect(
      validateEvoSessionContract(shortHybrix, { classKey: 'evohybrix' }).warnings.map(
        (entry) => entry.code,
      ),
    ).toContain('VAL-TIME-003')
  })

  it('bloquea una máquina para toda la clase o cinco parejas sin rotación real', () => {
    const individual = `PARTE ÚNICA — 20 MIN
Trabajo individual
20 cal RowErg
20 Burpees`
    expect(codes(validateEvoSessionContract(individual))).toContain('VAL-MATERIAL-001')

    const pairs = `PARTE ÚNICA — 20 MIN
5 parejas
20 cal RowErg por pareja
20 Burpees`
    expect(codes(validateEvoSessionContract(pairs))).toContain('VAL-MATERIAL-001')

    const unrelatedRelay = `A) ACONDICIONAMIENTO — 12 MIN
Trabajo individual
20 cal RowErg

B) RELEVOS DE CARRERA — 12 MIN
Carrera por relevos`
    expect(codes(validateEvoSessionContract(unrelatedRelay))).toContain('VAL-MATERIAL-001')
    expect(
      codes(
        validateEvoSessionContract(unrelatedRelay, {
          organizationText: 'En el bloque B se hacen relevos de carrera.',
        }),
      ),
    ).toContain('VAL-MATERIAL-001')

    const vagueRotation = `PARTE ÚNICA — 20 MIN
Rotación al terminar
20 cal RowErg`
    expect(codes(validateEvoSessionContract(vagueRotation))).toContain('VAL-MATERIAL-001')

    const unrelatedTurn = `PARTE ÚNICA — 20 MIN
Turnos de carrera
20 cal RowErg individual`
    expect(codes(validateEvoSessionContract(unrelatedTurn))).toContain('VAL-MATERIAL-001')

    const repeatedMachineStations = `PARTE ÚNICA — 20 MIN
Cinco estaciones por parejas
A. RowErg
B. RowErg
C. RowErg
D. RowErg
E. RowErg`
    expect(codes(validateEvoSessionContract(repeatedMachineStations))).toContain(
      'VAL-MATERIAL-001',
    )

    const wrongFeedbackBlock = `A) ACONDICIONAMIENTO — 12 MIN
Trabajo individual
20 cal RowErg

B) AMRAP — 12 MIN
Burpees + Sit-Ups`
    expect(
      codes(
        validateEvoSessionContract(wrongFeedbackBlock, {
          organizationText:
            'En el bloque B: cinco estaciones por parejas.\nA. RowErg\nB. Burpees\nC. Sit-Ups\nD. Wall Ball\nE. Carry',
        }),
      ),
    ).toContain('VAL-MATERIAL-001')
  })

  it('permite máquinas cuando la distribución usa los cinco puestos o estaciones reales', () => {
    const allErgs = `PARTE ÚNICA — 20 MIN
5 parejas repartidas en las máquinas disponibles: RowErg / Bike / SkiErg
Cambios libres de 30''`
    expect(validateEvoSessionContract(allErgs).valid).toBe(true)

    const stations = `PARTE ÚNICA — 20 MIN
Estaciones por parejas
A. RowErg
B. Burpees
C. Sit-Ups
D. Wall Ball
E. Farmer Carry`
    expect(validateEvoSessionContract(stations).valid).toBe(true)

    const organizationInFeedback = `PARTE ÚNICA — 20 MIN
20 cal RowErg
20 Burpees`
    expect(
      validateEvoSessionContract(organizationInFeedback, {
        organizationText:
          'Cinco estaciones por parejas; empieza una pareja en cada estación.\nA. RowErg\nB. Burpees\nC. Sit-Ups\nD. Wall Ball\nE. Farmer Carry',
      }).valid,
    ).toBe(true)
  })

  it('admite una excepción de montaje explicada en feedback y reservas simultáneas reales', () => {
    const highSetup = `A) FUERZA — 15 MIN
Back Squat
5 x 3 @80 % RM

B) AMRAP — 15 MIN
Burpees + Sit-Ups`
    expect(
      validateEvoSessionContract(highSetup, {
        organizationText:
          'La barra no se reutiliza en el segundo bloque para evitar fatiga lumbar acumulada.',
      }).warnings.map((entry) => entry.code),
    ).not.toContain('VAL-MATERIAL-002')

    const machineSession = `PARTE ÚNICA — 20 MIN
Relevos en RowErg y carrera`
    const shared = validateEvoWeek({
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: machineSession,
          feedback_funcional: 'Reserva el RowErg en la primera franja.',
          evohybrix: machineSession,
          feedback_hybrix: 'Reserva el RowErg en la segunda franja; las clases no coinciden.',
        },
      ],
    })
    expect(shared.warnings.map((entry) => entry.code)).not.toContain('VAL-MATERIAL-003')

    const internalTurnsOnly = validateEvoWeek({
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: `PARTE ÚNICA — 20 MIN\nTurnos por parejas en SkiErg`,
          evohybrix: `PARTE ÚNICA — 40 MIN\nTurnos por parejas en SkiErg`,
        },
      ],
    })
    expect(internalTurnsOnly.warnings.map((entry) => entry.code)).toContain('VAL-MATERIAL-003')
  })

  it('construye una huella que distingue formato exacto y esqueleto', () => {
    const first = buildEvoSessionArchitecture(`A) FUERZA — 15 MIN
Cada 4' x 4 series
2 Back Squat
B) INTERVALOS — 13 MIN
5 rondas · 2' ON / 45'' OFF`)
    const second = buildEvoSessionArchitecture(`A) FUERZA — 15 MIN
5 x 3 Deadlift
B) INTERVALOS — 15 MIN
4 rondas · 3' ON / 1' OFF`)
    expect(first.exact).not.toBe(second.exact)
    expect(first.skeleton).toBe(second.skeleton)
    expect(first.shape).toBe('strength>conditioning')
    expect(second.shape).toBe(first.shape)
  })

  it('bloquea intervalos consecutivos aunque se llamen ON/OFF y estaciones', () => {
    const week = {
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: `A) INTERVALOS — 13 MIN\n5 rondas · 2' ON / 45'' OFF\nBurpees`,
        },
        {
          nombre: 'MARTES',
          evofuncional: `A) ESTACIONES — 15 MIN\n5 estaciones de 3': 2'30'' trabajo + 30'' cambio`,
        },
      ],
    }
    expect(codes(validateEvoWeek(week))).toContain('VAL-VARIETY-003')
  })

  it('bloquea una arquitectura exacta repetida en días consecutivos', () => {
    const session = `A) FUERZA — 15 MIN
5 x 3 @80 % RM
B) AMRAP — 15 MIN
8 Burpees
10 Sit-Ups`
    const result = validateEvoWeek({
      dias: [
        { nombre: 'LUNES', evofuncional: `A) FUERZA — 15 MIN\nBack Squat\n${session.split('\n').slice(1).join('\n')}` },
        { nombre: 'MARTES', evofuncional: `A) FUERZA — 15 MIN\nDeadlift\n${session.split('\n').slice(1).join('\n')}` },
      ],
    })
    expect(codes(result)).toContain('VAL-ARCHITECTURE-001')

    const singleAmrap = `PARTE ÚNICA — 20 MIN
AMRAP
8 Burpees
10 Sit-Ups`
    expect(
      codes(
        validateEvoWeek({
          dias: [
            { nombre: 'LUNES', evofuncional: singleAmrap },
            { nombre: 'MARTES', evofuncional: singleAmrap },
          ],
        }),
      ),
    ).toContain('VAL-ARCHITECTURE-001')
  })

  it('bloquea la familia olímpica en tres días de una modalidad', () => {
    const result = validateEvoWeek({
      dias: [
        { nombre: 'LUNES', evofuncional: 'A) TÉCNICA — 15 MIN\nPower Clean' },
        { nombre: 'MIÉRCOLES', evofuncional: 'A) TÉCNICA — 15 MIN\nDumbbell Snatch' },
        { nombre: 'VIERNES', evofuncional: 'A) TÉCNICA — 15 MIN\nPush Jerk' },
      ],
    })
    expect(codes(result)).toContain('VAL-FATIGUE-002')

    const spanish = validateEvoWeek({
      dias: [
        { nombre: 'LUNES', evofuncional: 'A) TÉCNICA — 15 MIN\nCargada' },
        { nombre: 'MIÉRCOLES', evofuncional: 'A) TÉCNICA — 15 MIN\nArrancada' },
        { nombre: 'VIERNES', evofuncional: 'A) TÉCNICA — 15 MIN\nEnvión' },
      ],
    })
    expect(codes(spanish)).toContain('VAL-FATIGUE-002')
  })

  it('solo admite FESTIVO exacto y autorizado explícitamente', () => {
    expect(validateEvoSessionContract('FESTIVO inventado por la IA').valid).toBe(false)
    const week = {
      dias: [{ nombre: 'LUNES', evofuncional: 'FESTIVO', wodbuster: 'FESTIVO' }],
    }
    expect(codes(validateEvoWeek(week))).toContain('VAL-OFFER-003')
    expect(codes(validateEvoWeek(week, { allowedHolidayDays: [] }))).toContain('VAL-OFFER-003')
    expect(validateEvoWeek(week, { allowedHolidayDays: ['lunes'] }).valid).toBe(true)

    const inconsistentWodBuster = {
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: 'PARTE ÚNICA — 20 MIN\nAMRAP de Burpees',
          wodbuster: 'FESTIVO',
        },
      ],
    }
    expect(
      codes(validateEvoWeek(inconsistentWodBuster, { allowedHolidayDays: ['lunes'] })),
    ).toContain('VAL-OFFER-003')
  })

  it('bloquea una clase ofertada ausente cuando existe la cuadrícula completa', () => {
    const offer = {
      EvoFuncional: ['lunes'],
      EvoBasics: [],
      EvoFit: [],
      EvoHybrix: [],
      EvoFuerza: [],
      'EvoGimnástica': [],
      EvoTodos: [],
    }
    const result = validateEvoWeek(
      {
        dias: [
          { nombre: 'LUNES', evofuncional: '(no programada esta semana)' },
          { nombre: 'MARTES' },
        ],
      },
      { offer, requireCompleteOffer: true },
    )
    expect(codes(result)).toContain('VAL-OFFER-004')
  })

  it('bloquea la arquitectura del mismo día histórico sin progresión verificable', () => {
    const session = `A) FUERZA — 15 MIN
Back Squat
5 x 3 @80 % RM
B) AMRAP — 15 MIN
8 Burpees
10 Sit-Ups`
    const current = { dias: [{ nombre: 'LUNES', evofuncional: session }] }
    const previous = { dias: [{ nombre: 'LUNES', evofuncional: session }] }
    expect(codes(validateEvoWeek(current, { previousWeeks: [previous] }))).toContain('VAL-HISTORY-001')

    const changedPattern = {
      dias: [{ nombre: 'LUNES', evofuncional: session.replace('Back Squat', 'Strict Press') }],
    }
    expect(codes(validateEvoWeek(changedPattern, { previousWeeks: [previous] }))).not.toContain(
      'VAL-HISTORY-001',
    )

    const cosmeticRir = {
      dias: [{ nombre: 'LUNES', evofuncional: `${session}\nRIR 2` }],
    }
    expect(codes(validateEvoWeek(cosmeticRir, { previousWeeks: [previous] }))).toContain(
      'VAL-HISTORY-001',
    )

    const progressed = {
      dias: [{ nombre: 'LUNES', evofuncional: session.replace('5 x 3 @80', '5 x 2 @85') }],
    }
    expect(codes(validateEvoWeek(progressed, { previousWeeks: [previous] }))).not.toContain(
      'VAL-HISTORY-001',
    )

    const unknown = `PARTE ÚNICA — 20 MIN
Bear Crawl
Hollow Hold`
    expect(
      codes(
        validateEvoWeek(
          { dias: [{ nombre: 'LUNES', evofuncional: unknown }] },
          { previousWeeks: [{ dias: [{ nombre: 'LUNES', evofuncional: unknown }] }] },
        ),
      ),
    ).toContain('VAL-HISTORY-001')
  })

  it('admite dos días olímpicos consecutivos solo si uno es técnico y de bajo volumen', () => {
    const technical = `A) TÉCNICA — 12 MIN
Power Clean
5 x 2, bajo volumen`
    const highVolume = `A) AMRAP — 15 MIN
20 Dumbbell Snatch
20 Burpees`
    const accepted = validateEvoWeek({
      dias: [
        { nombre: 'LUNES', evofuncional: technical },
        { nombre: 'MARTES', evofuncional: highVolume },
      ],
    })
    expect(codes(accepted)).not.toContain('VAL-FATIGUE-002')

    const rejected = validateEvoWeek({
      dias: [
        { nombre: 'LUNES', evofuncional: highVolume },
        { nombre: 'MARTES', evofuncional: highVolume.replace('Snatch', 'Clean') },
      ],
    })
    expect(codes(rejected)).toContain('VAL-FATIGUE-002')

    for (const falseLowVolume of [
      `A) TÉCNICA — 15 MIN
Bajo volumen
5 rondas de 10 Power Snatch`,
      `A) TÉCNICA — 15 MIN
EMOM 12
3 Power Snatch`,
    ]) {
      const result = validateEvoWeek({
        dias: [
          { nombre: 'LUNES', evofuncional: falseLowVolume },
          { nombre: 'MARTES', evofuncional: highVolume },
        ],
      })
      expect(codes(result)).toContain('VAL-FATIGUE-002')
    }
  })

  it('usa el ordinal real del día para decidir consecutividad', () => {
    const result = validateEvoWeek({
      dias: [
        {
          nombre: 'LUNES',
          evofuncional: `A) INTERVALOS — 13 MIN\n5 rondas · 2' ON / 45'' OFF`,
        },
        {
          nombre: 'MIÉRCOLES',
          evofuncional: `A) INTERVALOS — 15 MIN\n4 rondas · 3' ON / 1' OFF`,
        },
      ],
    })
    expect(codes(result)).not.toContain('VAL-VARIETY-003')
  })

  it('usa el inventario canónico de diez personas', () => {
    expect(METHOD_EVO_V1.current_context.reference_class_capacity).toBe(10)
    expect(METHOD_EVO_V1.current_context.inventory.machines).toMatchObject({
      rowerg: 1,
      bike: 2,
      skierg: 2,
    })
  })
})
