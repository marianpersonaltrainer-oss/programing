/** Frases automáticas al guardar una edición de sesión (EditModal). */

import { extractMainExerciseFromBlockB } from './sessionBlockB.js'

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

function cleanReasonLabel(label) {
  return String(label || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .trim()
}

/**
 * Líneas concretas para aprendizaje: día + clase + motivo + ejercicio principal detectado.
 * Ejemplo: "Lunes EvoFuncional — WOD demasiado largo después de Back Squat"
 */
export function buildContextualLearnedLinesFromEditReasons({
  dayLabel,
  classLabels,
  selectedPresetIds,
  otherText,
  sessionContent,
}) {
  const labels = (classLabels || []).filter(Boolean)
  const classes = labels.length ? labels : ['Sesión']
  const ids = new Set(selectedPresetIds || [])
  const reasons = []
  for (const p of EDIT_REASON_PRESETS) {
    if (ids.has(p.id)) reasons.push(cleanReasonLabel(p.label))
  }
  if (ids.has(EDIT_REASON_OTHER_ID)) {
    const note = String(otherText || '').trim().slice(0, EDIT_REASON_OTHER_MAX)
    if (note) reasons.push(note)
  }
  if (!reasons.length) return []
  const main = extractMainExerciseFromBlockB(sessionContent)
  const suffix = main ? ` después de ${main}` : ''
  const day = String(dayLabel || '').trim() || 'Día'
  const out = []
  for (const cls of classes) {
    for (const reason of reasons) {
      out.push(`${day} ${cls} — ${reason}${suffix}`)
    }
  }
  return out
}

function parseMinutes(raw) {
  const n = Number(String(raw || '').replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n)
}

function extractWodDuration(sessionText) {
  const src = String(sessionText || '')
  if (!src.trim()) return null

  const lineMatch = src.match(/(?:^|\n)\s*WOD\b[^\n]*/i)
  if (!lineMatch) return null
  const line = lineMatch[0]

  const minMatch = line.match(/\b(\d+(?:[.,]\d+)?)\s*(?:min|mins|')\b/i)
  if (minMatch) return parseMinutes(minMatch[1])

  const rangeMatch = line.match(/\((\d+(?:[.,]\d+)?)\s*'\s*-\s*(\d+(?:[.,]\d+)?)\s*'\)/i)
  if (rangeMatch) {
    const start = parseMinutes(rangeMatch[1])
    const end = parseMinutes(rangeMatch[2])
    if (start != null && end != null && end > start) return end - start
  }

  return null
}

function summarizeEditChange({ beforeContent, afterContent, dayBefore, dayAfter, classLabelsBefore, classLabelsAfter }) {
  const out = []
  const beforeWod = extractWodDuration(beforeContent)
  const afterWod = extractWodDuration(afterContent)
  if (beforeWod != null && afterWod != null && beforeWod !== afterWod) {
    const action = afterWod < beforeWod ? 'acortado' : 'ampliado'
    out.push(`WOD ${action} de ${beforeWod}' a ${afterWod}'`)
  }

  const bDay = String(dayBefore || '').trim()
  const aDay = String(dayAfter || '').trim()
  if (bDay && aDay && bDay !== aDay) out.push(`día cambiado de ${bDay} a ${aDay}`)

  const bClasses = (classLabelsBefore || []).filter(Boolean).sort().join(', ')
  const aClasses = (classLabelsAfter || []).filter(Boolean).sort().join(', ')
  if (bClasses && aClasses && bClasses !== aClasses) out.push(`clases ajustadas (${bClasses} → ${aClasses})`)

  if (!out.length) {
    const beforeText = String(beforeContent || '').trim().replace(/\s+/g, ' ')
    const afterText = String(afterContent || '').trim().replace(/\s+/g, ' ')
    if (beforeText && afterText && beforeText !== afterText) out.push('contenido ajustado')
  }

  return out.length ? out.join('; ') : 'cambios menores de formato'
}

export function buildLearnedLinesWithDetectedChange({
  dayLabel,
  classLabels,
  selectedPresetIds,
  otherText,
  beforeContent,
  afterContent,
  dayBefore,
  dayAfter,
  classLabelsBefore,
  classLabelsAfter,
}) {
  const baseLines = buildContextualLearnedLinesFromEditReasons({
    dayLabel,
    classLabels,
    selectedPresetIds,
    otherText,
    sessionContent: afterContent,
  })
  if (!baseLines.length) return []
  const summary = summarizeEditChange({
    beforeContent,
    afterContent,
    dayBefore,
    dayAfter,
    classLabelsBefore,
    classLabelsAfter,
  })
  return baseLines.map((line) => `${line} · cambio detectado: ${summary}`)
}
