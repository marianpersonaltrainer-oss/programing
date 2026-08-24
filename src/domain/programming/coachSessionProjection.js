function asText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function sorted(items) {
  return [...(items || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
}

export function projectSessionForCoach(session) {
  return {
    id: session.id,
    weekday: session.weekday,
    classType: session.class_type?.label || session.class_type || 'Clase EVO',
    title: asText(session.title) || session.class_type?.label || 'Sesión sin título',
    objective: asText(session.objective),
    briefing: asText(session.briefing),
    status: session.status,
    blocks: sorted(session.blocks).map((block) => ({
      id: block.id || block.sort_order,
      title: asText(block.title) || asText(block.block_type) || 'Bloque',
      items: sorted(block.items).map((item) => ({
        id: item.id || item.sort_order,
        exerciseName: asText(item.exercise_name) || asText(item.name) || 'Ejercicio',
        prescription: asText(item.prescription) || asText(item.notes) || asText(item.text),
      })),
    })),
  }
}

export function projectConfirmedSessionsForCoach(sessions) {
  return [...(sessions || [])]
    .filter((session) => session.status === 'confirmed')
    .sort((a, b) => (a.weekday || 0) - (b.weekday || 0))
    .map(projectSessionForCoach)
}
