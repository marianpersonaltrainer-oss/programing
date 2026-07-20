import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT } from './systemPrompt.js'
import { SYSTEM_PROMPT_EXCEL } from './systemPromptExcel.js'
import { SYSTEM_PROMPT_DAY_EDIT } from './systemPromptDayEdit.js'
import {
  SYSTEM_PROMPT_CORE_WARMUP_POLICY,
  SYSTEM_PROMPT_SHARED_CORE,
  SYSTEM_PROMPT_DEPRECATED_WARMUP_PHRASES,
} from './systemPromptCore.js'

const V1_PROMPTS = [
  { name: 'chat', prompt: SYSTEM_PROMPT },
  { name: 'excel', prompt: SYSTEM_PROMPT_EXCEL },
  { name: 'day_edit', prompt: SYSTEM_PROMPT_DAY_EDIT },
]

function countOccurrences(haystack, needle) {
  if (!needle) return 0
  let count = 0
  let pos = 0
  while (true) {
    const idx = haystack.indexOf(needle, pos)
    if (idx === -1) break
    count += 1
    pos = idx + needle.length
  }
  return count
}

describe('systemPromptCore — núcleo V1 compartido', () => {
  it('los tres flujos incluyen la política común de calentamiento', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(prompt, name).toContain(SYSTEM_PROMPT_CORE_WARMUP_POLICY)
      expect(prompt, name).toContain('POLÍTICA GLOBAL COMPARTIDA — MÉTODO EVO')
    }
  })

  it('los tres flujos incluyen el bloque compartido exactamente una vez', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(countOccurrences(prompt, SYSTEM_PROMPT_SHARED_CORE), name).toBe(1)
    }
  })

  it('no permanece la contradicción «siempre mostrar calentamiento»', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      for (const phrase of SYSTEM_PROMPT_DEPRECATED_WARMUP_PHRASES) {
        expect(prompt, `${name}: ${phrase}`).not.toContain(phrase)
      }
      expect(prompt, name).not.toMatch(/calentamiento\s+SIEMPRE\s+se\s+incluye/i)
    }
  })

  it('no hay undefined ni bloques duplicados por interpolación rota', () => {
    for (const { name, prompt } of V1_PROMPTS) {
      expect(prompt, name).not.toContain('undefined')
      expect(prompt, name).not.toContain('null')
      expect(prompt.trim().length, name).toBeGreaterThan(500)
    }
  })

  it('Excel conserva instrucciones particulares', () => {
    expect(SYSTEM_PROMPT_EXCEL).toContain('LO QUE SE HACE Y LO QUE NO EN EVO')
    expect(SYSTEM_PROMPT_EXCEL).toContain('BLOQUE 3 — VARIEDAD')
    expect(SYSTEM_PROMPT_EXCEL).toContain('FEEDBACK REAL DE COACHES — SEMANA ANTERIOR')
    expect(SYSTEM_PROMPT_EXCEL).toContain('REGLAS APRENDIDAS')
  })

  it('Chat conserva instrucciones particulares', () => {
    expect(SYSTEM_PROMPT).toContain('MESOCICLOS')
    expect(SYSTEM_PROMPT).toContain('FORMATO DE SALIDA OBLIGATORIO')
    expect(SYSTEM_PROMPT).toContain('CONTEXTO DE LA SEMANA (MEMORIA ACUMULADA)')
    expect(SYSTEM_PROMPT).not.toContain('CALENTAMIENTO\n──────────────────────────────────────')
  })

  it('Edición diaria conserva instrucciones particulares', () => {
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('SALIDA OBLIGATORIA')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('{ "dia": { ... } }')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('REGLAS DE EDICIÓN')
    expect(SYSTEM_PROMPT_DAY_EDIT).toContain('SEGURIDAD')
  })
})
