import { EVO_SESSION_CLASS_DEFS } from './evoClasses.js'

const stringField = () => ({ type: 'string' })

const dayProperties = {
  nombre: stringField(),
}

for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
  dayProperties[key] = stringField()
  dayProperties[feedbackKey] = stringField()
}

dayProperties.wodbuster = stringField()

/**
 * Salida mínima canónica para generar exactamente un día EVO.
 *
 * Mantiene la misma forma de día que el editor y el Excel actuales, pero evita
 * transportar título, mesociclo, resumen y el array semanal completo.
 * Anthropic Structured Outputs exige que todos los objetos estén cerrados y que
 * `required` enumere todas sus propiedades.
 */
export const EVO_DAY_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    dia: {
      type: 'object',
      properties: dayProperties,
      required: Object.keys(dayProperties),
      additionalProperties: false,
    },
  },
  required: ['dia'],
  additionalProperties: false,
}

export const EVO_DAY_RESPONSE_FORMAT = 'evo_day'
