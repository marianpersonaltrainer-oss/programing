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
    openOpeningItem(itemId) {
      if (!currentShift) return false
      return run(
        () => service.openOpeningItem({ shiftId: currentShift.id, itemId, actor }),
        'Actividad abierta. Completa sus comprobaciones antes de finalizarla.',
      )
    },
    completeOpeningCheck(itemId, checkId) {
      if (!currentShift) return false
      return run(
        () => service.completeOpeningCheck({ shiftId: currentShift.id, itemId, checkId, actor }),
        'Comprobación concreta guardada con responsable y hora.',
      )
    },
    completeOpeningItem(itemId, evidence) {
      if (!currentShift) return false
      return run(
        () => service.completeOpeningItem({ shiftId: currentShift.id, itemId, actor, evidence }),
        'Actividad de apertura finalizada con evidencia verificable.',
      )
    },
    completePreparation() {
      if (!currentShift) return false
      return run(
        () => service.completePreparation({ shiftId: currentShift.id, actor }),
        'Turno preparado y guardado con responsable y hora.',
      )
    },
    recordIncident(incident) {
      if (!currentShift) return false
      return run(
        () => service.recordIncident({ shiftId: currentShift.id, actor, ...incident }),
        incident.openingItemId || incident.closingItemId
          ? 'Problema registrado y vinculado. La actividad continúa pendiente hasta finalizar sus comprobaciones.'
          : 'Incidencia asignada y enviada a la bandeja local de Dirección.',
      )
    },
    recordFirstClass(record) {
      if (!currentShift) return false
      return run(
        () => service.recordFirstClass({ shiftId: currentShift.id, actor, record }),
        'Primera clase guardada con responsable y hora.',
      )
    },
    openClosingItem(itemId) {
      if (!currentShift) return false
      return run(
        () => service.openClosingItem({ shiftId: currentShift.id, itemId, actor }),
        'Comprobación final abierta. Revisa cada elemento.',
      )
    },
    completeClosingCheck(itemId, checkId) {
      if (!currentShift) return false
      return run(
        () => service.completeClosingCheck({ shiftId: currentShift.id, itemId, checkId, actor }),
        'Comprobación final guardada con responsable y hora.',
      )
    },
    completeClosingItem(itemId, evidence) {
      if (!currentShift) return false
      return run(
        () => service.completeClosingItem({ shiftId: currentShift.id, itemId, actor, evidence }),
        'Actividad final cerrada con evidencia verificable.',
      )
    },
    close(note = '') {
      if (!currentShift) return false
      return run(
        () => service.close({ shiftId: currentShift.id, actor, note }),
        currentShift.endMode === 'handover'
          ? 'Turno entregado. Las excepciones asignadas siguen visibles para Dirección.'
          : 'Centro cerrado. Las excepciones asignadas siguen visibles para Dirección.',
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
