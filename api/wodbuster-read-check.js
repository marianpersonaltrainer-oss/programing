import { adminSecretsMatch } from './lib/evoAdminAuth.js'
import { probeWodBuster } from './lib/wodBusterReadProbe.js'

export function createReadCheck({ env = process.env, probe = probeWodBuster, now = Date.now } = {}) {
  let lastAttempt = 0
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
    if (!adminSecretsMatch(req.headers?.['x-evo-admin-secret'], env.COACH_GUIDE_ADMIN_SECRET)) {
      return res.status(401).json({ error: 'unauthorized' })
    }
    const end = now()
    if (lastAttempt && end - lastAttempt < 60000) return res.status(429).json({ error: 'retry_later' })
    lastAttempt = end
    const result = await probe({ env, from: new Date(end - 86400000).toISOString(), to: new Date(end).toISOString() })
    return res.status(result.ok ? 200 : 502).json(result)
  }
}
export default createReadCheck()
