/**
 * Valida localmente la migración pe2_weeks_optimistic_lock.sql (PostgreSQL aislado).
 * Requiere DATABASE_URL apuntando a una base local o de desarrollo — no usa Supabase login.
 */
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATION = join(__dirname, '..', 'supabase', 'migrations', '20260723160000_pe2_weeks_optimistic_lock.sql')
const BASE_MIGRATION = join(__dirname, '..', 'supabase', 'migrations', '20260622120000_pe2_weeks.sql')

async function main() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.log('SKIP: DATABASE_URL no definida — delegando en PGLite aislado.')
    const { spawnSync } = await import('child_process')
    const r = spawnSync(process.execPath, [join(__dirname, 'validate-migration-pe2-weeks-lock-pglite.mjs')], {
      stdio: 'inherit',
    })
    process.exit(r.status ?? 1)
  }

  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  await client.connect()

  const schema = `pe2_lock_test_${Date.now()}`
  await client.query(`create schema ${schema}`)
  await client.query(`set search_path to ${schema}, public`)

  try {
    if (existsSync(BASE_MIGRATION)) {
      await client.query(readFileSync(BASE_MIGRATION, 'utf8'))
    }
    await client.query(readFileSync(MIGRATION, 'utf8'))

    const { rows } = await client.query(
      `insert into pe2_weeks (mesociclo, semana, titulo) values ('test', 1, 'lock') returning id, lock_version`,
    )
    const id = rows[0].id
    expect(Number(rows[0].lock_version)).toBe(1)

    const upd = await client.query(`update pe2_weeks set titulo = 'lock v2' where id = $1 returning lock_version`, [id])
    expect(Number(upd.rows[0].lock_version)).toBe(2)

    console.log('OK: lock_version presente e incrementa en UPDATE.')
  } finally {
    await client.query(`drop schema if exists ${schema} cascade`)
    await client.end()
  }
}

function expect(cond) {
  if (!cond) throw new Error('Assertion failed')
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
