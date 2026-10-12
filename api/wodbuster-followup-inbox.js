import { createHash, timingSafeEqual } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const FOLLOWUP_EVENT_TYPE = 'member.followup_signal'
const FOLLOWUP_SIGNAL = 'inactive_no_next_booking'
const DIRECT_FOLLOWUP_SIGNAL = 'inactive_needs_check'
const ACTIVE_ATHLETES_URL = 'https://evolution.wodbuster.com/api/box/Atletas'
const USER_IDS_URL = 'https://evolution.wodbuster.com/api/users/Get'
const WODBUSTER_PROFILE_URL = 'https://evolution.wodbuster.com/admin/edituser.aspx?id='

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
    officeUsersApiKey: String(env.WODBUSTER_OFFICE_USER_IDS_KEY || '').trim(),
  }
}

function nonNegative(value) {
  const number = typeof value === 'number' ? value : Number(String(value ?? '').trim().replace(',', '.'))
  return Number.isFinite(number) && number >= 0 ? number : null
}

function fullName(row) {
  const parts = [row?.Nombre, row?.Apellido1, row?.Apellido2]
    .map(value => String(value || '').trim())
    .filter(Boolean)
  const result = parts.join(' ').replace(/\s+/g, ' ').trim()
  return result.slice(0, 140) || null
}

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0]?.slice(0, 60) || null
}

function opaqueReference(row, secret) {
  const upstreamReference = String(row?.Dni || row?.Email || row?.['Nombre para mostrar'] || row?.Nombre || '').trim()
  if (!upstreamReference) return null
  return `wb_${createHash('sha256').update(`${secret}:${upstreamReference}`).digest('hex').slice(0, 24)}`
}

function profileUrlForId(profileId) {
  const normalizedId = String(profileId || '').trim()
  return /^\d{1,12}$/.test(normalizedId) ? `${WODBUSTER_PROFILE_URL}${normalizedId}` : null
}

function profileUrlForAthlete(row, profileIdsByEmail) {
  const email = String(row?.Email || '').trim().toLowerCase()
  if (!email) return null
  return profileUrlForId(profileIdsByEmail.get(email))
}

function directFollowup(row, secret, observedAt, profileIdsByEmail = new Map()) {
  const inactiveDays = nonNegative(row?.['Días sin entrenar'])
  // WodBuster's display name can be a legacy alias or a social handle. Prefer
  // the actual name entered in the member record for a human follow-up list.
  const memberFullName = fullName(row) || String(row?.['Nombre para mostrar'] || '').trim().slice(0, 140) || null
  const memberFirstName = firstName(memberFullName)
  const memberReference = opaqueReference(row, secret)
  // The active-athlete report does not confirm a future reservation. Keep the
  // signal explicit so nobody reads it as a cancellation or missed booking.
  if (inactiveDays === null || inactiveDays < 7 || inactiveDays > 30 || !memberFullName || !memberReference) return null
  return {
    sourceEventId: `wodbuster-direct-${memberReference}`,
    occurredAt: observedAt,
    memberReference,
    memberFirstName,
    memberFullName,
    memberProfileUrl: profileUrlForAthlete(row, profileIdsByEmail),
    signal: DIRECT_FOLLOWUP_SIGNAL,
    inactiveDays,
    nextBookingDays: null,
  }
}

async function readProfileIds(settings, fetchImpl) {
  if (!settings.officeUsersApiKey) return new Map()
  const response = await fetchImpl(USER_IDS_URL, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(15000),
    headers: {
      API_ACCESS_KEY: settings.officeUsersApiKey,
      'User-Agent': 'EVO-Office-Followups-ReadOnly',
    },
  })
  if (!response.ok) throw new Error('wodbuster_user_ids_unavailable')
  const payload = await response.json()
  if (!payload?.EsOk || !Array.isArray(payload.Data)) throw new Error('wodbuster_user_ids_invalid')

  // Do not retain the full WodBuster response. This reader deliberately keeps
  // only the short-lived email -> internal-id lookup needed to open a ficha.
  return new Map(payload.Data.flatMap(item => {
    const email = String(item?.email || '').trim().toLowerCase()
    const id = String(item?.id || '').trim()
    return email && /^\d{1,12}$/.test(id) ? [[email, id]] : []
  }))
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
  let profileIdsByEmail = new Map()
  try {
    profileIdsByEmail = await readProfileIds(settings, fetchImpl)
  } catch {
    // The current follow-up list remains available if profile deep-links are
    // temporarily unavailable; it never falls back to matching people by name.
  }
  return rows.map(row => directFollowup(row, settings.secret, observedAt, profileIdsByEmail)).filter(Boolean)
}

/** Redacta la señal antes de que salga del núcleo: nunca el evento bruto. */
export function toFollowupInboxItem(row) {
  if (!row || row.event_type !== FOLLOWUP_EVENT_TYPE || !row.payload || typeof row.payload !== 'object') return null
  const member = row.payload.member
  const signal = row.payload.signal
  const reference = text(member?.reference, 120)
  const memberFirstName = text(member?.firstName, 60)
  const memberFullName = text(member?.fullName, 140)
  const inactiveDays = numberOrNull(signal?.inactiveDays)
  const nextBookingDays = numberOrNull(signal?.nextBookingDays)
  const occurredAt = text(row.occurred_at, 40)
  if (!reference || signal?.code !== FOLLOWUP_SIGNAL || inactiveDays === null || !occurredAt || Number.isNaN(new Date(occurredAt).getTime())) return null
  return {
    sourceEventId: text(row.event_id, 80),
    occurredAt: new Date(occurredAt).toISOString(),
    memberReference: reference,
    memberFirstName: memberFirstName || null,
    memberFullName: memberFullName || memberFirstName || null,
    memberProfileUrl: null,
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
