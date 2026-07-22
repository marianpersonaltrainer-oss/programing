import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER } from './excelGenerationPlan.js'

export const WEEKLY_OFFER_SCHEMA_VERSION = 1

/**
 * Oferta confirmada por Marian para la semana del 27 de julio al 2 de agosto.
 * También es el punto de partida editable de julio/agosto; nunca sustituye lo
 * que Marian marque expresamente en la parrilla de una semana concreta.
 */
export const CURRENT_WEEKLY_OFFER_CLASS_KEYS = Object.freeze({
  LUNES: Object.freeze(['evofuncional', 'evobasics', 'evofit', 'evohybrix']),
  MARTES: Object.freeze(['evofuncional', 'evofit', 'evogimnastica']),
  MIÉRCOLES: Object.freeze(['evofuncional', 'evobasics', 'evofit', 'evohybrix']),
  JUEVES: Object.freeze(['evofuncional', 'evofit']),
  VIERNES: Object.freeze(['evofuncional', 'evobasics', 'evofit']),
  SÁBADO: Object.freeze([]),
})

const CLASS_KEYS = EVO_SESSION_CLASS_DEFS.map(({ key }) => key)
const CLASS_KEY_SET = new Set(CLASS_KEYS)

function emptySelection() {
  return Object.fromEntries(
    EXCEL_DAY_ORDER.map((day) => [
      day,
      Object.fromEntries(CLASS_KEYS.map((key) => [key, false])),
    ]),
  )
}

function selectionFromClassKeysByDay(classKeysByDay) {
  const selection = emptySelection()
  for (const day of EXCEL_DAY_ORDER) {
    const keys = Array.isArray(classKeysByDay?.[day]) ? classKeysByDay[day] : []
    for (const key of keys) {
      if (CLASS_KEY_SET.has(key)) selection[day][key] = true
    }
  }
  return selection
}

export function buildCurrentWeeklyOfferSelection() {
  return selectionFromClassKeysByDay(CURRENT_WEEKLY_OFFER_CLASS_KEYS)
}

export function buildEmptyWeeklyOfferSelection() {
  return emptySelection()
}

export function getSelectedClassKeysForDay(selection, day) {
  return CLASS_KEYS.filter((key) => !!selection?.[day]?.[key])
}

export function getSelectedOfferDays(selection) {
  return EXCEL_DAY_ORDER.filter((day) => getSelectedClassKeysForDay(selection, day).length > 0)
}

/** Shape pequeño y legible que viaja dentro del JSON de la semana publicada. */
export function serializeWeeklyOfferSelection(selection) {
  return {
    version: WEEKLY_OFFER_SCHEMA_VERSION,
    dias: Object.fromEntries(
      EXCEL_DAY_ORDER.map((day) => [day, getSelectedClassKeysForDay(selection, day)]),
    ),
  }
}

/**
 * Acepta el shape actual y deja una salida booleana completa. Devuelve null si
 * no reconoce ninguna oferta explícita, para no confundir un histórico antiguo
 * con una semana seleccionada en la app.
 */
export function parseWeeklyOfferSelection(raw) {
  const source = raw?.dias && typeof raw.dias === 'object' ? raw.dias : raw
  if (!source || typeof source !== 'object') return null

  const selection = emptySelection()
  let recognizedDay = false
  for (const day of EXCEL_DAY_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(source, day)) continue
    recognizedDay = true
    const value = source[day]
    if (Array.isArray(value)) {
      for (const key of value) {
        if (CLASS_KEY_SET.has(key)) selection[day][key] = true
      }
      continue
    }
    if (value && typeof value === 'object') {
      for (const key of CLASS_KEYS) selection[day][key] = !!value[key]
    }
  }
  return recognizedDay ? selection : null
}

/** Convierte la parrilla día × clase al shape que consume validateEvoWeek. */
export function weeklyOfferSelectionToValidationOffer(selection) {
  return Object.fromEntries(
    EVO_SESSION_CLASS_DEFS.map(({ key, label }) => [
      label,
      EXCEL_DAY_ORDER.filter((day) => !!selection?.[day]?.[key]).map((day) => day.toLowerCase()),
    ]),
  )
}

function isRealSession(value) {
  const text = String(value || '').trim()
  return !!text && !/^\(no programada esta semana\)$/i.test(text) && !/^FESTIVO\b/i.test(text)
}

/**
 * Al abrir una semana, prioriza su oferta guardada. Para históricos anteriores
 * al selector, la reconstruye a partir de las sesiones reales existentes.
 */
export function weeklyOfferSelectionFromWeekData(weekData) {
  const explicit = parseWeeklyOfferSelection(weekData?.oferta_semanal)
  if (explicit) return explicit

  if (!Array.isArray(weekData?.dias)) return buildCurrentWeeklyOfferSelection()
  const inferred = emptySelection()
  let found = false
  for (const day of weekData.dias) {
    const dayName = EXCEL_DAY_ORDER.find((candidate) => candidate === String(day?.nombre || '').trim().toUpperCase())
    if (!dayName) continue
    for (const { key } of EVO_SESSION_CLASS_DEFS) {
      if (!isRealSession(day?.[key])) continue
      inferred[dayName][key] = true
      found = true
    }
  }
  return found ? inferred : buildCurrentWeeklyOfferSelection()
}
