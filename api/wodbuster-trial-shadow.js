import { adminSecretsMatch } from './lib/evoAdminAuth.js'
import { readWodBusterReport } from './lib/wodBusterReadProbe.js'
import { summarizeWodBusterTrialShadow } from './lib/wodBusterTrialShadow.js'

function configuration(env) {
  return {
    user: String(env.WODBUSTER_API_USER || '').trim(),
    password: String(env.WODBUSTER_API_PASSWORD || '').trim(),
    box: String(env.WODBUSTER_BOX || '').trim(),
    adminSecret: String(env.COACH_GUIDE_ADMIN_SECRET || '').trim(),
    cronSecret: String(env.CRON_SECRET || '').trim(),
  }
}

function cronSecretsMatch(received, expected) {
  return Boolean(expected) && String(received || '') === `Bearer ${expected}`
}

export function createWodBusterTrialShadowHandler({ env = process.env, read = readWodBusterReport, now = Date.now } = {}) {
  let lastAttempt = 0
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'method_not_allowed' })
    const settings = configuration(env)
    const authorizedAdmin = req.method === 'POST' && adminSecretsMatch(req.headers?.['x-evo-admin-secret'], settings.adminSecret)
    const authorizedCron = req.method === 'GET' && cronSecretsMatch(req.headers?.authorization, settings.cronSecret)
    if (!authorizedAdmin && !authorizedCron) return res.status(401).json({ error: 'unauthorized' })
    if (!settings.user || !settings.password || settings.box !== 'evolution') return res.status(503).json({ error: 'wodbuster_trial_shadow_not_configured' })

    const instant = now()
    if (lastAttempt && instant - lastAttempt < 60000) return res.status(429).json({ error: 'retry_later' })
    lastAttempt = instant
    const from = new Date(instant).toISOString()
    const to = new Date(instant + 86400000).toISOString()
    const source = { env: { WODBUSTER_API_USER: settings.user, WODBUSTER_API_PASSWORD: settings.password, WODBUSTER_BOX: settings.box }, from, to }
    const [bookings, sessions] = await Promise.all([
      read({ ...source, report: 'CuantoEntrenan' }),
      read({ ...source, report: 'CuantoEnsenan' }),
    ])
    if (!bookings.ok || !sessions.ok) {
      return res.status(502).json({
        error: 'wodbuster_trial_shadow_source_unavailable',
        bookings: bookings.ok ? 'ok' : bookings.error,
        sessions: sessions.ok ? 'ok' : sessions.error,
      })
    }
    const summary = summarizeWodBusterTrialShadow({ bookings: bookings.rows, sessions: sessions.rows })
    return res.status(200).json({ source: 'wodbuster', window: 'next_24h', ...summary })
  }
}

export default createWodBusterTrialShadowHandler()
