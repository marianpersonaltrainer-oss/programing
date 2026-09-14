import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER } from './excelGenerationPlan.js'
import { normalizeWeekDataForEditor } from './normalizeWeekDataForEditor.js'
import { parseAssistantWeekJson } from './parseAssistantWeekJson.js'

function isRealSession(value) {
  const text = String(value || '').trim()
  return !!text && !/^\(no programada esta semana\)$/i.test(text) && !/^FESTIVO\b/i.test(text)
}

function selectedClassesForDay(weeklyOffer, day) {
  const values = weeklyOffer?.dias?.[day]
  return Array.isArray(values) ? [...new Set(values.map((value) => String(value || '').trim()))] : []
}

function normalizeStrictReview(raw) {
  const review = raw?.revision_evo
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    throw new Error('El borrador semanal no incluye la revisión estricta EVO.')
  }
  const status = String(review.estado || '').trim().toLowerCase()
  const controls = Array.isArray(review.controles) ? review.controles : []
  if (status !== 'revisado' || controls.length < 5) {
    throw new Error('La revisión estricta EVO está incompleta.')
  }
  for (const control of controls) {
    if (!control || typeof control !== 'object' || !String(control.nombre || '').trim() || !String(control.resultado || '').trim()) {
      throw new Error('La revisión estricta EVO contiene un control inválido.')
    }
  }
  return {
    estado: 'revisado',
    controles: controls.map((control) => ({
      nombre: String(control.nombre).trim(),
      resultado: String(control.resultado).trim(),
      detalle: String(control.detalle || '').trim(),
    })),
    ajustes_aplicados: Array.isArray(review.ajustes_aplicados)
      ? review.ajustes_aplicados.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
    pendientes_para_marian: Array.isArray(review.pendientes_para_marian)
      ? review.pendientes_para_marian.map((item) => String(item || '').trim()).filter(Boolean)
      : [],
  }
}

/**
 * Convierte el único borrador semanal del Agente Programador al formato de
 * Programing EVO. Exige toda la oferta solicitada y rechaza clases añadidas:
 * un borrador privado nunca puede sustituir ni ampliar una semana publicada.
 */
export function normalizeOwnAgentWeeklyDraft(assistantText, {
  semana,
  mesociclo,
  weeklyOffer,
} = {}) {
  const parsed = parseAssistantWeekJson(assistantText)
  const normalized = normalizeWeekDataForEditor(parsed, { semana, mesociclo })

  for (const day of EXCEL_DAY_ORDER) {
    const row = normalized.dias.find((candidate) => candidate.nombre === day)
    const expected = new Set(selectedClassesForDay(weeklyOffer, day))
    for (const { key, feedbackKey, label } of EVO_SESSION_CLASS_DEFS) {
      const hasSession = isRealSession(row?.[key])
      if (expected.has(key) && !hasSession) {
        throw new Error(`${day} · ${label}: falta una sesión completa en el borrador semanal.`)
      }
      if (!expected.has(key) && hasSession) {
        throw new Error(`${day} · ${label}: el borrador añadió una clase que no está en la oferta elegida.`)
      }
      if (expected.has(key) && !String(row?.[feedbackKey] || '').trim()) {
        throw new Error(`${day} · ${label}: falta el briefing operativo para el entrenador.`)
      }
    }
    if (row) row.wodbuster = ''
  }
  const revision_evo = normalizeStrictReview(parsed)

  return {
    ...normalized,
    titulo: String(normalized.titulo || '').trim() || `S${semana} · ${String(mesociclo || '').toUpperCase()}`,
    semana: Number(semana) || normalized.semana,
    mesociclo: String(mesociclo || normalized.mesociclo || '').trim(),
    oferta_semanal: weeklyOffer,
    revision_evo,
  }
}
