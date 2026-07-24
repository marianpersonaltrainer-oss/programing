/**
 * Aplica únicamente supabase/migrations/20260723160000_pe2_weeks_optimistic_lock.sql
 * al proyecto remoto indicado por STAGING_DATABASE_URL o SUPABASE_URL + token.
 *
 * Seguridad:
 * - Define STAGING_DATABASE_URL (recomendado) o DATABASE_URL apuntando solo a staging.
 * - Si usas Management API, define STAGING_SUPABASE_URL (no producción).
 *
 * Validación previa (sin aplicar):
 *   node scripts/staging-validate-supabase.mjs
 *
 * Aplicar en staging:
 *   node scripts/apply-migration-pe2-weeks-lock.mjs
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_FILE = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260723160000_pe2_weeks_optimistic_lock.sql',
)
const MIGRATION_VERSION = '20260723160000'

function loadDotEnv() {
  for (const name of ['.env.staging', '.env']) {
    const envPath = join(__dirname, '..', name)
    if (!existsSync(envPath)) continue
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      if (process.env[key] != null && process.env[key] !== '') continue
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
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

function resolveDbUrl() {
  return (
    process.env.STAGING_DATABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ''
  )
}

function resolveSupabaseUrl() {
  return (
    process.env.STAGING_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    ''
  )
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

async function applyViaPg(sql, url) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    await client.query(sql)
  } finally {
    await client.end()
  }
}

async function assertPe2WeeksExists(url) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    const { rows } = await client.query(
      `select to_regclass('public.pe2_weeks')::text as tbl`,
    )
    if (!rows[0]?.tbl) {
      throw new Error('pe2_weeks no existe. Aplica antes 20260622120000_pe2_weeks.sql en staging.')
    }
    const lock = await client.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='pe2_weeks' and column_name='lock_version'`,
    )
    if (lock.rows.length > 0) {
      console.log('SKIP: lock_version ya presente — migración ya aplicada.')
      process.exit(0)
    }
  } finally {
    await client.end()
  }
}

async function main() {
  loadDotEnv()
  const sql = readFileSync(MIGRATION_FILE, 'utf8')
  const dbUrl = resolveDbUrl()
  const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()

  if (dbUrl) {
    console.log(`Pre-check (${MIGRATION_VERSION}) vía Postgres…`)
    await assertPe2WeeksExists(dbUrl)
    console.log('Aplicando migración optimistic lock vía DATABASE_URL…')
    await applyViaPg(sql, dbUrl)
    console.log('OK: lock_version aplicado en staging.')
    return
  }

  if (token) {
    const baseUrl = resolveSupabaseUrl()
    const ref = projectRefFromUrl(baseUrl)
    if (!ref) {
      throw new Error('Define STAGING_SUPABASE_URL para obtener el project ref de staging.')
    }
    console.log(`Aplicando migración optimistic lock vía Management API (proyecto ${ref})…`)
    await applyViaManagementApi(sql, ref, token)
    console.log('OK: lock_version aplicado.')
    return
  }

  console.error(
    'Falta STAGING_DATABASE_URL, DATABASE_URL o SUPABASE_ACCESS_TOKEN.\n' +
      'Usa solo credenciales de staging — no producción.',
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
