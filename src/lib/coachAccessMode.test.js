import { describe, expect, it } from 'vitest'
import { resolveCoachAccessMode } from './coachAccessMode.js'

describe('resolveCoachAccessMode', () => {
  it('prefers the individual membership capability when it is available', () => {
    expect(resolveCoachAccessMode({
      individualAuthEnabled: true,
      sharedCodeFallbackEnabled: true,
      hasIndividualAccess: true,
    })).toBe('individual')
  })

  it('preserves the shared-code rollback while the staged fallback remains enabled', () => {
    expect(resolveCoachAccessMode({
      individualAuthEnabled: true,
      sharedCodeFallbackEnabled: true,
      hasIndividualAccess: false,
    })).toBe('shared_code')
  })

  it('fails closed when individual access is required but the capability is absent', () => {
    expect(resolveCoachAccessMode({
      individualAuthEnabled: true,
      sharedCodeFallbackEnabled: false,
      hasIndividualAccess: false,
    })).toBe('denied')
  })

  it('uses the legacy path only while individual access is not enabled', () => {
    expect(resolveCoachAccessMode({
      individualAuthEnabled: false,
      sharedCodeFallbackEnabled: false,
      hasIndividualAccess: false,
    })).toBe('shared_code')
  })
})
