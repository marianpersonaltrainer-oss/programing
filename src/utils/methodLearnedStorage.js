/** Persistencia local: decisiones manuales confirmadas + observaciones pendientes de revisión. */
import { filterHighImpactLearnedLines } from './highImpactLearnedRules.js'
import { METHOD_EVO_V1_VERSION } from '../domain/method/methodEvoV1.js'

export const METHOD_LEARNED_KEY = `programingevo_method_learned_v${METHOD_EVO_V1_VERSION.replaceAll('.', '_')}`
export const LEGACY_METHOD_LEARNED_KEYS = [
  'programingevo_method_learned_v1_2_0',
  'programingevo_method_learned_v1_1_0',
  'programingevo_method_learned_v1_0_0',
  'programingevo_method_learned',
]

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

function migrateLegacyStateToPending(raw, sourceKey) {
  const parsed = safeParse(raw) || { manual: String(raw || '').trim(), auto: [] }
  const at = new Date().toISOString()
  const migrated = Array.isArray(parsed.auto) ? [...parsed.auto] : []
  const manual = String(parsed.manual || '').trim()
  if (manual) {
    migrated.unshift({
      id: `legacy_reconfirm_${sourceKey}`,
      at,
      text: `Pendiente de reconfirmar tras actualizar el Método EVO: ${manual}`,
    })
  }
  return { manual: '', auto: migrated }
}

/** @returns {MethodLearnedState} */
export function loadLearnedState() {
  try {
    const currentRaw = localStorage.getItem(METHOD_LEARNED_KEY)
    if (currentRaw != null) {
      const parsed = safeParse(currentRaw)
      if (parsed) return parsed
      return { manual: String(currentRaw), auto: [] }
    }

    for (const key of LEGACY_METHOD_LEARNED_KEYS) {
      const legacyRaw = localStorage.getItem(key)
      if (legacyRaw == null) continue
      const migrated = migrateLegacyStateToPending(legacyRaw, key)
      saveLearnedState(migrated)
      return migrated
    }

    return { manual: '', auto: [] }
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

/** Añade una o varias frases con la misma marca temporal (un guardado de edición). */
export function appendAutoLearnedLines(lines, options = {}) {
  const { highImpactOnly = false } = options || {}
  let list = (Array.isArray(lines) ? lines : []).map((s) => String(s || '').trim()).filter(Boolean)
  if (highImpactOnly) {
    list = filterHighImpactLearnedLines(list)
  }
  if (!list.length) return
  const state = loadLearnedState()
  const existingNorm = new Set(
    (Array.isArray(state.auto) ? state.auto : []).map((e) =>
      String(e?.text || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  )
  const at = new Date().toISOString()
  const t0 = Date.now()
  list.forEach((text, i) => {
    const norm = text.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!norm || existingNorm.has(norm)) return
    existingNorm.add(norm)
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
