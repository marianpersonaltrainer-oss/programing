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

/** Todos los objetos `{...}` equilibrados del texto (de izquierda a derecha). */
function extractBalancedJsonObjects(text) {
  const input = String(text || '')
  const out = []
  for (let start = input.indexOf('{'); start >= 0; start = input.indexOf('{', start + 1)) {
    let depth = 0
    let inString = false
    let escape = false
    for (let i = start; i < input.length; i++) {
      const ch = input[i]
      if (inString) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{') depth += 1
      else if (ch === '}') {
        depth -= 1
        if (depth === 0) {
          out.push(input.slice(start, i + 1))
          break
        }
      }
    }
  }
  return out
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

function normalizeAssistantText(text) {
  return String(text || '')
    .replace(/^\uFEFF/, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
}

function collectJsonCandidates(text) {
  const candidates = []
  const push = (s) => {
    const v = String(s || '').trim()
    if (v) candidates.push(v)
  }

  const raw = normalizeAssistantText(text)
  push(raw)
  push(stripOuterCodeFence(raw))

  // Bloques fenced intermedios (no solo externos)
  for (const m of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    push(m[1])
  }

  // Primer objeto clásico
  const top = extractTopLevelJsonObject(raw)
  if (top) push(top)

  // Cualquier objeto equilibrado en el texto
  for (const obj of extractBalancedJsonObjects(raw)) {
    push(obj)
  }

  // A veces el modelo devuelve un JSON escapado dentro de comillas
  for (const m of raw.matchAll(/"\s*(\{[\s\S]*\})\s*"/g)) {
    try {
      push(JSON.parse(`"${m[1].replace(/"/g, '\\"')}"`))
    } catch {
      /* noop */
    }
  }

  return candidates
}

function isPlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function looksLikeWeekObject(v) {
  if (!isPlainObject(v)) return false
  return (
    Object.prototype.hasOwnProperty.call(v, 'dias') ||
    Object.prototype.hasOwnProperty.call(v, 'dia') ||
    Object.prototype.hasOwnProperty.call(v, 'titulo') ||
    Object.prototype.hasOwnProperty.call(v, 'semana') ||
    Object.prototype.hasOwnProperty.call(v, 'mesociclo')
  )
}

function coerceLikelyObject(parsed) {
  if (looksLikeWeekObject(parsed)) return parsed
  if (Array.isArray(parsed)) {
    const found = parsed.find((x) => looksLikeWeekObject(x))
    if (found) return found
  }
  if (isPlainObject(parsed) && isPlainObject(parsed.proposal) && looksLikeWeekObject(parsed.proposal)) {
    return parsed.proposal
  }
  return isPlainObject(parsed) ? parsed : null
}

/**
 * @param {string} assistantText — `data.content[0].text` de Anthropic
 * @returns {object} objeto semanal parseado
 */
export function parseAssistantWeekJson(assistantText) {
  const candidateSlices = collectJsonCandidates(assistantText)
  if (!candidateSlices.length) {
    throw new Error(
      'La respuesta no contiene un objeto JSON {…} reconocible. Prueba regenerar con salida SOLO JSON.',
    )
  }

  let lastErr = null
  for (const slice of candidateSlices) {
    const variants = [
      slice,
      repairCommonLlMJsonIssues(slice),
      repairCommonLlMJsonIssues(slice.replace(/[\u201C\u201D\u2018\u2019]/g, '"')),
    ]
    try {
      const repaired = jsonrepair(slice)
      if (repaired && !variants.includes(repaired)) variants.push(repaired)
    } catch {
      /* seguimos con variantes base */
    }

    for (const candidate of variants) {
      try {
        const parsed = JSON.parse(candidate)
        const chosen = coerceLikelyObject(parsed)
        if (chosen) return chosen
      } catch (e) {
        lastErr = e
      }
    }
  }

  throw new Error(
    lastErr?.message ||
      'JSON inválido. La IA devolvió texto no parseable; vuelve a generar en modo SOLO JSON.',
  )
}
