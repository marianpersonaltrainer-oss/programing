/**
 * POST /api/programming-drive-import
 *
 * Lee texto de una carpeta de Google Drive (y subcarpetas hasta cierta profundidad) usando
 * una cuenta de servicio. La carpeta debe estar compartida en Drive con el email de esa
 * cuenta (permiso «Lector» basta).
 *
 * Body JSON:
 * - secret (obligatorio) — mismo valor que COACH_GUIDE_ADMIN_SECRET en Vercel
 * - folderId (opcional) — si falta, usa GOOGLE_DRIVE_PROGRAMMING_FOLDER_ID
 * - folderName (opcional, default "programacion") — si no hay folderId, intenta localizar por nombre
 * - appendMode (opcional, default true) — no usado en servidor; el cliente decide cómo fusionar
 *
 * Variables Vercel (servidor):
 * - COACH_GUIDE_ADMIN_SECRET
 * - GOOGLE_DRIVE_PROGRAMMING_SA_JSON — JSON completo de la clave de cuenta de servicio (una línea)
 *   O bien GOOGLE_DRIVE_PROGRAMMING_SA_JSON_B64 — mismo JSON en base64 (recomendado en Vercel)
 * - GOOGLE_DRIVE_PROGRAMMING_FOLDER_ID — ID de carpeta por defecto (opcional si siempre mandas folderId)
 */

import { JWT } from 'google-auth-library'

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

const MAX_DEPTH = 6
const MAX_FILES_SCANNED = 80
const MAX_FILES_EXPORTED = 28
const MAX_TOTAL_CHARS = 95000
const MAX_SHEET_CHARS = 32000

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

function loadServiceAccountJson() {
  const b64 = (process.env.GOOGLE_DRIVE_PROGRAMMING_SA_JSON_B64 || '').trim()
  if (b64) {
    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf8')
      return JSON.parse(decoded)
    } catch {
      return null
    }
  }
  const raw = (process.env.GOOGLE_DRIVE_PROGRAMMING_SA_JSON || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function buildJwt(creds) {
  if (!creds?.client_email || !creds?.private_key) return null
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })
}

