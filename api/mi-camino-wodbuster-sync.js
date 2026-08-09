import { createClient } from '@supabase/supabase-js'
import { createWodBusterAdapter } from './lib/wodbuster/adapter.js'
import { reconcileWodBuster } from './lib/wodbuster/reconcile.js'

const date = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? value : null
const isoDay = (dateValue) => dateValue.toISOString().slice(0, 10)

export default async function handler(req, res) {
  if (!['POST', 'GET'].includes(req.method)) return res.status(405).json({ error: 'Method Not Allowed' })
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
  const syncSecret = process.env.MC_SYNC_SECRET || process.env.CRON_SECRET
  if (!syncSecret || token !== syncSecret) return res.status(401).json({ error: 'Unauthorized' })
  const supabaseUrl = String(process.env.SUPABASE_URL || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const orgId = String(process.env.MC_ORG_ID || '').trim()
  if (!supabaseUrl || !serviceKey || !orgId) return res.status(503).json({ error: 'Sync server is not configured' })

  const body = typeof req.body === 'object' && req.body ? req.body : {}
  const now = new Date()
  const mode = String(body.mode || req.query?.mode || 'frequent')
  const windowDays = mode === 'daily'
    ? Math.max(1, Number(process.env.MC_WODBUSTER_DAILY_DAYS || 30))
    : Math.max(1, Number(process.env.MC_WODBUSTER_FREQUENT_DAYS || 3))
  const defaultFrom = new Date(now); defaultFrom.setUTCDate(defaultFrom.getUTCDate() - windowDays)
  const from = date(body.from || req.query?.from) || isoDay(defaultFrom)
  const to = date(body.to || req.query?.to) || isoDay(now)
  if (from > to) return res.status(400).json({ error: 'from must not be after to' })

  try {
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const result = await reconcileWodBuster({ adapter: createWodBusterAdapter(), db, orgId, from, to, now })
    return res.status(200).json({ ok: true, window: { from, to }, ...result })
  } catch (error) {
    console.error('WodBuster reconciliation failed', { name: error.name, message: error.message })
    return res.status(502).json({ error: 'WodBuster reconciliation failed' })
  }
}
