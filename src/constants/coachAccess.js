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

/**
 * Valor inicial de la caja local de transición. El código real nunca se
 * publica dentro del build: su comprobación se hace sólo en el servidor.
 */
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
  return DEFAULT_COACH_ACCESS_CODE
}
