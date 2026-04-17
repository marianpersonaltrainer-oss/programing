import { formatInTimeZone } from 'date-fns-tz'

export function madridDateParts(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return {
    ymd: formatInTimeZone(d, 'Europe/Madrid', 'yyyy-MM-dd'),
    hour: Number(formatInTimeZone(d, 'Europe/Madrid', 'H')),
    dayOfWeek: Number(formatInTimeZone(d, 'Europe/Madrid', 'i')), // 1..7
  }
}

export function isoWeekString(date = new Date()) {
  return formatInTimeZone(date, 'Europe/Madrid', "RRRR-'W'II")
}
