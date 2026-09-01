export const TRIAL_ENTRY_OPTIONS = [
  'EVO Basics',
  'EVO Fit',
  'EVO Funcional',
]

export const TRIAL_FREQUENCY_OPTIONS = ['2 días', '3 días', '4 días', 'A concretar']

export const TRIAL_PRIORITY_OPTIONS = [
  'Retomar y crear constancia',
  'Moverse con seguridad y confianza',
  'Mejorar técnica y fuerza',
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
  const entryPoint = clean(values.entryPoint)
  const frequency = clean(values.frequency)
  const priority = clean(values.priority)
  const adaptations = clean(values.adaptations)
  const reason = clean(values.reason)

  const missing = []
  if (!personReference) missing.push('persona')
  if (!entryPoint) missing.push('punto de entrada')
  if (!frequency) missing.push('frecuencia')
  if (!priority) missing.push('prioridad')
  if (!reason) missing.push('motivo')

  if (missing.length) {
    return { ok: false, missing, summary: null }
  }

  const lines = [
    `Persona: ${personReference}`,
    `Punto de entrada recomendado: ${entryPoint}`,
    `Frecuencia sugerida: ${frequency}`,
    `Prioridad inicial: ${priority}`,
  ]
  if (adaptations) lines.push(`Adaptaciones relevantes: ${adaptations}`)
  lines.push(`Motivo de la recomendación: ${reason}`)

  return {
    ok: true,
    missing: [],
    summary: lines.join('\n'),
    nextStage: '📄 Propuesta preparada',
  }
}
