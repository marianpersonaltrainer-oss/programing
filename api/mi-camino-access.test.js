import { describe, expect, it, vi } from 'vitest'
import { EvoCapabilityAuthError } from './lib/evoCapabilityAuth.js'
import { createMiCaminoAccessHandler } from './mi-camino-access.js'

const ORG_ID = '018f1f4d-7b6c-7d8e-9f10-111213141517'
const USER_ID = '018f1f4d-7b6c-7d8e-9f10-111213141518'
const PERSON_ID = '018f1f4d-7b6c-7d8e-9f10-111213141519'

function projection(overrides = {}) {
  return {
    projection_id: '018f1f4d-7b6c-7d8e-9f10-111213141520',
    organization_id: ORG_ID,
    person_id: PERSON_ID,
    entry_mode: 'new',
    journey_day: 1,
    stage_key: 'concierge_0_14',
    next_action: { action_id: '018f1f4d-7b6c-7d8e-9f10-111213141521', kind: 'approved_content', title: 'Primer paso', status: 'available', due_at: null, reference_id: 'pilot:one' },
    progress: { confirmed_attendance_count: 0, completed_action_count: 0, total_action_count: 1, next_milestone_key: null },
    freshness: { status: 'unknown', source: 'nucleus', source_updated_at: null, observed_at: '2026-08-17T10:00:00.000Z' },
    schema_version: 1,
    updated_at: '2026-08-17T10:00:00.000Z',
    ...overrides,
  }
}

function request(body = {}) {
  return { method: 'POST', headers: { authorization: 'Bearer token', origin: 'http://localhost:5173', 'x-forwarded-for': '127.0.0.1' }, body: { action: 'provision', userId: USER_ID, projection: projection(), ...body } }
}

function response() {
  return { statusCode: null, body: null, status: vi.fn(function status(code) { this.statusCode = code; return this }), json: vi.fn(function json(body) { this.body = body; return this }) }
}

function unit(options = {}) {
  const supabase = { rpc: vi.fn().mockResolvedValue({ data: null, error: null }) }
  const requireCapabilityImpl = options.requireCapabilityImpl || vi.fn().mockResolvedValue({ user: { id: USER_ID }, organizationId: ORG_ID })
  return {
    handler: createMiCaminoAccessHandler({
      createClientImpl: vi.fn(() => supabase),
      requireCapabilityImpl,
      checkRateLimitImpl: options.checkRateLimitImpl || vi.fn().mockResolvedValue(false),
      readConfigImpl: options.readConfigImpl || (() => ({ enabled: true, serviceKey: 'test-only', supabaseUrl: 'https://staging.supabase.test' })),
      requestIdImpl: () => 'request-one', logger: { info: vi.fn(), warn: vi.fn() },
    }), supabase, requireCapabilityImpl,
  }
}

describe('POST /api/mi-camino-access', () => {
  it('provisiona una proyección P2 solo con mi_camino.manage', async () => {
    const current = unit(); const res = response()
    await current.handler(request(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ ok: true, action: 'provision', requestId: 'request-one' })
    expect(current.requireCapabilityImpl).toHaveBeenCalledWith(expect.anything(), 'mi_camino.manage')
    expect(current.supabase.rpc).toHaveBeenCalledWith('evo_provision_mi_camino_access', expect.objectContaining({ target_user_id: USER_ID, target_organization_id: ORG_ID, projection: expect.objectContaining({ person_id: PERSON_ID }) }))
  })

  it('no permite que un administrador inyecte otra organización', async () => {
    const current = unit(); const res = response()
    await current.handler(request({ projection: projection({ organization_id: '018f1f4d-7b6c-7d8e-9f10-111213141530' }) }), res)
    expect(res.statusCode).toBe(403)
    expect(res.body.error).toBe('organization_mismatch')
    expect(current.supabase.rpc).not.toHaveBeenCalled()
  })

  it('rechaza proyecciones inválidas antes de escribir', async () => {
    const current = unit(); const res = response()
    await current.handler(request({ projection: projection({ journey_day: 31 }) }), res)
    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('invalid_mi_camino_projection')
    expect(current.supabase.rpc).not.toHaveBeenCalled()
  })

  it('falla cerrado para capability, rate limit y feature apagada', async () => {
    const denied = unit({ requireCapabilityImpl: vi.fn().mockRejectedValue(new EvoCapabilityAuthError('capability_denied', 403)) })
    const limited = unit({ checkRateLimitImpl: vi.fn().mockResolvedValue(true) })
    const disabled = unit({ readConfigImpl: () => ({ enabled: false, serviceKey: '', supabaseUrl: '' }) })
    const a = response(); const b = response(); const c = response()
    await denied.handler(request(), a); await limited.handler(request(), b); await disabled.handler(request(), c)
    expect(a.statusCode).toBe(403); expect(b.statusCode).toBe(429); expect(c.statusCode).toBe(404)
  })

  it('desactiva de forma reversible sin borrar proyecciones', async () => {
    const current = unit(); const res = response()
    await current.handler(request({ action: 'deactivate' }), res)
    expect(res.statusCode).toBe(200)
    expect(current.supabase.rpc).toHaveBeenCalledWith('evo_set_mi_camino_access_status', expect.objectContaining({ next_status: 'inactive' }))
  })

  it('lista sólo enlaces de acceso de la organización administrada', async () => {
    const current = unit()
    current.supabase.from = vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [{ user_id: USER_ID, status: 'active' }], error: null }),
          })),
        })),
      })),
    }))
    const res = response()
    await current.handler(request({ action: 'list', userId: undefined, projection: undefined }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.data).toEqual([{ user_id: USER_ID, status: 'active' }])
    expect(current.supabase.from).toHaveBeenCalledWith('mi_camino_person_access')
  })
})
