/**
 * POST /api/coach-exercise-library
 * Gestión de `coach_exercise_library` con service role (no escritura desde anon).
 *
 * Body: { action, ... }
 * - action: 'list' — todos los ejercicios (incl. inactivos)
 * - action: 'upsert' — { row } con campos; si row.id es UUID, update; si no, insert
 * - action: 'delete' — { id: uuid }
 *
 * COACH_GUIDE_ADMIN_SECRET solo se conserva como compatibilidad temporal con clientes antiguos.
 */

import { createClient } from '@supabase/supabase-js'
import { adminSecretsMatch } from './lib/evoAdminAuth.js'
import {
  capabilityAuthErrorResponse,
  readBearerToken,
  requireEvoCapability,
} from './lib/evoCapabilityAuth.js'

const CATEGORIES = new Set([
  'bisagra',
  'squat',
  'empuje_horizontal',
  'empuje_vertical',
  'jalon',
  'rotacion',
  'metabolico',
  'core',
  'olimpico',
  'landmine',
])

const LEVELS = new Set(['basico', 'intermedio', 'avanzado'])

function sanitizeRow(input) {
  if (!input || typeof input !== 'object') return null
  const row = {}
  if (typeof input.name === 'string') row.name = input.name.trim()
  if (typeof input.category === 'string' && CATEGORIES.has(input.category)) row.category = input.category
  if (Array.isArray(input.classes)) row.classes = input.classes.map((c) => String(c).trim()).filter(Boolean)
  if (typeof input.level === 'string' && LEVELS.has(input.level)) row.level = input.level
  if (input.notes === null || typeof input.notes === 'string') row.notes = input.notes === null ? null : input.notes.trim() || null
  if (typeof input.is_new === 'boolean') row.is_new = input.is_new
  if (typeof input.active === 'boolean') row.active = input.active
  if (input.video_url === null || typeof input.video_url === 'string') {
    row.video_url = input.video_url === null ? null : input.video_url.trim() || null
  }
  if (typeof input.video_url_verified === 'boolean') {
    row.video_url_verified = input.video_url_verified
  } else if (row.video_url === null || row.video_url === undefined || row.video_url === '') {
    row.video_url_verified = true
  }
  return row
}

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

  const { action } = body || {}
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

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  if (action === 'list') {
    const { data, error } = await supabase
      .from('coach_exercise_library')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data: data || [] })
  }

  if (action === 'delete') {
    const id = body.id
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Falta id' })
    }
    const { error } = await supabase.from('coach_exercise_library').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ ok: true })
  }

  if (action === 'upsert') {
    const patch = sanitizeRow(body.row)
    if (!patch || !patch.name || !patch.category || !patch.level) {
      return res.status(400).json({ error: 'Faltan name, category o level válidos' })
    }
    if (!Array.isArray(patch.classes)) {
      return res.status(400).json({ error: 'classes debe ser un array' })
    }

    const id = body.row?.id
    if (id && typeof id === 'string') {
      const { data, error } = await supabase
        .from('coach_exercise_library')
        .update(patch)
        .eq('id', id)
        .select()
        .single()

      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ data })
    }

    const insertRow = {
      ...patch,
      is_new: patch.is_new ?? false,
      active: patch.active !== false,
      video_url_verified:
        typeof patch.video_url_verified === 'boolean'
          ? patch.video_url_verified
          : patch.video_url
            ? false
            : true,
    }
    const { data, error } = await supabase.from('coach_exercise_library').insert(insertRow).select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ data })
  }

  return res.status(400).json({ error: 'Acción no válida' })
}
