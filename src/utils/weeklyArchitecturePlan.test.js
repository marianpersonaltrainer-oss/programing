import { describe, expect, it } from 'vitest'
import {
  buildWeeklyStructuralFingerprint,
  extractWeeklyArchitectureBlock,
  formatWeeklyArchitecturePlan,
  normalizeWeeklyArchitecturePlan,
  replaceWeeklyArchitectureBlock,
} from './weeklyArchitecturePlan.js'

const offer = {
  dias: {
    LUNES: ['evofuncional', 'evofit'],
    MARTES: ['evofuncional'],
  },
}

const plan = [
  {
    day: 'LUNES',
    intent: 'fuerza de rodilla con acondicionamiento continuo',
    classPlans: {
      evofuncional: 'Back Squat en series + AMRAP por parejas; barra y balón; descanso natural',
      evofit: 'Skill landmine + circuito continuo; sin intervalos',
    },
    sharedFatigue: 'dominante de rodilla',
    antiRepetition: 'el martes no repetirá series + AMRAP',
  },
  {
    day: 'MARTES',
    intent: 'tracción y locomoción',
    classPlans: {
      evofuncional: 'Técnica de tracción + for time corto; cajón y autocarga',
    },
    sharedFatigue: 'agarre moderado',
    antiRepetition: 'sin sentadilla pesada ni AMRAP',
  },
]

describe('weekly architecture plan', () => {
  it('crea una huella semanal legible por día y clase', () => {
    const fingerprint = buildWeeklyStructuralFingerprint({
      id: 's4',
      mesociclo: 'fuerza',
      semana: 4,
      data: {
        dias: [
          {
            nombre: 'LUNES',
            evofuncional: "A) Back Squat 5x3\nB) AMRAP 12': 10 Wall Ball + 8 Burpees",
          },
        ],
      },
    })

    expect(fingerprint.days[0].sessions[0]).toMatchObject({
      classKey: 'evofuncional',
      strengthFormats: ['series'],
      conditioningFormats: ['AMRAP'],
    })
    expect(fingerprint.signature).toContain('LUNES:evofuncional')
  })

  it('exige plan previo para exactamente los días y clases seleccionados', () => {
    expect(
      normalizeWeeklyArchitecturePlan(plan, {
        generationDays: ['LUNES', 'MARTES'],
        weeklyOffer: offer,
      }),
    ).toHaveLength(2)

    expect(() =>
      normalizeWeeklyArchitecturePlan(plan.slice(0, 1), {
        generationDays: ['LUNES', 'MARTES'],
        weeklyOffer: offer,
      }),
    ).toThrow(/no cubre: MARTES/)
  })

  it('rechaza clases que no existen en la oferta confirmada', () => {
    const bad = structuredClone(plan)
    bad[0].classPlans.evobasics = 'Clase inventada'
    expect(() =>
      normalizeWeeklyArchitecturePlan(bad, {
        generationDays: ['LUNES', 'MARTES'],
        weeklyOffer: offer,
      }),
    ).toThrow(/sobran \[evobasics\]/)
  })

  it('reemplaza un plan refinado sin conservar el anterior', () => {
    const first = replaceWeeklyArchitectureBlock('CONTEXTO', plan)
    const revised = structuredClone(plan)
    revised[0].intent = 'intención revisada'
    const second = replaceWeeklyArchitectureBlock(first, revised)

    expect(second).toContain('intención revisada')
    expect(second).not.toContain('fuerza de rodilla con acondicionamiento continuo')
    expect(second.match(/PLAN ESTRUCTURAL SEMANAL APROBADO/g)).toHaveLength(1)
    expect(formatWeeklyArchitecturePlan(plan)).toContain('contraste obligatorio')
    expect(extractWeeklyArchitectureBlock(`RUIDO\n${second}\nMÁS RUIDO`)).toContain(
      'intención revisada',
    )
  })
})
