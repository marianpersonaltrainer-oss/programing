import { describe, expect, it } from 'vitest'
import { normalizeOwnAgentWeeklyDraft } from './ownAgentWeeklyDraft.js'

const weeklyOffer = {
  version: 1,
  dias: {
    LUNES: ['evofuncional', 'evobasics'],
    MARTES: [], MIÉRCOLES: [], JUEVES: [], VIERNES: [], SÁBADO: [],
  },
}

const validDraft = JSON.stringify({
  titulo: 'Mixto S1',
  resumen: { foco: 'Progresión controlada' },
  revision_evo: {
    estado: 'revisado',
    controles: [
      { nombre: 'Oferta', resultado: 'ok' },
      { nombre: 'Mesociclo', resultado: 'ok' },
      { nombre: 'Huella horizontal', resultado: 'ok' },
      { nombre: 'Impartición', resultado: 'ok' },
      { nombre: 'Feedback', resultado: 'ok' },
    ],
  },
  dias: [{
    nombre: 'LUNES',
    evofuncional: 'A) FUERZA · 12\'\nTrabajo técnico con carga controlada.',
    feedback_funcional: 'Hoy buscamos calidad. Organiza las cargas antes de empezar.',
    evobasics: 'A) SKILL · 12\'\nProgresión sencilla y práctica guiada.',
    feedback_basics: 'Hoy buscamos aprender el gesto. Prioriza explicarlo antes de subir carga.',
  }],
})

describe('borrador semanal completo del Agente Programador', () => {
  it('acepta exactamente todas las clases previstas y conserva WodBuster vacío', () => {
    const result = normalizeOwnAgentWeeklyDraft(validDraft, {
      semana: 1, mesociclo: 'mixto', weeklyOffer,
    })
    expect(result.semana).toBe(1)
    expect(result.oferta_semanal).toEqual(weeklyOffer)
    expect(result.dias.find((day) => day.nombre === 'LUNES').wodbuster).toBe('')
  })

  it('rechaza una clase fuera de la oferta o una clase sin briefing', () => {
    expect(() => normalizeOwnAgentWeeklyDraft(JSON.stringify({
      dias: [{ nombre: 'LUNES', evofuncional: 'Sesión', feedback_funcional: 'Briefing', evofit: 'No permitida' }],
    }), { semana: 1, mesociclo: 'mixto', weeklyOffer })).toThrow('falta una sesión completa')

    expect(() => normalizeOwnAgentWeeklyDraft(JSON.stringify({
      dias: [{ nombre: 'LUNES', evofuncional: 'Sesión', feedback_funcional: 'Briefing', evobasics: 'Sesión Basics' }],
    }), { semana: 1, mesociclo: 'mixto', weeklyOffer })).toThrow('falta el briefing')
  })

  it('no abre un borrador sin revisión estricta EVO', () => {
    const withoutReview = JSON.parse(validDraft)
    delete withoutReview.revision_evo
    expect(() => normalizeOwnAgentWeeklyDraft(JSON.stringify(withoutReview), {
      semana: 1, mesociclo: 'mixto', weeklyOffer,
    })).toThrow('no incluye la revisión estricta')
  })
})
