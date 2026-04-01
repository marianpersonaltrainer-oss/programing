/**
 * Aplica supabase/migrations/20260401120000_coach_handover_reads.sql al proyecto remoto.
 *
 * Opción A — API de gestión de Supabase (recomendada si no tienes DATABASE_URL):
 *   export SUPABASE_ACCESS_TOKEN="sbp_..."  # Cuenta → Access Tokens (ámbito database:write)
 *   node scripts/apply-migration-coach-handover-reads.mjs
 *
 * Opción B — Conexión Postgres directa (cadena del dashboard: Project Settings → Database):
 *   export DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:6543/postgres"
 *   node scripts/apply-migration-coach-handover-reads.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_FILE = join(__dirname, '..', 'supabase', 'migrations', '20260401120000_coach_handover_reads.sql')

function projectRefFromUrl(url) {
  try {
    const h = new URL(url).hostname
    const m = h.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

function loadEnvUrl() {
  for (const k of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
    const v = process.env[k]?.trim()
    if (v) return v
  }
  return ''
}

async function applyViaManagementApi(sql, ref, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Management API ${res.status}: ${text.slice(0, 500)}`)
  }
  return text
}

async function applyViaPg(sql) {
  const { default: pg } = await import('pg')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL vacío')
  const client = new pg.Client({ connectionString: url, ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

async function main() {
  const sql = readFileSync(MIGRATION_FILE, 'utf8')
  const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const dbUrl = process.env.DATABASE_URL?.trim()

  if (dbUrl) {
    console.log('Aplicando migración vía DATABASE_URL (pg)…')
    await applyViaPg(sql)
    console.log('Listo.')
    return
  }

  if (pat) {
    const baseUrl = loadEnvUrl()
    const ref = projectRefFromUrl(baseUrl)
    if (!ref) {
      throw new Error('Define SUPABASE_URL o VITE_SUPABASE_URL para obtener el project ref')
    }
    console.log(`Aplicando migración vía Management API (proyecto ${ref})…`)
    await applyViaManagementApi(sql, ref, pat)
    console.log('Listo.')
    return
  }

  console.error(
    'Falta SUPABASE_ACCESS_TOKEN (API de gestión) o DATABASE_URL (Postgres).\n' +
      'Ver comentarios al inicio de scripts/apply-migration-coach-handover-reads.mjs',
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
