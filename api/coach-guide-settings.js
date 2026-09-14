/**
 * POST /api/coach-guide-settings
 * Actualiza la fila `coach_guide_settings` (id = default) con service role.
 * Body: { patch } donde patch solo incluye campos permitidos.
 *
 * Variables Vercel:
 * - COACH_GUIDE_ADMIN_SECRET — compatibilidad temporal con clientes antiguos
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VITE_SUPABASE_URL o SUPABASE_URL
 */

import { createClient } from '@supabase/supabase-js'
import { adminSecretsMatch } from './lib/evoAdminAuth.js'
import {
  capabilityAuthErrorResponse,
  readBearerToken,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'

const ALLOWED_KEYS = [
  'contact_channel',
  'contact_response',
  'material_override',
  'active_notice',
  'material_table',
  'contact_person',
  'contact_schedule',
  'response_time',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const serverSecret = (process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()

  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({
      error: 'Servidor sin configurar: SUPABASE_SERVICE_ROLE_KEY y URL de Supabase.',
    })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const { patch } = body || {}
  if (readBearerToken(req)) {
    try {
      await requireEvoCapability(req, 'programming.manage')
    } catch (error) {
      const response = capabilityAuthErrorResponse(error)
      return res.status(response.status).json(response.body)
    }
  } else if (!adminSecretsMatch(body?.secret, serverSecret)) {
    return res.status(401).json({ error: 'authentication_required' })
  }

  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Falta patch' })
  }

  const row = {}
  for (const k of ALLOWED_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) {
      row[k] = patch[k]
    }
  }

  if (Object.keys(row).length === 0) {
    return res.status(400).json({ error: 'No hay campos válidos en patch' })
  }

  if (row.material_table != null && !Array.isArray(row.material_table)) {
    return res.status(400).json({ error: 'material_table debe ser un array' })
  }

  row.updated_at = new Date().toISOString()

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('coach_guide_settings')
    .update(row)
    .eq('id', 'default')
    .select()
    .maybeSingle()

  if (error) {
    console.error('coach-guide-settings update failed', {
      code: error.code || 'unknown',
    })
    return res.status(500).json({ error: error.message || 'Error Supabase' })
  }

  return res.status(200).json({ ok: true, data })
}
