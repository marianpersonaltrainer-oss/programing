import {
  closeShift,
  completeClosingItem,
  completeOpeningItem,
  completeShiftPreparation,
  getLatestShift,
  recordFirstClass,
  recordIncident,
  startShift,
} from './shiftDomain.js'

export function createShiftService({ repository, now = () => new Date().toISOString() }) {
  function persist(operation) {
    const current = repository.load()
    const next = operation(current, now())
    repository.save(next)
    return next
  }

  return {
    load: () => repository.load(),
    reset: () => repository.reset(),
    start({ templateId, actor }) {
      const current = repository.load()
      const result = startShift(current, { templateId, actor }, now())
      repository.save(result.state)
      return result
    },
    completeOpeningItem: (params) => persist((state, at) => completeOpeningItem(state, params, at)),
    completePreparation: (params) => persist((state, at) => completeShiftPreparation(state, params, at)),
    recordIncident: (params) => persist((state, at) => recordIncident(state, params, at)),
    recordFirstClass: (params) => persist((state, at) => recordFirstClass(state, params, at)),
    completeClosingItem: (params) => persist((state, at) => completeClosingItem(state, params, at)),
    close: (params) => persist((state, at) => closeShift(state, params, at)),
    latest: () => getLatestShift(repository.load()),
  }
}
