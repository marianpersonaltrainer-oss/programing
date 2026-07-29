import { describe, expect, it } from 'vitest'
import { EVO_SESSION_CLASS_DEFS } from './evoClasses.js'
import { EVO_DAY_OUTPUT_SCHEMA, EVO_DAY_RESPONSE_FORMAT } from './evoDayOutputSchema.js'

function collectObjectSchemas(schema, path = '$', out = []) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return out
  if (schema.type === 'object') out.push({ path, schema })
  for (const [key, value] of Object.entries(schema.properties || {})) {
    collectObjectSchemas(value, `${path}.properties.${key}`, out)
  }
  collectObjectSchemas(schema.items, `${path}.items`, out)
  return out
}

describe('EVO_DAY_OUTPUT_SCHEMA', () => {
  it('define una salida compacta de un único día', () => {
    expect(EVO_DAY_RESPONSE_FORMAT).toBe('evo_day')
    expect(EVO_DAY_OUTPUT_SCHEMA.required).toEqual(['dia'])
    expect(Object.keys(EVO_DAY_OUTPUT_SCHEMA.properties)).toEqual(['dia'])
    expect(EVO_DAY_OUTPUT_SCHEMA.properties).not.toHaveProperty('dias')
    expect(EVO_DAY_OUTPUT_SCHEMA.properties).not.toHaveProperty('resumen')
  })

  it('conserva la forma canónica que consumen editor y Excel', () => {
    const daySchema = EVO_DAY_OUTPUT_SCHEMA.properties.dia
    const expected = [
      'nombre',
      ...EVO_SESSION_CLASS_DEFS.flatMap(({ key, feedbackKey }) => [key, feedbackKey]),
      'wodbuster',
    ]

    expect(daySchema.required).toEqual(expected)
    for (const key of expected) {
      expect(daySchema.properties[key]).toEqual({ type: 'string' })
    }
  })

  it('cierra recursivamente todos los objetos del JSON Schema', () => {
    const objectSchemas = collectObjectSchemas(EVO_DAY_OUTPUT_SCHEMA)
    expect(objectSchemas.map(({ path }) => path)).toEqual(['$', '$.properties.dia'])

    for (const { path, schema } of objectSchemas) {
      expect(schema.additionalProperties, path).toBe(false)
      expect([...schema.required].sort(), path).toEqual(
        Object.keys(schema.properties).sort(),
      )
    }
  })
})
