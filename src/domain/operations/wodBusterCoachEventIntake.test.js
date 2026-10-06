import { describe, expect, it } from 'vitest'
import {
  normalizeWodBusterCoachEvent,
  WodBusterCoachEventError,
  wodbusterCoachIntakeStatus,
} from './wodBusterCoachEventIntake.js'

const valid = {
  id: 'wodbuster-demo-001',
  type: 'trial.confirmed',
  coachId: 'javi',
  occurredAt: '2026-09-08T09:30:00+02:00',
  person: {
    reference: 'Caso de prueba A',
    phase: 'Clase de prueba',
    sessionAt: '2026-09-10T17:00:00+02:00',
    objective: 'Retomar entrenamiento',
    precaution: 'Preguntar sensaciones antes de impacto.',
  },
}

describe('WodBuster coach event intake', () => {
  it('reduce un evento al contrato operativo permitido', () => {
    const event = normalizeWodBusterCoachEvent(valid)
    expect(event).toEqual({
      ...valid,
      source: 'wodbuster',
      occurredAt: '2026-09-08T07:30:00.000Z',
    })
    expect(Object.isFrozen(event)).toBe(true)
  })

  it('rechaza datos personales, pagos y diagnósticos antes de proyectarlos', () => {
    for (const extra of [
      { person: { ...valid.person, email: 'persona@example.test' } },
      { person: { ...valid.person, phone: '600000000' } },
      { price: '100' },
      { medicalReport: 'detalle clínico' },
    ]) {
      expect(() => normalizeWodBusterCoachEvent({ ...valid, ...extra })).toThrow(WodBusterCoachEventError)
    }
  })

  it('solo permite los eventos que aportan continuidad deportiva', () => {
    expect(() => normalizeWodBusterCoachEvent({ ...valid, type: 'payment.completed' }))
      .toThrow('event_type_not_allowed')
  })

  it('permanece apagado hasta una fuente verificada y autorización individual', () => {
    expect(wodbusterCoachIntakeStatus()).toMatchObject({
      readyForVerifiedSource: true,
      liveSourceEnabled: false,
      writesToWodBuster: false,
      acceptsPayments: false,
    })
  })
})
