#!/usr/bin/env node
/**
 * Prueba la migración del Puente EVO V0 en PostgreSQL embebido y en memoria.
 *
 * No lee .env, no usa fetch, no carga credenciales y no puede conectarse a
 * Supabase remoto. Simula los helpers y roles ya creados por pe2_structured_auth.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260722210000_shift_protocol_logs.sql'),
  'utf8',
)

const ORG_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_ORG_ID = '10000000-0000-4000-8000-000000000002'
const COACH_ID = '20000000-0000-4000-8000-000000000001'
const OTHER_COACH_ID = '20000000-0000-4000-8000-000000000002'
const PROGRAMMER_ID = '30000000-0000-4000-8000-000000000001'

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`)
}

async function expectFail(operation, message) {
  try {
    await operation()
  } catch {
    return
  }
  throw new Error(`ASSERT FAIL: se esperaba rechazo — ${message}`)
}

async function useIdentity(db, userId) {
  await db.exec('reset role;')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId])
  await db.exec('set role authenticated;')
}

async function main() {
  console.log('Entorno: PGlite en memoria · sin red · sin credenciales · producción no accesible')
  const db = new PGlite()

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema if not exists auth;

    create table auth.users (id uuid primary key);
    create function auth.uid()
    returns uuid
    language sql
    stable
    as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;

    create table public.organizations (
      id uuid primary key,
      name text not null,
      slug text not null unique
    );

    create table public.profiles (
      id uuid primary key references auth.users (id),
      full_name text,
      role text not null,
      org_id uuid references public.organizations (id)
    );

    alter table public.profiles enable row level security;
    grant usage on schema public, auth to authenticated;
    grant select, update on public.profiles to authenticated;

    create function public.pe2_my_org()
    returns uuid
    language sql
    stable
    security definer
    set search_path = public
    as $$ select org_id from public.profiles where id = auth.uid(); $$;

    create function public.pe2_my_role()
    returns text
    language sql
    stable
    security definer
    set search_path = public
    as $$ select role from public.profiles where id = auth.uid(); $$;

    grant execute on function public.pe2_my_org() to authenticated;
    grant execute on function public.pe2_my_role() to authenticated;

    create policy profiles_select_own on public.profiles
      for select to authenticated using (id = auth.uid());

    create policy profiles_update_own on public.profiles
      for update to authenticated
      using (id = auth.uid()) with check (id = auth.uid());

    insert into auth.users (id) values
      ('${COACH_ID}'), ('${OTHER_COACH_ID}'), ('${PROGRAMMER_ID}');
    insert into public.organizations (id, name, slug) values
      ('${ORG_ID}', 'EVO', 'evo'),
      ('${OTHER_ORG_ID}', 'Otro centro', 'otro-centro');
    insert into public.profiles (id, full_name, role, org_id) values
      ('${COACH_ID}', 'Coach Prueba', 'coach', '${ORG_ID}'),
      ('${OTHER_COACH_ID}', 'Coach Otro Centro', 'coach', '${OTHER_ORG_ID}'),
      ('${PROGRAMMER_ID}', 'Dirección Prueba', 'programmer', '${ORG_ID}');
  `)

  await db.exec(MIGRATION)
  console.log('✓ Migración SQL ejecutada sin errores')

  await useIdentity(db, COACH_ID)
  for (const recordType of ['apertura', 'cierre', 'apertura', 'cierre']) {
    await db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, comment, all_steps_confirmed, protocol_version)
       values ($1, 'completado', null, true, 'v0')`,
      [recordType],
    )
  }

  const ownLogs = await db.query('select * from public.shift_protocol_logs order by created_at')
  assert(ownLogs.rows.length === 4, 'el entrenador debe conservar dos aperturas y dos cierres')
  assert(ownLogs.rows.every((row) => row.user_id === COACH_ID), 'user_id debe venir de auth.uid()')
  assert(ownLogs.rows.every((row) => row.org_id === ORG_ID), 'org_id debe venir del perfil autenticado')
  assert(ownLogs.rows.every((row) => row.created_at), 'created_at debe venir de la base de datos')
  console.log('✓ Varias aperturas y cierres en el mismo día, sin sobrescritura')

  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (user_id, record_type, result, all_steps_confirmed, protocol_version)
       values ($1, 'apertura', 'completado', true, 'v0')`,
      [PROGRAMMER_ID],
    ),
    'el cliente no puede elegir user_id',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, all_steps_confirmed, protocol_version, created_at)
       values ('apertura', 'completado', true, 'v0', '2000-01-01T00:00:00Z')`,
    ),
    'el cliente no puede elegir created_at',
  )
  console.log('✓ Identidad y hora manipuladas rechazadas por permisos de columna')

  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, comment, all_steps_confirmed, protocol_version)
       values ('cierre', 'incidencia', $1, false, 'v0')`,
      [' \n\t '],
    ),
    'una incidencia exige comentario',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, all_steps_confirmed, protocol_version)
       values ('cierre', 'completado', false, 'v0')`,
    ),
    'un completado exige confirmación',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, all_steps_confirmed, protocol_version)
       values ('cierre', 'completado', true, 'v1')`,
    ),
    'la versión del protocolo queda fijada por la base de datos',
  )
  console.log('✓ Constraints de incidencia y confirmación activos')

  await expectFail(
    () => db.query("update public.shift_protocol_logs set comment = 'editado'"),
    'el entrenador no puede editar registros',
  )
  await expectFail(
    () => db.query('delete from public.shift_protocol_logs'),
    'el entrenador no puede borrar registros',
  )
  await expectFail(
    () => db.query("update public.profiles set role = 'programmer' where id = auth.uid()"),
    'el entrenador no puede elevar su rol',
  )
  await db.query("update public.profiles set full_name = 'Coach Actualizado' where id = auth.uid()")
  const updatedProfile = await db.query('select full_name from public.profiles where id = auth.uid()')
  assert(updatedProfile.rows[0]?.full_name === 'Coach Actualizado', 'el entrenador puede editar su nombre')
  console.log('✓ Registros inmutables y escalada de rol bloqueada')

  await db.exec('reset role;')
  await db.query(
    `insert into public.shift_protocol_logs
      (user_id, org_id, record_type, result, all_steps_confirmed, protocol_version, created_at)
     values ($1, $2, 'apertura', 'completado', true, 'v0', now() - interval '2 days')`,
    [COACH_ID, ORG_ID],
  )
  await db.query(
    `insert into public.shift_protocol_logs
      (user_id, org_id, record_type, result, all_steps_confirmed, protocol_version)
     values ($1, $2, 'cierre', 'completado', true, 'v0')`,
    [OTHER_COACH_ID, OTHER_ORG_ID],
  )

  await useIdentity(db, COACH_ID)
  const coachVisibleLogs = await db.query('select * from public.shift_protocol_logs')
  assert(coachVisibleLogs.rows.length === 4, 'el coach solo ve sus registros del día actual')
  assert(
    coachVisibleLogs.rows.every((row) => row.user_id === COACH_ID && row.org_id === ORG_ID),
    'el coach no ve otros usuarios u organizaciones',
  )

  await db.exec('reset role; set role anon;')
  await expectFail(
    () => db.query('select * from public.shift_protocol_logs'),
    'una sesión anónima no puede leer registros',
  )
  console.log('✓ Lectura del coach limitada al día actual, a su identidad y a su organización')

  await useIdentity(db, PROGRAMMER_ID)
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (record_type, result, all_steps_confirmed, protocol_version)
       values ('apertura', 'completado', true, 'v0')`,
    ),
    'Dirección no crea registros de turno',
  )
  const directionLogs = await db.query('select * from public.shift_protocol_logs')
  const directionProfiles = await db.query('select id, full_name, role from public.profiles')
  assert(directionLogs.rows.length === 5, 'Dirección debe ver el historial de su organización')
  assert(directionLogs.rows.every((row) => row.org_id === ORG_ID), 'Dirección no ve otra organización')
  assert(directionProfiles.rows.length === 2, 'Dirección resuelve solo el equipo de su organización')
  console.log('✓ Dirección consulta registros y perfiles solo de su organización')

  await db.exec('reset role;')
  await db.close()
  console.log('RESULTADO: Puente V0 validado en PostgreSQL local en memoria')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
