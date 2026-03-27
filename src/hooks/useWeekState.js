import { useState, useCallback } from 'react'
import { MESOCYCLES } from '../constants/evoColors.js'

const STORAGE_KEY = 'programingevo_week'

function getInitialState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore
  }
  return {
    mesocycle: null,
    week: 1,
    phase: null,
    totalWeeks: null,
    sessions: {
      monday:    null,
      tuesday:   null,
      wednesday: null,
      thursday:  null,
      friday:    null,
      saturday:  null,
    },
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // ignore
  }
}

export function useWeekState() {
  const [weekState, setWeekState] = useState(getInitialState)

  const updateWeekState = useCallback((updater) => {
    setWeekState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      save(next)
      return next
    })
  }, [])

  const setMesocycle = useCallback((mesocycle, week, phase) => {
    const meso = MESOCYCLES.find((m) => m.value === mesocycle)
    updateWeekState((prev) => ({
      ...prev,
      mesocycle,
      week: week || 1,
      phase: phase || null,
      totalWeeks: meso?.weeks || null,
    }))
  }, [updateWeekState])

  const confirmSession = useCallback((day, content, classes) => {
    updateWeekState((prev) => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [day]: { content, classes, confirmed: true },
      },
    }))
  }, [updateWeekState])

  const removeSession = useCallback((day) => {
    updateWeekState((prev) => ({
      ...prev,
      sessions: {
        ...prev.sessions,
        [day]: null,
      },
    }))
  }, [updateWeekState])

  const resetWeek = useCallback(() => {
    const fresh = {
      mesocycle: null,
      week: 1,
      phase: null,
      totalWeeks: null,
      sessions: {
        monday: null, tuesday: null, wednesday: null,
        thursday: null, friday: null, saturday: null,
      },
    }
    save(fresh)
    setWeekState(fresh)
  }, [])

  return {
    weekState,
    setMesocycle,
    confirmSession,
    removeSession,
    resetWeek,
  }
}
