import { formatInTimeZone } from 'date-fns-tz'

const MADRID_TZ = 'Europe/Madrid'

export function madridDateParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return {
    ymd: formatInTimeZone(d, MADRID_TZ, 'yyyy-MM-dd'),
    hour: Number(formatInTimeZone(d, MADRID_TZ, 'H')),
    dayOfWeek: Number(formatInTimeZone(d, MADRID_TZ, 'i')), // 1..7 ISO (lun=1 … dom=7)
  }
}

export function isoWeekString(date = new Date()) {
  return formatInTimeZone(date, MADRID_TZ, "RRRR-'W'II")
}

/**
 * Día y hora calendario en Europe/Madrid (vía formatInTimeZone, no UTC del dispositivo).
 * `dayOfWeekIso`: token ISO `i` → 1 = lunes … 7 = domingo.
 */
export function madridCheckinGateParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return {
    hour: Number(formatInTimeZone(d, MADRID_TZ, 'H')),
    dayOfWeekIso: Number(formatInTimeZone(d, MADRID_TZ, 'i')),
    weekIso: formatInTimeZone(d, MADRID_TZ, "RRRR-'W'II"),
    weekdayLabel: formatInTimeZone(d, MADRID_TZ, 'EEEE'),
  }
}
