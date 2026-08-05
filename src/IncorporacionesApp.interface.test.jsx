import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  createEmptyShiftState,
  openOpeningItem,
  startShift,
  SYNTHETIC_ACTORS,
} from './domain/shift/shiftDomain.js'
import {
  OpeningActivityScreen,
  OpeningStep,
  ProgrammingOpeningReview,
} from './IncorporacionesApp.jsx'

const startedAt = '2026-08-05T06:42:00+02:00'

function startedShift() {
  return startShift(createEmptyShiftState(), {
    templateId: 'morning',
    actor: SYNTHETIC_ACTORS.coach,
  }, startedAt)
}

function openedShift(itemId) {
  const started = startedShift()
  const state = openOpeningItem(started.state, {
    shiftId: started.shift.id,
    itemId,
    actor: SYNTHETIC_ACTORS.coach,
  }, startedAt)
  return state.shifts[0]
}

const flow = {
  completeOpeningCheck: vi.fn(),
  completeOpeningItem: vi.fn(),
}

describe('Phase 2.3 evidence interface', () => {
  it('offers an activity entry point without a generic completion action', () => {
    const { shift } = startedShift()
    const html = renderToStaticMarkup(<OpeningStep shift={shift} onOpenItem={vi.fn()} onOpenProtocol={vi.fn()} />)

    expect(html).toContain('Abrir actividad')
    expect(html).toContain('Disponible después de la actividad anterior')
    expect(html).not.toContain('Marcar completado')
    expect(html).not.toContain('Registrar problema')
  })

  it('renders systems as a dedicated work screen with exact checks and linked problems', () => {
    const html = renderToStaticMarkup(<OpeningActivityScreen
      shift={openedShift('systems')}
      itemId="systems"
      flow={flow}
      onBack={vi.fn()}
      onProblem={vi.fn()}
      onProgrammingReview={vi.fn()}
      onCompleted={vi.fn()}
    />)

    expect(html).toContain('Ordenador.')
    expect(html).toContain('Música.')
    expect(html).toContain('Aire o climatización.')
    expect(html).toContain('Registrar problema')
    expect(html).toContain('Finalizar actividad')
    expect(html).toContain('← Volver a la apertura')
    expect(html).not.toContain('Marcar completado')
  })

  it('reviews each class in Programación with the operational context required by the audit', () => {
    const html = renderToStaticMarkup(<ProgrammingOpeningReview
      shift={openedShift('schedule')}
      flow={flow}
      onBack={vi.fn()}
      onCompleted={vi.fn()}
    />)

    expect(html).toContain('Objetivo')
    expect(html).toContain('Estructura o bloques')
    expect(html).toContain('Material')
    expect(html).toContain('Adaptaciones y avisos')
    expect(html.match(/Confirmar clase revisada/g)).toHaveLength(3)
    expect(html).not.toContain('WodBuster')
  })
})
