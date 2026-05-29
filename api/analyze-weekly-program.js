/**
 * VERCEL SERVERLESS FUNCTION: api/analyze-weekly-program.js
 *
 * Analiza un .xlsx de programación semanal EN EL SERVIDOR (Node), donde ExcelJS funciona de
 * forma fiable. En el navegador, `wb.xlsx.load()` falla al parsear el workbook
 * («Cannot read properties of undefined (reading 'sheets')»), así que el cliente sube aquí el
 * archivo (base64) y recibe el resultado del análisis ya calculado.
 *
 * Body JSON:
 * - fileBase64 (obligatorio) — contenido del .xlsx en base64
 * - mesocycle, week, phase — metadatos de la semana
 * - scope — { partialWeek, activeClassesOnly, draftMode, experienciaEvo }
 * - previousWeekData, historicalWeeksData — contexto ya leído por el cliente (Supabase)
 */

import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import { analyzeWeeklyProgramXlsx } from '../src/utils/analyzeWeeklyProgramXlsx.js'

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed' })
  }

  const body = parseBody(req)
  if (body === null) {
    return res.status(400).json({ error: 'Cuerpo de la petición no es JSON válido.' })
  }

  const {
    fileBase64,
    mesocycle,
    week,
    phase = '',
    scope = {},
    previousWeekData = null,
    historicalWeeksData = [],
  } = body || {}

  if (!fileBase64 || typeof fileBase64 !== 'string') {
    return res.status(400).json({ error: 'Falta el archivo (fileBase64).' })
  }

  let buffer
  try {
    buffer = Buffer.from(fileBase64, 'base64')
  } catch {
    return res.status(400).json({ error: 'El archivo no es base64 válido.' })
  }
  if (!buffer || !buffer.length) {
    return res.status(400).json({ error: 'El archivo está vacío.' })
  }

  try {
    const out = await analyzeWeeklyProgramXlsx({
      buffer,
      mesocycle,
      week: Number(week),
      phase,
      previousWeekData: previousWeekData || null,
      historicalWeeksData: Array.isArray(historicalWeeksData) ? historicalWeeksData : [],
      scope: scope || {},
    })
    return res.status(200).json(out)
  } catch (e) {
    const msg = e?.message || String(e)
    console.error('[analyze-weekly-program]', msg)
    return res.status(500).json({ error: `No se pudo analizar el Excel: ${msg}`.slice(0, 800) })
  }
}
