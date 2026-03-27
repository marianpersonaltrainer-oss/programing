import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { EXERCISE_VIDEOS, EXERCISE_CATEGORIES, findExercisesWithVideos } from '../constants/exerciseVideos.js'

// ── Definición de todas las clases EVO ────────────────────────────────────────
export const ALL_CLASSES = [
  { key: 'evofuncional',  feedbackKey: 'feedback_funcional',  label: 'EvoFuncional',   bg: 'FF2F7BBE' },
  { key: 'evobasics',     feedbackKey: 'feedback_basics',     label: 'EvoBasics',      bg: 'FFE07B39' },
  { key: 'evofit',        feedbackKey: 'feedback_fit',        label: 'EvoFit',         bg: 'FF2FBE7B' },
  { key: 'evohybrix',     feedbackKey: 'feedback_hybrix',     label: 'EvoHybrix',      bg: 'FFBE2F2F' },
  { key: 'evofuerza',     feedbackKey: 'feedback_fuerza',     label: 'EvoFuerza',      bg: 'FF78350F' },
  { key: 'evogimnastica', feedbackKey: 'feedback_gimnastica', label: 'EvoGimnástica',  bg: 'FF4C1D95' },
]

const C = {
  titleBg:       'FF4B0082',
  titleText:     'FFFFFFFF',
  resumeBg:      'FFF5F0FF',
  resumeLabel:   'FF6B21A8',
  resumeText:    'FF1A1A1A',
  resumeBorder:  'FFD8B4FE',
  dayBg:         'FF1A1A2E',
  dayText:       'FFFFFFFF',
  classText:     'FFFFFFFF',
  contentBg:     'FFFFFFFF',
  emptyBg:       'FFF9FAFB',
  contentText:   'FF1A1A1A',
  feedbackBg:    'FFFFFBEB',
  feedbackText:  'FF78350F',
  feedbackBorder:'FFFDE68A',
  border:        'FFD4D4D4',
}

const COL_LETTERS = ['A','B','C','D','E','F']

function fill(cell, argb) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}
function fnt(cell, { bold = false, size = 9, color = C.contentText, italic = false } = {}) {
  cell.font = { bold, size, color: { argb: color }, name: 'Arial', italic }
}
function aln(cell, { h = 'left', v = 'top', wrap = true } = {}) {
  cell.alignment = { horizontal: h, vertical: v, wrapText: wrap }
}
function brd(cell, color = C.border) {
  const s = { style: 'thin', color: { argb: color } }
  cell.border = { top: s, left: s, bottom: s, right: s }
}
function rowH(sheet, r, h) {
  sheet.getRow(r).height = h
}

