import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import handler from './method-rule.js'

function createMockRes() {
  /** @type {{ statusCode: number, body: unknown, setHeader: Function, status: Function, json: Function }} */
  const res = {
    statusCode: 200,
    body: null,
    setHeader() {
      return this
    },
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
  return res
}

describe('POST /api/method-rule — cuarentena legacy', () => {
  /** @type {string|undefined} */
  let prevLegacyFlag

  beforeEach(() => {
    prevLegacyFlag = process.env.METHOD_RULE_LEGACY_WRITE_ENABLED
    delete process.env.METHOD_RULE_LEGACY_WRITE_ENABLED
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_URL
    delete process.env.VITE_SUPABASE_URL
  })

  afterEach(() => {
    if (prevLegacyFlag === undefined) {
      delete process.env.METHOD_RULE_LEGACY_WRITE_ENABLED
    } else {
      process.env.METHOD_RULE_LEGACY_WRITE_ENABLED = prevLegacyFlag
    }
  })

  it('responde 403 por defecto sin configurar Supabase', async () => {
    const req = { method: 'POST', body: { rule_text: 'Probar regla' } }
    const res = createMockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res.body).toMatchObject({ ok: false, error: 'legacy_writes_disabled' })
  })
})
