import { buildShiftProtocolLogInput } from '../domain/shiftProtocolLog.js'
import { buildShiftNoteInput } from '../domain/shiftNote.js'
import { madridDayUtcRange } from '../utils/shiftProtocolTime.js'
import { supabase } from './supabase.js'

const TABLE = 'shift_protocol_logs'
const LOG_SELECT = 'id, shift_id, user_id, org_id, record_type, result, comment, all_steps_confirmed, first_class_expected, protocol_version, created_at'
const NOTE_SELECT = 'id, shift_id, user_id, org_id, note_type, team_note, person_name, is_first_class, mobility_technique, discomfort_status, discomfort_zone, discomfort_intensity, work_volume_percent, loads_used, adapted_exercises, schema_version, created_at'

function shiftProtocolError(error) {
  if (!error) return error
  const message = String(error.message || '')
  if (message.includes('does not exist') || message.includes('schema cache')) {
    return new Error('El registro de turnos todavía no está activado en este entorno.')
  }
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return new Error('Tu cuenta no tiene permiso para realizar esta acción.')
  }
  if (message.includes('shift already finished') || message.includes('finished shifts are immutable')) {
    return new Error('Este turno ya está finalizado y no admite más cambios.')
  }
  if (message.includes('opening must be completed first')) {
    return new Error('Completa primero la apertura del turno.')
  }
  if (message.includes('review must be completed')) {
    return new Error('Revisa primero las personas y novedades del turno.')
  }
  if (message.includes('first class follow-up must be completed first')) {
    return new Error('Guarda primero el seguimiento de la primera clase.')
  }
  if (String(error.code || '') === '23505') {
    return new Error('Este paso del turno ya estaba guardado. Actualiza la pantalla para continuar.')
  }
  return error
}

async function currentUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw shiftProtocolError(error)
  if (!data.user?.id) throw new Error('Inicia sesión para registrar tu turno.')
  return data.user.id
}

export async function createShiftProtocolLog(input) {
  const payload = buildShiftProtocolLogInput(input)
  const { data, error } = await supabase
    .from(TABLE)
    .insert(payload)
    .select(LOG_SELECT)
    .single()

  if (error) throw shiftProtocolError(error)
  return data
}

export async function createShiftNote(input) {
  const payload = buildShiftNoteInput(input)
  const { data, error } = await supabase
    .from('shift_notes')
    .insert(payload)
    .select(NOTE_SELECT)
    .single()

  if (error) throw shiftProtocolError(error)
  return data
}

export async function listMyShiftProtocolLogs(ymd) {
  const [userId, range] = await Promise.all([
    currentUserId(),
    Promise.resolve(madridDayUtcRange(ymd)),
  ])
  const { data, error } = await supabase
    .from(TABLE)
    .select(LOG_SELECT)
    .eq('user_id', userId)
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .order('created_at', { ascending: false })

  if (error) throw shiftProtocolError(error)
  return data || []
}

export async function listDirectionShiftProtocolLogs({ ymd, userId = '' }) {
  const range = madridDayUtcRange(ymd)
  let query = supabase
    .from(TABLE)
    .select(LOG_SELECT)
    .gte('created_at', range.start)
    .lt('created_at', range.end)
    .order('created_at', { ascending: false })

  if (userId) query = query.eq('user_id', userId)
  const { data, error } = await query
  if (error) throw shiftProtocolError(error)
  return data || []
}

export async function listTeamShiftNotes({ noteType = '', ymd = '', userId = '', limit = 20 } = {}) {
  let query = supabase
    .from('shift_notes')
    .select(NOTE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (noteType) query = query.eq('note_type', noteType)
  if (userId) query = query.eq('user_id', userId)
  if (ymd) {
    const range = madridDayUtcRange(ymd)
    query = query.gte('created_at', range.start).lt('created_at', range.end)
  }
  const { data, error } = await query
  if (error) throw shiftProtocolError(error)
  return data || []
}

export async function listDirectionShiftNotes({ ymd, userId = '' }) {
  return listTeamShiftNotes({ ymd, userId, limit: 200 })
}

export async function listDirectionProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('role', 'coach')
    .order('full_name', { ascending: true })

  if (error) throw shiftProtocolError(error)
  return data || []
}
