import { supabase } from './supabase.js'

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

export async function getPe2ActiveSlot(organizationId) {
  if (!organizationId) {
    throw new Error('No existe un contexto único con programming.manage.')
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw wrapPe2Error(userErr)
  const userId = userData.user?.id
  if (!userId) throw new Error('Inicia sesión para ver el slot activo.')

  const { data, error } = await supabase
    .from('pe2_programmer_state')
    .select('mesociclo, semana, phase, org_id')
    .eq('user_id', userId)
    .eq('org_id', organizationId)
    .maybeSingle()

  if (error) throw wrapPe2Error(error, 'Ejecuta la migración `20260629150000_pe2_structured_auth.sql`.')
  if (data) return data

  const fallback = {
    mesociclo: 'fuerza',
    semana: 1,
    phase: null,
    org_id: organizationId,
  }
  await setPe2ActiveSlot(fallback, organizationId)
  return fallback
}

export async function setPe2ActiveSlot(
  { mesociclo, semana, phase = null },
  organizationId,
) {
  if (!organizationId) {
    throw new Error('No existe un contexto único con programming.manage.')
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const userId = userData.user?.id
  if (!userId) throw new Error('Inicia sesión para guardar el slot.')

  const row = {
    user_id: userId,
    org_id: organizationId,
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

// ── Semanas (cabecera de slot) ────────────────────────────────────────────────

export async function listPe2WeeksForSlot(mesociclo, semana, { includeArchived = false } = {}) {
  if (!mesociclo || semana == null) return []
  let q = supabase
    .from(TABLE)
    .select('id, mesociclo, semana, phase, titulo, status, is_primary, updated_at, created_at, published_week_id')
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

export async function updatePe2Week(id, patch) {
  if (id == null) throw new Error('Falta id de borrador')

  if (patch?.is_primary === true) {
    const current = await getPe2WeekById(id)
    if (current?.mesociclo && current?.semana != null) {
      await clearPe2PrimaryForSlot(current.mesociclo, current.semana, current.org_id)
    }
  }

  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single()
  if (error) throw wrapPe2Error(error)
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


/**
 * Adds a private structured review of an imported week.
 *
 * This deliberately refuses to replace existing sessions and never marks a week
 * ready or published. Publication remains a separate, explicit workflow.
 */
export async function createPe2StructuredReviewSessions({ weekId, orgId, sessions }) {
  if (!weekId || !orgId) throw new Error('Falta la semana u organización para preparar la revisión.')
  if (!Array.isArray(sessions) || !sessions.length) {
    throw new Error('No hay sesiones para preparar.')
  }

  const { data: existing, error: existingError } = await supabase
    .from('pe2_sessions')
    .select('id')
    .eq('week_id', weekId)
    .is('parent_session_id', null)
    .limit(1)

  if (existingError) throw wrapPe2Error(existingError)
  if (existing?.length) {
    throw new Error('Esta semana ya tiene sesiones estructuradas. No se reemplazarán automáticamente.')
  }

  const rows = sessions.map(({ blocks, ...session }) => session)
  const { data: insertedSessions, error: sessionsError } = await supabase
    .from('pe2_sessions')
    .insert(rows)
    .select('id, class_type_id, weekday')

  if (sessionsError) throw wrapPe2Error(sessionsError)

  try {
    const sessionIds = new Map(
      (insertedSessions || []).map((session) => [
        `${session.class_type_id}:${session.weekday}`,
        session.id,
      ])
    )

    const blockRows = []
    for (const session of sessions) {
      const sessionId = sessionIds.get(`${session.class_type_id}:${session.weekday}`)
      for (const block of session.blocks || []) {
        blockRows.push({
          session_id: sessionId,
          org_id: orgId,
          kind: block.kind,
          name: block.name,
          dose: block.dose,
          duration_min: block.duration_min,
          sort_order: block.sort_order,
        })
      }
    }

    const { data: insertedBlocks, error: blocksError } = await supabase
      .from('pe2_blocks')
      .insert(blockRows)
      .select('id, session_id, sort_order')

    if (blocksError) throw wrapPe2Error(blocksError)

    const blockIds = new Map(
      (insertedBlocks || []).map((block) => [
        `${block.session_id}:${block.sort_order}`,
        block.id,
      ])
    )

    const itemRows = []
    for (const session of sessions) {
      const sessionId = sessionIds.get(`${session.class_type_id}:${session.weekday}`)
      for (const block of session.blocks || []) {
        const blockId = blockIds.get(`${sessionId}:${block.sort_order}`)
        for (const item of block.items || []) {
          itemRows.push({
            block_id: blockId,
            org_id: orgId,
            exercise_ref: null,
            raw_text: item.raw_text,
            prescription: item.prescription,
            sort_order: item.sort_order,
          })
        }
      }
    }

    const { error: itemsError } = await supabase
      .from('pe2_block_items')
      .insert(itemRows)

    if (itemsError) throw wrapPe2Error(itemsError)
    return listPe2SessionsForWeek(weekId)
  } catch (error) {
    // Foreign-key cascades remove any partial blocks/items as well. Restrict the
    // rollback to the rows created by this request; never delete another review.
    const insertedIds = (insertedSessions || []).map((session) => session.id).filter(Boolean)
    if (insertedIds.length) {
      await supabase.from('pe2_sessions').delete().in('id', insertedIds)
    }
    throw error
  }
}
