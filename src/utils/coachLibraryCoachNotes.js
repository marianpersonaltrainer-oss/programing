/** Notas personales del coach por ejercicio (biblioteca) — localStorage. */

const KEY = 'programingevo_coach_exercise_notes_v1'

function readRaw() {
  try {
    const r = localStorage.getItem(KEY)
    const o = r ? JSON.parse(r) : {}
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {}
  } catch {
    return {}
  }
}

function writeRaw(obj) {
  try {
    localStorage.setItem(KEY, JSON.stringify(obj))
  } catch {
    /* quota */
  }
}

export function getAllCoachExerciseNotes() {
  return readRaw()
}

export function getCoachExerciseNote(exerciseId) {
  if (exerciseId == null) return ''
  const k = String(exerciseId)
  const v = readRaw()[k]
  return typeof v === 'string' ? v : ''
}

export function setCoachExerciseNote(exerciseId, text) {
  if (exerciseId == null) return
  const k = String(exerciseId)
  const raw = readRaw()
  const t = String(text ?? '').trim()
  if (t) raw[k] = t
  else delete raw[k]
  writeRaw(raw)
}
