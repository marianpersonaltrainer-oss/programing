import { parseAssistantWeekJson } from './parseAssistantWeekJson.js'

/**
 * Parsea la respuesta del modelo para edición de un solo día.
 * Forma esperada: { "dia": { nombre, evofuncional, ... } }
 * @param {string} assistantText
 * @returns {Record<string, unknown>}
 */
export function parseAssistantDayJson(assistantText) {
  const o = parseAssistantWeekJson(assistantText)
  if (!o || typeof o !== 'object') {
    throw new Error('La respuesta no es un objeto JSON.')
  }
  const dia = o.dia
  if (!dia || typeof dia !== 'object') {
    throw new Error(
      'La respuesta debe ser un JSON con la clave "dia" (objeto del día). Ejemplo: {"dia":{"nombre":"LUNES",...}}',
    )
  }
  return dia
}
