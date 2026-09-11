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
    const selection = req.query?.check ?? 'bookings-past'
    if (!['bookings-past', 'teachers-past', 'teachers-next'].includes(selection)) return res.status(400).json({ error: 'invalid_check' })
    const end = now()
    if (lastAttempt && end - lastAttempt < 60000) return res.status(429).json({ error: 'retry_later' })
    lastAttempt = end
    const future = selection === 'teachers-next'
    const result = await probe({ env, report: selection === 'bookings-past' ? 'CuantoEntrenan' : 'CuantoEnsenan', from: new Date(future ? end : end - 86400000).toISOString(), to: new Date(future ? end + 86400000 : end).toISOString() })
    return res.status(result.ok ? 200 : 502).json(result)
  }
}
export default createReadCheck()
