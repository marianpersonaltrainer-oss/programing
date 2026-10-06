/*
 * Proyección del turno de un entrenador.
 *
 * Esta capa recibe eventos operativos ya autorizados y devuelve solo lo que
 * necesita un coach concreto. No es un conector de WodBuster o WhatsApp y no
 * acepta pagos, teléfonos, correos ni conversaciones completas.
 */

const PERSON_ALLOWED = [
  'reference',
  'phase',
  'sessionAt',
  'objective',
  'experience',
  'context',
  'precaution',
  'observe',
  'close',
]

function text(value) {
  return String(value || '').trim()
}

function minimalPerson(raw = {}) {
  return Object.fromEntries(
    PERSON_ALLOWED
      .filter((key) => text(raw[key]))
      .map((key) => [key, text(raw[key])]),
  )
}

function timelineEntry(event) {
  const note = text(event?.note)
  const adaptation = text(event?.adaptation)
  const observation = text(event?.observation)
  const body = [observation, adaptation, note].filter(Boolean).join(' · ')
  if (!body) return null
  return {
    occurredAt: text(event?.occurredAt),
    coach: text(event?.coachName) || 'Equipo EVO',
    text: body,
  }
}

function peopleWithTimeline(events) {
  const grouped = new Map()
  for (const event of events) {
    const person = minimalPerson(event.person)
    const reference = person.reference
    if (!reference) continue
    const current = grouped.get(reference) || { latest: null, timeline: [] }
    if (!current.latest || String(current.latest.occurredAt) < String(event.occurredAt)) {
      current.latest = { ...person, eventType: event.type, occurredAt: event.occurredAt }
    }
    const timeline = timelineEntry(event)
    if (timeline) current.timeline.push(timeline)
    grouped.set(reference, current)
  }
  return [...grouped.values()]
    .map(({ latest, timeline }) => ({ ...latest, timeline: timeline.sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 8) }))
    .sort((a, b) => String(a.sessionAt).localeCompare(String(b.sessionAt)))
}

function taskForEvent(event) {
  const person = minimalPerson(event.person)
  const reference = person.reference || 'persona asignada'
  if (event.type === 'trial.confirmed') {
    return { id: `${event.id}:prepare`, kind: 'antes_de_clase', priority: 'alta', text: `Revisar el relevo de ${reference} antes de la prueba.`, dueAt: person.sessionAt || event.occurredAt }
  }
  if (event.type === 'trial.completed') {
    return { id: `${event.id}:close`, kind: 'cierre_de_prueba', priority: 'alta', text: `Completar el cierre observado de ${reference}.`, dueAt: event.occurredAt }
  }
  if (event.type === 'onboarding.started') {
    return { id: `${event.id}:welcome`, kind: 'primera_semana', priority: 'media', text: `Recibir a ${reference} y dejar nota solo si aporta continuidad.`, dueAt: person.sessionAt || event.occurredAt }
  }
  if (event.type === 'coach.note.requested') {
    return { id: `${event.id}:note`, kind: 'seguimiento', priority: 'media', text: `Revisar el último relevo útil de ${reference}.`, dueAt: person.sessionAt || event.occurredAt }
  }
  return null
}

/**
 * Proyecta una vista mínima por entrenador. Los eventos sin destinatario o
 * asignados a otro coach no aparecen. Una tarea marcada como cerrada deja de
 * estar pendiente, pero el contexto de la persona sigue disponible.
 */
