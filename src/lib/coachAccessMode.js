/**
 * Decide the authentication path for EVO Coach without inspecting or storing
 * credentials. Keeping this pure makes the staged transition auditable.
 */
export function resolveCoachAccessMode({
  individualAuthEnabled = false,
  sharedCodeFallbackEnabled = true,
  hasIndividualAccess = false,
} = {}) {
  if (individualAuthEnabled && hasIndividualAccess) return 'individual'
  if (individualAuthEnabled && !sharedCodeFallbackEnabled) return 'denied'
  return 'shared_code'
}
