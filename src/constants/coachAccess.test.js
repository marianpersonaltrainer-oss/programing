import { describe, expect, it } from 'vitest'
import {
  isCoachIndividualAuthEnabled,
  isCoachSharedCodeFallbackEnabled,
} from './coachAccess.js'

describe('EVO Coach auth rollout flags', () => {
  it('activa Auth individual solo de forma explícita', () => {
    expect(isCoachIndividualAuthEnabled()).toBe(false)
    expect(isCoachIndividualAuthEnabled('true')).toBe(true)
    expect(isCoachIndividualAuthEnabled(' false ')).toBe(false)
  })

  it('mantiene rollback por defecto y permite apagarlo explícitamente', () => {
    expect(isCoachSharedCodeFallbackEnabled()).toBe(true)
    expect(isCoachSharedCodeFallbackEnabled('true')).toBe(true)
    expect(isCoachSharedCodeFallbackEnabled(' false ')).toBe(false)
  })
})
