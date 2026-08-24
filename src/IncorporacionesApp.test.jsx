import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IncorporacionesApp, { IncidentDialog } from './IncorporacionesApp.jsx'
import { LOCAL_SHIFT_STORAGE_KEY } from './adapters/shift/localShiftRepository.js'
import { completeShiftPreparation, confirmCenterOperational, createEmptyShiftState, startShift, SYNTHETIC_ACTORS } from './domain/shift/shiftDomain.js'

function storageWith(state) {
  const values = new Map([[LOCAL_SHIFT_STORAGE_KEY, JSON.stringify(state)]])
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: (key) => values.delete(key) }
}

afterEach(() => { delete globalThis.localStorage })

describe('Mi turno contextual journey', () => {
  it('shows compact opening for the first shift', () => {
    const started = startShift(createEmptyShiftState(), { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:42:00+02:00')
    globalThis.localStorage = storageWith(started.state)
    const html = renderToStaticMarkup(<IncorporacionesApp />)
    expect(html).toContain('Centro abierto y operativo')
    expect(html).toContain('Registrar un problema')
    expect(html).not.toContain('Abrir actividad')
  })

  it('shows important exceptions before a compact schedule without duplicating attendee details', () => {
    const started = startShift(createEmptyShiftState(), { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:42:00+02:00')
    const opened = confirmCenterOperational(started.state, { shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:44:00+02:00')
    globalThis.localStorage = storageWith(opened)
    const html = renderToStaticMarkup(<IncorporacionesApp />)
    expect(html).toContain('Preparar mi turno')
    expect(html).toContain('Alex Vega')
    expect(html.indexOf('Lo importante de tu turno')).toBeLessThan(html.indexOf('Horario del turno'))
    expect(html).not.toContain('Feedback anterior')
    expect(html).not.toContain('Mia Demo')
    expect(html.match(/Nora Sol/g)).toHaveLength(1)
    expect(html.match(/Abrir en Programación/g)).toHaveLength(3)
    expect(html.match(/He revisado y preparado mi turno/g)).toHaveLength(1)
  })

  it('sends the handover trainer directly to briefing', () => {
    const started = startShift(createEmptyShiftState(), { templateId: 'afternoon', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T14:25:00+02:00')
    globalThis.localStorage = storageWith(started.state)
    const html = renderToStaticMarkup(<IncorporacionesApp />)
    expect(html).toContain('Información del relevo')
    expect(html).not.toContain('Centro abierto y operativo')
  })

  it('shows contextual work instead of a permanent checklist', () => {
    const started = startShift(createEmptyShiftState(), { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:42:00+02:00')
    const opened = confirmCenterOperational(started.state, { shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:44:00+02:00')
    const prepared = completeShiftPreparation(opened, { shiftId: started.shift.id, actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:48:00+02:00')
    globalThis.localStorage = storageWith(prepared)
    const html = renderToStaticMarkup(<IncorporacionesApp />)
    expect(html).toContain('Abrir siguiente clase')
    expect(html).toContain('Dar feedback de EVO Funcional')
    expect(html).not.toContain('Ver persona nueva')
    expect(html).not.toContain('Ver primera clase')
    expect(html).not.toContain('Completa cada comprobación')
    expect(html).toContain('Ver qué falta')
    expect(html).not.toContain('50%')
  })

  it('uses the existing incident dialog with contextual preselection', () => {
    const shift = startShift(createEmptyShiftState(), { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:42:00+02:00').shift
    const html = renderToStaticMarkup(<IncidentDialog shift={shift} prefill={{ description: 'El remo 04 queda fuera de uso.', nextAction: 'Revisar y confirmar.' }} error="" onClose={() => {}} onConfirm={() => true} onClearError={() => {}} />)
    expect(html).toContain('El remo 04 queda fuera de uso.')
    expect(html).toContain('Revisar y confirmar.')
    expect(html).toContain('Guardar incidencia')
  })
})
