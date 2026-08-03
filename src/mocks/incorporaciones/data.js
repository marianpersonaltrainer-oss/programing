export const shifts = {
  morning: {
    label: 'Mañana',
    time: '06:45–14:30',
    entry: 'Entrada registrada a las 06:42',
    progress: 42,
    progressLabel: '3 de 7 hitos operativos resueltos',
  },
  afternoon: {
    label: 'Tarde',
    time: '14:30–22:15',
    entry: 'Entrada prevista a las 14:25',
    progress: 18,
    progressLabel: '1 de 6 hitos operativos resueltos',
  },
}

export const shiftTasks = [
  {
    id: 'opening',
    title: 'Confirmar apertura',
    detail: 'Sala revisada. Falta confirmar el inicio del turno.',
    status: 'pending',
    statusLabel: 'Ahora',
    primary: true,
  },
  {
    id: 'briefing',
    title: 'Revisar briefing especial',
    detail: 'Primera clase ficticia a las 13:30.',
    status: 'exception',
    statusLabel: 'Antes de 13:15',
  },
  {
    id: 'feedback',
    title: 'Completar feedback pendiente',
    detail: 'Caso operativo del turno anterior.',
    status: 'overdue',
    statusLabel: 'Pendiente',
  },
]

export const specialNotices = [
  {
    type: 'Persona nueva',
    title: 'Alex Vega · 13:30',
    detail: 'Primera clase. Necesita un briefing breve antes de entrar.',
    status: 'exception',
  },
  {
    type: 'Adaptación relevante',
    title: 'Alternativa sin impacto',
    detail: 'Preparar una opción conservadora para un caso ficticio.',
    status: 'pending',
  },
  {
    type: 'Cambio operativo',
    title: 'Material en zona B',
    detail: 'El remo 04 queda fuera de uso durante este turno.',
    status: 'overdue',
  },
]

export const quickActions = [
  { id: 'incident', label: 'Registrar incidencia', icon: 'incidents' },
  { id: 'first-class', label: 'Cerrar primera clase', icon: 'signups' },
  { id: 'feedback', label: 'Dejar feedback operativo', icon: 'followups' },
  { id: 'handover', label: 'Dejar relevo', icon: 'exceptions' },
]

export const endOfShiftItems = [
  { label: 'Caja', value: 'Sin diferencias registradas', status: 'completed' },
  { label: 'Sala y material', value: 'Una incidencia abierta', status: 'exception' },
  { label: 'Feedbacks críticos', value: 'Uno pendiente', status: 'pending' },
  { label: 'Relevo y cierre', value: 'Disponible al final del turno', status: 'empty' },
]

export const protocols = [
  { id: 'opening', title: 'Apertura', summary: 'Dejar el espacio operativo antes del primer servicio.', steps: ['Acceso y seguridad', 'Sala y material esencial', 'Incidencias de apertura'] },
  { id: 'closing', title: 'Cierre', summary: 'Cerrar el turno sin pendientes invisibles.', steps: ['Revisar incidencias', 'Confirmar sala y material', 'Cerrar o dejar relevo'] },
  { id: 'cash', title: 'Caja', summary: 'Registrar únicamente diferencias o acciones necesarias.', steps: ['Comprobar cierre', 'Anotar diferencia', 'Escalar si corresponde'] },
  { id: 'first-class', title: 'Primera clase', summary: 'Preparar y cerrar un caso nuevo con el mínimo contexto.', steps: ['Leer briefing especial', 'Acompañar la primera sesión', 'Dejar resultado operativo'] },
  { id: 'incidents', title: 'Incidencias', summary: 'Hacer visible una situación que necesita respuesta.', steps: ['Describir el hecho', 'Indicar urgencia', 'Dejar responsable o relevo'] },
  { id: 'feedback', title: 'Feedback', summary: 'Separar el feedback operativo del feedback de programación.', steps: ['Identificar el caso', 'Registrar el resultado', 'Definir siguiente acción'] },
  { id: 'handover', title: 'Relevo', summary: 'Transferir solo lo que requiere atención del siguiente turno.', steps: ['Pendientes críticos', 'Incidencias abiertas', 'Responsable siguiente'] },
  { id: 'followup', title: 'Seguimiento', summary: 'Mantener un caso especial con responsable y fecha.', steps: ['Motivo concreto', 'Acción acordada', 'Próxima fecha'] },
  { id: 'handbook', title: 'Handbook de clases', summary: 'Referencia de calidad para formación y evaluación, no checklist diaria.', steps: ['Consultar criterio', 'Aplicar con contexto', 'Usar en observación de calidad'] },
]