export function buildCoachOperationsDashboard({ coachId, events = [], assignments = [] } = {}) {
  const target = text(coachId).toLowerCase()
  if (!target) return { tasks: [], people: [], alerts: [], counts: { tasks: 0, people: 0, alerts: 0 } }

  const assigned = events
    .filter((event) => text(event?.coachId).toLowerCase() === target)
    .filter((event) => event?.status !== 'cancelled')

  // El derecho de lectura nace de una clase asignada, no de quién escribió la
  // nota. Así, un entrenador nuevo para esa persona puede prepararse con la
  // evolución deportiva útil, sin acceder a ventas o conversaciones.
  const scheduledReferences = new Set(
    assignments
      .filter((assignment) => text(assignment?.coachId).toLowerCase() === target)
      .filter((assignment) => ['planned', 'active'].includes(text(assignment?.status)))
      .map((assignment) => text(assignment?.personReference))
      .filter(Boolean),
  )
  const visiblePersonEvents = events
    .filter((event) => scheduledReferences.has(text(event?.person?.reference)))
    .filter((event) => event?.status !== 'cancelled')

  const resolved = new Set(
    assigned
      .filter((event) => event.type === 'task.completed')
      .map((event) => text(event?.taskId))
      .filter(Boolean),
  )
  const tasks = assigned
    .map(taskForEvent)
    .filter(Boolean)
    .filter((task) => !resolved.has(task.id))
    .sort((a, b) => `${a.priority}:${a.dueAt}`.localeCompare(`${b.priority}:${b.dueAt}`))
  const people = peopleWithTimeline(visiblePersonEvents)
  const alerts = assigned
    .filter((event) => event.type === 'coach.alert')
    .map((event) => ({ id: event.id, text: text(event.message), severity: text(event.severity) || 'revisar' }))
    .filter((alert) => alert.text)

  return { tasks, people, alerts, counts: { tasks: tasks.length, people: people.length, alerts: alerts.length } }
}

export const DEMO_OPERATION_EVENTS = [
  {
    id: 'evt-trial-001', type: 'trial.confirmed', occurredAt: '2026-09-08T10:00:00+02:00', coachId: 'coach-demo',
    person: {
      reference: 'Caso de prueba A', phase: 'Clase de prueba', sessionAt: '2026-09-10T17:00:00+02:00',
      objective: 'Retomar el entrenamiento y construir constancia.', experience: 'Sin experiencia reciente.',
      context: 'Le preocupa no seguir el ritmo del grupo.',
      precaution: 'Confirmar sensaciones antes de impacto y ofrecer una alternativa si hace falta.',
      observe: 'Que se sienta segura y observar su punto de partida.',
      close: 'Al terminar, deja observaciones, adaptaciones y nivel recomendado para Marian.',
    },
  },
  {
    id: 'evt-onboarding-001', type: 'onboarding.started', occurredAt: '2026-09-08T11:00:00+02:00', coachId: 'coach-demo',
    person: {
      reference: 'Caso de inicio B', phase: 'Primera semana', sessionAt: '2026-09-11T08:00:00+02:00',
      objective: 'Ganar fuerza de forma progresiva.', experience: 'Nivel básico.',
      context: 'La primera sesión fue bien; mantener una progresión prudente.',
      observe: 'Solo registrar un cambio útil para el siguiente entrenador.',
      close: 'Deja una nota breve si hay avance, adaptación o incidencia relevante.',
    },
  },
  {
    id: 'evt-note-javi-001', type: 'coach.note.created', occurredAt: '2026-09-07T18:00:00+02:00', coachId: 'javi', coachName: 'Javi',
    person: { reference: 'Caso de inicio B' },
    observation: 'Ha ido ganando confianza con los movimientos básicos.',
    adaptation: 'Mantener progresión de carga de forma gradual.',
  },
  {
    id: 'evt-note-dani-001', type: 'coach.note.created', occurredAt: '2026-09-08T08:30:00+02:00', coachId: 'dani', coachName: 'Dani',
    person: { reference: 'Caso de inicio B' },
    observation: 'Buena actitud y coordinación más fluida en la sesión.',
    note: 'Confirmar sensaciones antes de aumentar complejidad.',
  },
]

export const DEMO_COACH_ASSIGNMENTS = [
  { coachId: 'coach-demo', personReference: 'Caso de prueba A', status: 'planned' },
  { coachId: 'coach-demo', personReference: 'Caso de inicio B', status: 'planned' },
]
