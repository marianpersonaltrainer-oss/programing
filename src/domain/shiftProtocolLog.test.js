import { describe, expect, it } from 'vitest'
import { buildShiftProtocolLogInput } from './shiftProtocolLog.js'

const SHIFT_ID = '40000000-0000-4000-8000-000000000001'

describe('buildShiftProtocolLogInput', () => {
  it('crea un completado confirmado sin aceptar identidad ni hora del cliente', () => {
    const value = buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'apertura',
      result: 'completado',
      allStepsConfirmed: true,
      protocolVersion: 'v0',
      userId: 'otro-usuario',
      createdAt: '2000-01-01T00:00:00Z',
    })

    expect(value).toEqual({
      shift_id: SHIFT_ID,
      record_type: 'apertura',
      result: 'completado',
      comment: null,
      all_steps_confirmed: true,
      first_class_expected: false,
      protocol_version: 'v0',
    })
    expect(value).not.toHaveProperty('user_id')
    expect(value).not.toHaveProperty('created_at')
  })

  it('impide completar sin confirmar todos los pasos', () => {
    expect(() => buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'cierre',
      result: 'completado',
      allStepsConfirmed: false,
      protocolVersion: 'v0',
    })).toThrow('Confirma que has realizado todos los pasos')
  })

  it('impide una incidencia vacía o compuesta solo por espacios en blanco', () => {
    expect(() => buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'cierre',
      result: 'incidencia',
      comment: ' \n\t ',
      protocolVersion: 'v0',
    })).toThrow('Describe qué paso')
  })

  it('normaliza una incidencia válida y no exige confirmación completa', () => {
    expect(buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'cierre',
      result: 'incidencia',
      comment: '  Falta reponer papel  ',
      allStepsConfirmed: true,
      protocolVersion: 'v0',
    })).toEqual({
      shift_id: SHIFT_ID,
      record_type: 'cierre',
      result: 'incidencia',
      comment: 'Falta reponer papel',
      all_steps_confirmed: false,
      first_class_expected: false,
      protocol_version: 'v0',
    })
  })

  it('guarda la revisión y solo ahí acepta que haya una primera clase', () => {
    expect(buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'revision',
      result: 'completado',
      allStepsConfirmed: true,
      firstClassExpected: true,
      protocolVersion: 'v0',
    })).toMatchObject({
      record_type: 'revision',
      first_class_expected: true,
    })

    expect(buildShiftProtocolLogInput({
      shiftId: SHIFT_ID,
      recordType: 'apertura',
      result: 'completado',
      allStepsConfirmed: true,
      firstClassExpected: true,
      protocolVersion: 'v0',
    }).first_class_expected).toBe(false)
  })
})
