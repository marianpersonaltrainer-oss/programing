import { describe, expect, it } from 'vitest'
import {
  buildCoachSupportLibraryBlock,
  coachSupportContextFingerprint,
  inferCoachSupportSessionContext,
  questionHasExplicitCoachContext,
} from './coachSupportContext.js'

const WEEK = {
  dias: [
    {
      nombre: 'MIÉRCOLES',
      evofuncional: 'A) FUERZA — 15 MIN\nBack Squat\nB) AMRAP — 10 MIN\nWall Ball',
      feedback_funcional: 'Hoy buscamos fuerza sólida y ritmo continuo.',
      evofit: 'A) FUERZA — 15 MIN\nPeso muerto\nB) ACCESORIOS — 8 MIN\nPress landmine\nC) AMRAP — 8 MIN\nBurpees',
      feedback_fit: 'La fuerza es la prioridad y el WOD cambia la sensación.',
      evobasics: '(no programada esta semana)',
    },
  ],
}

describe('coachSupportContext', () => {
  it('resuelve una clase concreta usando el día activo', () => {
    const context = inferCoachSupportSessionContext('¿Cómo adapto el peso muerto en Fit?', WEEK, 'MIÉRCOLES')
    expect(context?.dayName).toBe('MIÉRCOLES')
    expect(context?.classLabel).toBe('EvoFit')
    expect(context?.sessionText).toContain('Peso muerto')
    expect(context?.sessionText).not.toContain('Back Squat')
  })

  it('entrega todas las clases del día cuando la pregunta es ambigua', () => {
    const context = inferCoachSupportSessionContext('¿Qué hago si alguien tiene dolor?', WEEK, 'MIÉRCOLES')
    expect(context?.classLabel).toBe('Clases programadas del día')
    expect(context?.sessionText).toContain('EvoFuncional')
    expect(context?.sessionText).toContain('EvoFit')
  })

  it('selecciona ejercicios relacionados por nombre, patrón y modalidad', () => {
    const context = inferCoachSupportSessionContext('Necesito adaptar el peso muerto en Fit', WEEK, 'MIÉRCOLES')
    const rows = [
      { name: 'Peso muerto', category: 'bisagra', level: 'intermedio', classes: ['evofit'] },
      { name: 'KB RDL', category: 'bisagra', level: 'basico', classes: ['evofit'] },
      { name: 'Box Jump', category: 'metabolico', level: 'intermedio', classes: ['evofuncional'] },
    ]
    const block = buildCoachSupportLibraryBlock(rows, context, 'Necesito adaptar el peso muerto')
    expect(block).toContain('clasificación histórica')
    expect(block).toContain('Peso muerto')
    expect(block).toContain('KB RDL')
    expect(block).not.toContain('Box Jump')
  })

  it('cambia la huella cuando cambia la sesión', () => {
    const base = inferCoachSupportSessionContext('Fit', WEEK, 'MIÉRCOLES')
    expect(coachSupportContextFingerprint(base)).not.toBe(
      coachSupportContextFingerprint({ ...base, sessionText: `${base.sessionText}\nCambio` }),
    )
  })

  it('solo cambia un contexto seleccionado cuando la pregunta nombra día o modalidad', () => {
    expect(questionHasExplicitCoachContext('En EvoFit, ¿qué alternativa pondrías?')).toBe(true)
    expect(questionHasExplicitCoachContext('¿Y para el jueves?')).toBe(true)
    expect(questionHasExplicitCoachContext('¿Cómo ajusto el bloque de fuerza?')).toBe(false)
  })

  it('no sustituye un día o una clase ausente por otro contexto', () => {
    expect(inferCoachSupportSessionContext('¿Qué toca el jueves?', WEEK, 'MIÉRCOLES')).toBe(null)
    const basics = inferCoachSupportSessionContext('¿Qué adapto en Basics?', WEEK, 'MIÉRCOLES')
    expect(basics?.classLabel).toBe('EvoBasics')
    expect(basics?.sessionText).toBe('(no programada esta semana)')
  })
})
