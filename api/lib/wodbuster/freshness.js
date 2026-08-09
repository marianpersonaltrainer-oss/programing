export function evaluateFreshness(syncState, { now = new Date(), staleAfterMinutes = 90 } = {}) {
  const completed = syncState?.last_completed_at && new Date(syncState.last_completed_at)
  const lagMinutes = completed && !Number.isNaN(completed.valueOf()) ? (now - completed) / 60000 : Infinity
  const healthy = syncState?.last_status === 'ok' && lagMinutes <= staleAfterMinutes
  return { healthy, stale: !healthy, lagMinutes, suppressNegativeActions: !healthy, status: healthy ? 'healthy' : syncState?.last_status === 'error' ? 'degraded' : 'stale' }
}
