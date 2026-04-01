/**
 * Texto para pegar en WodBuster (vista alumno): por día (MAYÚSCULAS) y por clase.
 * Sin timings (X' - Y') entre paréntesis, sin feedback de coach, sin markdown ni emojis.
 * Cargas @kg / % se conservan.
 */

import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

/** Rangos tipo (0' - 5'), (12' - 24'), (56' - 60') en cualquier parte del texto */
const PAREN_CLASS_TIMING = /\(\s*\d+\s*['′']?\s*-\s*\d+\s*['′']?\s*\)/gi

const EMOJI_REGEX = /\p{Extended_Pictographic}|\p{Emoji_Presentation}/gu

function stripParenTimingsGlobal(text) {
  let s = String(text)
  let prev
  do {
    prev = s
    s = s.replace(PAREN_CLASS_TIMING, '')
  } while (s !== prev)
  return s
}

function stripMarkdownChars(text) {
  return String(text)
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/__/g, '')
    .replace(/_/g, '')
}

function stripEmojis(text) {
  try {
    return String(text).replace(EMOJI_REGEX, '')
  } catch {
    return String(text)
  }
}

function stripFeedbackSection(text) {
  const m = String(text).match(/\n\s*FEEDBACK\b/im)
  if (!m || m.index == null) return String(text)
  return String(text).slice(0, m.index).trimEnd()
}

function isFeedbackCoachLine(line) {
  const t = line.trim()
  if (!t) return false
  if (/^feedback\b/i.test(t)) return true
  if (/^FEEDBACK\b/.test(t)) return true
  if (/^briefing\b/i.test(t) && /coach/i.test(t)) return true
  return false
}

/** Normaliza encabezados: BIENVENIDA, CIERRE, A) / B) / C) (subtítulo en MAYÚSCULAS) */
function normalizeSectionHeaders(text) {
  return String(text)
    .split('\n')
    .map((line) => {
      const t = line.trim()
      if (/^bienvenida$/i.test(t) || /^bienvida$/i.test(t)) return 'BIENVENIDA'
      if (/^cierre$/i.test(t)) return 'CIERRE'
      const block = t.match(/^([abc])\)(\s*)(.*)$/i)
      if (block) {
        const letter = block[1].toUpperCase()
        const rest = block[3].trim()
        const title = rest ? rest.toUpperCase() : ''
        return title ? `${letter}) ${title}` : `${letter})`
      }
      return line
    })
    .join('\n')
}

/**
 * Sesión de una clase (evofuncional, …) → texto WodBuster limpio.
 * @param {string} raw
 * @returns {string}
 */
export function formatClassSessionForWodBusterPaste(raw) {
  if (raw == null) return ''
  const trimmed = String(raw).trim()
  if (!trimmed || trimmed === 'FESTIVO') return ''
  const firstLine = trimmed.split('\n')[0].trim()
  if (/^FESTIVO\b/i.test(firstLine)) return ''

  let t = stripFeedbackSection(trimmed)
  t = stripMarkdownChars(t)
  t = stripEmojis(t)
  t = stripParenTimingsGlobal(t)

  const lines = t.split('\n')
  const out = []
  for (const line of lines) {
    if (isFeedbackCoachLine(line)) continue
    const cleaned = line.replace(PAREN_CLASS_TIMING, '')
    const tr = cleaned.trimEnd()
    if (!tr.trim()) {
      out.push('')
      continue
    }
    out.push(tr.trimStart())
  }

  let result = out.join('\n')
  result = result.replace(/\n{4,}/g, '\n\n\n')
  result = result.replace(/\n{3,}/g, '\n\n')
  result = normalizeSectionHeaders(result)
  return result.trim()
}

/**
 * @deprecated Usar formatClassSessionForWodBusterPaste; se mantiene por si hay imports externos.
 */
export function formatWodBusterPasteText(raw) {
  return formatClassSessionForWodBusterPaste(raw)
}

/**
 * Semana completa: DÍA EN MAYÚSCULAS, línea en blanco, bloques por clase separados por una línea en blanco;
 * entre días, dos líneas en blanco.
 * @param {{ dias?: Array<Record<string, string>> }} weekData
 */
export function buildWeekWodBusterPaste(weekData) {
  const dias = weekData?.dias || []
  const dayChunks = []

  for (const d of dias) {
    const dayName = String(d?.nombre || '').trim().toUpperCase()
    if (!dayName) continue

    const classBlocks = []
    for (const { key, label } of EVO_SESSION_CLASS_DEFS) {
      const raw = d[key]
      const block = formatClassSessionForWodBusterPaste(raw)
      if (!block) continue
      classBlocks.push(`${label}\n\n${block}`)
    }

    if (classBlocks.length === 0) {
      const legacy = formatClassSessionForWodBusterPaste(d?.wodbuster || '')
      if (legacy) classBlocks.push(legacy)
    }

    if (classBlocks.length === 0) continue
    dayChunks.push(`${dayName}\n\n${classBlocks.join('\n\n')}`)
  }

  return dayChunks.join('\n\n\n\n')
}
