export const TRIAL_ENTRY_OPTIONS = [
  'EVO Basics',
  'EVO Fit',
  'EVO Funcional',
  'Revisar con Marian',
]

export const TRIAL_PRIORITY_OPTIONS = [
  'Retomar y crear constancia',
  'Moverse con seguridad y confianza',
  'Mejorar técnica y fuerza',
  'Coordinación y aprendizaje de movimientos',
  'Otro objetivo inicial',
]

function clean(value) {
  return String(value || '').trim()
}

/**
 * Prepara el resumen que necesita la propuesta posterior a una prueba.
 * No guarda ni transmite información: el formulario se mantiene en modo local
 * hasta que exista una política de datos y un destino operativo aprobado.
 */
export function buildTrialCloseSummary(values = {}) {
  const personReference = clean(values.personReference)
  const attendance = clean(values.attendance)
  const entryPoint = clean(values.entryPoint)
  const priority = clean(values.priority)
  const adaptations = clean(values.adaptations)
  const reason = clean(values.reason)

  const missing = []
  if (!personReference) missing.push('persona')
  if (!attendance) missing.push('asistencia')
  if (!entryPoint) missing.push('punto de entrada')
  if (!priority) missing.push('prioridad')
  if (!reason) missing.push('motivo')

  if (missing.length) {
    return { ok: false, missing, summary: null }
  }

  const lines = [
    `CIERRE DE PRUEBA · ${personReference}`,
    '',
    `1. Asistencia: ${attendance}`,
    `2. Punto de entrada recomendado: ${entryPoint}`,
    `3. Prioridad inicial: ${priority}`,
    `4. Adaptaciones relevantes: ${adaptations || 'ninguna'}`,
    `5. Motivo breve: ${reason}`,
  ]

  return {
    ok: true,
    missing: [],
    summary: lines.join('\n'),
    nextStage: '📄 Propuesta preparada',
  }
}
