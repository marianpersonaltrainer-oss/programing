import { timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const FOLLOWUP_EVENT_TYPE = 'member.followup_signal'
const FOLLOWUP_SIGNAL = 'inactive_no_next_booking'

function text(value, maximum = 240) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : ''
}

function numberOrNull(value) {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function validBearer(header, secret) {
  const expected = Buffer.from(String(secret || ''))
  const received = Buffer.from(String(header || '').replace(/^Bearer\s+/i, '').trim())
  return expected.length >= 32 && received.length === expected.length && timingSafeEqual(received, expected)
}

function config(env) {
  return {
    secret: String(env.SALES_HANDOFF_SECRET || '').trim(),
    organizationId: String(env.EVO_ORGANIZATION_ID || '').trim(),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

/** Redacta la señal antes de que salga del núcleo: nunca el evento bruto. */
export function toFollowupInboxItem(row) {
  if (!row || row.event_type !== FOLLOWUP_EVENT_TYPE || !row.payload || typeof row.payload !== 'object') return null
  const member = row.payload.member
  const signal = row.payload.signal
  const reference = text(member?.reference, 120)
  const memberFirstName = text(member?.firstName, 60)
  const inactiveDays = numberOrNull(signal?.inactiveDays)
  const nextBookingDays = numberOrNull(signal?.nextBookingDays)
  const occurredAt = text(row.occurred_at, 40)
  if (!reference || !memberFirstName || signal?.code !== FOLLOWUP_SIGNAL || inactiveDays === null || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return null
  return {
    sourceEventId: text(row.event_id, 80),
    occurredAt: new Date(occurredAt).toISOString(),
    memberReference: reference,
    memberFirstName,
    signal: FOLLOWUP_SIGNAL,
    inactiveDays,
    nextBookingDays,
  }
}

export function createWodBusterFollowupInboxHandler({ createClientImpl = createClient, readConfigImpl = config } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const settings = readConfigImpl(process.env)
    if (!settings.secret || !settings.organizationId || !settings.serviceKey || !settings.supabaseUrl) return res.status(503).json({ error: 'followup_inbox_not_configured' })
    if (!validBearer(req.headers?.authorization, settings.secret)) return res.status(401).json({ error: 'followup_inbox_unauthorized' })

    const supabase = createClientImpl(settings.supabaseUrl, settings.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const { data, error } = await supabase
      .from('evo_events')
      .select('event_id,event_type,occurred_at,payload')
      .eq('organization_id', settings.organizationId)
      .eq('source', 'wodbuster')
      .eq('event_type', FOLLOWUP_EVENT_TYPE)
      .order('occurred_at', { ascending: false })
      .limit(100)
    if (error) return res.status(503).json({ error: 'followup_inbox_unavailable' })
    return res.status(200).json({ ok: true, followups: (data || []).map(toFollowupInboxItem).filter(Boolean) })
  }
}

export default createWodBusterFollowupInboxHandler()
