const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]/g, '')
}

export function getMadridProgramDayKey(now = new Date()) {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    weekday: 'long',
  }).format(now).toLowerCase()
  return DAY_KEYS.includes(weekday) ? weekday : null
}

export function feedbackObligationKey(dayKey, classLabel) {
  return `${String(dayKey || '').toLowerCase()}::${normalizeToken(classLabel)}`
}

export function buildProgrammingNavigationTarget(classItem, mode = 'class', token = Date.now()) {
  return {
    token,
    mode,
    dayKey: classItem?.dayKey || getMadridProgramDayKey(),
    classLabel: classItem?.classLabel || null,
    classId: classItem?.id || null,
    type: classItem?.type || classItem?.classLabel || 'Clase',
    time: classItem?.time || null,
  }
}

export function feedbackMatchesTarget(row, target) {
  return feedbackObligationKey(row?.day_key, row?.class_label) === feedbackObligationKey(target?.dayKey, target?.classLabel)
}

export function hasExistingFeedback(rows, target) {
  return Array.isArray(rows) && rows.some((row) => feedbackMatchesTarget(row, target))
}

function madridMinutes(now) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0)
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0)
  return hour * 60 + minute
}

function timeToMinutes(value) {
  const [hour, minute] = String(value || '00:00').split(':').map(Number)
  return hour * 60 + minute
}

export function classHasFinished(classItem, now = new Date(), currentDayKey = getMadridProgramDayKey(now)) {
  if (!classItem || (classItem.dayKey && classItem.dayKey !== currentDayKey)) return false
  const endMinutes = classItem.endTime
    ? timeToMinutes(classItem.endTime)
    : timeToMinutes(classItem.time) + Number(classItem.durationMinutes || 60)
  return madridMinutes(now) >= endMinutes
}

export function getNextShiftClass(classes, now = new Date(), currentDayKey = getMadridProgramDayKey(now)) {
  const ordered = [...(classes || [])]
    .filter((item) => !item.dayKey || item.dayKey === currentDayKey)
    .sort((left, right) => timeToMinutes(left.time) - timeToMinutes(right.time))
  if (!ordered.length) return null
  const currentMinutes = madridMinutes(now)
  return ordered.find((item) => timeToMinutes(item.time) >= currentMinutes) || ordered.at(-1)
}

export function deriveProgrammingFeedbackStatus({ classes, feedbackRows, now = new Date(), dayKey = getMadridProgramDayKey(now) }) {
  const unique = new Map()
  for (const classItem of classes || []) {
    const target = { dayKey: classItem.dayKey || dayKey, classLabel: classItem.classLabel }
    const key = feedbackObligationKey(target.dayKey, target.classLabel)
    if (!target.dayKey || !target.classLabel || unique.has(key)) continue
    unique.set(key, { ...classItem, ...target, key })
  }

  const due = Array.from(unique.values()).filter((item) => classHasFinished(item, now, dayKey))
  const pending = due.filter((item) => !hasExistingFeedback(feedbackRows, item))
  const completed = due.filter((item) => hasExistingFeedback(feedbackRows, item))

  return {
    due,
    pending,
    completed,
    totalDue: due.length,
    pendingCount: pending.length,
    completedCount: completed.length,
  }
}

export function getShiftCompletionBlockers(shiftBlockers = [], programmingStatus) {
  const feedbackBlockers = (programmingStatus?.pending || []).map((item) => ({
    id: `programming-feedback:${item.key}`,
    label: `Dar feedback de ${item.type || item.classLabel} en Programación.`,
    source: 'programming',
  }))
  return [...shiftBlockers, ...feedbackBlockers]
}

export function getShiftStatusLabel({ shift, programmingStatus }) {
  if (shift?.status === 'closed') return shift.endLabel || 'Turno finalizado'
  if (!shift?.shiftPreparation) return shift?.centerOpening?.status === 'completed' || shift?.arrivalMode === 'handover'
    ? 'Briefing pendiente'
    : 'Turno iniciado'
  if (programmingStatus?.pendingCount > 0) {
    return `${programmingStatus.pendingCount} ${programmingStatus.pendingCount === 1 ? 'clase pendiente' : 'clases pendientes'} de feedback`
  }
  return 'Todo listo para entregar'
}
