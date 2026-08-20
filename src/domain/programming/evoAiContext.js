export const EVO_AI_CONTEXT_FIELDS = [
  {
    key: 'objective',
    label: 'Objetivo y foco de esta semana',
    placeholder: 'Qué debe desarrollar la semana, cómo enlaza con el mesociclo y qué no debe perderse.',
  },
  {
    key: 'approvedRules',
    label: 'Normas EVO aprobadas para esta programación',
    placeholder: 'Reglas operativas que deben respetarse. Solo decisiones ya aprobadas por Dirección.',
  },
  {
    key: 'constraints',
    label: 'Material, calendario o restricciones reales',
    placeholder: 'Material disponible, clases especiales, aforo, eventos o límites de esta semana.',
  },
  {
    key: 'language',
    label: 'Lenguaje y notas para entrenadores',
    placeholder: 'Terminología EVO, tono de los briefings y qué debe quedar claro para el equipo.',
  },
  {
    key: 'references',
    label: 'Referencias que la IA puede seguir',
    placeholder: 'Pega ejemplos o indicaciones concretas de tu método. No incluyas datos de clientes.',
  },
]

const MAX_FIELD_LENGTH = 5000

function clean(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_FIELD_LENGTH) : ''
}

export function normalizeEvoAiContext(raw, fallbackObjective = '') {
  return Object.fromEntries(EVO_AI_CONTEXT_FIELDS.map(({ key }) => [
    key,
    clean(raw?.[key] || (key === 'objective' ? fallbackObjective : '')),
  ]))
}

export function getWeekEvoAiContext(week) {
  return normalizeEvoAiContext(week?.data?.ai_context, week?.proposal)
}

export function mergeWeekEvoAiContext(week, context) {
  return {
    ...(week?.data || {}),
    ai_context: normalizeEvoAiContext(context, week?.proposal),
  }
}

export function buildEvoAiContextPrompt(context) {
  const normalized = normalizeEvoAiContext(context)
  const sections = EVO_AI_CONTEXT_FIELDS
    .map(({ key, label }) => (normalized[key] ? `## ${label}\n${normalized[key]}` : ''))
    .filter(Boolean)

  return [
    '# Contexto operativo de esta semana',
    'Este bloque complementa el Método EVO y el catálogo de ejercicios; no los sustituye.',
    'No inventes movimientos, vídeos, reglas ni datos. Si falta una decisión, señálala para revisión.',
    ...sections,
  ].join('\n\n')
}
