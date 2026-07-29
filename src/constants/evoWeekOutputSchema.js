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
 * Esquema canónico neutral para Structured Outputs.
 *
 * Todos los campos son obligatorios para que el esquema no acumule parámetros
 * opcionales y para que cada llamada parcial conserve exactamente la misma forma.
 * Las clases que no se generan se devuelven como cadena vacía o como el marcador
 * canónico; el cliente sigue siendo quien decide qué columnas fusionar.
 */
export const EVO_WEEK_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    titulo: stringField(),
    semana: { type: 'integer' },
    mesociclo: stringField(),
    resumen: {
      type: 'object',
      properties: {
        estimulo: stringField(),
        intensidad: stringField(),
        foco: stringField(),
        nota: stringField(),
      },
      required: ['estimulo', 'intensidad', 'foco', 'nota'],
      additionalProperties: false,
    },
    dias: {
      type: 'array',
      items: {
        type: 'object',
        properties: dayProperties,
        required: Object.keys(dayProperties),
        additionalProperties: false,
      },
    },
  },
  required: ['titulo', 'semana', 'mesociclo', 'resumen', 'dias'],
  additionalProperties: false,
}

export const EVO_WEEK_RESPONSE_FORMAT = 'evo_week'
