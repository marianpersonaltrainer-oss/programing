import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CoachSessionFeedbackForm from './CoachSessionFeedbackForm.jsx'

describe('Mi turno bridge to the real coach feedback form', () => {
  it('opens the existing form with day and modality fixed by feedbackPrefill', () => {
    const html = renderToStaticMarkup(
      <CoachSessionFeedbackForm
        coachName="Lara Demo"
        sessionId="session-demo"
        weekRow={{ id: 'week-demo', mesociclo: 'mixto', semana: 2 }}
        weekData={{ dias: [] }}
        peerEntries={[]}
        onAfterSave={vi.fn()}
        prefill={{ token: 7, dayKey: 'thursday', classLabel: 'EvoBasics' }}
      />,
    )
    expect(html).toContain('Clase seleccionada desde Mi turno')
    expect(html).toContain('Jueves · EvoBasics')
    expect(html).toContain('no necesitas volver a elegir día ni modalidad')
    expect(html).not.toContain('<select')
    expect(html).toContain('>Guardar<')
  })
})
