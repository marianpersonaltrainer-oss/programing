/**
 * Validación aislada de 20260723160000_pe2_weeks_optimistic_lock.sql con PGLite (PostgreSQL embebido).
 * No requiere DATABASE_URL ni Supabase. Uso: node scripts/validate-migration-pe2-weeks-lock-pglite.mjs
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PGlite } from '@electric-sql/pglite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCK_MIGRATION = join(
  __dirname,
  '..',
  'supabase',
  'migrations',
  '20260723160000_pe2_weeks_optimistic_lock.sql',
)

const MINIMAL_PE2_WEEKS = `
create table if not exists public.pe2_weeks (
  id uuid primary key default gen_random_uuid(),
  mesociclo text not null,
  semana integer not null check (semana >= 1),
  phase text,
  titulo text not null default '',
  status text not null default 'draft',
  is_primary boolean not null default false,
  data jsonb not null default '{}'::jsonb,
  proposal jsonb,
  briefing_pack text,
  generation_log jsonb not null default '[]'::jsonb,
  published_week_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.pe2_weeks_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pe2_weeks_set_updated_at on public.pe2_weeks;
create trigger pe2_weeks_set_updated_at
  before update on public.pe2_weeks
  for each row
  execute function public.pe2_weeks_set_updated_at();
`

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function main() {
  const db = new PGlite()
  await db.exec(MINIMAL_PE2_WEEKS)
  await db.exec(readFileSync(LOCK_MIGRATION, 'utf8'))

  const insert = await db.query(
    `insert into pe2_weeks (mesociclo, semana, titulo) values ('test', 1, 'v1') returning id, lock_version`,
  )
  assert(Number(insert.rows[0].lock_version) === 1, 'lock_version inicial debe ser 1')

  const id = insert.rows[0].id
  const upd = await db.query(`update pe2_weeks set titulo = 'v2' where id = $1 returning lock_version, updated_at`, [id])
  assert(Number(upd.rows[0].lock_version) === 2, 'lock_version debe incrementar a 2 tras UPDATE')

  const stale = await db.query(
    `update pe2_weeks set titulo = 'stale' where id = $1 and lock_version = $2 returning id`,
    [id, 1],
  )
  assert(stale.rows.length === 0, 'UPDATE con lock_version obsoleto no debe afectar filas')

  const fresh = await db.query(
    `update pe2_weeks set titulo = 'fresh' where id = $1 and lock_version = $2 returning lock_version`,
    [id, 2],
  )
  assert(Number(fresh.rows[0].lock_version) === 3, 'UPDATE con lock_version correcto debe incrementar a 3')

  console.log('OK: migración pe2_weeks_optimistic_lock validada en PGLite (PostgreSQL aislado).')
}

main().catch((err) => {
  console.error('FAIL:', err.message)
  process.exit(1)
})
