/** Clave localStorage donde el programador guarda el código (vista principal). */
export const COACH_CODE_KEY = 'programingevo_coach_code'

/** Sin configuración explícita, el acceso compartido falla de forma cerrada. */
export const DEFAULT_COACH_ACCESS_CODE = ''

export function isCoachIndividualAuthEnabled(
  value = import.meta.env.VITE_COACH_INDIVIDUAL_AUTH_ENABLED,
) {
  return String(value || '').trim().toLowerCase() === 'true'
}

/**
 * Rollback temporal del acceso compartido. Se mantiene activo por defecto para
 * no alterar Production hasta que el rollout individual haya pasado staging.
 */
export function isCoachSharedCodeFallbackEnabled(
  value = import.meta.env.VITE_COACH_SHARED_CODE_FALLBACK_ENABLED,
) {
  return String(value ?? 'true').trim().toLowerCase() !== 'false'
}

function coachCodeFromEnv() {
  const v = import.meta.env.VITE_COACH_ACCESS_CODE
  if (v == null || v === '') return ''
  return String(v).trim()
}

/**
 * Código que debe introducir el coach para entrar.
 * 1) `VITE_COACH_ACCESS_CODE` en build (Vercel) — prioridad durante la transición.
 * 2) Valor en localStorage `programingevo_coach_code` (configurado en la app principal).
 * 3) Sin código predeterminado: si falta configuración, se deniega el acceso.
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
