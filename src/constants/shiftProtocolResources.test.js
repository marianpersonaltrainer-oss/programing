import { describe, expect, it } from 'vitest'
import {
  EVO_OPERATIONAL_RESOURCES,
  getShiftProtocol,
  SHIFT_PROTOCOL_LINKS,
  SHIFT_PROTOCOL_RESOURCES,
} from './shiftProtocolResources.js'

describe('recursos oficiales del Puente EVO V0', () => {
  it('integra exactamente dos protocolos y cinco recursos', () => {
    expect(SHIFT_PROTOCOL_LINKS).toHaveLength(2)
    expect(EVO_OPERATIONAL_RESOURCES).toHaveLength(5)
    expect(SHIFT_PROTOCOL_RESOURCES).toHaveLength(7)
  })

  it('mantiene siete destinos HTTPS únicos', () => {
    const urls = SHIFT_PROTOCOL_RESOURCES.map((resource) => resource.url)
    expect(new Set(urls).size).toBe(7)
    expect(urls.every((url) => url.startsWith('https://'))).toBe(true)
  })

  it('resuelve las versiones oficiales de apertura y cierre', () => {
    expect(getShiftProtocol('apertura')).toMatchObject({ version: 'v0', zone: 'shift' })
    expect(getShiftProtocol('cierre')).toMatchObject({ version: 'v0', zone: 'shift' })
    expect(getShiftProtocol('otro')).toBeNull()
  })
})
