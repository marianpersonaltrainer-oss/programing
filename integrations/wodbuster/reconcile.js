import { normalizeAthlete, normalizeCoachSession, normalizeTraining, rawEventId } from './normalize.js'

const assertOk = (error, operation) => {
  if (error) throw new Error(`${operation}: ${error.message}`)
}

async function upsert(db, table, rows, onConflict) {
  if (!rows.length) return
  const { error } = await db.from(table).upsert(rows, { onConflict })
  assertOk(error, `upsert ${table}`)
}

export async function reconcileWodBuster({
  adapter,
  db,
  orgId,
  from,
  to,
  now = new Date(),
  timezone = 'Europe/Madrid',
}) {
  if (!orgId) throw new Error('MC_ORG_ID es obligatorio para reconciliar WodBuster')
  if (!from || !to) throw new Error('from y to son obligatorios para reconciliar WodBuster')

  const startedAt = now.toISOString()
  const syncKey = 'reconciliation'
  await upsert(db, 'mc_sync_state', [{
    org_id: orgId,
    source: 'wodbuster_data',
    sync_key: syncKey,
    last_started_at: startedAt,
    last_status: 'running',
    last_error: null,
  }], 'org_id,source,sync_key')

  try {
    const [athleteRaw, trainingRaw, coachingRaw] = await Promise.all([
      adapter.listAthletes(),
      adapter.listTraining({ from, to }),
      adapter.listCoaching({ from, to }),
    ])

    const coachSessions = coachingRaw.map((row) => normalizeCoachSession(row, { timezone }))
    const coachesBySession = new Map()
    for (const session of coachSessions) {
      coachesBySession.set(session.externalClassId, [
        ...(coachesBySession.get(session.externalClassId) || []),
        session,
      ])
    }

    const athletes = athleteRaw.map((row) => normalizeAthlete(row, { timezone })).filter(Boolean)
    const reservations = trainingRaw
      .map((row) => normalizeTraining(row, { now, coaches: coachesBySession, timezone }))
      .filter(Boolean)

    const syncedAt = now.toISOString()

    // mc_people can be exposed to the person herself through RLS. Keep only the
    // normalized identity fields needed by Mi Camino and never persist the full
    // Atletas payload here (it may contain DNI, phone, address, tariff, etc.).
    // Omit metadata from the upsert so existing product metadata is preserved.
    await upsert(db, 'mc_people', athletes.map((athlete) => ({
      org_id: orgId,
      wodbuster_user_id: athlete.externalPersonId,
      full_name: athlete.fullName,
      email: athlete.email,
      joined_at: athlete.joinedAt,
      updated_at: syncedAt,
    })), 'org_id,wodbuster_user_id')

    await upsert(db, 'mc_wodbuster_events', reservations.map((reservation) => ({
      org_id: orgId,
      external_event_id: rawEventId('snapshot', reservation),
      event_type: `reservation.${reservation.status}`,
      occurred_at: reservation.attendedAt || reservation.cancelledAt || reservation.startsAt,
      payload: reservation.raw,
      processing_status: 'processed',
      processed_at: syncedAt,
    })), 'org_id,external_event_id')

    await upsert(db, 'mc_wodbuster_reservations', reservations.map((reservation) => ({
      org_id: orgId,
      external_reservation_id: reservation.externalReservationId,
      wodbuster_user_id: reservation.externalPersonId,
      external_class_id: reservation.externalClassId,
      class_name: reservation.className,
      coach_external_id: reservation.coaches[0]?.externalCoachId || null,
      coach_name: reservation.coaches.map((coach) => coach.coachName).filter(Boolean).join(', ') || null,
      starts_at: reservation.startsAt,
      status: reservation.status,
      cancelled_at: reservation.cancelledAt,
      late_cancellation: reservation.lateCancellation,
      raw: reservation.raw,
      synced_at: syncedAt,
    })), 'org_id,external_reservation_id')

    // Mirror the attendance state for every reservation, not only confirmed rows.
    // This lets a later WodBuster correction (for example, attendance removed after
    // an erroneous check) reconcile the same stable row back to confirmed=false.
    // Product logic must always filter confirmed=true before counting attendance/hits.
    await upsert(db, 'mc_wodbuster_attendance', reservations.map((reservation) => ({
      org_id: orgId,
      external_attendance_id: `attendance:${reservation.externalReservationId}`,
      external_reservation_id: reservation.externalReservationId,
      wodbuster_user_id: reservation.externalPersonId,
      external_class_id: reservation.externalClassId,
      class_name: reservation.className,
      coach_external_id: reservation.coaches[0]?.externalCoachId || null,
      coach_name: reservation.coaches.map((coach) => coach.coachName).filter(Boolean).join(', ') || null,
      attended_at: reservation.attendedAt,
      confirmed: Boolean(reservation.attendedAt),
      raw: reservation.raw,
      synced_at: syncedAt,
    })), 'org_id,external_attendance_id')

    await upsert(db, 'mc_wodbuster_coach_sessions', coachSessions.map((session) => ({
      org_id: orgId,
      external_class_id: session.externalClassId,
      coach_external_id: session.externalCoachId || 'unknown',
      coach_name: session.coachName,
      class_name: session.className,
      starts_at: session.startsAt,
      raw: session.raw,
      synced_at: syncedAt,
    })), 'org_id,external_class_id,coach_external_id')

    const confirmedAttendance = reservations.filter((reservation) => reservation.attendedAt).length
    const result = {
      athletes: athletes.length,
      reservations: reservations.length,
      attendance: confirmedAttendance,
      coachSessions: coachSessions.length,
      from,
      to,
    }

    await upsert(db, 'mc_sync_state', [{
      org_id: orgId,
      source: 'wodbuster_data',
      sync_key: syncKey,
      last_started_at: startedAt,
      last_completed_at: syncedAt,
      last_status: 'ok',
      last_error: null,
      metadata: result,
    }], 'org_id,source,sync_key')

    return result
  } catch (error) {
    const failedAt = new Date().toISOString()
    await upsert(db, 'mc_sync_state', [{
      org_id: orgId,
      source: 'wodbuster_data',
      sync_key: syncKey,
      last_started_at: startedAt,
      last_completed_at: failedAt,
      last_status: 'error',
      last_error: String(error?.message || error).slice(0, 500),
    }], 'org_id,source,sync_key')
    throw error
  }
}
