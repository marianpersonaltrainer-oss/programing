/**
 * POST /api/import-exercise-library-xlsx
 *
 * Importación masiva de ejercicios a `coach_exercise_library` desde uno o varios .xlsx de
 * programación semanal. Extrae nombres de ejercicio del texto, descarta los que ya existen,
 * adivina categoría/nivel, busca un vídeo verificado en YouTube y los da de alta (service role).
 *
 * Body JSON:
 * - secret (obligatorio) — COACH_GUIDE_ADMIN_SECRET
 * - files: [{ name, base64 }] — uno o varios .xlsx en base64
 * - maxResolve (opcional, default 60) — cuántos vídeos buscar como máximo en esta pasada
 * - resolveVideos (opcional, default true)
 *
 * Variables: COACH_GUIDE_ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL o VITE_SUPABASE_URL
 */

import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { excelCellPlainString } from '../src/utils/excelWorkbookRead.js'
import { normalizeXlsxBuffer } from '../src/utils/normalizeXlsxBuffer.js'
import {
  extractExerciseNamesFromText,
  normalizeExerciseKey,
  guessExerciseCategory,
  guessExerciseLevel,
} from '../src/utils/exerciseNameExtraction.js'
import { resolveVerifiedWatchUrl } from './lib/youtubeResolve.js'

export const config = { api: { bodyParser: { sizeLimit: '24mb' } } }

const TIME_BUDGET_MS = 220_000
const RESOLVE_CONCURRENCY = 4

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

async function workbookToText(buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await normalizeXlsxBuffer(buffer))
  const parts = []
  wb.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const s = excelCellPlainString(cell)
        if (s && s.trim()) parts.push(s)
      })
    })
  })
  return parts.join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const serverSecret = (process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (!serverSecret || !serviceKey || !supabaseUrl) {
    return res.status(500).json({
      error: 'Servidor sin configurar: COACH_GUIDE_ADMIN_SECRET, SUPABASE_SERVICE_ROLE_KEY y URL de Supabase.',
    })
  }

  const body = parseBody(req)
  if (body === null) return res.status(400).json({ error: 'JSON inválido' })

  const { secret, files, maxResolve = 60, resolveVideos = true } = body || {}
  if (!secret || String(secret).trim() !== serverSecret) {
    return res.status(401).json({ error: 'Clave de administración incorrecta' })
  }
  if (!Array.isArray(files) || files.length === 0) {
    return res.status(400).json({ error: 'Sube al menos un archivo .xlsx' })
  }

  const startedAt = Date.now()

  // 1) Extraer nombres de todos los archivos
  const nameByKey = new Map() // key -> nombre original (primero visto)
  const fileErrors = []
  for (const f of files) {
    const b64 = typeof f?.base64 === 'string' ? f.base64 : ''
    if (!b64) continue
    let buffer
    try {
      buffer = Buffer.from(b64, 'base64')
    } catch {
      fileErrors.push({ name: f?.name || '?', error: 'base64 inválido' })
      continue
    }
    try {
      const text = await workbookToText(buffer)
      for (const name of extractExerciseNamesFromText(text)) {
        const key = normalizeExerciseKey(name)
        if (key && !nameByKey.has(key)) nameByKey.set(key, name)
      }
    } catch (e) {
      fileErrors.push({ name: f?.name || '?', error: (e?.message || String(e)).slice(0, 200) })
    }
  }

  if (nameByKey.size === 0) {
    return res.status(200).json({
      ok: true,
      summary: { extracted: 0, added: 0, alreadyExisting: 0, withVideo: 0, withoutVideo: 0 },
      fileErrors,
      message: 'No se detectaron ejercicios en los archivos. ¿Tienen el formato de programación semanal?',
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 2) Descartar los que ya existen (por nombre normalizado)
  const { data: existing, error: listErr } = await supabase.from('coach_exercise_library').select('name')
  if (listErr) return res.status(500).json({ error: `No se pudo leer la biblioteca: ${listErr.message}` })
  const existingKeys = new Set((existing || []).map((r) => normalizeExerciseKey(r.name)))

  const newEntries = []
  let alreadyExisting = 0
  for (const [key, name] of nameByKey) {
    if (existingKeys.has(key)) {
      alreadyExisting += 1
      continue
    }
    newEntries.push({ key, name })
  }

  // 3) Resolver vídeo (verificado) para los nuevos, con presupuesto de tiempo
  const resolveCap = Math.max(0, Math.min(200, Number(maxResolve) || 0))
  const videoByKey = new Map()
  if (resolveVideos && resolveCap > 0) {
    const toResolve = newEntries.slice(0, resolveCap)
    for (let i = 0; i < toResolve.length; i += RESOLVE_CONCURRENCY) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break
      const chunk = toResolve.slice(i, i + RESOLVE_CONCURRENCY)
      const results = await Promise.all(
        chunk.map(async ({ key, name }) => {
          const { url } = await resolveVerifiedWatchUrl(name, { maxAttempts: 8 })
          return { key, url }
        }),
      )
      for (const { key, url } of results) {
        if (url) videoByKey.set(key, url)
      }
    }
  }

  // 4) Insertar
  const rows = newEntries.map(({ key, name }) => {
    const video_url = videoByKey.get(key) || null
    return {
      name,
      category: guessExerciseCategory(name),
      level: guessExerciseLevel(name),
      classes: [],
      notes: null,
      is_new: true,
      active: true,
      video_url,
      video_url_verified: true,
    }
  })

  let added = 0
  const insertErrors = []
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { data, error } = await supabase.from('coach_exercise_library').insert(batch).select('id')
    if (error) {
      insertErrors.push(error.message)
    } else {
      added += data?.length || 0
    }
  }

  const withVideo = rows.filter((r) => r.video_url).length
  return res.status(200).json({
    ok: insertErrors.length === 0,
    summary: {
      extracted: nameByKey.size,
      newCandidates: newEntries.length,
      added,
      alreadyExisting,
      withVideo,
      withoutVideo: added - withVideo,
      resolveCap,
    },
    sampleAdded: rows.slice(0, 20).map((r) => ({ name: r.name, category: r.category, hasVideo: !!r.video_url })),
    fileErrors,
    insertErrors,
    message:
      insertErrors.length === 0
        ? `Añadidos ${added} ejercicios (${withVideo} con vídeo). ${alreadyExisting} ya existían.`
        : 'Importación con errores; revisa insertErrors.',
  })
}
