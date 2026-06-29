import { useCallback, useEffect, useState } from 'react'
import { getPe2Profile, getPe2Session, onPe2AuthChange, signInPe2, signOutPe2 } from '../lib/pe2Auth.js'

export function usePe2Auth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const row = await getPe2Profile(userId)
    setProfile(row)
  }, [])

  useEffect(() => {
    let cancelled = false
    getPe2Session()
      .then(async (s) => {
        if (cancelled) return
        setSession(s)
        await loadProfile(s?.user?.id)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Error de sesión')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsub = onPe2AuthChange(async (s) => {
      setSession(s)
      await loadProfile(s?.user?.id)
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [loadProfile])

  async function signIn(email, password) {
    setError('')
    setLoading(true)
    try {
      const { session: s, profile: p } = await signInPe2(email, password)
      setSession(s)
      setProfile(p)
      return { session: s, profile: p }
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
  }

  return {
    session,
    profile,
    loading,
    error,
    setError,
    signIn,
    signOut,
    isAuthenticated: Boolean(session?.user),
    role: profile?.role || null,
    orgId: profile?.org_id || null,
  }
}
