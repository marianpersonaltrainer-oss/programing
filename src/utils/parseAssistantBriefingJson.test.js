import { describe, expect, it } from 'vitest'
import { parseAssistantBriefingJson } from './parseAssistantWeekJson.js'

describe('parseAssistantBriefingJson', () => {
  it('parsea JSON puro de propuesta', () => {
    const parsed = parseAssistantBriefingJson(
      JSON.stringify({
        title: 'PROPUESTA PARA SEMANA 6',
        narrative: 'Semana de pico controlado.',
        suggestedFocus: 'Fuerza + contraste metabólico',
        weeklyArchitecture: [],
      }),
    )
    expect(parsed.title).toContain('SEMANA 6')
    expect(parsed.narrative).toContain('pico')
  })

  it('tolera fences markdown y comas finales', () => {
    const parsed = parseAssistantBriefingJson(`Aquí va la propuesta:
\`\`\`json
{
  "title": "PROPUESTA PARA SEMANA 5",
  "narrative": "Consolidación técnica.",
  "suggestedFocus": "Tren inferior",
  "weeklyArchitecture": [],
}
\`\`\``)
    expect(parsed.title).toContain('SEMANA 5')
  })

  it('acepta objeto anidado en proposal', () => {
    const parsed = parseAssistantBriefingJson(
      JSON.stringify({
        proposal: {
          title: 'PROPUESTA PARA SEMANA 4',
          narrative: 'Descarga parcial.',
          suggestedFocus: 'Hombro',
        },
      }),
    )
    expect(parsed.title).toContain('SEMANA 4')
  })
})
