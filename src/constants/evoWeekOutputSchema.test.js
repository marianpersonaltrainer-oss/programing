import { describe, expect, it } from 'vitest'
import { EVO_SESSION_CLASS_DEFS } from './evoClasses.js'
import { EVO_WEEK_OUTPUT_SCHEMA, EVO_WEEK_RESPONSE_FORMAT } from './evoWeekOutputSchema.js'

function collectObjectSchemas(schema, path = '$', out = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return out
  if (schema.type === 'object') out.push({ path, schema })
  for (const [key, value] of Object.entries(schema.properties || {})) {
    collectObjectSchemas(value, `${path}.properties.${key}`, out)
  }
  collectObjectSchemas(schema.items, `${path}.items`, out)
  return out
}

describe('EVO_WEEK_OUTPUT_SCHEMA', () => {
  it('define el formato estable que activa Structured Outputs', () => {
    expect(EVO_WEEK_RESPONSE_FORMAT).toBe('evo_week')
    expect(EVO_WEEK_OUTPUT_SCHEMA.required).toEqual([
      'titulo',
      'semana',
      'mesociclo',
      'resumen',
      'dias',
    ])
    expect(EVO_WEEK_OUTPUT_SCHEMA.additionalProperties).toBe(false)
  })

  it('obliga a devolver todas las sesiones, feedbacks y wodbuster como strings', () => {
    const daySchema = EVO_WEEK_OUTPUT_SCHEMA.properties.dias.items
    const expected = [
      'nombre',
      ...EVO_SESSION_CLASS_DEFS.flatMap(({ key, feedbackKey }) => [key, feedbackKey]),
      'wodbuster',
    ]

    expect(daySchema.required).toEqual(expected)
    expect(daySchema.additionalProperties).toBe(false)
    for (const key of expected) {
      expect(daySchema.properties[key]).toEqual({ type: 'string' })
    }
  })

  it('mantiene cerrado cada objeto para que Structured Outputs no falle en producción', () => {
    for (const { path, schema } of collectObjectSchemas(EVO_WEEK_OUTPUT_SCHEMA)) {
      expect(schema.additionalProperties, path).toBe(false)
      expect([...schema.required].sort(), path).toEqual(
        Object.keys(schema.properties).sort(),
      )
    }
  })
})
