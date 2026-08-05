import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import IncorporacionesApp from './IncorporacionesApp.jsx'
import { LOCAL_SHIFT_STORAGE_KEY } from './adapters/shift/localShiftRepository.js'
import { createEmptyShiftState, startShift, SYNTHETIC_ACTORS } from './domain/shift/shiftDomain.js'

function createMemoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null },
    setItem(key, value) { values.set(key, String(value)) },
    removeItem(key) { values.delete(key) },
  }
}

afterEach(() => {
  delete globalThis.localStorage
})

describe('Mi turno opening actions', () => {
  it('shows contextual work actions instead of a generic completion checklist', () => {
    const started = startShift(
      createEmptyShiftState(),
      { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach },
      '2026-08-05T06:42:00+02:00',
    )
    globalThis.localStorage = createMemoryStorage({
      [LOCAL_SHIFT_STORAGE_KEY]: JSON.stringify(started.state),
    })

    const html = renderToStaticMarkup(<IncorporacionesApp />)

    expect(html).toContain('Revisar relevo anterior')
    expect(html).toContain('Confirmar dispositivos')
    expect(html).toContain('Confirmar sala y material')
    expect(html).toContain('Abrir programación del día')
    expect(html).toContain('Preparar primera clase')
    expect(html).not.toContain('Marcar completado')
  })
})
