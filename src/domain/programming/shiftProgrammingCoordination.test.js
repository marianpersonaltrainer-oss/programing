import { describe, expect, it } from 'vitest'
import {
  deriveProgrammingFeedbackStatus,
  buildProgrammingNavigationTarget,
  feedbackMatchesTarget,
  getNextShiftClass,
  getShiftCompletionBlockers,
} from './shiftProgrammingCoordination.js'

const classes = [
  { id: 'a', dayKey: 'thursday', time: '07:00', endTime: '08:00', type: 'EVO Funcional', classLabel: 'EvoFuncional' },
  { id: 'b', dayKey: 'thursday', time: '10:30', endTime: '11:30', type: 'EVO Fuerza', classLabel: 'EvoFuerza' },
]

describe('shift coordination with existing Programming feedback', () => {
  it('opens the requested existing class or feedback surface with the correct identity', () => {
    expect(buildProgrammingNavigationTarget(classes[1], 'feedback', 7)).toMatchObject({
      token: 7,
      mode: 'feedback',
      dayKey: 'thursday',
      classLabel: 'EvoFuerza',
      classId: 'b',
    })
  })

  it('matches the existing identity by day and modality, not by hour', () => {
    expect(feedbackMatchesTarget(
      { day_key: 'thursday', class_label: 'Evo Funcional' },
      { dayKey: 'thursday', classLabel: 'EvoFuncional', time: '18:00' },
    )).toBe(true)
  })

  it('does not request feedback before a class has finished', () => {
    const status = deriveProgrammingFeedbackStatus({
      classes,
      feedbackRows: [],
      now: new Date('2026-08-06T09:00:00+02:00'),
      dayKey: 'thursday',
    })
    expect(status.pending.map((item) => item.id)).toEqual(['a'])
    expect(getNextShiftClass(classes, new Date('2026-08-06T09:00:00+02:00'), 'thursday')?.id).toBe('b')
  })

  it('deduplicates repeated sessions with the same day and modality', () => {
    const status = deriveProgrammingFeedbackStatus({
      classes: [...classes, { ...classes[0], id: 'a-repeat', time: '09:00', endTime: '10:00' }],
      feedbackRows: [],
      now: new Date('2026-08-06T14:00:00+02:00'),
      dayKey: 'thursday',
    })
    expect(status.totalDue).toBe(2)
    expect(status.pending).toHaveLength(2)
  })

  it('derives completion from existing records and keeps failed saves pending', () => {
    const completed = deriveProgrammingFeedbackStatus({
      classes,
      feedbackRows: [{ day_key: 'thursday', class_label: 'EvoFuncional' }],
      now: new Date('2026-08-06T14:00:00+02:00'),
      dayKey: 'thursday',
    })
    expect(completed.completedCount).toBe(1)
    expect(completed.pending.map((item) => item.classLabel)).toEqual(['EvoFuerza'])

    const failed = deriveProgrammingFeedbackStatus({
      classes,
      feedbackRows: [],
      now: new Date('2026-08-06T14:00:00+02:00'),
      dayKey: 'thursday',
    })
    expect(failed.pendingCount).toBe(2)
  })

  it('adds Programming obligations to closure without storing feedback in the shift domain', () => {
    const blockers = getShiftCompletionBlockers([{ id: 'first-class', label: 'Primera clase pendiente.' }], {
      pending: [{ key: 'thursday::evofuncional', type: 'EVO Funcional' }],
    })
    expect(blockers.map((item) => item.source || 'shift')).toEqual(['shift', 'programming'])
  })
})
