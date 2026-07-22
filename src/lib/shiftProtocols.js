import { buildShiftProtocolLogInput } from '../domain/shiftProtocolLog.js'
import { madridDayUtcRange } from '../utils/shiftProtocolTime.js'
import { supabase } from './supabase.js'

const TABLE = 'shift_protocol_logs'
const LOG_SELECT = 'id, user_id, org_id, record_type, result, comment, all_steps_confirmed, protocol_version, created_at'

function shiftProtocolError(error) {
  if (!error) return error
  const message = String(error.message || '')
  if (message.includes('does not exist') || message.includes('schema cache')) {
    return new Error('El registro de turnos todavía no está activado en este entorno.')
  }
  if (message.includes('row-level security') || message.includes('permission denied')) {
    return new Error('Tu cuenta no tiene permiso para realizar esta acción.')
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

export async function listDirectionProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .in('role', ['coach', 'programmer'])
    .order('full_name', { ascending: true })

  if (error) throw shiftProtocolError(error)
  return data || []
}
