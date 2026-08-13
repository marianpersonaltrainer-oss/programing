import { describe, expect, it, vi } from 'vitest'
import {
  capabilityAuthErrorResponse,
  readBearerToken,
  requireEvoCapability,
} from './evoCapabilityAuth.js'

const env = {
  SUPABASE_URL: 'https://staging.supabase.co',
  VITE_SUPABASE_ANON_KEY: 'public-anon-key',
}

function request(token = 'valid-jwt') {
  return { headers: { authorization: `Bearer ${token}` } }
}

function clientFactory({
  user = { id: 'user-1' },
  userError = null,
  capabilities = [],
  capabilityError = null,
} = {}) {
  const getUser = vi.fn().mockResolvedValue({
    data: { user },
    error: userError,
  })
  const rpc = vi.fn().mockResolvedValue({
    data: capabilities,
    error: capabilityError,
  })
  const createClientImpl = vi.fn(() => ({
    auth: { getUser },
    rpc,
  }))
  return { createClientImpl, getUser, rpc }
}

describe('EVO-S server capability auth', () => {
  it('exige un Bearer token bien formado y acotado', () => {
    expect(readBearerToken(request('token'))).toBe('token')
    expect(readBearerToken({ headers: {} })).toBe('')
    expect(readBearerToken({ headers: { authorization: 'Basic value' } })).toBe('')
    expect(readBearerToken(request('x'.repeat(8193)))).toBe('')
  })

  it('rechaza una petición sin sesión antes de crear clientes remotos', async () => {
    const { createClientImpl } = clientFactory()
    const promise = requireEvoCapability(
      { headers: {} },
      'programming.manage',
      { createClientImpl, env },
    )

    await expect(promise).rejects.toMatchObject({
      code: 'authentication_required',
      status: 401,
    })
    expect(createClientImpl).not.toHaveBeenCalled()
  })

  it('valida el JWT y autoriza por capability y organización', async () => {
    const { createClientImpl, getUser, rpc } = clientFactory({
      capabilities: [{
        organization_id: 'org-a',
        capability_key: 'programming.manage',
      }],
    })

    const result = await requireEvoCapability(
      request(),
      'programming.manage',
      { organizationId: 'org-a', createClientImpl, env },
    )

    expect(result).toMatchObject({
      capability: 'programming.manage',
      organizationId: 'org-a',
      user: { id: 'user-1' },
    })
    expect(getUser).toHaveBeenCalledWith('valid-jwt')
    expect(rpc).toHaveBeenCalledWith('evo_my_capabilities')
    expect(createClientImpl).toHaveBeenCalledWith(
      env.SUPABASE_URL,
      env.VITE_SUPABASE_ANON_KEY,
      expect.objectContaining({
        global: { headers: { Authorization: 'Bearer valid-jwt' } },
      }),
    )
  })

  it('no concede una capability de otra organización', async () => {
    const { createClientImpl } = clientFactory({
      capabilities: [{
        organization_id: 'org-a',
        capability_key: 'coach.workspace.access',
      }],
    })

    await expect(
      requireEvoCapability(
        request(),
        'coach.workspace.access',
        { organizationId: 'org-b', createClientImpl, env },
      ),
    ).rejects.toMatchObject({ code: 'capability_denied', status: 403 })
  })

  it('exige contexto explícito cuando una capability pertenece a varias organizaciones', async () => {
    const { createClientImpl } = clientFactory({
      capabilities: [
        {
          organization_id: 'org-a',
          capability_key: 'coach.workspace.access',
        },
        {
          organization_id: 'org-b',
          capability_key: 'coach.workspace.access',
        },
      ],
    })

    await expect(
      requireEvoCapability(
        request(),
        'coach.workspace.access',
        { createClientImpl, env },
      ),
    ).rejects.toMatchObject({
      code: 'organization_context_required',
      status: 409,
    })

    await expect(
      requireEvoCapability(
        request(),
        'coach.workspace.access',
        { organizationId: 'org-b', createClientImpl, env },
      ),
    ).resolves.toMatchObject({ organizationId: 'org-b' })
  })

  it('falla cerrado ante un JWT inválido o una RPC indisponible', async () => {
    const invalid = clientFactory({ user: null, userError: { message: 'invalid' } })
    await expect(
      requireEvoCapability(
        request(),
        'programming.manage',
        { createClientImpl: invalid.createClientImpl, env },
      ),
    ).rejects.toMatchObject({ code: 'authentication_required', status: 401 })

    const unavailable = clientFactory({ capabilityError: { code: 'PGRST500' } })
    await expect(
      requireEvoCapability(
        request(),
        'programming.manage',
        { createClientImpl: unavailable.createClientImpl, env },
      ),
    ).rejects.toMatchObject({
      code: 'identity_authorization_unavailable',
      status: 503,
    })
  })

  it('serializa únicamente errores públicos estables', () => {
    const response = capabilityAuthErrorResponse(new Error('sensitive detail'))
    expect(response).toEqual({
      status: 503,
      body: { error: 'identity_authorization_unavailable' },
    })
  })
})
