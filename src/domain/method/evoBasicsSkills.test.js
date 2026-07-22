import { describe, expect, it } from 'vitest'
import {
  EVO_BASICS_COMPLEX_SKILLS,
  EVO_BASICS_SIMPLE_SKILLS,
  attachEvoMethodMetadata,
  buildEvoBasicsRotationContext,
  extractEvoBasicsPrincipalSkill,
  findComplexEvoBasicsFamiliesInConditioning,
  findEvoBasicsSkillMatches,
  validateEvoBasicsRotation,
} from './evoBasicsSkills.js'
import {
  buildCoachInventoryItems,
  detectEvoEquipmentUsage,
  validateDailyEquipmentSimultaneity,
  validateHighSetupReuse,
} from './evoInventory.js'

function basicsSession(skill, wod = '8 Burpees\n10 Sit-Ups') {
  return `A) TÉCNICA — 10 MIN\n${skill}\nB) AMRAP — 18 MIN\n${wod}`
}

describe('skills EvoBasics 1.2', () => {
  it('conserva exactamente la clasificación confirmada 48 + 38', () => {
    expect(EVO_BASICS_COMPLEX_SKILLS.filter((entry) => entry.source === 'confirmed')).toHaveLength(48)
    expect(EVO_BASICS_SIMPLE_SKILLS.filter((entry) => entry.source === 'confirmed')).toHaveLength(38)
  })

  it('prefiere el movimiento específico y no confunde DB Snatch con Snatch de barra', () => {
    expect(findEvoBasicsSkillMatches('Dumbbell Snatch')).toMatchObject([
      { name: 'Dumbbell Snatch', complexity: 'simple' },
    ])
    expect(findEvoBasicsSkillMatches('Power Snatch')).toMatchObject([
      { name: 'Power Snatch', complexity: 'complex' },
    ])
  })

  it('solo avanza con un bloque principal rotulado e identificable', () => {
    expect(extractEvoBasicsPrincipalSkill(basicsSession('Back Squat'))).toMatchObject({
      identifiable: true,
      complexity: 'complex',
      family: 'back_squat',
    })
    expect(extractEvoBasicsPrincipalSkill('A) FUERZA — 15 MIN\nBack Squat')).toBeNull()
  })

  it('permite un complejo en el WOD y avisa cuando hay dos familias complejas', () => {
    expect(findComplexEvoBasicsFamiliesInConditioning(basicsSession('Air Squat', '6 Push Jerk\n8 Burpees'))).toEqual([
      'push_jerk',
    ])
    expect(
      findComplexEvoBasicsFamiliesInConditioning(
        basicsSession('Air Squat', '6 Push Jerk\n8 Power Snatch\n10 Sit-Ups'),
      ),
    ).toEqual(['push_jerk', 'snatch'])
  })

  it('cierra el bloque móvil con dos complejos y tres sencillos', () => {
    const skills = ['Back Squat', 'Air Squat', 'Dumbbell Snatch', 'Push Press', 'Wall Ball']
    const week = {
      dias: skills.map((skill, index) => ({
        nombre: `D${index + 1}`,
        evobasics: basicsSession(skill),
      })),
    }
    const withMetadata = attachEvoMethodMetadata(week)
    expect(withMetadata.metodo_evo.evobasics_rotation.end_state).toMatchObject({
      position: 5,
      complex: 2,
      simple: 3,
    })
    expect(validateEvoBasicsRotation(withMetadata)).toEqual([])
  })

  it('bloquea un tercer complejo dentro del mismo bloque', () => {
    const week = {
      dias: ['Back Squat', 'Push Press', 'Push Jerk'].map((skill, index) => ({
        nombre: `D${index + 1}`,
        evobasics: basicsSession(skill),
      })),
    }
    expect(validateEvoBasicsRotation(attachEvoMethodMetadata(week)).map((entry) => entry.code)).toContain(
      'VAL-BASICS-002',
    )
  })

  it('explica al generador qué complejidad toca según lo ya impartido', () => {
    const currentWeek = {
      dias: [{ nombre: 'LUNES', evobasics: basicsSession('Air Squat') }],
    }
    const context = buildEvoBasicsRotationContext({ currentWeek, targetDay: 'MIÉRCOLES' })
    expect(context).toContain('1/5 impartidas')
    expect(context).toContain('programa como skill principal uno sencillo')
  })
})

describe('inventario y montaje EVO 1.2', () => {
  it('la guía se construye desde el inventario canónico', () => {
    const rows = buildCoachInventoryItems()
    expect(rows.find((row) => row.name === 'Landmine')?.detail).toContain('8 puestos')
    expect(rows.find((row) => row.name === 'Anillas')?.detail).toContain('fijas en sus salas')
    expect(rows.find((row) => row.name === 'Máquinas')?.detail).toContain('se desplazan las personas')
  })

  it('detecta un landmine aislado y acepta una sesión que amortiza el montaje', () => {
    const isolated = `A) FUERZA — 14 MIN\nHalf-Kneeling Landmine Press\n4 x 6+6\nB) AMRAP — 16 MIN\n8 Burpees\n10 Sit-Ups`
    expect(validateHighSetupReuse(isolated).map((entry) => entry.code)).toContain('VAL-MATERIAL-002')

    const reused = `A) FUERZA — 14 MIN\nHalf-Kneeling Landmine Press\n4 x 6+6\nB) AMRAP — 16 MIN\n8 Landmine Row\n10 Sit-Ups`
    expect(validateHighSetupReuse(reused)).toEqual([])
    expect(detectEvoEquipmentUsage(reused).find((entry) => entry.key === 'landmine')?.blockCount).toBe(2)
  })

  it('avisa de máquinas y barra pesada compartidas entre clases', () => {
    const warnings = validateDailyEquipmentSimultaneity([
      { classKey: 'evofuncional', session: 'A) FUERZA — 15 MIN\nBack Squat @90%\nB) EMOM — 10 MIN\nRowErg' },
      { classKey: 'evofit', session: 'A) FUERZA — 15 MIN\nFront Squat @85%\nB) AMRAP — 10 MIN\nRowErg' },
    ])
    expect(warnings.filter((entry) => entry.code === 'VAL-MATERIAL-003').length).toBeGreaterThanOrEqual(2)
  })
})
