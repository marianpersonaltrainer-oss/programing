import { describe, expect, it, vi } from 'vitest'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'
import { createIdentityCoachesHandler } from './identity-coaches.js'

const ORGANIZATION_ID = '018f1f4d-7b6c-4d8e-9f10-111213141517'
const ADMIN_ID = '018f1f4d-7b6c-4d8e-8f10-111213141518'
const COACH_ID = '018f1f4d-7b6c-4d8e-9f10-111213141519'

function request(body, overrides = {}) {
  return {
    method: 'POST',
    headers: {
      authorization: 'Bearer valid-token',
      origin: 'http://localhost:5173',
      'x-forwarded-for': '127.0.0.1',
    },
    body,
    ...overrides,
  }
}

function response() {
  return {
    statusCode: null,
    body: null,
    status: vi.fn(function status(code) {
      this.statusCode = code
      return this
    }),
    json: vi.fn(function json(body) {
      this.body = body
      return this
    }),
  }
}

function baseOptions(serviceClient, overrides = {}) {
  return {
    createClientImpl: vi.fn(() => serviceClient),
    requireCapabilityImpl: vi.fn().mockResolvedValue({
      user: { id: ADMIN_ID },
      organizationId: ORGANIZATION_ID,
      capability: 'identity.manage',
    }),
    checkRateLimitImpl: vi.fn().mockResolvedValue(false),
    readConfigImpl: () => ({
      serviceKey: 'service-role',
      supabaseUrl: 'https://staging.supabase.test',
    }),
    requestIdImpl: () => 'request-one',
    logger: { info: vi.fn(), warn: vi.fn() },
    ...overrides,
  }
}

