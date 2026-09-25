import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { toCommercialTrialHandoff } from './lib/trialCloseCommercialHandoff.js'

const MAX_LIMIT = 100

function sameSecret(left, right) {
  if (!left || !right || left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < right.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function readConfig(env) {
  return {
    secret: String(env.SALES_HANDOFF_SECRET || '').trim(),
    organizationId: String(env.SALES_HANDOFF_ORGANIZATION_ID || '').trim(),
    serviceKey: String(env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
    supabaseUrl: String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim(),
  }
}

function requestedLimit(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, MAX_LIMIT) : MAX_LIMIT
}

function toTransportHandoff(event) {
  const handoff = toCommercialTrialHandoff(event)
  if (!handoff) return null
  return {
    sourceEventId: handoff.source_event_id,
    sourceOccurredAt: handoff.source_occurred_at,
    personReference: handoff.person_reference,
    attendance: handoff.attendance,
    commercialState: handoff.commercial_state,
    manualLeadLinkRequired: handoff.manual_lead_link_required,
    recommendedEntryPoint: handoff.recommended_entry_point,
    initialPriority: handoff.initial_priority,
    excludedFields: handoff.excluded_fields,
  }
}

/**
 * Lector privado para la oficina de Ventas. No crea ni modifica leads y solo
 * entrega el contrato reducido de cierres ya guardados en EVO.
 */
export function createTrialCloseHandoffsHandler({
  createClientImpl = createClient,
  readConfigImpl = readConfig,
  requestIdImpl = randomUUID,
  transformImpl = toTransportHandoff,
} = {}) {
  return async function trialCloseHandoffsHandler(req, res) {
    const requestId = requestIdImpl()
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed', requestId })

    const config = readConfigImpl(process.env)
    if (!config.secret || !config.organizationId || !config.serviceKey || !config.supabaseUrl) {
      return res.status(503).json({ error: 'sales_handoff_not_configured', requestId })
    }
    const supplied = String(req?.headers?.authorization || '').replace(/^Bearer\s+/i, '').trim()
    if (!sameSecret(supplied, config.secret)) return res.status(401).json({ error: 'not_authorized', requestId })

    const supabase = createClientImpl(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const limit = requestedLimit(req?.query?.limit)
    try {
      const { data, error } = await supabase
        .from('evo_events')
        .select('event_id,event_type,occurred_at,organization_id,external_id,payload')
        .eq('organization_id', config.organizationId)
        .eq('event_type', 'trial.close.recorded')
        .order('occurred_at', { ascending: false })
        .limit(limit)
      if (error || !Array.isArray(data)) throw error || new Error('invalid_event_response')
      const handoffs = data.map(transformImpl).filter(Boolean)
      return res.status(200).json({ ok: true, handoffs, sent: false, requestId })
    } catch {
      return res.status(503).json({ error: 'sales_handoff_unavailable', requestId })
    }
  }
}

export default createTrialCloseHandoffsHandler()
