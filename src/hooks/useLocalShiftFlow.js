import { useMemo, useState } from 'react'
import { createLocalShiftRepository } from '../adapters/shift/localShiftRepository.js'
import { createEmptyShiftState, getLatestShift, SYNTHETIC_ACTORS } from '../domain/shift/shiftDomain.js'
import { createShiftService } from '../domain/shift/shiftService.js'

export function useLocalShiftFlow() {
  const service = useMemo(() => createShiftService({ repository: createLocalShiftRepository() }), [])
  const initial = useMemo(() => {
    try {
      return { state: service.load(), error: '' }
    } catch (error) {
      return { state: createEmptyShiftState(), error: error.message }
    }
  }, [service])
  const [state, setState] = useState(initial.state)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState(initial.error)

  const currentShift = getLatestShift(state)
  const actor = SYNTHETIC_ACTORS.coach

  function run(operation, successMessage) {
    setError('')
    try {
      const next = operation()
      setState(next)
      setNotice(successMessage)
      return true
    } catch (nextError) {
      setNotice('')
      setError(nextError.message || 'No se pudo completar la acción local.')
      return false
    }
  }

  return {
    state,
    currentShift,
    actor,
    notice,
    error,
    clearMessages() {
      setNotice('')
      setError('')
    },
    start(templateId) {
      setError('')
      try {
        const result = service.start({ templateId, actor })
        setState(result.state)
        setNotice(result.duplicate ? 'Ese turno ya existía. Se ha recuperado sin crear un duplicado.' : 'Turno iniciado y guardado en este dispositivo.')
        return true
      } catch (nextError) {
        setNotice('')
        setError(nextError.message || 'No se pudo iniciar el turno local.')
        return false
      }
    },
    completeTask(taskId) {
      if (!currentShift) return false
      return run(
        () => service.completeTask({ shiftId: currentShift.id, taskId, actor }),
        taskId === 'opening' ? 'Apertura completada y guardada.' : 'Tarea completada y guardada.',
      )
    },
    consultBriefing() {
      if (!currentShift) return false
      return run(
        () => service.consultBriefing({ shiftId: currentShift.id, actor }),
        'Briefing consultado con responsable y hora.',
      )
    },
    recordIncident(description) {
      if (!currentShift) return false
      return run(
        () => service.recordIncident({ shiftId: currentShift.id, actor, description }),
        'Incidencia abierta y enviada a la bandeja local de Dirección.',
      )
    },
    recordFeedback(note) {
      if (!currentShift) return false
      return run(
        () => service.recordFeedback({ shiftId: currentShift.id, actor, note }),
        'Feedback operativo guardado para el relevo.',
      )
    },
    prepareEnd(mode, note) {
      if (!currentShift) return false
      return run(
        () => service.prepareEnd({ shiftId: currentShift.id, actor, mode, note }),
        mode === 'handover' ? 'Relevo completado y guardado.' : 'Cierre operativo completado y guardado.',
      )
    },
    close() {
      if (!currentShift) return false
      return run(
        () => service.close({ shiftId: currentShift.id, actor }),
        'Turno cerrado. Las excepciones abiertas siguen visibles para Dirección.',
      )
    },
    reset() {
      try {
        setState(service.reset())
        setError('')
        setNotice('Datos sintéticos reiniciados. Puedes comenzar una prueba nueva.')
        return true
      } catch (nextError) {
        setNotice('')
        setError(nextError.message || 'No se pudieron reiniciar los datos locales.')
        return false
      }
    },
  }
}
