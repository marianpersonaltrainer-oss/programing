/** Persistencia de «Reglas aprendidas»: manual (textarea) + entradas automáticas (desde ediciones). */

export const METHOD_LEARNED_KEY = 'programingevo_method_learned'

/**
 * @typedef {{ id: string, at: string, text: string }} MethodLearnedAutoEntry
 * @typedef {{ manual: string, auto: MethodLearnedAutoEntry[] }} MethodLearnedState
 */

function safeParse(raw) {
  try {
    const o = JSON.parse(raw)
    if (o && typeof o === 'object' && typeof o.manual === 'string' && Array.isArray(o.auto)) {
      return {
        manual: o.manual,
        auto: o.auto
          .filter((e) => e && typeof e.text === 'string')
          .map((e) => ({
            id: typeof e.id === 'string' && e.id ? e.id : `auto_${Math.random().toString(36).slice(2, 12)}`,
            at: typeof e.at === 'string' && e.at ? e.at : new Date().toISOString(),
            text: String(e.text || '').trim(),
          }))
          .filter((e) => e.text),
      }
    }
  } catch {
    /* legacy */
  }
  return null
}

/** @returns {MethodLearnedState} */
export function loadLearnedState() {
  try {
    const raw = localStorage.getItem(METHOD_LEARNED_KEY)
    if (raw == null) return { manual: '', auto: [] }
    const parsed = safeParse(raw)
    if (parsed) return parsed
    return { manual: String(raw), auto: [] }
  } catch {
    return { manual: '', auto: [] }
  }
}

/** @param {MethodLearnedState} state */
export function saveLearnedState(state) {
  try {
    localStorage.setItem(
      METHOD_LEARNED_KEY,
      JSON.stringify({
        manual: state.manual ?? '',
        auto: Array.isArray(state.auto) ? state.auto : [],
      }),
    )
  } catch {
    /* quota */
  }
}

function formatDayStamp(iso) {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10)
    return d.toISOString().slice(0, 10)
  } catch {
    return new Date().toISOString().slice(0, 10)
  }
}

/** Texto único para prompts (manual + bloque automático con fechas). */
export function getLearnedRulesConcatenated() {
  const { manual, auto } = loadLearnedState()
  const parts = []
  const m = String(manual || '').trim()
  if (m) parts.push(m)
  if (auto.length) {
    const block = auto
      .map((e) => {
        const day = formatDayStamp(e.at)
        return `[${day}] ${String(e.text || '').trim()}`
      })
      .filter(Boolean)
      .join('\n\n')
    if (block) parts.push(block)
  }
  return parts.join('\n\n')
}

/** Añade una o varias frases con la misma marca temporal (un guardado de edición). */
export function appendAutoLearnedLines(lines) {
  const list = (Array.isArray(lines) ? lines : []).map((s) => String(s || '').trim()).filter(Boolean)
  if (!list.length) return
  const state = loadLearnedState()
  const at = new Date().toISOString()
  const t0 = Date.now()
  list.forEach((text, i) => {
    state.auto.push({
      id: `auto_${t0}_${i}_${Math.random().toString(36).slice(2, 10)}`,
      at,
      text,
    })
  })
  saveLearnedState(state)
}

/** @param {string} id */
export function removeAutoLearnedEntry(id) {
  if (!id) return
  const state = loadLearnedState()
  state.auto = state.auto.filter((e) => e.id !== id)
  saveLearnedState(state)
}

export function clearAutoLearnedEntries() {
  const state = loadLearnedState()
  state.auto = []
  saveLearnedState(state)
}

export function clearAllLearned() {
  saveLearnedState({ manual: '', auto: [] })
}
