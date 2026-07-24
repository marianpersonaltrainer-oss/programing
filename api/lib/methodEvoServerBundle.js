import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const CONTRACT_CANDIDATES = [
  join(__dirname, '../../src/domain/method/methodEvoV1.json'),
  join(process.cwd(), 'src/domain/method/methodEvoV1.json'),
]

let contractCache = null
let methodPromptCache = null
let methodPromptLoadAttempted = false

function readable(value) {
  return String(value || '').replaceAll('_', ' ')
}

export function loadMethodEvoV1Contract() {
  if (contractCache) return contractCache
  let lastErr = null
  for (const path of CONTRACT_CANDIDATES) {
    try {
      contractCache = JSON.parse(readFileSync(path, 'utf8'))
      return contractCache
    } catch (err) {
      lastErr = err
    }
  }
  throw new Error(`No se pudo cargar methodEvoV1.json en el servidor: ${lastErr?.message || 'archivo no encontrado'}`)
}

function buildBriefingMethodContextFromJson(contract) {
  const rules = (contract.global_rules || [])
    .slice(0, 16)
    .map((rule) => `- [${rule.id}] ${rule.text}`)
    .join('\n')
  const profiles = Object.entries(contract.class_profiles || {})
    .map(([name, profile]) => `- ${name}: ${profile.identity || profile.summary || ''}`.trim())
    .join('\n')
  return `MÉTODO EVO ${contract.meta?.version || '1.2.0'} — contexto canónico para briefing
Reglas globales:
${rules}

Identidad de modalidades:
${profiles}`
}

export async function getBriefingMethodContext() {
  if (methodPromptCache) return methodPromptCache
  if (!methodPromptLoadAttempted) {
    methodPromptLoadAttempted = true
    try {
      const { buildMethodEvoV1Prompt } = await import('../../src/domain/method/methodEvoV1.js')
      methodPromptCache = buildMethodEvoV1Prompt({ includeValidators: false })
      return methodPromptCache
    } catch (err) {
      console.warn('[programming-week-briefing] import methodEvoV1.js falló; usando JSON embebido.', err?.message || err)
    }
  }
  methodPromptCache = buildBriefingMethodContextFromJson(loadMethodEvoV1Contract())
  return methodPromptCache
}

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

export function buildMesocycleProgrammingBlockFromContract(contract, { mesocycle, week, totalWeeks, phase }) {
  const key = normMeso(mesocycle)
  const definition = contract.mesocycles?.[key]
  if (!definition) return ''

  const weekNumber = Number(week) || 1
  const weekDefinition = definition.sequence?.find((item) => Number(item.week) === weekNumber)
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
  const forceStrategy =
    key === 'force'
      ? `
Estrategia específica del mesociclo de fuerza:
- Prioriza básicos en la mayoría de días viables de Funcional, distribuidos para no repetir fatiga.
- Incluye halterofilia en la semana con una progresión reconocible y cargas medias-altas, salvo incompatibilidad real.
- No alargues el descanso de un solo movimiento por inercia: desde 3 minutos combina un segundo movimiento o accesorio; la excepción son las últimas series de RM de S6.`
      : ''

  return `════════════════════════════════════════
MESOCICLO ACTIVO — ${names[key]} · MÉTODO EVO ${contract.meta?.version || '1.2.0'}
════════════════════════════════════════
Semana ${weekNumber}/${total}${phase ? ` · Fase informada por la app: ${phase}` : ''}
${details}
${forceStrategy}

Aplica esta intención a la semana completa. La técnica manda sobre el porcentaje, la fuerza trabaja sin fallo salvo test deliberado y las modalidades conservan su identidad. No añadas obligaciones heredadas de plantillas antiguas.`
}

export async function buildMesocycleProgrammingBlockServer(params) {
  try {
    const { buildMesocycleProgrammingBlock } = await import('../../src/constants/mesocycleGenerationBlocks.js')
    return buildMesocycleProgrammingBlock(params)
  } catch (err) {
    console.warn('[programming-week-briefing] import mesocycleGenerationBlocks falló; usando JSON.', err?.message || err)
    return buildMesocycleProgrammingBlockFromContract(loadMethodEvoV1Contract(), params)
  }
}