async function driveGetJson(jwt, pathAndQuery) {
  const { token } = await jwt.getAccessToken()
  if (!token) throw new Error('No access token from Google')
  const url = pathAndQuery.startsWith('http') ? pathAndQuery : `${DRIVE_BASE}${pathAndQuery}`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await r.text()
  if (!r.ok) {
    const err = new Error(`Drive API ${r.status}: ${text.slice(0, 400)}`)
    err.status = r.status
    throw err
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

async function driveGetText(jwt, url) {
  const { token } = await jwt.getAccessToken()
  if (!token) throw new Error('No access token from Google')
  const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const text = await r.text()
  if (!r.ok) {
    const err = new Error(`Drive API ${r.status}: ${text.slice(0, 400)}`)
    err.status = r.status
    throw err
  }
  return text
}

async function findFolderByName(jwt, folderNameRaw) {
  const folderName = String(folderNameRaw || '').trim()
  if (!folderName) return null
  const escaped = folderName.replace(/'/g, "\\'")
  const q = `mimeType='application/vnd.google-apps.folder' and trashed=false and name contains '${escaped}'`
  const fields = encodeURIComponent('files(id, name, modifiedTime)')
  const path = `/files?q=${encodeURIComponent(q)}&fields=${fields}&orderBy=modifiedTime desc&pageSize=20`
  const data = await driveGetJson(jwt, path)
  const list = Array.isArray(data?.files) ? data.files : []
  if (!list.length) return null
  const normTarget = folderName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
  const exact = list.find((f) => {
    const n = String(f?.name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    return n === normTarget
  })
  return exact || list[0]
}

/**
 * @param {JWT} jwt
 * @param {string} rootFolderId
 * @returns {Promise<Array<{ id: string, name: string, mimeType: string, modifiedTime?: string }>>}
 */
async function collectFilesRecursive(jwt, rootFolderId) {
  const files = []
  const folderQueue = [{ id: rootFolderId, depth: 0 }]
  const visitedFolders = new Set([rootFolderId])

  while (folderQueue.length > 0 && files.length < MAX_FILES_SCANNED) {
    const { id: parentId, depth } = folderQueue.shift()
    let pageToken
    do {
      const q = `'${parentId}' in parents and trashed=false`
      const fields = encodeURIComponent('nextPageToken, files(id, name, mimeType, modifiedTime)')
      const path = `/files?q=${encodeURIComponent(q)}&fields=${fields}&pageSize=100${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
      }`
      const data = await driveGetJson(jwt, path)
      const batch = data.files || []
      for (const f of batch) {
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (depth < MAX_DEPTH && !visitedFolders.has(f.id)) {
            visitedFolders.add(f.id)
            folderQueue.push({ id: f.id, depth: depth + 1 })
          }
        } else {
          files.push(f)
          if (files.length >= MAX_FILES_SCANNED) break
        }
      }
      pageToken = data.nextPageToken
    } while (pageToken && files.length < MAX_FILES_SCANNED)
  }

  files.sort((a, b) => String(b.modifiedTime || '').localeCompare(String(a.modifiedTime || '')))
  return files
}

/**
 * @param {JWT} jwt
 * @param {{ id: string, name: string, mimeType: string }} file
 * @returns {Promise<string|null>}
 */
async function exportFileAsPlainText(jwt, file) {
  const { id, mimeType, name } = file
  try {
    if (mimeType === 'application/vnd.google-apps.document') {
      const url = `${DRIVE_BASE}/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent('text/plain')}`
      return await driveGetText(jwt, url)
    }
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const url = `${DRIVE_BASE}/files/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent('text/csv')}`
      let t = await driveGetText(jwt, url)
      if (t.length > MAX_SHEET_CHARS) {
        t = `${t.slice(0, MAX_SHEET_CHARS)}\n\n[…hoja truncada por tamaño: ${name}]`
      }
      return t
    }
    if (
      mimeType === 'text/plain' ||
      mimeType === 'text/markdown' ||
      mimeType === 'text/csv' ||
      mimeType === 'application/json'
    ) {
      const url = `${DRIVE_BASE}/files/${encodeURIComponent(id)}?alt=media`
      return await driveGetText(jwt, url)
    }
    return null
  } catch (e) {
    console.warn('[programming-drive-import] skip file', name, e?.message || e)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const serverSecret = (process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  if (!serverSecret) {
    return res.status(500).json({ error: 'Servidor sin COACH_GUIDE_ADMIN_SECRET.' })
  }

  const body = parseBody(req)
  if (body === null) {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const { secret, folderId: folderIdRaw, folderName: folderNameRaw } = body || {}
  if (!secret || String(secret).trim() !== serverSecret) {
    return res.status(401).json({ error: 'Clave de administración incorrecta' })
  }

  const creds = loadServiceAccountJson()
  if (!creds) {
    return res.status(503).json({
      error:
        'Google Drive no está configurado en el servidor. Añade GOOGLE_DRIVE_PROGRAMMING_SA_JSON_B64 (recomendado) o GOOGLE_DRIVE_PROGRAMMING_SA_JSON con la cuenta de servicio, y comparte la carpeta de programación con el email de esa cuenta (lector).',
      setupHint:
        'Google Cloud Console → APIs y servicios → Biblioteca → activar «Google Drive API». IAM → Cuentas de servicio → claves JSON. En Drive: compartir carpeta con el client_email del JSON.',
    })
  }

  const jwt = buildJwt(creds)
  if (!jwt) {
    return res.status(503).json({ error: 'Credencial de servicio inválida (faltan client_email o private_key).' })
  }

  let folderId =
    String(folderIdRaw || process.env.GOOGLE_DRIVE_PROGRAMMING_FOLDER_ID || '')
      .trim()
      .replace(/['"]/g, '') || ''
  let folderNameMatched = null

  if (!folderId) {
    const candidates = [
      String(folderNameRaw || '').trim(),
      String(process.env.GOOGLE_DRIVE_PROGRAMMING_FOLDER_NAME || '').trim(),
      'programacion',
      'programación',
    ].filter(Boolean)
    let pickedFolder = null
    for (const name of candidates) {
      try {
        pickedFolder = await findFolderByName(jwt, name)
      } catch {
        pickedFolder = null
      }
      if (pickedFolder?.id) break
    }
    if (pickedFolder?.id) {
      folderId = pickedFolder.id
      folderNameMatched = String(pickedFolder.name || '')
    }
  }

  if (!folderId) {
    return res.status(400).json({
      error:
        'No se encontró carpeta de programación automáticamente. Pega el enlace/ID de la carpeta o define GOOGLE_DRIVE_PROGRAMMING_FOLDER_ID en Vercel.',
    })
  }

  try {
    const allMeta = await collectFilesRecursive(jwt, folderId)
    const parts = []
    let total = 0
    const usedFiles = []
    const skipped = []

    for (const meta of allMeta) {
      if (usedFiles.length >= MAX_FILES_EXPORTED) break
      const chunk = await exportFileAsPlainText(jwt, meta)
      if (chunk == null || !String(chunk).trim()) {
        skipped.push({ name: meta.name, mimeType: meta.mimeType, reason: 'tipo no soportado o vacío' })
        continue
      }
      const header = `\n\n════ ${meta.name} (${meta.mimeType}) ════\n`
      const block = `${header}${String(chunk).trim()}`
      if (total + block.length > MAX_TOTAL_CHARS) {
        skipped.push({ name: meta.name, reason: 'límite total de importación alcanzado' })
        break
      }
      parts.push(block)
      total += block.length
      usedFiles.push({ id: meta.id, name: meta.name, mimeType: meta.mimeType })
    }

    const text = parts.join('\n').trim()
    if (!text) {
      return res.status(200).json({
        text: '',
        meta: {
          folderId,
          folderNameMatched,
          exported: 0,
          usedFiles: [],
          skipped,
          hint:
            'No se exportó texto: comprueba que haya Docs, Hojas de cálculo o .txt/.md en la carpeta (PDF/binarios no se leen aquí).',
        },
      })
    }

    return res.status(200).json({
      text,
      meta: {
        folderId,
        folderNameMatched,
        exported: usedFiles.length,
        scanned: allMeta.length,
        usedFiles,
        skipped,
        truncatedTotal: total >= MAX_TOTAL_CHARS,
      },
    })
  } catch (e) {
    const status = e.status === 404 ? 404 : e.status === 403 ? 403 : 500
    const msg = e.message || String(e)
    console.error('[programming-drive-import]', msg)
    if (status === 403 || /403|accessNotConfigured|insufficientPermissions/i.test(msg)) {
      return res.status(403).json({
        error:
          'Google Drive devolvió 403. Comprueba que la carpeta esté compartida con el email de la cuenta de servicio (lector) y que la API Drive esté activada en el proyecto de Google Cloud.',
        detail: msg.slice(0, 500),
      })
    }
    return res.status(status).json({ error: msg.slice(0, 800) })
  }
}
