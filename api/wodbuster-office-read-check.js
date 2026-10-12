import { adminSecretsMatch } from './lib/evoAdminAuth.js'
import { probeWodBuster } from './lib/wodBusterReadProbe.js'

// Private, schema-only health check for the dedicated Office credential.
// It never returns rows or persists WodBuster data. Individual follow-ups are
// deliberately not derived until the source fields and their semantics have
// been verified in a supervised read.
export function createOfficeReadCheck({ env = process.env, probe = probeWodBuster, now = Date.now } = {}) {
  let lastAttempt = 0
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!adminSecretsMatch(req.headers?.['x-evo-admin-secret'], env.COACH_GUIDE_ADMIN_SECRET)) {
      return res.status(401).json({ error: 'unauthorized' })
    }

    const check = req.query?.check ?? 'activity-past'
    if (!['activity-past', 'active-athletes'].includes(check)) return res.status(400).json({ error: 'invalid_check' })

    const instant = now()
    if (lastAttempt && instant - lastAttempt < 60000) return res.status(429).json({ error: 'retry_later' })
    lastAttempt = instant

    const officeEnv = {
      ...env,
      WODBUSTER_API_USER: String(env.WODBUSTER_OFFICE_READ_USER || '').trim(),
      WODBUSTER_API_PASSWORD: String(env.WODBUSTER_OFFICE_READ_PASSWORD || '').trim(),
      WODBUSTER_BOX: 'evolution',
    }
    const result = await probe({
      env: officeEnv,
      report: check === 'active-athletes' ? 'Atletas' : 'CuantoEntrenan',
      ...(check === 'activity-past'
        ? { from: new Date(instant - 86400000).toISOString(), to: new Date(instant).toISOString() }
        : {}),
    })
    return res.status(result.ok ? 200 : 502).json({
      source: 'wodbuster_office_read_only',
      mode: 'schema_only',
      check,
      ...result,
    })
  }
}

export default createOfficeReadCheck()
