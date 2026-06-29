/**
 * Aplica supabase/migrations/20260629150000_pe2_structured_auth.sql
 * npm run db:apply-pe2-structured-auth
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_FILE = join(__dirname, '..', 'supabase', 'migrations', '20260629150000_pe2_structured_auth.sql')

function loadDotEnv() {
  const envPath = join(__dirname, '..', '.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    if (process.env[key]) continue
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

function projectRefFromUrl(url) {
  try {
    const h = new URL(url).hostname
    const m = h.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function applyViaManagementApi(sql, ref, token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Management API ${res.status}: ${text.slice(0, 500)}`)
}

async function applyViaPg(sql) {
  const { default: pg } = await import('pg')
  const url = process.env.DATABASE_URL?.trim()
  const client = new pg.Client({ connectionString: url, ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

async function main() {
  loadDotEnv()
  const sql = readFileSync(MIGRATION_FILE, 'utf8')
  const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const dbUrl = process.env.DATABASE_URL?.trim()

  if (dbUrl) {
    console.log('Aplicando pe2_structured_auth vía DATABASE_URL…')
    await applyViaPg(sql)
    console.log('Listo.')
    return
  }
  if (pat) {
    const baseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const ref = projectRefFromUrl(baseUrl)
    if (!ref) throw new Error('Define SUPABASE_URL o VITE_SUPABASE_URL')
    console.log(`Aplicando pe2_structured_auth vía Management API (${ref})…`)
    await applyViaManagementApi(sql, ref, pat)
    console.log('Listo.')
    return
  }
  console.error('Falta DATABASE_URL o SUPABASE_ACCESS_TOKEN')
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
