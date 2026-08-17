import { describe, expect, it } from 'vitest'
import {
  buildLegacyPe2Identity,
  buildPe2Identity,
  getIdentityOrganizationId,
  identityHasCapability,
  isMissingIdentityFoundationError,
  isLegacyIdentityFallbackEnabled,
  resolvePe2Identity,
} from './pe2Auth.js'

const profile = {
  id: 'user-1',
  full_name: 'EVO User',
  role: 'programmer',
  org_id: 'org-legacy',
}

describe('EVO-S multirole identity', () => {
  it('autoriza por capability y organización, no por el rol legacy', () => {
    const identity = buildPe2Identity(
      profile,
      [{
        user_id: 'user-1',
        organization_id: 'org-a',
        role_key: 'coach',
        status: 'active',
      }],
      [{
        organization_id: 'org-a',
        capability_key: 'coach.workspace.access',
      }],
    )

    expect(identityHasCapability(identity, 'coach.workspace.access')).toBe(true)
    expect(identityHasCapability(identity, 'coach.workspace.access', 'org-a')).toBe(true)
    expect(identityHasCapability(identity, 'coach.workspace.access', 'org-b')).toBe(false)
    expect(identityHasCapability(identity, 'programming.manage')).toBe(false)
    expect(getIdentityOrganizationId(identity, 'coach.workspace.access')).toBe('org-a')
  })

  it('ignora memberships inactivas y elimina duplicados', () => {
    const identity = buildPe2Identity(
      profile,
      [
        {
          user_id: 'user-1',
          organization_id: 'org-a',
          role_key: 'coach',
          status: 'active',
        },
        {
          user_id: 'user-1',
          organization_id: 'org-a',
          role_key: 'coach',
          status: 'active',
        },
        {
          user_id: 'user-1',
          organization_id: 'org-b',
          role_key: 'admin',
          status: 'inactive',
        },
      ],
      [],
    )

    expect(identity.memberships).toHaveLength(1)
    expect(identity.roles).toEqual(['coach'])
    expect(identity.organizationIds).toEqual(['org-a'])
  })

  it('falla cerrado si una capability existe en más de una organización sin contexto', () => {
    const identity = buildPe2Identity(
      profile,
      [
        {
          user_id: 'user-1',
          organization_id: 'org-a',
          role_key: 'coach',
          status: 'active',
        },
        {
          user_id: 'user-1',
          organization_id: 'org-b',
          role_key: 'coach',
          status: 'active',
        },
      ],
      [
        {
          organization_id: 'org-a',
          capability_key: 'coach.workspace.access',
        },
        {
          organization_id: 'org-b',
          capability_key: 'coach.workspace.access',
        },
      ],
    )

    expect(identity.organizationIds).toEqual(['org-a', 'org-b'])
    expect(identity.primaryOrganizationId).toBeNull()
    expect(identityHasCapability(identity, 'coach.workspace.access')).toBe(false)
    expect(getIdentityOrganizationId(identity, 'coach.workspace.access')).toBeNull()
    expect(identityHasCapability(identity, 'coach.workspace.access', 'org-b')).toBe(true)
  })

  it('mantiene un fallback legacy explícito para entornos aún no migrados', () => {
    const identity = buildLegacyPe2Identity(profile)

    expect(identity.source).toBe('legacy-fallback')
    expect(identityHasCapability(identity, 'programming.manage')).toBe(true)
    expect(getIdentityOrganizationId(identity, 'programming.manage')).toBe('org-legacy')
  })

  it('solo permite fallback ante ausencia real del esquema multirrol', () => {
    expect(isMissingIdentityFoundationError({ code: 'PGRST205' })).toBe(true)
    expect(isMissingIdentityFoundationError({ code: '42883' })).toBe(true)
    expect(isMissingIdentityFoundationError({ code: '42501' })).toBe(false)
    expect(isMissingIdentityFoundationError(new Error('network error'))).toBe(false)
  })

  it('mantiene el bridge legacy apagado por defecto y no convierte un fallo de esquema en acceso', async () => {
    await expect(resolvePe2Identity({
      profile,
      userId: profile.id,
      loadMemberships: async () => {
        throw { code: '42P01' }
      },
      loadCapabilities: async () => [],
    })).rejects.toMatchObject({ code: '42P01' })
  })

  it('permite el bridge sólo con flag explícito y conserva el fail-closed para otros errores', async () => {
    const legacy = await resolvePe2Identity({
      profile,
      userId: profile.id,
      allowLegacyFallback: true,
      loadMemberships: async () => {
        throw { code: 'PGRST205' }
      },
      loadCapabilities: async () => [],
    })
    expect(legacy.source).toBe('legacy-fallback')

    await expect(resolvePe2Identity({
      profile,
      userId: profile.id,
      allowLegacyFallback: true,
      loadMemberships: async () => {
        throw { code: '42501' }
      },
      loadCapabilities: async () => [],
    })).rejects.toMatchObject({ code: '42501' })
  })

  it('sólo reconoce el valor literal true para habilitar el bridge legacy', () => {
    expect(isLegacyIdentityFallbackEnabled('true')).toBe(true)
    expect(isLegacyIdentityFallbackEnabled(' TRUE ')).toBe(true)
    expect(isLegacyIdentityFallbackEnabled('1')).toBe(false)
    expect(isLegacyIdentityFallbackEnabled()).toBe(false)
  })
})
