import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { FEEDBACK_BLOCKS } from './coachViewConstants.js'

export function sessionText(val) {
  if (val == null) return ''
  const s = String(val).trim()
  return s
}

export function findDia(dias, name) {
  if (!name || name === 'show') return null
  return dias.find(
    (d) =>
      d.nombre === name ||
      (d.nombre && name && String(d.nombre).trim().toUpperCase() === String(name).trim().toUpperCase()),
  )
}

export function previewText(text, maxLines = 4, maxChars = 320) {
  const t = sessionText(text)
  if (!t) return ''
  const lines = t.split('\n').filter((l) => l.trim())
  const chunk = lines.slice(0, maxLines).join('\n')
  return chunk.length > maxChars ? `${chunk.slice(0, maxChars)}…` : chunk
}

export function buildDayQuickSummary(dia, SESSION_BLOCKS) {
  if (!dia) return { labels: [], preview: '' }
  const labels = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key])).map(({ label }) => label)
  const firstBlock = SESSION_BLOCKS.map(({ key }) => dia[key]).find((v) => sessionText(v))
  const preview = previewText(firstBlock || dia.wodbuster || '', 5, 400)
  return { labels, preview }
}

/** Una línea para destacar “objetivo del día” en cards de semana. */
export function dayFocusLine(dia, SESSION_BLOCKS) {
  if (!dia) return null
  const { preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
  if (preview) {
    const line = preview.split('\n').find((l) => l.trim()) || preview
    return line.length > 200 ? `${line.slice(0, 197)}…` : line
  }
  for (const { key } of FEEDBACK_BLOCKS) {
    const t = sessionText(dia[key])
    if (t) {
      const line = t.split('\n').find((l) => l.trim()) || t
      return line.length > 200 ? `${line.slice(0, 197)}…` : line
    }
  }
  const wb = sessionText(dia.wodbuster)
  if (wb) return previewText(wb, 5, 220)
  return null
}

/** Día marcado FESTIVO en datos publicados (todas las sesiones no vacías empiezan por FESTIVO, o sin sesiones y wodbuster FESTIVO). */
export function isFestivoDay(dia) {
  if (!dia) return false
  const contents = EVO_SESSION_CLASS_DEFS.map(({ key }) => sessionText(dia[key])).filter(Boolean)
  if (contents.length === 0) {
    return /^FESTIVO\b/i.test(sessionText(dia.wodbuster))
  }
  return contents.every((t) => /^FESTIVO\b/i.test(t.split('\n')[0].trim()))
}

const NORM = (s) =>
  String(s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

/** `dia.nombre` (LUNES, MIÉRCOLES…) → clave `CoachSessionFeedbackForm` / DAYS_ORDER */
export function dayNombreToFeedbackKey(nombre) {
  const n = NORM(nombre)
  const map = {
    LUNES: 'monday',
    MARTES: 'tuesday',
    MIERCOLES: 'wednesday',
    JUEVES: 'thursday',
    VIERNES: 'friday',
    SABADO: 'saturday',
  }
  return map[n] || null
}

/** Vecinos en el array `dias` publicado (mismo orden que la semana). */
export function getAdjacentDayNames(dias, activeName) {
  if (!Array.isArray(dias) || !activeName || activeName === 'show') return { prev: null, next: null }
  const i = dias.findIndex(
    (d) => NORM(d?.nombre) === NORM(activeName),
  )
  if (i < 0) return { prev: null, next: null }
  return {
    prev: i > 0 ? dias[i - 1]?.nombre ?? null : null,
    next: i < dias.length - 1 ? dias[i + 1]?.nombre ?? null : null,
  }
}

/** Siguiente o anterior día con sesión (salta días FESTIVO). */
export function getAdjacentNavDayName(dias, activeName, direction) {
  if (!Array.isArray(dias) || !activeName || activeName === 'show') return null
  const i = dias.findIndex((d) => NORM(d?.nombre) === NORM(activeName))
  if (i < 0) return null
  const delta = direction === 'prev' ? -1 : 1
  for (let j = i + delta; j >= 0 && j < dias.length; j += delta) {
    if (!isFestivoDay(dias[j])) return dias[j].nombre
  }
  return null
}
