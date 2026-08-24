/**
 * Aplica supabase/migrations/20260723220000_published_weeks_versioned_publication.sql
 *
 * Necesario cuando «Guardar borrador en Hub» falla con:
 *   Could not find the function public.save_published_week_draft_v2(...) in the schema cache
 *
 * Opción A — Postgres (recomendada):
 *   Supabase → Project Settings → Database → Connection string → URI (pooler, puerto 6543)
 *   export DATABASE_URL="postgresql://postgres.[ref]:[PASSWORD]@....pooler.supabase.com:6543/postgres"
 *   node --env-file=.env scripts/apply-migration-published-weeks-versioned.mjs
 *
 * Opción B — API de gestión Supabase:
 *   export SUPABASE_ACCESS_TOKEN="sbp_..."
 *   export VITE_SUPABASE_URL="https://[ref].supabase.co"
 *   node scripts/apply-migration-published-weeks-versioned.mjs
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION_FILE = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260723220000_published_weeks_versioned_publication.sql',
)

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
    throw new Error(`Management API ${res.status}: ${text.slice(0, 800)}`)
  }
  return text
}

async function applyViaPg(sql) {
  const { default: pg } = await import('pg')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) throw new Error('DATABASE_URL vacío')
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

async function verifyApplied() {
  const { default: pg } = await import('pg')
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()
  try {
    const { rows } = await client.query(`
      select proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and proname = 'save_published_week_draft_v2'
    `)
    if (!rows.length) {
      throw new Error('La función save_published_week_draft_v2 sigue sin existir tras la migración.')
    }
    console.log('Verificado: save_published_week_draft_v2 existe en public.')
  } finally {
    await client.end()
  }
}

async function main() {
  const sql = readFileSync(MIGRATION_FILE, 'utf8')
  const pat = process.env.SUPABASE_ACCESS_TOKEN?.trim()
  const dbUrl = process.env.DATABASE_URL?.trim()

  if (dbUrl && !dbUrl.includes('....')) {
    console.log('Aplicando publicación versionada V2 vía DATABASE_URL…')
    await applyViaPg(sql)
    await verifyApplied()
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
    console.log('Listo. Comprueba en SQL Editor: select proname from pg_proc where proname = \'save_published_week_draft_v2\';')
    return
  }

  console.error(
    'Falta DATABASE_URL (Postgres) o SUPABASE_ACCESS_TOKEN (API de gestión).\n' +
      'Ver comentarios al inicio de scripts/apply-migration-published-weeks-versioned.mjs',
  )
  process.exit(1)
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
