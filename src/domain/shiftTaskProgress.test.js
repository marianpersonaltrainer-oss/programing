import { describe, expect, it } from 'vitest'
import { getShiftTaskProgress } from './shiftTaskProgress.js'

const SHIFT_ID = '40000000-0000-4000-8000-000000000001'
const OTHER_SHIFT_ID = '40000000-0000-4000-8000-000000000002'
const completed = (recordType, extra = {}) => ({
  shift_id: SHIFT_ID,
  record_type: recordType,
  result: 'completado',
  ...extra,
})

describe('getShiftTaskProgress', () => {
  it('muestra tres tareas y avanza por la secuencia guiada', () => {
    expect(getShiftTaskProgress()).toMatchObject({ completed: 0, total: 3, next: 'opening' })
    expect(getShiftTaskProgress([completed('apertura')])).toMatchObject({ completed: 1, next: 'review' })
    expect(getShiftTaskProgress([
      completed('revision', { first_class_expected: false }),
      completed('apertura'),
    ])).toMatchObject({ completed: 2, next: 'finish', canFinish: true })
  })

  it('no cuenta una incidencia como tarea completada', () => {
    expect(getShiftTaskProgress([
      { record_type: 'apertura', result: 'incidencia' },
    ])).toMatchObject({ completed: 0, next: 'opening', canFinish: false })
  })

  it('bloquea el final hasta guardar la primera clase del entrenador', () => {
    const logs = [
      completed('revision', { first_class_expected: true }),
      completed('apertura'),
    ]
    expect(getShiftTaskProgress(logs, [], 'coach-1')).toMatchObject({
      completed: 1,
      next: 'first_class',
      canFinish: false,
    })
    expect(getShiftTaskProgress(logs, [{
      note_type: 'post_class',
      shift_id: SHIFT_ID,
      is_first_class: true,
      user_id: 'coach-1',
    }], 'coach-1')).toMatchObject({ completed: 2, next: 'finish', canFinish: true })
  })

  it('solo completa el turno con una finalización completada', () => {
    const logs = [
      { record_type: 'cierre', result: 'incidencia' },
      completed('revision'),
      completed('apertura'),
    ]
    expect(getShiftTaskProgress(logs)).toMatchObject({ completed: 2, finishComplete: false })
    expect(getShiftTaskProgress([completed('cierre'), ...logs])).toMatchObject({
      completed: 3,
      next: 'done',
      finishComplete: true,
    })
  })

  it('reinicia el recuento para otro turno del mismo día', () => {
    const previousShift = [
      completed('cierre', { shift_id: OTHER_SHIFT_ID }),
      completed('revision', { shift_id: OTHER_SHIFT_ID }),
      completed('apertura', { shift_id: OTHER_SHIFT_ID }),
    ]
    const currentShift = completed('apertura')

    expect(getShiftTaskProgress([currentShift, ...previousShift])).toMatchObject({
      shiftId: SHIFT_ID,
      completed: 1,
      next: 'review',
    })
  })
})
