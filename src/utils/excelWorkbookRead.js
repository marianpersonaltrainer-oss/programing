/**
 * Lectura unificada Excel (import + análisis estructural).
 * Evita que import y scanStructure usen criterios distintos de celda/hoja.
 */

export function excelCellPlainString(cell) {
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

/**
 * Misma hoja que el import: prioriza S1/S2… si existe (no Biblioteca), si no primera útil.
 */
export function pickPrimaryProgrammingWeekSheet(workbook) {
  const list = workbook?.worksheets?.filter(Boolean) || []
  if (!list.length) return null
  const nonBiblioteca = list.filter((w) => !/^biblioteca/i.test(String(w.name || '').trim()))
  const prefer = nonBiblioteca.find((w) => /^s\d+$/i.test(String(w.name || '').trim()))
  return prefer || nonBiblioteca[0] || list[0]
}
