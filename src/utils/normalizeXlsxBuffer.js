/**
 * Normaliza un .xlsx para que ExcelJS pueda leerlo.
 *
 * Algunas herramientas (p. ej. EPPlus y varios exportadores/editores online) generan los XML
 * internos del libro con el namespace principal de SpreadsheetML ligado a un PREFIJO
 * (`<x:workbook><x:sheets><x:sheet …>` con `xmlns:x="…/spreadsheetml/2006/main"`).
 * ExcelJS 4.x parsea por nombre de etiqueta SIN prefijo, así que con esos ficheros no encuentra
 * las hojas → el modelo del libro queda sin `sheets` → revienta con
 * «Cannot read properties of undefined (reading 'sheets')».
 *
 * Esta función reescribe esos XML quitando el prefijo del namespace principal (deja `r:` y
 * demás intactos). Si el fichero ya es estándar (sin prefijo), se devuelve el buffer original
 * sin tocar. Funciona igual en navegador y en Node (JSZip es dependencia de ExcelJS).
 */

import JSZip from 'jszip'

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const MAIN_NS_RE = MAIN_NS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Quita el prefijo ligado al namespace principal de SpreadsheetML en un XML concreto. */
function stripMainNsPrefix(xml) {
  if (typeof xml !== 'string' || xml.indexOf(MAIN_NS) === -1) return xml
  const prefixes = new Set()
  const declRe = new RegExp(`xmlns:([A-Za-z0-9_]+)\\s*=\\s*"${MAIN_NS_RE}"`, 'g')
  let m
  while ((m = declRe.exec(xml)) !== null) prefixes.add(m[1])
  if (!prefixes.size) return xml
  let out = xml
  for (const p of prefixes) {
    out = out.replace(new RegExp(`<${p}:`, 'g'), '<')
    out = out.replace(new RegExp(`</${p}:`, 'g'), '</')
    out = out.replace(
      new RegExp(`xmlns:${p}\\s*=\\s*"${MAIN_NS_RE}"`, 'g'),
      `xmlns="${MAIN_NS}"`,
    )
  }
  return out
}

/**
 * Convierte cualquier entrada aceptada por ExcelJS (Buffer/ArrayBuffer/Uint8Array) a algo que
 * JSZip pueda cargar, y devuelve un buffer normalizado (o el original si no hace falta tocarlo).
 * @param {Buffer|ArrayBuffer|Uint8Array} input
 * @returns {Promise<Buffer|ArrayBuffer|Uint8Array>}
 */
export async function normalizeXlsxBuffer(input) {
  if (!input) return input
  let zip
  try {
    zip = await JSZip.loadAsync(input)
  } catch {
    // No es un zip legible: que ExcelJS dé su propio error con la entrada original.
    return input
  }

  let changed = false
  const names = Object.keys(zip.files)
  for (const name of names) {
    const entry = zip.files[name]
    if (!entry || entry.dir) continue
    if (!/\.(xml|rels)$/i.test(name)) continue
    let xml
    try {
      xml = await entry.async('string')
    } catch {
      continue
    }
    const fixed = stripMainNsPrefix(xml)
    if (fixed !== xml) {
      zip.file(name, fixed)
      changed = true
    }
  }

  if (!changed) return input

  const isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'
  const outType = isBrowser ? 'arraybuffer' : 'nodebuffer'
  return zip.generateAsync({ type: outType, compression: 'DEFLATE' })
}