function writeWeekToSheet(sheet, weekData) {
  const n = ALL_CLASSES.length
  const lastCol = COL_LETTERS[n - 1]

  // Columnas — una por clase
  sheet.columns = ALL_CLASSES.map((cls) => ({ key: cls.key, width: 52 }))

  let r = 1

  // ── TÍTULO ─────────────────────────────────────────────────────────────────
  sheet.mergeCells(`A${r}:${lastCol}${r}`)
  rowH(sheet, r, 36)
  const tCell = sheet.getRow(r).getCell(1)
  tCell.value = weekData.titulo || `S${weekData.semana} – MESOCICLO ${(weekData.mesociclo || '').toUpperCase()}`
  fill(tCell, C.titleBg)
  fnt(tCell, { bold: true, size: 13, color: C.titleText })
  aln(tCell, { h: 'center', v: 'middle', wrap: false })
  r++

  // ── RESUMEN ─────────────────────────────────────────────────────────────────
  const res = weekData.resumen
  if (res) {
    sheet.mergeCells(`A${r}:${lastCol}${r}`)
    rowH(sheet, r, 18)
    const resHdr = sheet.getRow(r).getCell(1)
    resHdr.value = 'RESUMEN DE SEMANA'
    fill(resHdr, C.resumeLabel)
    fnt(resHdr, { bold: true, size: 8, color: C.titleText })
    aln(resHdr, { h: 'center', v: 'middle', wrap: false })
    brd(resHdr, C.resumeBorder)
    r++

    rowH(sheet, r, 52)
    const resRow = sheet.getRow(r)
    // Distribuir en 3 celdas aunque haya más columnas
    const resMergeEnd = COL_LETTERS[Math.floor(n / 3) * 1 - 1] || 'B'
    const resDefs = [
      { col: 1, label: 'ESTÍMULO', value: res.estimulo },
      { col: Math.ceil(n / 3) + 1, label: 'INTENSIDAD · FOCO', value: `${res.intensidad || ''}  ·  ${res.foco || ''}` },
      { col: Math.ceil(n * 2 / 3) + 1, label: 'NOTA PARA EL COACH', value: res.nota },
    ]
    // Simplificado: 3 celdas sin merge para el resumen
    for (const { col, label, value } of resDefs) {
      if (col > n) continue
      const cell = resRow.getCell(col)
      cell.value = {
        richText: [
          { text: label + '\n', font: { bold: true, size: 8, color: { argb: C.resumeLabel }, name: 'Arial' } },
          { text: value || '', font: { size: 9, color: { argb: C.resumeText }, name: 'Arial' } },
        ],
      }
      fill(cell, C.resumeBg)
      aln(cell, { h: 'left', v: 'top', wrap: true })
      brd(cell, C.resumeBorder)
    }
    // Rellenar celdas vacías del resumen
    for (let c = 1; c <= n; c++) {
      const isUsed = resDefs.some((d) => d.col === c)
      if (!isUsed) {
        const cell = resRow.getCell(c)
        fill(cell, C.resumeBg)
        brd(cell, C.resumeBorder)
      }
    }
    r++

    rowH(sheet, r, 6)
    r++
  }

  // ── DÍAS ────────────────────────────────────────────────────────────────────
  for (const dia of (weekData.dias || [])) {
    // Espacio
    rowH(sheet, r, 7)
    r++

    // Cabecera día
    sheet.mergeCells(`A${r}:${lastCol}${r}`)
    rowH(sheet, r, 26)
    const dCell = sheet.getRow(r).getCell(1)
    dCell.value = dia.nombre
    fill(dCell, C.dayBg)
    fnt(dCell, { bold: true, size: 11, color: C.dayText })
    aln(dCell, { h: 'center', v: 'middle', wrap: false })
    r++

    // Cabecera clases
    rowH(sheet, r, 22)
    const hRow = sheet.getRow(r)
    ALL_CLASSES.forEach((cls, i) => {
      const cell = hRow.getCell(i + 1)
      cell.value = cls.label
      fill(cell, cls.bg)
      fnt(cell, { bold: true, size: 10, color: C.classText })
      aln(cell, { h: 'center', v: 'middle', wrap: false })
      brd(cell)
    })
    r++

    // Contenido
    rowH(sheet, r, 460)
    const cRow = sheet.getRow(r)
    ALL_CLASSES.forEach((cls, i) => {
      const cell = cRow.getCell(i + 1)
      const text = dia[cls.key]
      cell.value = text || ''
      fill(cell, text ? C.contentBg : C.emptyBg)
      fnt(cell, { size: 9, color: text ? C.contentText : 'FFAAAAAA', italic: !text })
      aln(cell, { h: 'left', v: 'top', wrap: true })
      brd(cell)
      if (!text) {
        cell.value = cls.label + '\n(no programada esta semana)'
      }
    })
    r++

    // Feedback
    const hasFeedback = ALL_CLASSES.some((cls) => dia[cls.feedbackKey])
    if (hasFeedback) {
      rowH(sheet, r, 80)
      const fRow = sheet.getRow(r)
      ALL_CLASSES.forEach((cls, i) => {
        const cell = fRow.getCell(i + 1)
        const text = dia[cls.feedbackKey]
        if (text) {
          cell.value = {
            richText: [
              { text: `FEEDBACK ${cls.label}\n`, font: { bold: true, size: 8, color: { argb: C.feedbackText }, name: 'Arial' } },
              { text, font: { size: 8.5, color: { argb: 'FF44200A' }, name: 'Arial', italic: true } },
            ],
          }
          fill(cell, C.feedbackBg)
        } else {
          fill(cell, 'FFFEFCE8')
        }
        aln(cell, { h: 'left', v: 'top', wrap: true })
        brd(cell, C.feedbackBorder)
      })
      r++
    }

    // Vídeos del día
    const allText = ALL_CLASSES.map((cls) => dia[cls.key] || '').join(' ')
    const videos = findExercisesWithVideos(allText)
    if (videos.length > 0) {
      rowH(sheet, r, 18)
      sheet.mergeCells(`A${r}:${lastCol}${r}`)
      const vCell = sheet.getRow(r).getCell(1)
      vCell.value = `📎  ${videos.length} ejercicios con vídeo de referencia en este día → Ver pestaña "Biblioteca EVO"`
      fill(vCell, 'FFEFF6FF')
      fnt(vCell, { size: 8, color: 'FF1D4ED8', italic: true })
      aln(vCell, { h: 'left', v: 'middle', wrap: false })
      brd(vCell, 'FFBFDBFE')
      r++
    }
  }
}