describe('POST /api/identity-coaches', () => {
  it('lista únicamente memberships coach de la organización autorizada', async () => {
    const membershipOrder = vi.fn().mockResolvedValue({
      data: [{
        user_id: COACH_ID,
        status: 'active',
        source: 'admin_invitation',
        created_at: '2026-08-14T10:00:00.000Z',
        updated_at: '2026-08-14T10:00:00.000Z',
      }],
      error: null,
    })
    const membershipEqRole = vi.fn(() => ({ order: membershipOrder }))
    const membershipEqOrg = vi.fn(() => ({ eq: membershipEqRole }))
    const profileIn = vi.fn().mockResolvedValue({
      data: [{ id: COACH_ID, full_name: 'Coach Uno' }],
      error: null,
    })
    const serviceClient = {
      from: vi.fn((table) => {
        if (table === 'evo_memberships') return { select: vi.fn(() => ({ eq: membershipEqOrg })) }
        if (table === 'profiles') return { select: vi.fn(() => ({ in: profileIn })) }
        throw new Error(`unexpected table ${table}`)
      }),
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: COACH_ID, email: 'coach@example.com', user_metadata: { secret: 'hidden' } } },
            error: null,
          }),
        },
      },
    }
    const options = baseOptions(serviceClient)
    const handler = createIdentityCoachesHandler(options)
    const res = response()

    await handler(request({ action: 'list' }), res)

    expect(res.statusCode).toBe(200)
    expect(res.body.coaches).toEqual([expect.objectContaining({
      userId: COACH_ID,
      fullName: 'Coach Uno',
      email: 'coach@example.com',
      status: 'active',
    })])
    expect(res.body.coaches[0]).not.toHaveProperty('user_metadata')
    expect(membershipEqOrg).toHaveBeenCalledWith('organization_id', ORGANIZATION_ID)
    expect(membershipEqRole).toHaveBeenCalledWith('role_key', 'coach')
    expect(options.requireCapabilityImpl).toHaveBeenCalledWith(expect.anything(), 'identity.manage')
  })

  it('invita, crea perfil y concede solo la membership coach resuelta por capability', async () => {
    const profileUpsert = vi.fn().mockResolvedValue({ error: null })
    const membershipUpsert = vi.fn().mockResolvedValue({ error: null })
    const inviteUserByEmail = vi.fn().mockResolvedValue({
      data: { user: { id: COACH_ID } },
      error: null,
    })
    const serviceClient = {
      from: vi.fn((table) => ({
        upsert: table === 'profiles' ? profileUpsert : membershipUpsert,
      })),
      auth: { admin: { inviteUserByEmail, deleteUser: vi.fn() } },
    }
    const options = baseOptions(serviceClient)
    const handler = createIdentityCoachesHandler(options)
    const res = response()

    await handler(request({
      action: 'invite',
      fullName: '  Coach   Uno ',
      email: ' COACH@Example.com ',
    }), res)

    expect(res.statusCode).toBe(201)
    expect(inviteUserByEmail).toHaveBeenCalledWith('coach@example.com', {
      redirectTo: 'http://localhost:5173/?v2&reset-password=1',
      data: { full_name: 'Coach Uno' },
    })
    expect(profileUpsert).toHaveBeenCalledWith({
      id: COACH_ID,
      full_name: 'Coach Uno',
    }, { onConflict: 'id' })
    expect(membershipUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: COACH_ID,
      organization_id: ORGANIZATION_ID,
      role_key: 'coach',
      status: 'active',
      assigned_by: ADMIN_ID,
    }), { onConflict: 'user_id,organization_id,role_key' })
    expect(res.body.invited).toBe(true)
  })

  it('activa como coach una cuenta existente sin borrarla ni exigir código', async () => {
    const profileUpsert = vi.fn().mockResolvedValue({ error: null })
    const membershipUpsert = vi.fn().mockResolvedValue({ error: null })
    const deleteUser = vi.fn()
    const listUsers = vi.fn().mockResolvedValue({
      data: { users: [{ id: COACH_ID, email: 'coach@example.com' }] },
      error: null,
    })
    const serviceClient = {
      from: vi.fn((table) => ({
        upsert: table === 'profiles' ? profileUpsert : membershipUpsert,
      })),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'User already registered' },
          }),
          listUsers,
          deleteUser,
        },
      },
    }
    const handler = createIdentityCoachesHandler(baseOptions(serviceClient))
    const res = response()

    await handler(request({ action: 'invite', fullName: 'Coach Uno', email: 'coach@example.com' }), res)

    expect(res.statusCode).toBe(201)
    expect(res.body).toEqual(expect.objectContaining({ ok: true, userId: COACH_ID, invited: false }))
    expect(listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 })
    expect(membershipUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: COACH_ID,
      organization_id: ORGANIZATION_ID,
      role_key: 'coach',
      status: 'active',
    }), { onConflict: 'user_id,organization_id,role_key' })
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('compensa el usuario recién invitado si la membership no puede guardarse', async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null })
    const serviceClient = {
      from: vi.fn((table) => ({
        upsert: vi.fn().mockResolvedValue(
          table === 'profiles' ? { error: null } : { error: { message: 'db unavailable' } },
        ),
      })),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({ data: { user: { id: COACH_ID } }, error: null }),
          deleteUser,
        },
      },
    }
    const handler = createIdentityCoachesHandler(baseOptions(serviceClient))
    const res = response()

    await handler(request({ action: 'invite', fullName: 'Coach Uno', email: 'coach@example.com' }), res)

    expect(res.statusCode).toBe(503)
    expect(res.body.error).toBe('identity_write_unavailable')
    expect(deleteUser).toHaveBeenCalledWith(COACH_ID)
  })

  it('nunca borra una cuenta existente si falla la activación de membership', async () => {
    const deleteUser = vi.fn()
    const serviceClient = {
      from: vi.fn((table) => ({
        upsert: vi.fn().mockResolvedValue(
          table === 'profiles' ? { error: null } : { error: { message: 'db unavailable' } },
        ),
      })),
      auth: {
        admin: {
          inviteUserByEmail: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'User already registered' },
          }),
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: COACH_ID, email: 'coach@example.com' }] },
            error: null,
          }),
          deleteUser,
        },
      },
    }
    const handler = createIdentityCoachesHandler(baseOptions(serviceClient))
    const res = response()

    await handler(request({ action: 'invite', fullName: 'Coach Uno', email: 'coach@example.com' }), res)

    expect(res.statusCode).toBe(503)
    expect(deleteUser).not.toHaveBeenCalled()
  })

  it('desactiva de forma reversible solo la membership coach indicada', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { user_id: COACH_ID, status: 'inactive' },
      error: null,
    })
    const select = vi.fn(() => ({ maybeSingle }))
    const eqRole = vi.fn(() => ({ select }))
    const eqOrg = vi.fn(() => ({ eq: eqRole }))
    const eqUser = vi.fn(() => ({ eq: eqOrg }))
    const update = vi.fn(() => ({ eq: eqUser }))
    const serviceClient = {
      from: vi.fn(() => ({ update })),
      auth: { admin: {} },
    }
    const options = baseOptions(serviceClient)
    const handler = createIdentityCoachesHandler(options)
    const res = response()

    await handler(request({ action: 'set_status', userId: COACH_ID, status: 'inactive' }), res)

    expect(res.statusCode).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'inactive', assigned_by: ADMIN_ID }))
    expect(eqUser).toHaveBeenCalledWith('user_id', COACH_ID)
    expect(eqOrg).toHaveBeenCalledWith('organization_id', ORGANIZATION_ID)
    expect(eqRole).toHaveBeenCalledWith('role_key', 'coach')
    expect(serviceClient.auth.admin).not.toHaveProperty('deleteUser')
  })

  it('falla cerrado ante origen, acción, capability o rate limit inválidos', async () => {
    const serviceClient = { from: vi.fn(), auth: { admin: {} } }
    const forbidden = createIdentityCoachesHandler(baseOptions(serviceClient))
    const badOrigin = response()
    await forbidden(request({ action: 'list' }, { headers: { origin: 'https://evil.example' } }), badOrigin)
    expect(badOrigin.statusCode).toBe(403)

    const badAction = response()
    await forbidden(request({ action: 'delete_user' }), badAction)
    expect(badAction.statusCode).toBe(400)

    const deniedOptions = baseOptions(serviceClient, {
      requireCapabilityImpl: vi.fn().mockRejectedValue(new EvoCapabilityAuthError('capability_denied', 403)),
    })
    const denied = response()
    await createIdentityCoachesHandler(deniedOptions)(request({ action: 'list' }), denied)
    expect(denied.statusCode).toBe(403)

    const limitedOptions = baseOptions(serviceClient, {
      checkRateLimitImpl: vi.fn().mockResolvedValue(true),
    })
    const limited = response()
    await createIdentityCoachesHandler(limitedOptions)(request({ action: 'list' }), limited)
    expect(limited.statusCode).toBe(429)
  })
})
