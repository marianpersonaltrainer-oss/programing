import ExcelJS from 'exceljs'
import { ALL_CLASSES } from '../constants/evoClasses.js'
import { EXCEL_DAY_ORDER } from './excelGenerationPlan.js'

function cellToPlainString(cell) {
  if (!cell) return ''
  const v = cell.value
  if (v == null || v === '') return ''
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object' && Array.isArray(v.richText)) {
    return v.richText.map((t) => (t && t.text) || '').join('')
  }
  if (typeof v === 'object' && v.text != null) return String(v.text)
  if (typeof v === 'object' && v.result != null) return String(v.result)
  return ''
}

function normalizeDayName(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

function canonDayFromRow(s) {
  const n = normalizeDayName(s)
  for (const d of EXCEL_DAY_ORDER) {
    if (normalizeDayName(d) === n) return d
  }
  return null
}

/** Quita cabecera "FEEDBACK EvoFuncional\n" del texto plano de la celda. */
function stripFeedbackHeader(plain, classLabel) {
  let t = plain.trim()
  const re = new RegExp(`^FEEDBACK\\s+${classLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i')
  t = t.replace(re, '').trim()
  t = t.replace(/^FEEDBACK\s+\S+\s*/i, '').trim()
  return t
}

function normalizeSessionCell(raw) {
  const t = String(raw || '').trim()
  if (!t) return ''
  if (/^\s*Evo\w+\s*\n\s*\(no programada esta semana\)\s*$/i.test(t)) return '(no programada esta semana)'
  return t
}

/**
 * Lee un .xlsx generado por ProgramingEvo (`generateExcel` / `buildWeekExportWorkbook`): hoja de semana
 * (no "Biblioteca EVO") y fusiona sesiones + feedbacks en `baseWeekData` por nombre de día.
 *
 * @param {ArrayBuffer} buffer
 * @param {object} baseWeekData — semana actual del modal (se conserva resumen y días no encontrados)
 * @returns {Promise<{ data: object, warnings: string[] }>}
 */
export async function importProgramingEvoWeekFromXlsxBuffer(buffer, baseWeekData) {
  const warnings = []
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)

  const sheet =
    wb.worksheets.find((w) => w && w.name && !/^biblioteca/i.test(String(w.name).trim())) ||
    wb.worksheets[0]
  if (!sheet) {
    throw new Error('El archivo no tiene ninguna hoja legible.')
  }

  const maxR = sheet.lastRow?.number || 0
  if (maxR < 8) {
    throw new Error('El Excel parece vacío o no es el export de ProgramingEvo.')
  }

  const titulo = cellToPlainString(sheet.getRow(1).getCell(1)).trim()
  const byDay = new Map()

  let r = 1
  while (r <= maxR) {
    const row = sheet.getRow(r)
    const v1 = cellToPlainString(row.getCell(1)).trim()
    const dayCanon = v1.length <= 12 ? canonDayFromRow(v1) : null

    if (!dayCanon) {
      r += 1
      continue
    }

    const headerRow = sheet.getRow(r + 1)
    const h1 = cellToPlainString(headerRow.getCell(1)).trim()
    if (!/^Evo/i.test(h1)) {
      warnings.push(`Fila ${r}: se leyó «${dayCanon}» pero la siguiente no parece cabecera de clases; se omite.`)
      r += 1
      continue
    }

    const contentRow = sheet.getRow(r + 2)
    const session = {}
    const feedback = {}
    ALL_CLASSES.forEach((cls, i) => {
      const c = i + 1
      session[cls.key] = normalizeSessionCell(cellToPlainString(contentRow.getCell(c)))
      feedback[cls.feedbackKey] = ''
    })

    let rr = r + 3
    const fbRow = rr <= maxR ? sheet.getRow(rr) : null
    let hasFeedbackRow = false
    if (fbRow) {
      const sample = ALL_CLASSES.map((cls, i) => cellToPlainString(fbRow.getCell(i + 1))).join(' ')
      if (/FEEDBACK/i.test(sample)) {
        hasFeedbackRow = true
        ALL_CLASSES.forEach((cls, i) => {
          const plain = cellToPlainString(fbRow.getCell(i + 1))
          const inner = stripFeedbackHeader(plain, cls.label)
          feedback[cls.feedbackKey] = inner
        })
        rr += 1
      }
    }

    if (rr <= maxR) {
      const vid = cellToPlainString(sheet.getRow(rr).getCell(1))
      if (vid.includes('📎') || /vídeo de referencia/i.test(vid)) {
        rr += 1
      }
    }

    byDay.set(dayCanon, { ...session, ...feedback, nombre: dayCanon })
    r = rr
  }

  if (byDay.size === 0) {
    throw new Error(
      'No se encontraron bloques LUNES…SÁBADO con el formato del export. ¿Es el Excel descargado desde esta app?',
    )
  }

  const dias = (baseWeekData?.dias || []).map((dia) => {
    const name = normalizeDayName(dia?.nombre)
    const hit = [...byDay.entries()].find(([k]) => normalizeDayName(k) === name)
    if (!hit) return dia
    const [, patch] = hit
    const next = { ...dia }
    for (const cls of ALL_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(patch, cls.key)) {
        next[cls.key] = patch[cls.key] || '(no programada esta semana)'
      }
      if (Object.prototype.hasOwnProperty.call(patch, cls.feedbackKey)) {
        next[cls.feedbackKey] = patch[cls.feedbackKey] || ''
      }
    }
    return next
  })

  const data = {
    ...baseWeekData,
    dias,
    ...(titulo ? { titulo } : {}),
  }

  return { data, warnings }
}
