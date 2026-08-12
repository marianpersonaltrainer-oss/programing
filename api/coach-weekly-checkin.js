/**
 * POST /api/coach-weekly-checkin
 * Escribe en `weekly_checkins` con service role: la vista ?coach no usa Supabase Auth,
 * así que el cliente no puede insertar con anon si RLS o el proyecto exigen JWT.
 *
 * Body JSON:
 * - accessCode — debe coincidir (trim, case-insensitive) con COACH_ACCESS_CODE
 *   configurado exclusivamente como variable privada de servidor.
 * - coach_name, week_iso, mood_score (1–5)
 * - feedback_text, highlights, improvements (opcionales, pueden ser null)
 *
 * Env Vercel / servidor:
 * - SUPABASE_SERVICE_ROLE_KEY
 * - SUPABASE_URL o VITE_SUPABASE_URL
 * - COACH_ACCESS_CODE
 */

import { createClient } from '@supabase/supabase-js'

function expectedCoachCodeFromEnv() {
  return (process.env.COACH_ACCESS_CODE || '').trim()
}

function codesMatch(input, expected) {
  const x = String(input ?? '').trim().toUpperCase()
  const y = String(expected ?? '').trim().toUpperCase()
  return x.length > 0 && y.length > 0 && x === y
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const accessCodeRecibido = body?.accessCode
  const expectedCode = expectedCoachCodeFromEnv()

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()

  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({
      error: 'Servidor sin configurar: SUPABASE_SERVICE_ROLE_KEY y URL de Supabase.',
    })
  }
  if (!expectedCode) {
    return res.status(500).json({
      error: 'Servidor sin configurar: COACH_ACCESS_CODE para validar al coach.',
    })
  }

  const { accessCode, coach_name, week_iso, mood_score, feedback_text, highlights, improvements } = body || {}

  if (!codesMatch(accessCode, expectedCode)) {
    return res.status(401).json({ error: 'Código de acceso coach incorrecto o no enviado.' })
  }

  const name = String(coach_name ?? '').trim()
  if (!name) {
    return res.status(400).json({ error: 'Falta coach_name' })
  }
  const week = String(week_iso ?? '').trim()
  if (!week) {
    return res.status(400).json({ error: 'Falta week_iso' })
  }
  const mood = Number(mood_score)
  if (!Number.isFinite(mood) || mood < 1 || mood > 5) {
    return res.status(400).json({ error: 'mood_score debe ser un entero entre 1 y 5' })
  }

  const row = {
    coach_name: name,
    week_iso: week,
    mood_score: mood,
    feedback_text: feedback_text == null || feedback_text === '' ? null : String(feedback_text),
    highlights: highlights == null || highlights === '' ? null : String(highlights),
    improvements: improvements == null || improvements === '' ? null : String(improvements),
    coach_id: null,
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('weekly_checkins')
    .upsert(row, { onConflict: 'week_iso,coach_name_norm' })
    .select('*')
    .single()

  if (error) {
    console.error('coach-weekly-checkin upsert failed', { code: error.code || 'unknown' })
    return res.status(500).json({
      error: [error.message, error.code, error.details, error.hint].filter(Boolean).join(' | ') || 'Error Supabase',
    })
  }

  return res.status(200).json({ ok: true, data })
}
