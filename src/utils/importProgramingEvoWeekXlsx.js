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

function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .trim()
}

function dayFromAnyCell(row) {
  if (!row) return null
  for (let c = 1; c <= Math.max(10, row.cellCount || 0); c += 1) {
    const v = cellToPlainString(row.getCell(c)).trim()
    const d = canonDayFromRow(v)
    if (d) return d
  }
  return null
}

function detectClassHeaderMap(sheet, maxR) {
  for (let r = 1; r <= Math.min(maxR, 80); r += 1) {
    const row = sheet.getRow(r)
    const map = new Map()
    for (let c = 1; c <= Math.max(12, row.cellCount || 0); c += 1) {
      const t = normalizeText(cellToPlainString(row.getCell(c)))
      if (!t) continue
      for (const cls of ALL_CLASSES) {
        if (normalizeText(cls.label) === t) map.set(cls.key, c)
      }
    }
    if (map.size >= 3) return { rowIdx: r, byClassKey: map }
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

function normalizeExerciseName(raw) {
  return String(raw || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/@\s*[\w.,+-/:%]+/g, ' ')
    .replace(/\b\d+\s*(kg|kgs|lb|lbs|m|s|seg|min|reps?)\b/gi, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseBibliotecaVideoMap(workbook) {
  const ws = workbook.getWorksheet('Biblioteca EVO')
  if (!ws) return new Map()

  const maxR = ws.lastRow?.number || 0
  if (maxR < 2) return new Map()

  // Intenta localizar columnas por cabecera; fallback al formato generado (B=ejercicio, E=video).
  let headerRowIdx = 2
  let nameCol = 2
  let videoCol = 5
  for (let r = 1; r <= Math.min(maxR, 6); r += 1) {
    const row = ws.getRow(r)
    const cols = [1, 2, 3, 4, 5, 6, 7].map((c) => cellToPlainString(row.getCell(c)).trim().toLowerCase())
    const idxName = cols.findIndex((x) => x.includes('ejercicio') || x.includes('exercise'))
    const idxVid = cols.findIndex((x) => x.includes('video') || x.includes('vídeo') || x.includes('url'))
    if (idxName >= 0 && idxVid >= 0) {
      headerRowIdx = r
      nameCol = idxName + 1
      videoCol = idxVid + 1
      break
    }
  }

  const map = new Map()
  for (let r = headerRowIdx + 1; r <= maxR; r += 1) {
    const rr = ws.getRow(r)
    const name = cellToPlainString(rr.getCell(nameCol)).trim()
    const video = cellToPlainString(rr.getCell(videoCol)).trim()
    if (!name || !/^https?:\/\//i.test(video)) continue
    const norm = normalizeExerciseName(name)
    if (norm) map.set(norm, video)
  }
  return map
}

function extractExerciseCandidates(text) {
  const raw = String(text || '').trim()
  if (!raw) return []
  const stripped = raw
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/PARTE\s+[AB]\s*:?\s*/gi, '\n')
    .replace(/FEEDBACK\s*:?\s*/gi, '\n')
  const chunks = stripped
    .split(/\n|•|·|,|;/g)
    .map((x) => x.trim())
    .filter(Boolean)
  const out = []
  const seen = new Set()
  for (const ch of chunks) {
    const clean = ch
      .replace(/^[\-\d.)\s]+/, '')
      .replace(/@\s*[\w.,+-/:%]+/g, '')
      .replace(/\([^)]*\)/g, '')
      .trim()
    if (clean.length < 3) continue
    if (/^(calentamiento|movilidad|bloque|for time|amrap|emom|cap|descanso|tiempo|round|rondas?)$/i.test(clean)) continue
    const norm = normalizeExerciseName(clean)
    if (!norm || norm.length < 3 || seen.has(norm)) continue
    seen.add(norm)
    out.push({ raw: clean, norm })
  }
  return out
}

function bestVideoForExercise(normName, bibMap) {
  if (!normName) return null
  if (bibMap.has(normName)) return bibMap.get(normName)
  let best = null
  let bestLen = 0
  for (const [k, url] of bibMap.entries()) {
    if (!k) continue
    if (normName.includes(k) || k.includes(normName)) {
      if (k.length > bestLen) {
        bestLen = k.length
        best = url
      }
    }
  }
  return best
}

function stripVideoAppendix(sessionText) {
  return String(sessionText || '')
    .replace(/\n{0,2}VIDEOS DE REFERENCIA:[\s\S]*$/i, '')
    .trim()
}

function attachVideoAppendix(sessionText, refs) {
  const base = stripVideoAppendix(sessionText)
  if (!refs || refs.length === 0) return base
  const lines = ['VIDEOS DE REFERENCIA:']
  for (const r of refs) lines.push(`- ${r.exercise} — ${r.url}`)
  return `${base}\n\n${lines.join('\n')}`.trim()
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
  const classByCol = new Map(ALL_CLASSES.map((cls, i) => [i + 1, cls]))
  const bibVideoMap = parseBibliotecaVideoMap(wb)

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

    // Soporta layout "PARTE A / PARTE B / FEEDBACK" con col A etiquetas y B-H clases.
    const block = { ...session, ...feedback, nombre: dayCanon }
    const candidateRows = [sheet.getRow(r + 2), sheet.getRow(r + 3), sheet.getRow(r + 4), sheet.getRow(r + 5)]
    const hasPartLabels = candidateRows.some((rw) => /PARTE\s*A|PARTE\s*B|FEEDBACK/i.test(cellToPlainString(rw.getCell(1))))
    if (hasPartLabels) {
      const partsA = {}
      const partsB = {}
      const fbs = {}
      let rrScan = r + 1
      while (rrScan <= Math.min(maxR, r + 14)) {
        const label = cellToPlainString(sheet.getRow(rrScan).getCell(1)).trim().toUpperCase()
        if (rrScan > r + 1 && canonDayFromRow(label)) break
        if (!/(PARTE\s*A|PARTE\s*B|FEEDBACK)/i.test(label)) {
          rrScan += 1
          continue
        }
        for (let c = 2; c <= 8; c += 1) {
          const cls = classByCol.get(c - 1)
          if (!cls) continue
          const text = normalizeSessionCell(cellToPlainString(sheet.getRow(rrScan).getCell(c)))
          if (/PARTE\s*A/i.test(label)) partsA[cls.key] = text
          if (/PARTE\s*B/i.test(label)) partsB[cls.key] = text
          if (/FEEDBACK/i.test(label)) fbs[cls.feedbackKey] = text
        }
        rrScan += 1
      }
      ALL_CLASSES.forEach((cls) => {
        const pa = String(partsA[cls.key] || '').trim()
        const pb = String(partsB[cls.key] || '').trim()
        const fb = String(fbs[cls.feedbackKey] || '').trim()
        if (pa || pb) {
          const merged = [pa ? `PARTE A\n${pa}` : '', pb ? `PARTE B\n${pb}` : ''].filter(Boolean).join('\n\n')
          block[cls.key] = merged || block[cls.key] || '(no programada esta semana)'
        }
        if (fb) block[cls.feedbackKey] = fb
      })
    }

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

    byDay.set(dayCanon, block)
    r = rr
  }

  // Fallback tolerante para excels con layout distinto (día/etiquetas fuera de col A).
  if (byDay.size === 0) {
    const hdr = detectClassHeaderMap(sheet, maxR)
    if (hdr) {
      const dayRows = []
      for (let rr = 1; rr <= maxR; rr += 1) {
        const d = dayFromAnyCell(sheet.getRow(rr))
        if (d) dayRows.push({ row: rr, day: d })
      }
      for (let i = 0; i < dayRows.length; i += 1) {
        const start = dayRows[i].row
        const dayCanon = dayRows[i].day
        const end = i + 1 < dayRows.length ? dayRows[i + 1].row - 1 : Math.min(maxR, start + 26)
        const block = { nombre: dayCanon }
        for (const cls of ALL_CLASSES) {
          block[cls.key] = ''
          block[cls.feedbackKey] = ''
        }

        // Intento A/B/Feedback por filas etiqueta (en cualquier columna)
        let gotLabeledRows = false
        for (let rr = start + 1; rr <= end; rr += 1) {
          const row = sheet.getRow(rr)
          let label = ''
          for (let c = 1; c <= Math.max(10, row.cellCount || 0); c += 1) {
            const t = normalizeText(cellToPlainString(row.getCell(c)))
            if (/PARTE\s*A/.test(t)) label = 'A'
            if (/PARTE\s*B/.test(t)) label = 'B'
            if (/FEEDBACK/.test(t)) label = 'F'
            if (label) break
          }
          if (!label) continue
          gotLabeledRows = true
          for (const cls of ALL_CLASSES) {
            const col = hdr.byClassKey.get(cls.key)
            if (!col) continue
            const txt = normalizeSessionCell(cellToPlainString(row.getCell(col)))
            if (!txt) continue
            if (label === 'A') {
              block[cls.key] = [block[cls.key], `PARTE A\n${txt}`].filter(Boolean).join('\n\n')
            } else if (label === 'B') {
              block[cls.key] = [block[cls.key], `PARTE B\n${txt}`].filter(Boolean).join('\n\n')
            } else if (label === 'F') {
              block[cls.feedbackKey] = txt
            }
          }
        }

        // Intento legacy: una fila de contenido + una de feedback (si no hubo A/B explícitos)
        if (!gotLabeledRows) {
          const contentRowIdx = Math.min(end, hdr.rowIdx + 1 > start ? hdr.rowIdx + 1 : start + 1)
          const feedbackRowIdx = Math.min(end, contentRowIdx + 1)
          const contentRow = sheet.getRow(contentRowIdx)
          const feedbackRow = sheet.getRow(feedbackRowIdx)
          for (const cls of ALL_CLASSES) {
            const col = hdr.byClassKey.get(cls.key)
            if (!col) continue
            const txt = normalizeSessionCell(cellToPlainString(contentRow.getCell(col)))
            if (txt) block[cls.key] = txt
            const fb = stripFeedbackHeader(cellToPlainString(feedbackRow.getCell(col)), cls.label)
            if (/FEEDBACK/i.test(cellToPlainString(feedbackRow.getCell(col))) || fb) {
              block[cls.feedbackKey] = fb
            }
          }
        }

        byDay.set(dayCanon, block)
      }
    }
  }

  if (byDay.size === 0) {
    throw new Error(
      'No se pudo detectar la estructura de días/clases en el Excel. Revisa que incluya LUNES-SÁBADO y columnas de clases EVO.',
    )
  }

  const missingOut = []
  let linkedCount = 0
  const missingSeen = new Set()

  const dias = (baseWeekData?.dias || []).map((dia) => {
    const name = normalizeDayName(dia?.nombre)
    const hit = [...byDay.entries()].find(([k]) => normalizeDayName(k) === name)
    if (!hit) return dia
    const [, patch] = hit
    const next = { ...dia }
    for (const cls of ALL_CLASSES) {
      if (Object.prototype.hasOwnProperty.call(patch, cls.key)) {
        const baseText = patch[cls.key] || '(no programada esta semana)'
        const candidates = extractExerciseCandidates(baseText)
        const refs = []
        for (const cand of candidates) {
          const url = bestVideoForExercise(cand.norm, bibVideoMap)
          if (url) {
            refs.push({ exercise: cand.raw, url })
          } else {
            const missKey = `${normalizeDayName(dia?.nombre)}::${cls.label}::${cand.norm}`
            if (!missingSeen.has(missKey)) {
              missingSeen.add(missKey)
              missingOut.push({
                exercise_name: cand.raw,
                exercise_norm: cand.norm,
                day_name: String(dia?.nombre || '').trim(),
                day_key: canonDayFromRow(dia?.nombre) || null,
                class_label: cls.label,
              })
            }
          }
        }
        linkedCount += refs.length
        next[cls.key] = attachVideoAppendix(baseText, refs) || '(no programada esta semana)'
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

  return {
    data,
    warnings,
    importReport: {
      sessionsImported: dias.length * ALL_CLASSES.length,
      videosLinked: linkedCount,
      bibliotecaMatches: bibVideoMap.size,
      missingExercises: missingOut,
      missingCount: missingOut.length,
    },
  }
}
