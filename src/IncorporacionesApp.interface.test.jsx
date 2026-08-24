import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createEmptyShiftState, startShift, SYNTHETIC_ACTORS } from './domain/shift/shiftDomain.js'
import { OpeningStep } from './IncorporacionesApp.jsx'

function morningShift() {
  return startShift(createEmptyShiftState(), { templateId: 'morning', actor: SYNTHETIC_ACTORS.coach }, '2026-08-05T06:42:00+02:00').shift
}

describe('Phase 2.3 contextual interface', () => {
  it('offers one opening confirmation and one subordinate problem action', () => {
    const html = renderToStaticMarkup(<OpeningStep shift={morningShift()} onConfirm={vi.fn()} onProblem={vi.fn()} onOpenProtocol={vi.fn()} />)
    expect(html.match(/Centro abierto y operativo/g)).toHaveLength(1)
    expect(html).toContain('Registrar un problema')
    expect(html).toContain('luces, pantalla, ordenador, música, clima')
    expect(html).not.toContain('Marcar completado')
    expect(html).not.toContain('Abrir actividad')
  })

  it('keeps every interactive opening target at least 44px high', () => {
    const html = renderToStaticMarkup(<OpeningStep shift={morningShift()} onConfirm={vi.fn()} onProblem={vi.fn()} onOpenProtocol={vi.fn()} />)
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(3)
  })
})
