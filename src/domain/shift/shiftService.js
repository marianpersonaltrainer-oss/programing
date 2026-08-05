import {
  closeShift,
  completeTask,
  consultBriefing,
  getLatestShift,
  prepareShiftEnd,
  recordFirstClass,
  recordFeedback,
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
    completeTask: (params) => persist((state, at) => completeTask(state, params, at)),
    consultBriefing: (params) => persist((state, at) => consultBriefing(state, params, at)),
    recordIncident: (params) => persist((state, at) => recordIncident(state, params, at)),
    recordFirstClass: (params) => persist((state, at) => recordFirstClass(state, params, at)),
    recordFeedback: (params) => persist((state, at) => recordFeedback(state, params, at)),
    prepareEnd: (params) => persist((state, at) => prepareShiftEnd(state, params, at)),
    close: (params) => persist((state, at) => closeShift(state, params, at)),
    latest: () => getLatestShift(repository.load()),
  }
}
