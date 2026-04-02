import { jsonrepair } from 'jsonrepair'

/**
 * La API devuelve texto del asistente; dentro debe ir un único objeto JSON semanal.
 * El modelo a veces produce JSON casi válido (comas finales, fences, comillas tipográficas).
 */

/** Primer objeto `{…}` equilibrado respetando strings entre comillas dobles y escapes. */
export function extractTopLevelJsonObject(text) {
  if (!text || typeof text !== 'string') return null
  const start = text.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escape) {
        escape = false
      } else if (ch === '\\') {
        escape = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

/** Quita comas finales ilegales antes de `}` o `]` (error frecuente del LLM). */
export function repairCommonLlMJsonIssues(jsonStr) {
  let s = String(jsonStr).replace(/^\uFEFF/, '').trim()
  let prev
  do {
    prev = s
    s = s.replace(/,(\s*[}\]])/g, '$1')
  } while (s !== prev)
  return s
}

function stripOuterCodeFence(text) {
  let t = text.trim()
  if (!t.startsWith('```')) return t
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/s, '')
    .trim()
}

/**
 * @param {string} assistantText — `data.content[0].text` de Anthropic
 * @returns {object} objeto semanal parseado
 */
export function parseAssistantWeekJson(assistantText) {
  const raw = stripOuterCodeFence(assistantText || '')
  let slice = extractTopLevelJsonObject(raw)
  if (!slice) {
    const m = raw.match(/\{[\s\S]*\}/)
    slice = m ? m[0] : null
  }
  if (!slice) {
    throw new Error(
      'La respuesta no contiene un objeto JSON {…} reconocible. El modelo debió devolver solo el JSON de la semana.',
    )
  }

  const variants = [
    slice,
    repairCommonLlMJsonIssues(slice),
    repairCommonLlMJsonIssues(slice.replace(/[\u201C\u201D\u2018\u2019]/g, '"')),
  ]
  try {
    const repaired = jsonrepair(slice)
    if (repaired && !variants.includes(repaired)) variants.push(repaired)
  } catch {
    /* jsonrepair no pudo reparar; seguimos con las otras variantes */
  }

  let lastErr
  for (const candidate of variants) {
    try {
      return JSON.parse(candidate)
    } catch (e) {
      lastErr = e
    }
  }

  const hint =
    lastErr?.message ||
    'JSON inválido. Revisa que no falten comas entre elementos o que no haya texto suelto dentro del JSON.'
  throw new Error(hint)
}
