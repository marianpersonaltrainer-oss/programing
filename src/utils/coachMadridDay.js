import { DAYS_ORDER } from '../constants/evoColors.js'

/** Normaliza `day_key` guardado (PostgREST / formulario) a `monday`…`saturday`. */
export function normalizeProgramDayKey(raw) {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (DAYS_ORDER.includes(s)) return s
  return null
}

const EN_LONG = {
  Monday: 'monday',
  Tuesday: 'tuesday',
  Wednesday: 'wednesday',
  Thursday: 'thursday',
  Friday: 'friday',
  Saturday: 'saturday',
  Sunday: null,
}

const EN_SHORT = {
  Mon: 'monday',
  Tue: 'tuesday',
  Wed: 'wednesday',
  Thu: 'thursday',
  Fri: 'friday',
  Sat: 'saturday',
  Sun: null,
}

const ES_LONG = {
  lunes: 'monday',
  martes: 'tuesday',
  miercoles: 'wednesday',
  miércoles: 'wednesday',
  jueves: 'thursday',
  viernes: 'friday',
  sabado: 'saturday',
  sábado: 'saturday',
  domingo: null,
}

function mapWeekdayStringToDayKey(raw) {
  if (!raw || typeof raw !== 'string') return undefined
  const longEn = raw.trim()
  if (longEn in EN_LONG) {
    const k = EN_LONG[longEn]
    return k === null ? null : DAYS_ORDER.includes(k) ? k : undefined
  }
  const esNorm = longEn
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (esNorm in ES_LONG) {
    const k = ES_LONG[esNorm]
    return k === null ? null : DAYS_ORDER.includes(k) ? k : undefined
  }
  const shortTok = longEn.replace(/\./g, '').trim().slice(0, 3)
  if (shortTok in EN_SHORT) {
    const k = EN_SHORT[shortTok]
    return k === null ? null : DAYS_ORDER.includes(k) ? k : undefined
  }
  return undefined
}

/**
 * Día de programación EVO (lunes–sábado) según calendario en Europe/Madrid.
 * Domingo → null (no hay bloque de día en la plantilla semanal).
 */
export function getMadridCoachProgramDayKey(date = new Date()) {
  const tz = 'Europe/Madrid'
  const attempts = [
    () => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long' }).format(date),
    () => new Intl.DateTimeFormat('es-ES', { timeZone: tz, weekday: 'long' }).format(date),
    () => new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(date),
  ]
  for (const fn of attempts) {
    try {
      const mapped = mapWeekdayStringToDayKey(fn())
      if (mapped !== undefined) return mapped
    } catch {
      /* siguiente */
    }
  }
  return null
}

/** True si en Madrid es domingo (para mensaje de “sin día de sala”). */
export function isMadridCalendarSunday(date = new Date()) {
  try {
    const es = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
    })
      .format(date)
      .toLowerCase()
    return es.includes('domingo')
  } catch {
    return false
  }
}

/** Etiqueta corta de fecha en Madrid (p. ej. para cabeceras). */
export function formatMadridDateShort(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(date)
  } catch {
    return ''
  }
}
