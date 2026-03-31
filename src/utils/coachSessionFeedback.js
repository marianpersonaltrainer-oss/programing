/** Fila de `coach_session_feedback`: tolerant con tipos que devuelve PostgREST/Postgres. */
export function coachFeedbackRowIndicatesChange(row) {
  if (!row) return false
  const v = row.changed_something
  return v === true || v === 'true' || v === 't' || v === 1 || v === '1'
}