export const evolutionSummary = [
  { label: 'Tareas críticas en plazo', value: '92%', detail: 'Últimos 7 días', status: 'completed' },
  { label: 'Pendientes actuales', value: '2', detail: 'Un feedback y un relevo', status: 'pending' },
  { label: 'Último resultado operativo', value: 'Turno cerrado', detail: 'Ayer · sin incidencias críticas', status: 'completed' },
  { label: 'Última evaluación de calidad', value: 'Consistente', detail: 'Observación mensual ficticia', status: 'completed' },
  { label: 'Foco de mejora', value: 'Cerrar feedbacks en turno', detail: 'Prioridad formativa actual', status: 'exception' },
]

export const operationalExceptions = [
  { label: 'Retraso', detail: 'Entrada registrada 8 minutos tarde', owner: 'Sam · turno mañana', status: 'overdue' },
  { label: 'Turno sin cerrar', detail: 'Ayer · relevo no confirmado', owner: 'Dani · turno tarde', status: 'exception' },
  { label: 'Caja pendiente', detail: 'Falta confirmar una diferencia ficticia', owner: 'Lara · hoy', status: 'pending' },
  { label: 'Feedback pendiente', detail: 'Primera clase sin resultado operativo', owner: 'Sam · hoy', status: 'overdue' },
  { label: 'Incidencia abierta', detail: 'Material de zona B', owner: 'Dani · responsable', status: 'exception' },
  { label: 'Relevo incompleto', detail: 'Una tarea sin siguiente responsable', owner: 'Lara · ayer', status: 'pending' },
  { label: 'Tarea vencida', detail: 'Seguimiento especial fuera de plazo', owner: 'Sam · venció ayer', status: 'overdue' },
]

export const evaluations = {
  operations: [
    { label: 'Apertura y cierre', value: '94%', detail: 'Cumplimiento ficticio del último mes' },
    { label: 'Feedbacks operativos', value: '88%', detail: 'Dos cierres fuera de plazo' },
    { label: 'Incidencias y relevo', value: '91%', detail: 'Un relevo incompleto' },
  ],
  quality: {
    result: 'Consistente',
    detail: 'Observación mensual ficticia basada en el Handbook.',
    criteria: ['Claridad de la sesión', 'Gestión del grupo', 'Coherencia con el estímulo'],
  },
}

export const teamOverview = [
  { name: 'Lara', lastEvaluation: 'Consistente', trend: 'Mejora', repeated: 'Ninguno', focus: 'Delegar relevos', status: 'completed' },
  { name: 'Dani', lastEvaluation: 'En progreso', trend: 'Estable', repeated: 'Feedback tardío', focus: 'Cierre operativo', status: 'pending' },
  { name: 'Sam', lastEvaluation: 'Revisar', trend: 'Descenso', repeated: 'Puntualidad', focus: 'Inicio de turno', status: 'overdue' },
]

export const briefing = {
  person: 'Alex Vega',
  time: '13:30',
  objective: 'Empezar con seguridad y entender la dinámica de la sesión.',
  restriction: 'Evitar impacto alto y usar una carga inicial conservadora.',
  preparation: 'Reservar una posición cercana al entrenador.',
}

export const firstClassResults = [
  'Incorporación validada',
  'Necesita seguimiento',
  'Necesita Dirección',
]
