import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const FOLLOWUP_EVENT_TYPE = 'member.followup_signal'
const FOLLOWUP_SIGNAL = 'inactive_no_next_booking'
const DIRECT_FOLLOWUP_SIGNAL = 'inactive_needs_check'
const ACTIVE_ATHLETES_URL = 'https://evolution.wodbuster.com/api/box/Atletas'

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
    officeReaderUser: String(env.WODBUSTER_OFFICE_READ_USER || '').trim(),
    officeReaderPassword: String(env.WODBUSTER_OFFICE_READ_PASSWORD || '').trim(),
  }
}

function nonNegative(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? number : null
}

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0]?.slice(0, 60) || null
}

function opaqueReference(row, secret) {
  const upstreamReference = String(row?.Dni || row?.Email || row?.['Nombre para mostrar'] || row?.Nombre || '').trim()
  if (!upstreamReference) return null
  return `wb_${createHash('sha256').update(`${secret}:${upstreamReference}`).digest('hex').slice(0, 24)}`
}

function directFollowup(row, secret, observedAt) {
  const inactiveDays = nonNegative(row?.['Días sin entrenar'])
  const memberFirstName = firstName(row?.['Nombre para mostrar'] || row?.Nombre)
  const memberReference = opaqueReference(row, secret)
  // The active-athlete report does not confirm a future reservation. Keep the
  // signal explicit so nobody reads it as a cancellation or missed booking.
  if (inactiveDays === null || inactiveDays < 7 || inactiveDays > 30 || !memberFirstName || !memberReference) return null
  return {
    sourceEventId: `wodbuster-direct-${memberReference}`,
    occurredAt: observedAt,
    memberReference,
    memberFirstName,
    signal: DIRECT_FOLLOWUP_SIGNAL,
    inactiveDays,
    nextBookingDays: null,
  }
}

async function readCurrentFollowups(settings, fetchImpl, now) {
  const response = await fetchImpl(ACTIVE_ATHLETES_URL, {
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${settings.officeReaderUser}:${settings.officeReaderPassword}`, 'utf8').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'EVO-Office-Followups-ReadOnly',
    },
    body: new URLSearchParams({ SoloActivos: 'true' }).toString(),
  })
  if (!response.ok) throw new Error('wodbuster_active_athletes_unavailable')
  const rows = await response.json()
  if (!Array.isArray(rows)) throw new Error('wodbuster_active_athletes_invalid')
  const observedAt = now().toISOString()
  return rows.map(row => directFollowup(row, settings.secret, observedAt)).filter(Boolean)
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
  if (!reference || signal?.code !== FOLLOWUP_SIGNAL || inactiveDays === null || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return null
  return {
    sourceEventId: text(row.event_id, 80),
    occurredAt: new Date(occurredAt).toISOString(),
    memberReference: reference,
    memberFirstName: memberFirstName || null,
    signal: FOLLOWUP_SIGNAL,
    inactiveDays,
    nextBookingDays,
  }
}

export function createWodBusterFollowupInboxHandler({ createClientImpl = createClient, readConfigImpl = config, fetchImpl = fetch, nowImpl = () => new Date() } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })
    const settings = readConfigImpl(process.env)
    if (!settings.secret) return res.status(503).json({ error: 'followup_inbox_not_configured' })
    if (!validBearer(req.headers?.authorization, settings.secret)) return res.status(401).json({ error: 'followup_inbox_unauthorized' })

    if (settings.officeReaderUser && settings.officeReaderPassword) {
      try {
        const followups = await readCurrentFollowups(settings, fetchImpl, nowImpl)
        return res.status(200).json({ ok: true, source: 'wodbuster_active_athletes', followups })
      } catch {
        return res.status(503).json({ error: 'followup_source_unavailable' })
      }
    }

    if (!settings.organizationId || !settings.serviceKey || !settings.supabaseUrl) return res.status(503).json({ error: 'followup_inbox_not_configured' })

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
