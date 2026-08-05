export const todayClasses = [
  { id: 'class-0700', time: '07:00', type: 'EVO Funcional', room: 'Sala A', trainer: 'Lara Demo', objective: 'Moverse con ritmo estable y técnica consistente.', blocks: ['Activación', 'Fuerza técnica', 'Condicionamiento'], material: 'Kettlebells, cajones y esterillas.', adaptations: 'Alternativa sin impacto disponible.', alerts: 'Sin avisos adicionales.' },
  { id: 'class-1030', time: '10:30', type: 'EVO Fuerza', room: 'Sala A', trainer: 'Lara Demo', objective: 'Construir fuerza de pierna con control del tempo.', blocks: ['Movilidad', 'Sentadilla', 'Accesorios'], material: 'Barras, discos y bancos.', adaptations: 'Nora Sol: variante sin impacto y rango cómodo.', alerts: 'Remo 04 fuera de uso.' },
  { id: 'class-1330', time: '13:30', type: 'EVO Basics', room: 'Sala B', trainer: 'Lara Demo', objective: 'Aprender patrones básicos con carga conservadora.', blocks: ['Bienvenida', 'Técnica guiada', 'Trabajo simple'], material: 'Mancuernas ligeras, picas y esterillas.', adaptations: 'Alex Vega: posición próxima al entrenador.', alerts: 'Cambio de sala confirmado: Sala B.' },
]

export const previousShiftHandover = {
  noteId: 'handover-note-demo',
  note: 'La Sala B queda preparada para Basics. Revisar el audio antes de la primera clase.',
  incidents: [
    {
      id: 'previous-incident-audio',
      element: 'Altavoz principal',
      status: 'En seguimiento',
      owner: 'Dirección Demo',
      dueAt: 'Hoy · 08:30',
      nextAction: 'Probar conexión auxiliar y confirmar si el altavoz vuelve a servicio.',
    },
  ],
}

export const firstClassPreparation = {
  time: '13:30',
  type: 'EVO Basics',
  room: 'Sala B',
  objective: 'Aprender patrones básicos con carga conservadora.',
  structure: ['Bienvenida y referencia de movimientos', 'Técnica guiada', 'Trabajo simple y cierre'],
  material: 'Mancuernas ligeras, picas y esterillas.',
  people: 'Alex Vega · primera clase · posición próxima al entrenador.',
  steps: ['Montar una estación visible cerca del entrenador.', 'Preparar cargas ligeras y una pica.', 'Dejar libre una zona para demostraciones.'],
  alternative: 'Si la coordinación limita el trabajo, reducir la carga y practicar un patrón cada vez.',
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
