import { useCallback, useEffect, useState } from 'react'
import {
  getIdentityOrganizationId,
  getPe2Identity,
  getPe2Session,
  identityHasCapability,
  onPe2AuthChange,
  requestPe2PasswordReset,
  signInPe2,
  signOutPe2,
  updatePe2Password,
} from '../lib/pe2Auth.js'
import { isPasswordRecoveryLocation } from '../lib/passwordRecoveryUrl.js'

export function usePe2Auth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(() => (
    isPasswordRecoveryLocation(globalThis.location)
  ))

  const loadIdentity = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      setIdentity(null)
      return
    }
    const nextIdentity = await getPe2Identity(userId)
    setProfile(nextIdentity.profile)
    setIdentity(nextIdentity)
  }, [])

  useEffect(() => {
    let cancelled = false
    getPe2Session()
      .then(async (s) => {
        if (cancelled) return
        setSession(s)
        await loadIdentity(s?.user?.id)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Error de sesión')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsub = onPe2AuthChange(async (s, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setSession(s)
      await loadIdentity(s?.user?.id)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [loadIdentity])

  async function signIn(email, password) {
    setError('')
    setLoading(true)
    try {
      const {
        session: s,
        profile: p,
        identity: nextIdentity,
      } = await signInPe2(email, password)
      setSession(s)
      setProfile(p)
      setIdentity(nextIdentity)
      return { session: s, profile: p, identity: nextIdentity }
    } catch (e) {
      setError(e.message || 'No se pudo iniciar sesión')
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function signOut() {
    setError('')
    await signOutPe2()
    setSession(null)
    setProfile(null)
    setIdentity(null)
  }

  async function requestPasswordReset(email) {
    setError('')
    const redirectTo = `${window.location.origin}/?v2&reset-password=1`
    await requestPe2PasswordReset(email, redirectTo)
  }

  async function updatePassword(password) {
    setError('')
    setLoading(true)
    try {
      await updatePe2Password(password)
      setRecoveryMode(false)
    } catch (e) {
      setError(e.message || 'No se pudo actualizar la contraseña')
      throw e
    } finally {
      setLoading(false)
    }
  }

  return {
    session,
    profile,
    identity,
    loading,
    error,
    recoveryMode,
    setError,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    isAuthenticated: Boolean(session?.user),
    roles: identity?.roles || [],
    memberships: identity?.memberships || [],
    capabilities: identity?.capabilities || [],
    identitySource: identity?.source || null,
    orgId: identity?.primaryOrganizationId || null,
    can: (capabilityKey, organizationId) => (
      identityHasCapability(identity, capabilityKey, organizationId)
    ),
    organizationIdFor: (capabilityKey) => (
      getIdentityOrganizationId(identity, capabilityKey)
    ),
  }
}
