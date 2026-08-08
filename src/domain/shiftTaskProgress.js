export const SHIFT_TASK_COUNT = 3

export function createShiftId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function getShiftTaskProgress(logs = [], todayPostClassNotes = [], currentUserId = '') {
  const shiftId = logs.find((log) => log.shift_id)?.shift_id || ''
  const shiftLogs = shiftId ? logs.filter((log) => log.shift_id === shiftId) : []
  const completedLogs = shiftLogs.filter((log) => log.result === 'completado')
  const openingComplete = completedLogs.some((log) => log.record_type === 'apertura')
  const review = completedLogs.find((log) => log.record_type === 'revision') || null
  const reviewComplete = Boolean(review)
  const firstClassExpected = review?.first_class_expected === true
  const firstClassComplete = !firstClassExpected || todayPostClassNotes.some((note) => (
    note.note_type === 'post_class'
    && note.is_first_class === true
    && note.shift_id === shiftId
    && Boolean(currentUserId)
    && note.user_id === currentUserId
  ))
  const finishComplete = completedLogs.some((log) => log.record_type === 'cierre')
  const reviewTaskComplete = reviewComplete && firstClassComplete
  const completed = [openingComplete, reviewTaskComplete, finishComplete].filter(Boolean).length

  let next = 'opening'
  if (openingComplete && !reviewComplete) next = 'review'
  else if (openingComplete && reviewComplete && !firstClassComplete) next = 'first_class'
  else if (openingComplete && reviewComplete && !finishComplete) next = 'finish'
  else if (openingComplete && reviewComplete && finishComplete) next = 'done'

  return {
    completed,
    total: SHIFT_TASK_COUNT,
    shiftId,
    openingComplete,
    reviewComplete,
    reviewTaskComplete,
    firstClassExpected,
    firstClassComplete,
    finishComplete,
    canFinish: openingComplete && reviewComplete && firstClassComplete,
    next,
  }
}
