export function projectionProgressPercent(projection) {
  const completed = Number(projection?.progress?.completed_action_count || 0)
  const total = Number(projection?.progress?.total_action_count || 0)
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((completed / total) * 100)))
}

export function projectionStageLabel(projection) {
  if (projection?.entry_mode === 'veteran') return 'Tu siguiente hito'
  const day = projection?.journey_day
  return Number.isInteger(day) ? `Día ${day} · inicio` : 'Inicio'
}

export function projectionActionStatusLabel(status) {
  return status === 'completed' ? 'Completada'
    : status === 'available' ? 'Disponible'
      : 'Pendiente'
}

export function projectionDataStatusLabel(status) {
  return status === 'fresh' ? 'actualizado'
    : status === 'stale' ? 'pendiente de actualizar'
      : 'pendiente de conectar'
}
