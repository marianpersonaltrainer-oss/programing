import { supabase } from './supabase.js'

const TABLE = 'pe2_weeks'

function wrapPe2Error(error) {
  if (!error) return error
  const msg = String(error.message || '')
  if (msg.includes('pe2_weeks') && (msg.includes('schema cache') || msg.includes('does not exist'))) {
    return new Error(
      'No existe la tabla pe2_weeks. Ejecuta la migración `20260622120000_pe2_weeks.sql` (npm run db:apply-pe2-weeks o SQL Editor en Supabase).',
    )
  }
  return error
}

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
  if (error) throw wrapPe2Error(error)
  return data || []
}

export async function getPe2WeekById(id) {
  if (id == null) return null
  const { data, error } = await supabase.from(TABLE).select('*').eq('id', id).maybeSingle()
  if (error) throw wrapPe2Error(error)
  return data
}

export async function getPe2PrimaryWeek(mesociclo, semana) {
  if (!mesociclo || semana == null) return null
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('mesociclo', mesociclo)
    .eq('semana', Number(semana))
    .eq('is_primary', true)
    .neq('status', 'archived')
    .maybeSingle()

  if (error) throw wrapPe2Error(error)
  return data
}

async function clearPe2PrimaryForSlot(mesociclo, semana) {
  const { error } = await supabase
    .from(TABLE)
    .update({ is_primary: false })
    .eq('mesociclo', mesociclo)
    .eq('semana', Number(semana))
    .eq('is_primary', true)
    .neq('status', 'archived')

  if (error) throw wrapPe2Error(error)
}

export async function createPe2WeekDraft({
  mesociclo,
  semana,
  phase = null,
  titulo = '',
  data = {},
  is_primary = true,
  proposal = null,
}) {
  if (!mesociclo || semana == null) throw new Error('Falta mesociclo o semana')

  if (is_primary) await clearPe2PrimaryForSlot(mesociclo, semana)

  const { data: row, error } = await supabase
    .from(TABLE)
    .insert({
      mesociclo: String(mesociclo).trim(),
      semana: Number(semana),
      phase,
      titulo: titulo || `S${semana} · ${mesociclo}`,
      status: 'draft',
      is_primary,
      data,
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
      await clearPe2PrimaryForSlot(current.mesociclo, current.semana)
    }
  }

  const { data, error } = await supabase.from(TABLE).update(patch).eq('id', id).select('*').single()
  if (error) throw wrapPe2Error(error)
  return data
}

export async function archivePe2Week(id) {
  return updatePe2Week(id, { status: 'archived', is_primary: false })
}

export async function appendPe2GenerationLog(id, entry) {
  const row = await getPe2WeekById(id)
  if (!row) throw new Error('Borrador no encontrado')
  const log = Array.isArray(row.generation_log) ? [...row.generation_log] : []
  log.push({ at: new Date().toISOString(), ...entry })
  return updatePe2Week(id, { generation_log: log.slice(-200) })
}
