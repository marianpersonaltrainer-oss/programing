export const COACH_ADMIN_SECRET_SESSION_KEY = 'evo_coach_guide_admin_secret'

export function readCoachAdminSecret() {
  try {
    return String(sessionStorage.getItem(COACH_ADMIN_SECRET_SESSION_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function persistCoachAdminSecret(value) {
  const trimmed = String(value || '').trim()
  try {
    if (trimmed) {
      sessionStorage.setItem(COACH_ADMIN_SECRET_SESSION_KEY, trimmed)
    } else {
      sessionStorage.removeItem(COACH_ADMIN_SECRET_SESSION_KEY)
    }
  } catch {
    /* ignore quota / private mode */
  }
  return trimmed
}
