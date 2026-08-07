import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMiCaminoActivePlanB,
  getMiCaminoChallenges,
  getMiCaminoCurrentState,
  getMiCaminoMilestones,
  getMiCaminoPerson,
  getMiCaminoResourceDeliveries,
  getMiCaminoSession,
  onMiCaminoAuthChange,
  sendMiCaminoMagicLink,
  signInMiCamino,
  signOutMiCamino,
} from './miCaminoData.js'

const EMPTY_DATA = {
  person: null,
  currentState: null,
  milestones: [],
  planB: null,
  resources: [],
  challenges: [],
}

export function useMiCamino() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(EMPTY_DATA)

  const loadCustomerData = useCallback(async () => {
    setError('')
    setRefreshing(true)
    try {
      const [person, currentState, milestones, planB, resources, challenges] = await Promise.all([
        getMiCaminoPerson(),
        getMiCaminoCurrentState(),
        getMiCaminoMilestones(),
        getMiCaminoActivePlanB(),
        getMiCaminoResourceDeliveries(),
        getMiCaminoChallenges(),
      ])
      setData({ person, currentState, milestones, planB, resources, challenges })
    } catch (e) {
      setError(e?.message || 'No se pudo cargar Mi Camino.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    getMiCaminoSession()
      .then(async (s) => {
        if (cancelled) return
        setSession(s)
        if (s?.user) await loadCustomerData()
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || 'No se pudo comprobar tu sesión.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const unsubscribe = onMiCaminoAuthChange(async (s) => {
      if (cancelled) return
      setSession(s)
      if (s?.user) await loadCustomerData()
      else setData(EMPTY_DATA)
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [loadCustomerData])

  async function signIn(email, password) {
    setError('')
    setLoading(true)
    try {
      const next = await signInMiCamino(email, password)
      setSession(next)
      if (next?.user) await loadCustomerData()
    } catch (e) {
      setError(e?.message || 'No se pudo iniciar sesión.')
      throw e
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink(email) {
    setError('')
    const redirectTo = `${window.location.origin}/mi-camino/hoy`
    try {
      await sendMiCaminoMagicLink(email, redirectTo)
    } catch (e) {
      setError(e?.message || 'No se pudo enviar el acceso.')
      throw e
    }
  }

  async function signOut() {
    setError('')
    await signOutMiCamino()
    setSession(null)
    setData(EMPTY_DATA)
  }

  const isLinkedCustomer = Boolean(data.person?.id)

  return useMemo(
    () => ({
      session,
      loading,
      refreshing,
      error,
      setError,
      ...data,
      isAuthenticated: Boolean(session?.user),
      isLinkedCustomer,
      refresh: loadCustomerData,
      signIn,
      sendMagicLink,
      signOut,
    }),
    [session, loading, refreshing, error, data, isLinkedCustomer, loadCustomerData],
  )
}
