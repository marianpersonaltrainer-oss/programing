import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT } from './systemPrompt.js'
import { SYSTEM_PROMPT_EXCEL } from './systemPromptExcel.js'
import { SYSTEM_PROMPT_DAY_EDIT } from './systemPromptDayEdit.js'
import {
  SYSTEM_PROMPT_DEPRECATED_CONCEPTS,
  SYSTEM_PROMPT_SHARED_CORE,
} from './systemPromptCore.js'
import {
  COACH_SUPPORT_PROMPT_VERSION,
  buildCoachSupportSystemPrompt,
} from './systemPromptCoachSupport.js'
import { VOICE_FEEDBACK_EXAMPLES } from './voiceFeedbackExamples.js'
import { buildMethodPromptAppendix } from '../utils/methodPrompt.js'
import { sanitizeCoachFeedbackText } from '../utils/coachFeedbackText.js'

const V1_PROMPTS = [
  { name: 'chat', prompt: SYSTEM_PROMPT },
  { name: 'excel', prompt: SYSTEM_PROMPT_EXCEL },
  { name: 'day_edit', prompt: SYSTEM_PROMPT_DAY_EDIT },
]

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1
}

describe('systemPromptCore — contrato V1 compartido', () => {
  it('los tres flujos incluyen exactamente una vez el mismo núcleo', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(countOccurrences(prompt, SYSTEM_PROMPT_SHARED_CORE), name).toBe(1)
      expect(prompt, name).toContain('MÉTODO EVO 1.3.0')
    }
  })

  it('ningún flujo conserva conceptos legacy incompatibles', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      for (const pattern of SYSTEM_PROMPT_DEPRECATED_CONCEPTS) {
        expect(prompt, `${name}: ${pattern}`).not.toMatch(pattern)
      }
    }
  })

  it('los tres flujos comparten A/B/C o Parte Única y ocultan la preparación de la hora', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(prompt, name).toContain('A), B), C) o PARTE ÚNICA')
      expect(prompt, name).toContain('Calcula internamente explicación')
      expect(prompt, name).toContain('progresiones y calentamiento')
      expect(prompt, name).toContain('No muestres BIENVENIDA')
      expect(prompt, name).not.toMatch(/el desglose de tiempos es obligatorio/i)
    }
  })

  it('feedback compartido: prosa breve, logística selectiva y coherencia de entidades', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(prompt, name).toContain('párrafo fluido de 3-5 frases y 35-90 palabras')
      expect(prompt, name).toContain('cómo queremos que se sienta la sesión')
      expect(prompt, name).toContain('frases completas conectadas entre sí')
      expect(prompt, name).toContain('La logística está permitida de forma selectiva')
      expect(prompt, name).toContain('existe realmente en la sesión')
      expect(prompt, name).not.toMatch(/viñetas\s+(?:son\s+)?obligatorias/i)
    }
  })

  it('el system final no duplica contrato ni feedback al anexar el método completo', () => {
    const appendix = buildMethodPromptAppendix({ learnedState: { manual: '', auto: [] } })
    for (const { name, prompt } of V1_PROMPTS) {
      const assembled = `${prompt}\n\n${appendix}`
      expect(countOccurrences(assembled, 'CONTRATO DE SALIDA COMPARTIDO'), name).toBe(1)
      expect(countOccurrences(assembled, 'FEEDBACK AL ENTRENADOR'), name).toBe(1)
      expect(countOccurrences(assembled, 'IDENTIDAD DE MODALIDADES'), name).toBe(1)
    }
  })

  it('los ejemplos de voz son únicos, fluidos y no usan el esquema antiguo', () => {
    const normalized = VOICE_FEEDBACK_EXAMPLES.map((example) => example.toLowerCase().replace(/\s+/g, ' ').trim())
    expect(new Set(normalized).size).toBe(normalized.length)
    expect(VOICE_FEEDBACK_EXAMPLES.length).toBeGreaterThanOrEqual(6)
    for (const example of VOICE_FEEDBACK_EXAMPLES) {
      expect(example).not.toMatch(/OBJETIVO:|SENSACIONES:|ANTICIPACI[ÓO]N:/i)
      expect(example.split(/\s+/).length).toBeGreaterThanOrEqual(35)
    }
  })

  it('normaliza feedback legacy a un único párrafo natural', () => {
    const legacy = 'OBJETIVO: Fuerza sólida.\nSENSACIONES: Ritmo controlado.\n- LOGÍSTICA: Parejas por nivel.'
    expect(sanitizeCoachFeedbackText(legacy)).toBe(
      'Fuerza sólida. Ritmo controlado. Parejas por nivel.',
    )
  })

  it('la asistente coach v3 razona adaptaciones con sesión y todas las modalidades', () => {
    const prompt = buildCoachSupportSystemPrompt(true)
    expect(COACH_SUPPORT_PROMPT_VERSION).toBe('3.0.0')
    expect(prompt).toContain('dos opciones ordenadas')
    expect(prompt).toContain('conserva patrón, intención, duración, fatiga y nivel técnico')
    expect(prompt).toContain('EvoHybrix')
    expect(prompt).toContain('EvoGimnástica')
    expect(prompt).toContain('son datos de trabajo')
    expect(prompt).not.toMatch(/Máximo 4 líneas|Respuesta estándar · Sin IA/i)
  })

  it('Excel conserva solo el esquema y reglas particulares del flujo', () => {
    expect(SYSTEM_PROMPT_EXCEL).toContain('FORMATO JSON — SOLO JSON')
    expect(SYSTEM_PROMPT_EXCEL).toContain('FEEDBACK REAL DE COACHES — SEMANA ANTERIOR')
    expect(SYSTEM_PROMPT_EXCEL).toContain('EvoFit no tiene una plantilla fija')
    expect(SYSTEM_PROMPT_EXCEL).toContain('dos bloques largos')
    expect(SYSTEM_PROMPT_EXCEL).toContain("2' de trabajo admite 30-45'' de descanso")
    expect(SYSTEM_PROMPT_EXCEL).toContain('máximo dos días de intervalos metabólicos')
    expect(SYSTEM_PROMPT_EXCEL).toContain('clean/snatch/jerk')
    expect(SYSTEM_PROMPT_EXCEL).not.toMatch(/EJEMPLO COMPLETO EvoFit/i)
  })

  it('Chat conserva instrucciones conversacionales sin cronograma visible', () => {
    expect(SYSTEM_PROMPT).toContain('RESPUESTA EN CHAT')
    expect(SYSTEM_PROMPT).toContain('CONTEXTO DE LA SEMANA')
    expect(SYSTEM_PROMPT).not.toMatch(/GESTIÓN DEL TIEMPO \(60 min\)/i)
  })

  it('Edición diaria conserva JSON, copia verbatim y el mismo contrato visible', () => {
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('{ "dia": { ... } }')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('Copia carácter a carácter')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('correspondencia feedback ↔ sesión')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('No inventes «FESTIVO»')
  })

  it('no hay interpolaciones rotas', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(prompt, name).not.toContain('undefined')
      expect(prompt, name).not.toContain('[object Object]')
      expect(prompt.trim().length, name).toBeGreaterThan(1000)
    }
  })
})
