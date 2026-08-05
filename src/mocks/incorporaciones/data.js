export const todayClasses = [
  { time: '07:00', type: 'EVO Funcional', room: 'Sala A', trainer: 'Lara Demo', objective: 'Fuerza de tren inferior y capacidad sostenida.', blocks: ['A · Fuerza técnica', 'B · Metcon por intervalos'], material: 'Racks, barras, discos y mancuernas.', coachNote: 'Preparar dos opciones de carga antes de abrir la sala.' },
  { time: '10:30', type: 'EVO Fuerza', room: 'Sala A', trainer: 'Lara Demo', objective: 'Control unilateral y trabajo de empuje.', blocks: ['A · Técnica y fuerza', 'B · For Quality'], material: 'Bancos, mancuernas y bandas.', coachNote: 'Nora Sol necesita una alternativa sin impacto.' },
  { time: '13:30', type: 'EVO Basics', room: 'Sala B', trainer: 'Lara Demo', objective: 'Aprender patrones básicos con una carga conservadora.', blocks: ['A · Aprendizaje', 'B · Circuito guiado'], material: 'Kettlebells ligeras, bandas y esterillas.', coachNote: 'Primera clase de Alex Vega; mantenerlo cerca del entrenador.' },
]

export const previousShiftReview = {
  handedOverBy: 'Dani Demo',
  handedOverAt: 'Ayer · 22:18',
  note: 'La sala quedó preparada. Mantener el remo 04 fuera de uso hasta que Dirección confirme la revisión.',
  incidents: [
    { title: 'Remo 04 fuera de uso', status: 'Asignada a Dirección', nextAction: 'No utilizar y mantener señalizado.' },
  ],
}

export const firstClassPreparation = {
  person: 'Alex Vega',
  time: '13:30',
  className: 'EVO Basics',
  room: 'Sala B',
  goal: 'Empezar con seguridad y entender los patrones básicos.',
  context: 'Experiencia inicial. Carga conservadora y posición próxima al entrenador.',
  preparation: [
    'Reservar una posición próxima al entrenador.',
    'Dejar kettlebells ligeras y bandas accesibles.',
    'Preparar una variante sencilla para cada bloque.',
  ],
}

export const peopleToConsider = [
  { type: 'Primera clase', person: 'Alex Vega · 13:30', detail: 'Carga inicial conservadora y posición próxima al entrenador.' },
  { type: 'Adaptación relevante', person: 'Nora Sol · 10:30', detail: 'Preparar una alternativa sin impacto.' },
]

export const centerNotices = [
  { type: 'Material fuera de uso', title: 'Remo 04', detail: 'No utilizar hasta la revisión de Dirección.' },
  { type: 'Cambio de sala', title: 'EVO Basics · Sala B', detail: 'La última clase del turno cambia de espacio.' },
]

export const programmingFeedbackTarget = {
  mode: 'feedback',
  dateLabel: 'Hoy',
  time: '13:30',
  className: 'EVO Basics',
}

export const protocols = [
  { id: 'opening', title: 'Apertura', summary: 'Dejar sala, sistemas y primera clase preparados antes de trabajar.', steps: ['Lee las notas del turno anterior y localiza cualquier incidencia que siga activa.', 'Enciende ordenador, música, luces, aire y dispositivos; comprueba que responden.', 'Recorre sala y baños; revisa limpieza, orden y material imprescindible.', 'Contrasta la programación del día, los horarios y únicamente las personas que requieren atención.', 'Monta el material de la primera clase y deja preparada una alternativa si existe una adaptación.'] },
  { id: 'closing', title: 'Cierre', summary: 'Cerrar el turno sin pendientes invisibles.', steps: ['Revisar incidencias', 'Confirmar sala y material', 'Cerrar o dejar relevo'] },
  { id: 'cash', title: 'Caja', summary: 'Registrar únicamente diferencias o acciones necesarias.', steps: ['Comprobar cierre', 'Anotar diferencia', 'Escalar si corresponde'] },
  { id: 'first-class', title: 'Primera clase', summary: 'Preparar y registrar un caso nuevo con el mínimo contexto.', steps: ['Revisar la información mínima necesaria', 'Acompañar la primera sesión', 'Guardar el registro estructurado'] },
  { id: 'incidents', title: 'Incidencias', summary: 'Hacer visible una situación que necesita respuesta.', steps: ['Describir el hecho', 'Indicar urgencia', 'Dejar responsable o relevo'] },
  { id: 'feedback', title: 'Feedback de entrenamiento', summary: 'Registrar la lectura de la sesión dentro de Programación.', steps: ['Abrir el día correcto', 'Seleccionar la clase', 'Guardar el feedback en Programación'] },
  { id: 'handover', title: 'Relevo', summary: 'Transferir solo lo que requiere atención del siguiente turno.', steps: ['Pendientes críticos', 'Incidencias abiertas', 'Responsable siguiente'] },
  { id: 'followup', title: 'Seguimiento', summary: 'Mantener un caso especial con responsable y fecha.', steps: ['Motivo concreto', 'Acción acordada', 'Próxima fecha'] },
  { id: 'handbook', title: 'Handbook de clases', summary: 'Referencia de calidad para formación y evaluación, no checklist diaria.', steps: ['Consultar criterio', 'Aplicar con contexto', 'Usar en observación de calidad'] },
]

export const evolutionSummary = [
  { label: 'Tareas críticas en plazo', value: '92%', detail: 'Últimos 7 días', status: 'completed' },
  { label: 'Pendientes actuales', value: '2', detail: 'Una primera clase y una entrega', status: 'pending' },
  { label: 'Último resultado operativo', value: 'Turno cerrado', detail: 'Ayer · sin incidencias críticas', status: 'completed' },
  { label: 'Última evaluación de calidad', value: 'Consistente', detail: 'Observación mensual ficticia', status: 'completed' },
  { label: 'Foco de mejora', value: 'Preparar el relevo', detail: 'Prioridad formativa actual', status: 'exception' },
]

export const operationalExceptions = [
  { label: 'Retraso', detail: 'Entrada registrada 8 minutos tarde', owner: 'Sam · turno mañana', status: 'overdue' },
  { label: 'Turno sin cerrar', detail: 'Ayer · relevo no confirmado', owner: 'Dani · turno tarde', status: 'exception' },
  { label: 'Caja pendiente', detail: 'Falta confirmar una diferencia ficticia', owner: 'Lara · hoy', status: 'pending' },
  { label: 'Primera clase pendiente', detail: 'Falta el registro obligatorio', owner: 'Sam · hoy', status: 'overdue' },
  { label: 'Incidencia abierta', detail: 'Material de zona B', owner: 'Dani · responsable', status: 'exception' },
  { label: 'Relevo incompleto', detail: 'Una tarea sin siguiente responsable', owner: 'Lara · ayer', status: 'pending' },
  { label: 'Tarea vencida', detail: 'Seguimiento especial fuera de plazo', owner: 'Sam · venció ayer', status: 'overdue' },
]

export const evaluations = {
  operations: [
    { label: 'Apertura y cierre', value: '94%', detail: 'Cumplimiento ficticio del último mes' },
    { label: 'Registros de primera clase', value: '88%', detail: 'Dos cierres fuera de plazo' },
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
