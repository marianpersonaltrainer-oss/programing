/**
 * Validación segura pre/post migración en Supabase staging (solo lectura + PGLite local).
 *
 * Uso:
 *   STAGING_DATABASE_URL=postgresql://... node scripts/staging-validate-supabase.mjs
 *
 * Comprueba:
 * - pe2_weeks existe
 * - lock_version ausente (pre) o presente e incremental (post)
 * - RLS activo en pe2_weeks
 * - rechazo de UPDATE con lock_version obsoleto
 * - migraciones locales vs remota (schema_migrations)
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const LOCK_MIGRATION = '20260723160000_pe2_weeks_optimistic_lock.sql'
const LOCK_VERSION = '20260723160000'

function loadDotEnv() {
  for (const name of ['.env.staging', '.env']) {
    const envPath = join(root, name)
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

function listLocalMigrations() {
  const dir = join(root, 'supabase', 'migrations')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

async function validateRemote(url) {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const report = { ok: true, checks: [] }

  function pass(name, detail) {
    report.checks.push({ name, ok: true, detail })
    console.log(`OK  ${name}${detail ? `: ${detail}` : ''}`)
  }
  function fail(name, detail) {
    report.ok = false
    report.checks.push({ name, ok: false, detail })
    console.error(`FAIL ${name}${detail ? `: ${detail}` : ''}`)
  }

  try {
    const local = listLocalMigrations()
    pass('local_migrations', `${local.length} archivos`)

    let remoteVersions = []
    try {
      const { rows } = await client.query(
        'select version, name from supabase_migrations.schema_migrations order by version',
      )
      remoteVersions = rows.map((r) => r.version)
      pass('remote_migration_table', `${remoteVersions.length} aplicadas`)
    } catch (e) {
      fail('remote_migration_table', e.message.slice(0, 120))
    }

    const pending = local
      .map((f) => f.replace(/_.+$/, ''))
      .filter((v) => !remoteVersions.includes(v))
    if (pending.length === 1 && pending[0] === LOCK_VERSION) {
      pass('pending_only_lock', LOCK_MIGRATION)
    } else if (pending.length === 0) {
      pass('pending_migrations', 'ninguna pendiente')
    } else {
      fail('pending_migrations', pending.join(', '))
    }

    const tbl = await client.query(`select to_regclass('public.pe2_weeks')::text as tbl`)
    if (!tbl.rows[0]?.tbl) {
      fail('pe2_weeks_exists', 'tabla ausente')
      return report
    }
    pass('pe2_weeks_exists')

    const rls = await client.query(
      `select relrowsecurity from pg_class where oid = 'public.pe2_weeks'::regclass`,
    )
    if (rls.rows[0]?.relrowsecurity) pass('pe2_weeks_rls')
    else fail('pe2_weeks_rls', 'RLS desactivado')

    const lockCol = await client.query(
      `select column_name from information_schema.columns
       where table_schema='public' and table_name='pe2_weeks' and column_name='lock_version'`,
    )
    const hasLock = lockCol.rows.length > 0
    if (hasLock) pass('lock_version_column')
    else pass('lock_version_column', 'ausente (esperado antes de aplicar)')

    if (hasLock) {
      const ins = await client.query(
        `insert into pe2_weeks (mesociclo, semana, titulo)
         values ('__staging_lock_test__', 9999, 'lock-test')
         returning id, lock_version`,
      )
      const id = ins.rows[0].id
      const v1 = Number(ins.rows[0].lock_version)
      if (v1 === 1) pass('lock_version_default', '1')
      else fail('lock_version_default', String(v1))

      const upd = await client.query(
        `update pe2_weeks set titulo = 'lock-test-v2' where id = $1 returning lock_version`,
        [id],
      )
      const v2 = Number(upd.rows[0].lock_version)
      if (v2 === 2) pass('lock_version_increment', '2')
      else fail('lock_version_increment', String(v2))

      const stale = await client.query(
        `update pe2_weeks set titulo = 'stale' where id = $1 and lock_version = $2 returning id`,
        [id, 1],
      )
      if (stale.rows.length === 0) pass('stale_lock_rejected')
      else fail('stale_lock_rejected', 'UPDATE obsoleto afectó filas')

      await client.query(`delete from pe2_weeks where id = $1`, [id])
      pass('lock_test_cleanup')
    }

    const count = await client.query(`select count(*)::int as n from pe2_weeks`)
    pass('pe2_weeks_rows', `${count.rows[0].n} filas existentes conservadas`)
  } finally {
    await client.end()
  }

  return report
}

async function main() {
  loadDotEnv()
  const url = process.env.STAGING_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim()

  console.log('=== Validación local PGLite (migración lock) ===')
  const r = spawnSync(process.execPath, [join(__dirname, 'validate-migration-pe2-weeks-lock-pglite.mjs')], {
    cwd: root,
    stdio: 'inherit',
  })
  if (r.status !== 0) process.exit(r.status ?? 1)

  if (!url) {
    console.log('\nSKIP remoto: STAGING_DATABASE_URL no definida.')
    console.log('Cuando exista staging, repite con STAGING_DATABASE_URL apuntando solo a ese proyecto.')
    process.exit(0)
  }

  console.log('\n=== Validación remota staging (solo lectura + test efímero) ===')
  const report = await validateRemote(url)
  if (!report.ok) process.exit(1)
  console.log('\nOK: staging validado.')
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
