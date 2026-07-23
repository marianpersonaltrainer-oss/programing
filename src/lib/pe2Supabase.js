import { supabase } from './supabase.js'
import { assertPe2WeekLockMatch, Pe2WeekVersionConflictError } from './pe2WeekLock.js'

const TABLE = 'pe2_weeks'

function wrapPe2Error(error, hint) {
  if (!error) return error
  const msg = String(error.message || '')
  if (msg.includes('schema cache') || msg.includes('does not exist')) {
    return new Error(hint || msg)
  }
  if (msg.includes('JWT') || msg.includes('not authenticated')) {
    return new Error('Inicia sesión como programador para acceder a Programación V2.')
  }
  return error
}

// ── Slot activo (Supabase, no localStorage) ───────────────────────────────────

export async function getPe2ActiveSlot() {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw wrapPe2Error(userErr)
  const userId = userData.user?.id
  if (!userId) throw new Error('Inicia sesión para ver el slot activo.')

  const { data, error } = await supabase
    .from('pe2_programmer_state')
    .select('mesociclo, semana, phase, org_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw wrapPe2Error(error, 'Ejecuta la migración `20260629150000_pe2_structured_auth.sql`.')
  if (data) return data

  const profile = await getPe2ProfileForUser(userId)
  if (!profile?.org_id) throw new Error('Tu perfil no tiene organización asignada. Ejecuta el seed V2.')

  const fallback = { mesociclo: 'fuerza', semana: 1, phase: null, org_id: profile.org_id }
  await setPe2ActiveSlot(fallback)
  return fallback
}

export async function setPe2ActiveSlot({ mesociclo, semana, phase = null }) {
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const userId = userData.user?.id
  if (!userId) throw new Error('Inicia sesión para guardar el slot.')

  const profile = await getPe2ProfileForUser(userId)
  if (!profile?.org_id) throw new Error('Perfil sin org_id.')

  const row = {
    user_id: userId,
    org_id: profile.org_id,
    mesociclo: String(mesociclo).trim(),
    semana: Number(semana),
    phase,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('pe2_programmer_state')
    .upsert(row, { onConflict: 'user_id' })
    .select('mesociclo, semana, phase, org_id')
    .single()

  if (error) throw wrapPe2Error(error)
  return data
}

async function getPe2ProfileForUser(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, org_id, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

// ── Semanas (cabecera de slot) ────────────────────────────────────────────────

export async function listPe2WeeksForSlot(mesociclo, semana, { includeArchived = false } = {}) {
  if (!mesociclo || semana == null) return []
  let q = supabase
    .from(TABLE)
    .select('id, mesociclo, semana, phase, titulo, status, is_primary, updated_at, created_at, published_week_id, lock_version')
    .eq('mesociclo', mesociclo)
    .eq('semana', Number(semana))
    .order('updated_at', { ascending: false })

  if (!includeArchived) q = q.neq('status', 'archived')

  const { data, error } = await q
  if (error) throw wrapPe2Error(error, 'Ejecuta migraciones pe2_weeks y pe2_structured_auth.')
  return data || []
}

export async function getPe2WeekById(id) {
  if (id == null) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw wrapPe2Error(error)
  return data
}

async function clearPe2PrimaryForSlot(mesociclo, semana, orgId) {
  let q = supabase
    .from(TABLE)
    .update({ is_primary: false })
    .eq('mesociclo', mesociclo)
    .eq('semana', Number(semana))
    .eq('is_primary', true)
    .neq('status', 'archived')
  if (orgId) q = q.eq('org_id', orgId)
  const { error } = await q
  if (error) throw wrapPe2Error(error)
}

export async function createPe2WeekDraft({
  mesociclo,
  semana,
  orgId,
  phase = null,
  titulo = '',
  is_primary = true,
  proposal = null,
}) {
  if (!mesociclo || semana == null) throw new Error('Falta mesociclo o semana')
  if (!orgId) throw new Error('Falta org_id del programador.')

  if (is_primary) await clearPe2PrimaryForSlot(mesociclo, semana, orgId)

  const { data: row, error } = await supabase
    .from(TABLE)
    .insert({
      org_id: orgId,
      mesociclo: String(mesociclo).trim(),
      semana: Number(semana),
      phase,
      titulo: titulo || `S${semana} · ${mesociclo}`,
      status: 'draft',
      is_primary,
      data: {},
      proposal,
    })
    .select('*')
    .single()

  if (error) throw wrapPe2Error(error)
  return row
}

export async function updatePe2Week(id, patch, options = {}) {
  if (id == null) throw new Error('Falta id de borrador')

  if (patch?.is_primary === true) {
    const current = await getPe2WeekById(id)
    if (current?.mesociclo && current?.semana != null) {
      await clearPe2PrimaryForSlot(current.mesociclo, current.semana, current.org_id)
    }
  }

  let q = supabase.from(TABLE).update(patch).eq('id', id)
  if (options.expectedLockVersion != null) {
    q = q.eq('lock_version', Number(options.expectedLockVersion))
  }

  const { data, error } = await q.select('*').maybeSingle()
  if (error) throw wrapPe2Error(error)

  if (options.expectedLockVersion != null) {
    const lock = assertPe2WeekLockMatch(data, options.expectedLockVersion)
    if (!lock.ok) throw new Pe2WeekVersionConflictError(lock.message, lock.code)
  } else if (!data) {
    throw new Error('No se encontró el borrador a actualizar.')
  }

  return data
}

export async function archivePe2Week(id) {
  return updatePe2Week(id, { status: 'archived', is_primary: false })
}

// ── Catálogo ──────────────────────────────────────────────────────────────────

export async function listPe2ClassTypes() {
  const { data, error } = await supabase
    .from('pe2_class_types')
    .select('id, slug, label, sort_order, is_active, dna')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) throw wrapPe2Error(error)
  return data || []
}

// ── Rejilla semanal (sesiones estructuradas) ──────────────────────────────────

const SESSION_GRID_SELECT = `
  id, week_id, class_type_id, weekday, parent_session_id,
  title, objective, dominant_pattern, briefing, est_minutes, status,
  class_type:pe2_class_types ( id, slug, label, sort_order ),
  blocks:pe2_blocks (
    id, kind, name, dose, duration_min, sort_order,
    items:pe2_block_items (
      id, raw_text, prescription, sort_order,
      exercise:pe2_exercises ( id, name, pattern )
    )
  )
`

export async function listPe2SessionsForWeek(weekId) {
  if (!weekId) return []
  const { data, error } = await supabase
    .from('pe2_sessions')
    .select(SESSION_GRID_SELECT)
    .eq('week_id', weekId)
    .is('parent_session_id', null)
    .order('weekday', { ascending: true })

  if (error) throw wrapPe2Error(error)
  return data || []
}

export async function getPe2WeekGridData(weekId) {
  const [classTypes, sessions] = await Promise.all([
    listPe2ClassTypes(),
    listPe2SessionsForWeek(weekId),
  ])
  return { classTypes, sessions }
}

export function buildPe2SessionMap(sessions) {
  const map = new Map()
  for (const s of sessions || []) {
    map.set(`${s.class_type_id}:${s.weekday}`, s)
  }
  return map
}
