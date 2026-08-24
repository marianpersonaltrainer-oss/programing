import { describe, expect, it, vi } from 'vitest'
import { hasIndividualCoachAccess } from './coachIdentityAccess.js'
import { isCoachIndividualAuthEnabled } from '../constants/coachAccess.js'

describe('EVO Coach individual identity access', () => {
  it('solo activa la transición con un flag explícito', () => {
    expect(isCoachIndividualAuthEnabled(' true ')).toBe(true)
    expect(isCoachIndividualAuthEnabled('false')).toBe(false)
    expect(isCoachIndividualAuthEnabled('')).toBe(false)
  })

  it('mantiene el fallback si no existe una sesión individual', async () => {
    const getIdentityImpl = vi.fn()
    await expect(
      hasIndividualCoachAccess({
        getSessionImpl: vi.fn().mockResolvedValue(null),
        getIdentityImpl,
      }),
    ).resolves.toBe(false)
    expect(getIdentityImpl).not.toHaveBeenCalled()
  })

  it('permite una cuenta con coach.workspace.access', async () => {
    const identity = { capabilityRows: [{
      organization_id: 'org-a',
      capability_key: 'coach.workspace.access',
    }] }
    const getIdentityImpl = vi.fn().mockResolvedValue(identity)
    const hasCapabilityImpl = vi.fn().mockReturnValue(true)

    await expect(
      hasIndividualCoachAccess({
        getSessionImpl: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
        getIdentityImpl,
        hasCapabilityImpl,
      }),
    ).resolves.toBe(true)
    expect(getIdentityImpl).toHaveBeenCalledWith('user-1')
    expect(hasCapabilityImpl).toHaveBeenCalledWith(
      identity,
      'coach.workspace.access',
    )
  })

  it('no interpreta un rol de perfil como autorización', async () => {
    await expect(
      hasIndividualCoachAccess({
        getSessionImpl: vi.fn().mockResolvedValue({ user: { id: 'user-1' } }),
        getIdentityImpl: vi.fn().mockResolvedValue({
          profile: { role: 'coach' },
          capabilityRows: [],
        }),
        hasCapabilityImpl: vi.fn().mockReturnValue(false),
      }),
    ).resolves.toBe(false)
  })
})
