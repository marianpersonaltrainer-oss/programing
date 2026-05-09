import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER, emptyDay, buildWeekSkeleton } from './excelGenerationPlan.js'

function normDayName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

/**
 * Asegura el shape que el modal Excel / coaches esperan: 6 días LUNES→SÁBADO,
 * todas las claves `evofuncional`… y feedbacks, aunque vengan de Supabase con nombres o orden distintos
 * o JSON parcial.
 */
export function normalizeWeekDataForEditor(raw, { semana = 1, mesociclo = '' } = {}) {
  let data = raw
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      return buildWeekSkeleton(Number(semana) || 1, mesociclo)
    }
  }
  if (!data || typeof data !== 'object') {
    return buildWeekSkeleton(Number(semana) || 1, mesociclo)
  }

  const skel = buildWeekSkeleton(Number(semana) || Number(data.semana) || 1, String(data.mesociclo ?? mesociclo ?? ''))
  const byName = new Map()
  const arr = Array.isArray(data.dias) ? data.dias : []
  for (const d of arr) {
    if (!d || typeof d !== 'object') continue
    const key = normDayName(d.nombre)
    if (key) byName.set(key, d)
  }

  const mergedDias = EXCEL_DAY_ORDER.map((canon) => {
    const hit = byName.get(normDayName(canon))
    const base = emptyDay(canon)
    if (!hit) return base
    const out = { ...base }
    out.nombre = canon
    for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      if (Object.prototype.hasOwnProperty.call(hit, key)) {
        const v = hit[key]
        out[key] = v == null ? '' : String(v)
      }
      if (Object.prototype.hasOwnProperty.call(hit, feedbackKey)) {
        const v = hit[feedbackKey]
        out[feedbackKey] = v == null ? '' : String(v)
      }
    }
    if (Object.prototype.hasOwnProperty.call(hit, 'wodbuster')) {
      out.wodbuster = hit.wodbuster == null ? '' : String(hit.wodbuster)
    }
    return out
  })

  return {
    ...skel,
    ...data,
    titulo: data.titulo != null && String(data.titulo).trim() ? String(data.titulo).trim() : skel.titulo,
    semana: Number(data.semana) || skel.semana,
    mesociclo: String(data.mesociclo ?? mesociclo ?? skel.mesociclo ?? ''),
    resumen:
      data.resumen && typeof data.resumen === 'object'
        ? { ...skel.resumen, ...data.resumen }
        : skel.resumen,
    dias: mergedDias,
  }
}

/**
 * JSON publicado (Hub / coach): parsea string si hace falta y alinea días + clases Evo.
 * Úsalo siempre que `published_weeks.data` vaya a parar a UI (coach, Excel modal, etc.).
 */
export function normalizePublishedWeekForConsumers(raw, row = {}) {
  if (raw == null) return null
  let parsed = raw
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  return normalizeWeekDataForEditor(parsed, {
    semana: Number(row?.semana ?? parsed?.semana) || 1,
    mesociclo: String(row?.mesociclo ?? parsed?.mesociclo ?? ''),
  })
}

function isPlaceholderSessionText(s) {
  const t = String(s || '').trim()
  if (!t) return true
  return /^\(no programada esta semana\)$/i.test(t)
}

/**
 * True si hay texto de sesión real (no placeholder ni celda vacía).
 * No usa solo el título: el modal rellena título por defecto al generar y eso bloqueaba la auto-carga desde Supabase.
 */
export function weekHasMeaningfulSessionContent(data) {
  if (!data || typeof data !== 'object') return false
  const dias = Array.isArray(data.dias) ? data.dias : []
  for (const d of dias) {
    if (!d || typeof d !== 'object') continue
    for (const { key } of EVO_SESSION_CLASS_DEFS) {
      if (!isPlaceholderSessionText(d[key])) return true
    }
  }
  return false
}
