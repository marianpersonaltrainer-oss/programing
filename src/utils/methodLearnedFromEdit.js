/** Frases automáticas al guardar una edición de sesión (EditModal). */

export const EDIT_REASON_OTHER_MAX = 200
export const EDIT_REASON_MAX_CHIPS = 3

/** @type {{ id: string, label: string, build: (ctx: { dayLabel: string, classPhrase: string }) => string }[]} */
export const EDIT_REASON_PRESETS = [
  {
    id: 'timing_tight',
    label: '⏱ Timing demasiado ajustado',
    build: ({ dayLabel, classPhrase }) =>
      `Revisar timing: en ${classPhrase} el ${dayLabel} el tiempo estaba ajustado`,
  },
  {
    id: 'wod_long',
    label: '📏 WOD demasiado largo',
    build: ({ dayLabel, classPhrase }) =>
      `WOD demasiado largo en ${classPhrase} (${dayLabel}) — reducir duración o número de ejercicios`,
  },
  {
    id: 'wod_short',
    label: '📏 WOD demasiado corto',
    build: ({ dayLabel, classPhrase }) =>
      `WOD demasiado corto en ${classPhrase} (${dayLabel}) — ampliar duración o número de ejercicios`,
  },
  {
    id: 'rests_inflated',
    label: '⚖️ Descansos inflados',
    build: ({ dayLabel, classPhrase }) =>
      `Descansos inflados en ${classPhrase} (${dayLabel}) — revisar tiempos entre bloques`,
  },
  {
    id: 'exercise_misfit',
    label: '🔄 Ejercicio no encaja en esta clase',
    build: ({ dayLabel, classPhrase }) =>
      `En ${classPhrase} el ${dayLabel}: ejercicio que no encajaba en el perfil de la clase — sustituir o reubicar`,
  },
  {
    id: 'load_high',
    label: '💪 Carga demasiado alta',
    build: ({ dayLabel, classPhrase }) =>
      `Carga demasiado alta en ${classPhrase} (${dayLabel}) — bajar pesos, volumen o simplificar`,
  },
  {
    id: 'load_low',
    label: '💪 Carga demasiado baja',
    build: ({ dayLabel, classPhrase }) =>
      `Carga demasiado baja en ${classPhrase} (${dayLabel}) — subir estímulo o progresión`,
  },
]

export const EDIT_REASON_OTHER_ID = 'other'

/** @param {string[]} classLabels */
export function buildClassPhrase(classLabels) {
  const list = (classLabels || []).filter(Boolean)
  if (!list.length) return 'la sesión'
  if (list.length === 1) return list[0]
  if (list.length === 2) return `${list[0]} y ${list[1]}`
  return `${list.slice(0, -1).join(', ')} y ${list.at(-1)}`
}

/**
 * @param {{ dayLabel: string, classLabels: string[], selectedPresetIds: string[], otherText: string }} p
 * @returns {string[]}
 */
export function buildLearnedLinesFromEditReasons({ dayLabel, classLabels, selectedPresetIds, otherText }) {
  const classPhrase = buildClassPhrase(classLabels)
  const ctx = { dayLabel, classPhrase }
  const lines = []
  const ids = new Set(selectedPresetIds || [])
  for (const p of EDIT_REASON_PRESETS) {
    if (ids.has(p.id)) lines.push(p.build(ctx))
  }
  if (ids.has(EDIT_REASON_OTHER_ID)) {
    const note = String(otherText || '')
      .trim()
      .slice(0, EDIT_REASON_OTHER_MAX)
    if (note) lines.push(`Nota: ${note}`)
  }
  return lines
}
