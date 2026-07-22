import { es } from 'date-fns/locale'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'

export const MADRID_TIME_ZONE = 'Europe/Madrid'

function parseYmd(ymd) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  if (!match) throw new Error('La fecha debe tener el formato AAAA-MM-DD.')
  const [, year, month, day] = match
  const probe = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (
    probe.getUTCFullYear() !== Number(year)
    || probe.getUTCMonth() !== Number(month) - 1
    || probe.getUTCDate() !== Number(day)
  ) {
    throw new Error('La fecha no es válida.')
  }
  return { year: Number(year), month: Number(month), day: Number(day) }
}

function nextUtcCalendarYmd({ year, month, day }) {
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export function madridTodayYmd(date = new Date()) {
  return formatInTimeZone(date, MADRID_TIME_ZONE, 'yyyy-MM-dd')
}

export function madridDayUtcRange(ymd) {
  const parts = parseYmd(ymd)
  const nextYmd = nextUtcCalendarYmd(parts)
  return {
    start: fromZonedTime(`${ymd}T00:00:00`, MADRID_TIME_ZONE).toISOString(),
    end: fromZonedTime(`${nextYmd}T00:00:00`, MADRID_TIME_ZONE).toISOString(),
  }
}

export function formatShiftLogMadrid(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return formatInTimeZone(date, MADRID_TIME_ZONE, "d 'de' MMMM · HH:mm", { locale: es })
}

export function formatMadridDayHeading(ymd) {
  const { start } = madridDayUtcRange(ymd)
  return formatInTimeZone(new Date(start), MADRID_TIME_ZONE, "EEEE, d 'de' MMMM", { locale: es })
}
