import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const files = [
  './Pe2ShiftView.jsx',
  './ShiftProtocolLogList.jsx',
  './ShiftPostClassForm.jsx',
  './ShiftNoteList.jsx',
]

const source = files
  .map((file) => readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n')

describe('interfaz guiada de Mi turno', () => {
  it.each([
    'Qué toca ahora',
    'Personas a tener en cuenta',
    'Novedades del turno',
    'Anotar algo',
    'Finalizar turno',
  ])('incluye la sección “%s”', (label) => {
    expect(source).toContain(label)
  })

  it('muestra el recuento de tareas y la pregunta acordada', () => {
    expect(source).toContain('de 3 tareas completadas')
    expect(source).toContain('¿Ha ocurrido algo que deba saber el equipo?')
  })

  it('incluye todos los campos post-clase acordados', () => {
    for (const label of [
      'Movilidad / técnica',
      'Molestia o lesión',
      'No tenía',
      'Estable',
      'Mejoró',
      'Empeoró',
      'Intensidad 0–10',
      'Trabajo completado',
      'Cargas utilizadas',
      'Ejercicios adaptados',
    ]) {
      expect(source).toContain(label)
    }
  })

  it.each([
    'Especial',
    'Casos especiales',
    'Briefing especial',
    'Feedback operativo',
    '>Registrar<',
    '>Cierre<',
  ])('no conserva el vocabulario descartado “%s”', (label) => {
    expect(source).not.toContain(label)
  })
})
