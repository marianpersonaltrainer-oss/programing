import { METHOD_EVO_V1, METHOD_EVO_V1_VERSION } from '../domain/method/methodEvoV1.js'

function normMeso(raw) {
  const value = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (['fuerza', 'force'].includes(value)) return 'force'
  if (['autocarga', 'gimnasticos', 'gimnastica', 'gimnasico', 'bodyweight'].includes(value)) return 'bodyweight'
  if (['mixto', 'mixed'].includes(value)) return 'mixed'
  return ''
}

function readable(value) {
  return String(value || '').replaceAll('_', ' ')
}

/**
 * Proyección de la semana activa desde la misma fuente estructurada del Método EVO.
 * No redefine cuotas, ejercicios ni estructuras fuera del contrato canónico.
 */
export function buildMesocycleProgrammingBlock({ mesocycle, week, totalWeeks, phase }) {
  const key = normMeso(mesocycle)
  const definition = METHOD_EVO_V1.mesocycles[key]
  if (!definition) return ''

  const weekNumber = Number(week) || 1
  const weekDefinition = definition.sequence.find((item) => Number(item.week) === weekNumber)
  const names = { force: 'FUERZA', bodyweight: 'AUTOCARGA', mixed: 'MIXTO' }
  const total = Number(totalWeeks) || definition.weeks
  const details = weekDefinition
    ? [
        `Intención canónica: ${readable(weekDefinition.intent)}.`,
        weekDefinition.load ? `Referencia de carga: ${readable(weekDefinition.load)}.` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : 'La semana indicada no existe en la secuencia canónica: no inventes una fase; señálalo en el resumen.'
  const forceStrategy = key === 'force'
    ? `
Estrategia específica del mesociclo de fuerza:
- Prioriza básicos en la mayoría de días viables de Funcional, distribuidos para no repetir fatiga.
- Incluye halterofilia en la semana con una progresión reconocible y cargas medias-altas, salvo incompatibilidad real.
- No alargues el descanso de un solo movimiento por inercia: desde 3 minutos combina un segundo movimiento o accesorio; la excepción son las últimas series de RM de S6.`
    : ''

  return `════════════════════════════════════════
MESOCICLO ACTIVO — ${names[key]} · MÉTODO EVO ${METHOD_EVO_V1_VERSION}
════════════════════════════════════════
Semana ${weekNumber}/${total}${phase ? ` · Fase informada por la app: ${phase}` : ''}
${details}
${forceStrategy}

Aplica esta intención a la semana completa. La técnica manda sobre el porcentaje, la fuerza trabaja sin fallo salvo test deliberado y las modalidades conservan su identidad. No añadas obligaciones heredadas de plantillas antiguas.`
}
