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
    expect(urls).toEqual([
      'https://docs.google.com/document/d/1Y1m3lGIKEk5KFyIKLNLNs-VcrKnWzBOpmU_xjDKy6RE/edit',
      'https://docs.google.com/document/d/1e5Wumc6JS3v34duSZzHQHXpzPDv8P8KjneuxgnzT0xk/edit',
      'https://docs.google.com/document/d/1VLdStqgQp-IPvZSwCFPyCyA0ZGp9VhEqYEacducAH1g/edit',
      'https://drive.google.com/drive/folders/1f0kg4D3B7dxQEq0V2Mj-RRm0-FeQBQGd',
      'https://docs.google.com/document/d/1_d74cXPuuvtzhS43usOeVcxpJ330szYZOLOM1j0l_T8/edit',
      'https://docs.google.com/document/d/14pzOKGHRKoM0pY7wQcBU3jxkR5xeWCSF/edit',
      'https://docs.google.com/document/d/1b8E20TLbWhwMq34aPz1RD7IUhNZ_luk4ob2O1P7iXJU/edit',
    ])
    expect(new Set(urls).size).toBe(7)
  })

  it('resuelve las versiones oficiales de apertura y cierre', () => {
    expect(getShiftProtocol('apertura')).toMatchObject({ version: 'v0', zone: 'shift' })
    expect(getShiftProtocol('cierre')).toMatchObject({ version: 'v0', zone: 'shift' })
    expect(getShiftProtocol('otro')).toBeNull()
  })
})
