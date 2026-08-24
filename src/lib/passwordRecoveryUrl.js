export function isPasswordRecoveryLocation(locationLike = globalThis.location) {
  const search = new URLSearchParams(String(locationLike?.search || ''))
  if (search.has('reset-password')) return true

  const hash = String(locationLike?.hash || '').replace(/^#/, '')
  if (!hash) return false

  const hashParams = new URLSearchParams(hash)
  return hashParams.get('type') === 'recovery'
}
