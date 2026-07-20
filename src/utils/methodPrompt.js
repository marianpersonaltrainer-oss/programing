/**
 * Constructor compartido del bloque «Tu método» para Chat V1, Excel y edición diaria.
 * Fuente de verdad temporal: localStorage (método base + reglas aprendidas manuales/automáticas).
 */
import { sanitizePromptTextForLLM } from './sanitizePromptTextForLLM.js'
import { loadLearnedState } from './methodLearnedStorage.js'

export const METHOD_STORAGE_KEY = 'programingevo_method'

export const DEFAULT_METHOD = `FILOSOFÍA EVO
EVO es un centro funcional con formato CrossFit pero con identidad propia. Adulto activo 28-55 años. Abierto a ejercicios nuevos, accesorios y creatividad.

CLASES ACTIVAS
EvoFuncional: fuerza + habilidad + WOD intenso
EvoBasics: técnica y progresión, juego siempre en calentamiento
EvoFit: fuerza moderada, sin técnica compleja, nadie sale destrozado
EvoHybrix: metabólica por bloques, equipos/parejas, máquinas + cardio
(EvoFuerza, EvoGimnástica y EvoTodos: solo cuando se especifique en instrucciones)

REGLAS FIJAS
- No muscle ups, no deficit HSPU, no rope climb, no pegboard
- No overhead squat como ejercicio principal
- Thruster máx 1 vez/semana total
- Mismo squat con barra: máx 1 vez/semana por clase
- Landmine obligatorio 1 vez/semana en cada clase
- No mismo ejercicio principal en Funcional y Basics el mismo día

ESTILO DE PROGRAMACIÓN
- Clases distintas, no versiones escaladas de la misma sesión
- Feedback al coach: briefing texto corrido (ver prompt Excel), sin apartados formales
- Timings: NOMBRE DEL BLOQUE (X' - Y') — ver SYSTEM_PROMPT_EXCEL
- EvoFit: nunca KB Clean, Power Clean, Snatch ni movimientos olímpicos`

/** Presupuesto común de caracteres para el cuerpo del método en prompts V1. */
export const METHOD_PROMPT_MAX_CHARS = 5000

export const METHOD_PROMPT_HEADER = `════════════════════════════════════════
MÉTODO Y REGLAS PERMANENTES DE EVO (Tu método)
════════════════════════════════════════`

const LEARNED_SECTION_HEADER = `════════════════════════════════════════
REGLAS APRENDIDAS
════════════════════════════════════════`

/**
 * @param {Storage|null|undefined} storage
 * @returns {string}
 */
export function loadBaseMethodFromStorage(storage) {
  const ls = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!ls) return DEFAULT_METHOD
  try {
    const saved = ls.getItem(METHOD_STORAGE_KEY)
    return saved || DEFAULT_METHOD
  } catch {
    return DEFAULT_METHOD
  }
}

/** @param {string} baseText @param {Storage|null|undefined} [storage] */
export function saveMethodText(baseText, storage) {
  const ls = storage ?? (typeof localStorage !== 'undefined' ? localStorage : null)
  if (!ls) return
  try {
    ls.setItem(METHOD_STORAGE_KEY, String(baseText ?? ''))
  } catch {
    /* quota */
  }
}

function formatAutoDayStamp(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** @param {{ id?: string, at?: string, text?: string }} entry */
function formatAutoLearnedLine(entry) {
  const text = String(entry?.text || '').trim()
  if (!text) return ''
  const day = formatAutoDayStamp(entry.at)
  return `[${day}] ${text}`
}

/**
 * Recorta texto al final con elipsis si hace falta.
 * @param {string} text
 * @param {number} maxLen
 */
function truncateTail(text, maxLen) {
  const t = String(text || '').trim()
  if (maxLen <= 0 || !t) return ''
  if (t.length <= maxLen) return t
  if (maxLen <= 1) return '…'
  return `${t.slice(0, maxLen - 1).trim()}…`
}

/**
 * Aplica presupuesto con prioridad:
 * 1. Método base (recortado solo si solo él supera el límite).
 * 2. Reglas manuales de Marian (nunca eliminadas para dar sitio a automáticas).
 * 3. Reglas automáticas más recientes primero.
 * @param {{ base: string, manual: string, auto: Array<{ at?: string, text?: string }>, maxChars: number }} params
 */
export function applyMethodPromptBudget({ base, manual, auto, maxChars }) {
  const baseClean = sanitizePromptTextForLLM(base).trim()
  if (!baseClean) return ''

  if (baseClean.length >= maxChars) {
    return truncateTail(baseClean, maxChars)
  }

  const autoSorted = [...(auto || [])]
    .filter((e) => String(e?.text || '').trim())
    .sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime())

  let manualPart = sanitizePromptTextForLLM(manual).trim()
  const hasLearned = Boolean(manualPart) || autoSorted.length > 0
  if (!hasLearned) {
    return baseClean
  }

  const learnedPrefix = `\n\n${LEARNED_SECTION_HEADER}\n\n`
  let contentBudget = maxChars - baseClean.length - learnedPrefix.length
  if (contentBudget <= 0) {
    return baseClean
  }

  let manualIncluded = ''
  if (manualPart) {
    if (manualPart.length <= contentBudget) {
      manualIncluded = manualPart
      contentBudget -= manualPart.length
    } else {
      manualIncluded = truncateTail(manualPart, contentBudget)
      contentBudget = 0
    }
  }

  const autoLines = []
  if (contentBudget > 0) {
    for (const entry of autoSorted) {
      const line = formatAutoLearnedLine(entry)
      if (!line) continue
      const sep = autoLines.length ? 2 : manualIncluded ? 2 : 0
      if (line.length + sep > contentBudget) break
      autoLines.push(line)
      contentBudget -= line.length + sep
    }
  }

  const learnedParts = []
  if (manualIncluded) learnedParts.push(manualIncluded)
  if (autoLines.length) learnedParts.push(autoLines.join('\n\n'))

  if (!learnedParts.length) {
    return baseClean
  }

  return `${baseClean}${learnedPrefix}${learnedParts.join('\n\n')}`
}

/**
 * Cuerpo del método (base + reglas aprendidas) sin encabezado externo.
 * @param {{ baseMethod?: string, learnedState?: { manual?: string, auto?: Array<{ at?: string, text?: string, id?: string }> }, maxChars?: number, storage?: Storage }} [options]
 * @returns {string}
 */
export function buildMethodBody(options = {}) {
  const base = options.baseMethod ?? loadBaseMethodFromStorage(options.storage)
  const learnedState = options.learnedState ?? loadLearnedState()
  const maxChars = options.maxChars ?? METHOD_PROMPT_MAX_CHARS

  return applyMethodPromptBudget({
    base,
    manual: learnedState.manual ?? '',
    auto: learnedState.auto ?? [],
    maxChars,
  })
}

/**
 * Bloque completo listo para anexar al system prompt de la IA.
 * @param {Parameters<typeof buildMethodBody>[0]} [options]
 * @returns {string}
 */
export function buildMethodPromptAppendix(options = {}) {
  const body = buildMethodBody(options)
  if (!body || !body.trim()) return ''
  return `${METHOD_PROMPT_HEADER}\n\n${body}`.trim()
}

/** @deprecated Preferir buildMethodPromptAppendix en flujos IA; conservado para compatibilidad UI. */
export function getMethodText(options = {}) {
  return buildMethodBody(options)
}
