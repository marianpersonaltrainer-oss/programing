import { normalizeAthlete, normalizeCoachSession, normalizeTraining, rawEventId } from './normalize.js'

const assertOk = (error, operation) => { if (error) throw new Error(`${operation}: ${error.message}`) }
const upsert = async (db, table, rows, onConflict) => {
  if (!rows.length) return
  const { error } = await db.from(table).upsert(rows, { onConflict })
  assertOk(error, `upsert ${table}`)
}

export async function reconcileWodBuster({ adapter, db, orgId, from, to, now = new Date() }) {
  const startedAt = now.toISOString()
  await upsert(db, 'mc_sync_state', [{ org_id: orgId, source: 'wodbuster_data', sync_key: 'reconciliation', last_started_at: startedAt, last_status: 'running' }], 'org_id,source,sync_key')
  try {
    const [athleteRaw, trainingRaw, coachingRaw] = await Promise.all([adapter.listAthletes(), adapter.listTraining({ from, to }), adapter.listCoaching({ from, to })])
    const coachSessions = coachingRaw.map(normalizeCoachSession)
    const coaches = new Map()
    for (const session of coachSessions) coaches.set(session.externalClassId, [...(coaches.get(session.externalClassId) || []), session])
    const athletes = athleteRaw.map(normalizeAthlete).filter(Boolean)
    const reservations = trainingRaw.map((raw) => normalizeTraining(raw, { now, coaches })).filter(Boolean)
    await upsert(db, 'mc_people', athletes.map((a) => ({ org_id: orgId, wodbuster_user_id: a.externalPersonId, full_name: a.fullName, email: a.email, joined_at: a.joinedAt, metadata: { wodbuster_snapshot: a.raw } })), 'org_id,wodbuster_user_id')
    await upsert(db, 'mc_wodbuster_events', reservations.map((r) => ({ org_id: orgId, external_event_id: rawEventId('snapshot', r), event_type: `reservation.${r.status}`, occurred_at: r.attendedAt || r.cancelledAt || r.startsAt, payload: r.raw, processing_status: 'processed', processed_at: now.toISOString() })), 'org_id,external_event_id')
    await upsert(db, 'mc_wodbuster_reservations', reservations.map((r) => ({ org_id: orgId, external_reservation_id: r.externalReservationId, wodbuster_user_id: r.externalPersonId, external_class_id: r.externalClassId, class_name: r.className, coach_external_id: r.coaches[0]?.externalCoachId, coach_name: r.coaches.map((c) => c.coachName).filter(Boolean).join(', ') || null, starts_at: r.startsAt, status: r.status, cancelled_at: r.cancelledAt, late_cancellation: r.lateCancellation, raw: r.raw, synced_at: now.toISOString() })), 'org_id,external_reservation_id')
    const attendance = reservations.filter((r) => r.attendedAt)
    await upsert(db, 'mc_wodbuster_attendance', attendance.map((r) => ({ org_id: orgId, external_attendance_id: `attendance:${r.externalReservationId}`, external_reservation_id: r.externalReservationId, wodbuster_user_id: r.externalPersonId, external_class_id: r.externalClassId, class_name: r.className, coach_external_id: r.coaches[0]?.externalCoachId, coach_name: r.coaches.map((c) => c.coachName).filter(Boolean).join(', ') || null, attended_at: r.attendedAt, confirmed: true, raw: r.raw, synced_at: now.toISOString() })), 'org_id,external_attendance_id')
    await upsert(db, 'mc_wodbuster_coach_sessions', coachSessions.map((s) => ({ org_id: orgId, external_class_id: s.externalClassId, coach_external_id: s.externalCoachId || 'unknown', coach_name: s.coachName, class_name: s.className, starts_at: s.startsAt, raw: s.raw, synced_at: now.toISOString() })), 'org_id,external_class_id,coach_external_id')
    const completedAt = new Date().toISOString()
    await upsert(db, 'mc_sync_state', [{ org_id: orgId, source: 'wodbuster_data', sync_key: 'reconciliation', last_started_at: startedAt, last_completed_at: completedAt, last_status: 'ok', last_error: null, metadata: { from, to, athletes: athletes.length, reservations: reservations.length, attendance: attendance.length, coach_sessions: coachSessions.length } }], 'org_id,source,sync_key')
    return { athletes: athletes.length, reservations: reservations.length, attendance: attendance.length, coachSessions: coachSessions.length }
  } catch (error) {
    await upsert(db, 'mc_sync_state', [{ org_id: orgId, source: 'wodbuster_data', sync_key: 'reconciliation', last_started_at: startedAt, last_status: 'error', last_error: String(error.message).slice(0, 500) }], 'org_id,source,sync_key')
    throw error
  }
}
