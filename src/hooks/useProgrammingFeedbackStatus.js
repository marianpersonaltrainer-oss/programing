import { useCallback, useEffect, useMemo, useState } from 'react'
import { getActiveWeek, listCoachSessionFeedbackForWeek } from '../lib/supabase.js'
import { deriveProgrammingFeedbackStatus, getMadridProgramDayKey } from '../domain/programming/shiftProgrammingCoordination.js'

export function useProgrammingFeedbackStatus(classes, dependencies = {}) {
  const loadActiveWeek = dependencies.loadActiveWeek || getActiveWeek
  const loadFeedbackRows = dependencies.loadFeedbackRows || listCoachSessionFeedbackForWeek
  const now = dependencies.now || (() => new Date())
  const [feedbackRows, setFeedbackRows] = useState([])
  const [weekId, setWeekId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const week = await loadActiveWeek()
      if (!week?.id) {
        setWeekId(null)
        setFeedbackRows([])
        setError('No hay una semana publicada disponible.')
        return []
      }
      const rows = await loadFeedbackRows(week.id)
      const normalizedRows = Array.isArray(rows) ? rows : []
      setWeekId(week.id)
      setFeedbackRows(normalizedRows)
      setError('')
      return normalizedRows
    } catch (caught) {
      setError(caught?.message || 'No se pudo comprobar el feedback de Programación.')
      return []
    } finally {
      setLoading(false)
    }
  }, [loadActiveWeek, loadFeedbackRows])

  useEffect(() => {
    void refresh()
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refresh)
    window.addEventListener('evo-coach-feedback-saved', refresh)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('evo-coach-feedback-saved', refresh)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [refresh])

  const instant = now()
  const dayKey = getMadridProgramDayKey(instant)
  const status = useMemo(() => deriveProgrammingFeedbackStatus({
    classes,
    feedbackRows,
    now: instant,
    dayKey,
  }), [classes, feedbackRows, instant.getTime(), dayKey])

  return { ...status, feedbackRows, weekId, loading, error, refresh }
}
