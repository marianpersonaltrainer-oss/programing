import { describe, expect, it } from 'vitest'
import {
  classifyJsonApiResponse,
  parseJsonApiResponseText,
} from './parseJsonApiResponse.js'

describe('parseJsonApiResponse', () => {
  it('elimina espacios de heartbeat al parsear', () => {
    const { json } = parseJsonApiResponseText('   {"ok":true,"proposal":{"title":"T"}}')
    expect(json.ok).toBe(true)
  })

  it('interpreta errorStatus en respuesta transmitida con HTTP 200', () => {
    const classified = classifyJsonApiResponse(
      { ok: true, status: 200 },
      ' {"ok":false,"errorStatus":502,"error":"Anthropic saturado"}',
    )
    expect(classified.ok).toBe(false)
    expect(classified.httpStatus).toBe(502)
    expect(classified.errorMessage).toContain('Anthropic')
  })

  it('marca éxito cuando ok=true y no hay errorStatus', () => {
    const classified = classifyJsonApiResponse(
      { ok: true, status: 200 },
      '{"ok":true,"proposal":{"title":"X"}}',
    )
    expect(classified.ok).toBe(true)
  })
})
