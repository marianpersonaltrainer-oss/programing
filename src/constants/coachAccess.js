/** Clave localStorage donde el programador guarda el código (vista principal). */
export const COACH_CODE_KEY = 'programingevo_coach_code'

/** Si no hay env ni valor guardado, se usa este código. */
export const DEFAULT_COACH_ACCESS_CODE = 'EVO19'

function coachCodeFromEnv() {
  const v = import.meta.env.VITE_COACH_ACCESS_CODE
  if (v == null || v === '') return ''
  return String(v).trim()
}

/**
 * Código que debe introducir el coach para entrar.
 * 1) `VITE_COACH_ACCESS_CODE` en build (Vercel) — prioridad en producción.
 * 2) Valor en localStorage `programingevo_coach_code` (configurado en la app principal).
 * 3) `EVO19`
 */
export function getExpectedCoachCode() {
  const fromEnv = coachCodeFromEnv()
  if (fromEnv) return fromEnv
  try {
    const raw = localStorage.getItem(COACH_CODE_KEY)
    if (raw != null) {
      const t = String(raw).trim()
      if (t !== '') return t
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_COACH_ACCESS_CODE
}

export function coachCodesMatch(input) {
  const a = String(input ?? '').trim().toUpperCase()
  const b = getExpectedCoachCode().trim().toUpperCase()
  return a.length > 0 && a === b
}

/** Valor inicial del campo “código coach” en la app principal (sin pisar un valor ya guardado). */
export function getCoachCodeFieldInitialValue() {
  try {
    const raw = localStorage.getItem(COACH_CODE_KEY)
    if (raw != null) {
      const t = String(raw).trim()
      if (t !== '') return t
    }
  } catch {
    /* ignore */
  }
  return getExpectedCoachCode()
}