function writeBibliotecaSheet(workbook) {
  if (workbook.getWorksheet('Biblioteca EVO')) return

  const sheet = workbook.addWorksheet('Biblioteca EVO')
  sheet.columns = [
    { key: 'categoria', width: 22 },
    { key: 'ejercicio', width: 35 },
    { key: 'video',     width: 22 },
  ]

  sheet.mergeCells('A1:C1')
  const t = sheet.getRow(1).getCell(1)
  t.value = 'BIBLIOTECA DE VÍDEOS EVO'
  fill(t, 'FF4B0082')
  fnt(t, { bold: true, size: 12, color: 'FFFFFFFF' })
  aln(t, { h: 'center', v: 'middle', wrap: false })
  sheet.getRow(1).height = 28

  const hRow = sheet.getRow(2)
  for (const [i, label] of ['CATEGORÍA','EJERCICIO','VER VÍDEO'].entries()) {
    const cell = hRow.getCell(i + 1)
    cell.value = label
    fill(cell, 'FF1A1A2E')
    fnt(cell, { bold: true, size: 9, color: 'FFFFFFFF' })
    aln(cell, { h: 'center', v: 'middle', wrap: false })
    brd(cell)
  }
  sheet.getRow(2).height = 20

  const catLabels = {
    calentamiento: 'Calentamiento & Movilidad',
    landmine:      'Landmine',
    accesorios:    'Accesorios & Core',
    kettlebell:    'Kettlebell & Carries',
    olimpicos:     'Movimientos Olímpicos',
  }
  const catColors = {
    calentamiento: 'FFE0F2FE',
    landmine:      'FFFDF4FF',
    accesorios:    'FFECFDF5',
    kettlebell:    'FFFEFCE8',
    olimpicos:     'FFFFF1F2',
  }

  let row = 3
  for (const [cat, exercises] of Object.entries(EXERCISE_CATEGORIES)) {
    for (const name of exercises) {
      const url = EXERCISE_VIDEOS[name]
      if (!url) continue
      const rr = sheet.getRow(row)
      rr.height = 16

      const cCell = rr.getCell(1)
      cCell.value = catLabels[cat] || cat
      fill(cCell, catColors[cat] || 'FFFFFFFF')
      fnt(cCell, { size: 8.5, color: 'FF374151' })
      aln(cCell, { h: 'left', v: 'middle', wrap: false })
      brd(cCell)

      const eCell = rr.getCell(2)
      eCell.value = name.charAt(0).toUpperCase() + name.slice(1)
      fill(eCell, 'FFFFFFFF')
      fnt(eCell, { size: 9, color: 'FF111827' })
      aln(eCell, { h: 'left', v: 'middle', wrap: false })
      brd(eCell)

      const vCell = rr.getCell(3)
      vCell.value = { text: '▶ Ver en YouTube', hyperlink: url }
      fill(vCell, 'FFEFF6FF')
      fnt(vCell, { size: 9, color: 'FF2563EB' })
      aln(vCell, { h: 'center', v: 'middle', wrap: false })
      brd(vCell)

      row++
    }
  }
}

export async function generateWeekExcel(weekData, existingBuffer = null) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'ProgramingEvo'
  workbook.created = new Date()

  if (existingBuffer) {
    await workbook.xlsx.load(existingBuffer)
  }

  const sheetName = weekData.sheetName || `S${weekData.semana || 'X'}`
  let finalName = sheetName
  let suffix = 2
  while (workbook.getWorksheet(finalName)) {
    finalName = `${sheetName} (${suffix++})`
  }

  const sheet = workbook.addWorksheet(finalName, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  })

  writeWeekToSheet(sheet, weekData)
  writeBibliotecaSheet(workbook)

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const filename = existingBuffer
    ? `ProgramingEvo_Mesociclo_${weekData.mesociclo || 'EVO'}.xlsx`
    : `ProgramingEvo_${finalName}_${weekData.mesociclo || 'EVO'}.xlsx`

  saveAs(blob, filename)
}
