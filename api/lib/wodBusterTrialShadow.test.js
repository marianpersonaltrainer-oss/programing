import { expect, it } from 'vitest'
import { summarizeWodBusterTrialShadow } from './wodBusterTrialShadow.js'

const session = { Fecha: '2026-10-14', Hora: '19:00', Entrenamiento: 'EVOBASICS', Coach: 'Dani' }
const invited = { Fecha: '14/10/2026', HoraComienzo: '19:00:00', NombreEntrenamiento: 'EVOBASICS', Invitado: 'Sí', FechaBorrado: '', BorradoFueraHora: false, Nombre: 'Never expose this' }

it('counts a uniquely matched invited reservation without exposing a person or coach', () => {
  const result = summarizeWodBusterTrialShadow({ bookings: [invited], sessions: [session] })
  expect(result).toMatchObject({ mode: 'shadow', invitedBookings: 1, uniquelyMatched: 1 })
  expect(JSON.stringify(result)).not.toContain('Never expose this')
  expect(JSON.stringify(result)).not.toContain('Dani')
})

it('excludes cancelled invited reservations', () => {
  const result = summarizeWodBusterTrialShadow({ bookings: [{ ...invited, FechaBorrado: '2026-10-13' }], sessions: [session] })
  expect(result).toMatchObject({ invitedBookings: 1, excludedCancelled: 1, candidateBookings: 0, uniquelyMatched: 0 })
})

it('does not treat non-invited reservations as trials', () => {
  const result = summarizeWodBusterTrialShadow({ bookings: [{ ...invited, Invitado: false }], sessions: [session] })
  expect(result).toMatchObject({ invitedBookings: 0, candidateBookings: 0, uniquelyMatched: 0 })
})

it('blocks duplicate schedule rows instead of choosing a coach', () => {
  const result = summarizeWodBusterTrialShadow({ bookings: [invited], sessions: [session, session] })
  expect(result).toMatchObject({ ambiguous: 1, uniquelyMatched: 0 })
})

it('reports malformed source formats rather than guessing', () => {
  const result = summarizeWodBusterTrialShadow({ bookings: [{ ...invited, Fecha: '14-10-2026' }], sessions: [session] })
  expect(result).toMatchObject({ invalidCandidateBookings: 1, uniquelyMatched: 0 })
})
