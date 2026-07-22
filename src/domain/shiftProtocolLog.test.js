import { describe, expect, it } from 'vitest'
import { buildShiftProtocolLogInput } from './shiftProtocolLog.js'

describe('buildShiftProtocolLogInput', () => {
  it('crea un completado confirmado sin aceptar identidad ni hora del cliente', () => {
    const value = buildShiftProtocolLogInput({
      recordType: 'apertura',
      result: 'completado',
      allStepsConfirmed: true,
      protocolVersion: 'v0',
      userId: 'otro-usuario',
      createdAt: '2000-01-01T00:00:00Z',
    })

    expect(value).toEqual({
      record_type: 'apertura',
      result: 'completado',
      comment: null,
      all_steps_confirmed: true,
      protocol_version: 'v0',
    })
    expect(value).not.toHaveProperty('user_id')
    expect(value).not.toHaveProperty('created_at')
  })

  it('impide completar sin confirmar todos los pasos', () => {
    expect(() => buildShiftProtocolLogInput({
      recordType: 'cierre',
      result: 'completado',
      allStepsConfirmed: false,
      protocolVersion: 'v0',
    })).toThrow('Confirma que has realizado todos los pasos')
  })

  it('impide una incidencia vacía o compuesta solo por espacios en blanco', () => {
    expect(() => buildShiftProtocolLogInput({
      recordType: 'cierre',
      result: 'incidencia',
      comment: ' \n\t ',
      protocolVersion: 'v0',
    })).toThrow('Describe qué paso')
  })

  it('normaliza una incidencia válida y no exige confirmación completa', () => {
    expect(buildShiftProtocolLogInput({
      recordType: 'cierre',
      result: 'incidencia',
      comment: '  Falta reponer papel  ',
      allStepsConfirmed: true,
      protocolVersion: 'v0',
    })).toEqual({
      record_type: 'cierre',
      result: 'incidencia',
      comment: 'Falta reponer papel',
      all_steps_confirmed: false,
      protocol_version: 'v0',
    })
  })
})
