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
    completeOpeningItem(itemId, completionEvidence) {
      if (!currentShift) return false
      return run(
        () => service.completeOpeningItem({ shiftId: currentShift.id, itemId, actor, completionEvidence }),
        'Comprobación de apertura guardada con responsable y hora.',
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
        incident.openingItemId
          ? 'Problema registrado. La comprobación de apertura continúa pendiente.'
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
    completeClosingItem(itemId) {
      if (!currentShift) return false
      return run(
        () => service.completeClosingItem({ shiftId: currentShift.id, itemId, actor }),
        'Comprobación de cierre guardada con responsable y hora.',
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
