#!/usr/bin/env node
/**
 * Valida el control de turno guiado en PostgreSQL embebido y en memoria.
 *
 * No lee .env, no usa fetch, no carga credenciales y no puede conectarse a
 * Supabase remoto. Crea y valida también la base mínima de Auth/RLS.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260808120000_guided_shift_control.sql'),
  'utf8',
)
const AUTH_FOUNDATION = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260808100000_pe2_auth_foundation.sql'),
  'utf8',
)
const POLICY_TUNING = readFileSync(
  join(ROOT, 'supabase', 'migrations', '20260808140000_guided_shift_control_policy_tuning.sql'),
  'utf8',
)

const ORG_ID = '10000000-0000-4000-8000-000000000001'
const OTHER_ORG_ID = '10000000-0000-4000-8000-000000000002'
const COACH_ID = '20000000-0000-4000-8000-000000000001'
const TEAM_COACH_ID = '20000000-0000-4000-8000-000000000002'
const OTHER_COACH_ID = '20000000-0000-4000-8000-000000000003'
const PROGRAMMER_ID = '30000000-0000-4000-8000-000000000001'
const SHIFT_ONE = '40000000-0000-4000-8000-000000000001'
const SHIFT_TWO = '40000000-0000-4000-8000-000000000002'
const SHIFT_THREE = '40000000-0000-4000-8000-000000000003'
const SHIFT_FOUR = '40000000-0000-4000-8000-000000000004'
const SHIFT_OLD = '40000000-0000-4000-8000-000000000005'
const SHIFT_TEAM = '40000000-0000-4000-8000-000000000006'
const SHIFT_OTHER_ORG = '40000000-0000-4000-8000-000000000007'
const SHIFT_INVALID = '40000000-0000-4000-8000-000000000008'

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

async function insertCompletedLog(db, shiftId, recordType, firstClassExpected = false) {
  await db.query(
    `insert into public.shift_protocol_logs
      (shift_id, record_type, result, comment, all_steps_confirmed, first_class_expected, protocol_version)
     values ($1, $2, 'completado', null, true, $3, 'v0')`,
    [shiftId, recordType, firstClassExpected],
  )
}

async function insertTeamNote(db, shiftId, note = 'Novedad para el relevo') {
  await db.query(
    `insert into public.shift_notes (shift_id, note_type, team_note)
     values ($1, 'team', $2)`,
    [shiftId, note],
  )
}

async function insertPostClass(db, shiftId) {
  await db.query(
    `insert into public.shift_notes (
      shift_id,
      note_type,
      person_name,
      is_first_class,
      mobility_technique,
      discomfort_status,
      discomfort_zone,
      discomfort_intensity,
      work_volume_percent,
      loads_used,
      adapted_exercises
    ) values ($1, 'post_class', 'Alex Prueba', true, 'Mejor control de rodilla',
      'improved', 'hombro derecho', 3, 75, 'Mancuernas de 6 kg', 'Press en suelo')`,
    [shiftId],
  )
}

async function completeSimpleShift(db, shiftId, { teamNote = false } = {}) {
  await insertCompletedLog(db, shiftId, 'apertura')
  await insertCompletedLog(db, shiftId, 'revision')
  if (teamNote) await insertTeamNote(db, shiftId)
  await insertCompletedLog(db, shiftId, 'cierre')
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

    grant usage on schema public, auth to authenticated;
  `)

  await db.exec(AUTH_FOUNDATION)
  await db.exec(`
    insert into auth.users (id) values
      ('${COACH_ID}'), ('${TEAM_COACH_ID}'), ('${OTHER_COACH_ID}'), ('${PROGRAMMER_ID}');
    insert into public.organizations (id, name, slug) values
      ('${ORG_ID}', 'EVO', 'evo'),
      ('${OTHER_ORG_ID}', 'Otro centro', 'otro-centro');
    insert into public.profiles (id, full_name, role, org_id) values
      ('${COACH_ID}', 'Coach Prueba', 'coach', '${ORG_ID}'),
      ('${TEAM_COACH_ID}', 'Coach Equipo', 'coach', '${ORG_ID}'),
      ('${OTHER_COACH_ID}', 'Coach Otro Centro', 'coach', '${OTHER_ORG_ID}'),
      ('${PROGRAMMER_ID}', 'Dirección Prueba', 'programmer', '${ORG_ID}');
  `)

  await db.exec(MIGRATION)
  await db.exec(POLICY_TUNING)
  console.log('✓ Migración SQL ejecutada sin errores')

  await useIdentity(db, COACH_ID)
  await expectFail(
    () => insertCompletedLog(db, SHIFT_INVALID, 'cierre'),
    'no se puede finalizar sin apertura ni revisión',
  )

  await insertCompletedLog(db, SHIFT_ONE, 'apertura')
  await insertCompletedLog(db, SHIFT_ONE, 'revision', true)
  await expectFail(
    () => insertCompletedLog(db, SHIFT_ONE, 'cierre'),
    'una primera clase pendiente bloquea la finalización',
  )
  await insertPostClass(db, SHIFT_ONE)
  await insertTeamNote(db, SHIFT_ONE)
  await insertCompletedLog(db, SHIFT_ONE, 'cierre')
  await expectFail(
    () => insertTeamNote(db, SHIFT_ONE, 'No debe guardarse'),
    'un turno finalizado no admite notas',
  )
  await expectFail(
    () => insertCompletedLog(db, SHIFT_ONE, 'cierre'),
    'un paso completado no puede duplicarse',
  )
  console.log('✓ Secuencia obligatoria y primera clase enlazada al mismo turno')

  await completeSimpleShift(db, SHIFT_TWO)

  await insertCompletedLog(db, SHIFT_THREE, 'apertura')
  await insertCompletedLog(db, SHIFT_THREE, 'revision')
  await expectFail(
    () => db.query(
      `insert into public.shift_notes (
        shift_id, note_type, person_name, mobility_technique, discomfort_status,
        discomfort_zone, discomfort_intensity, work_volume_percent, loads_used, adapted_exercises
      ) values ($1, 'post_class', 'Persona', 'Observación', 'stable', null, 4, 50, 'Sin cargas', 'Ninguno')`,
      [SHIFT_THREE],
    ),
    'molestia estable exige zona',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_notes (
        shift_id, note_type, person_name, mobility_technique, discomfort_status,
        discomfort_intensity, work_volume_percent, loads_used, adapted_exercises
      ) values ($1, 'post_class', 'Persona', 'Observación', 'none', 0, 30, 'Sin cargas', 'Ninguno')`,
      [SHIFT_THREE],
    ),
    'el volumen debe ser 25, 50, 75 o 100',
  )
  await insertCompletedLog(db, SHIFT_THREE, 'cierre')

  await insertCompletedLog(db, SHIFT_FOUR, 'apertura')
  await expectFail(
    () => insertTeamNote(db, SHIFT_FOUR),
    'las notas requieren revisar personas y novedades',
  )
  await insertCompletedLog(db, SHIFT_FOUR, 'revision')
  await insertCompletedLog(db, SHIFT_FOUR, 'cierre')
  console.log('✓ Campos post-clase, volumen y secuencia de notas validados en SQL')

  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, user_id, record_type, result, all_steps_confirmed, protocol_version)
       values ($1, $2, 'apertura', 'completado', true, 'v0')`,
      [SHIFT_INVALID, PROGRAMMER_ID],
    ),
    'el cliente no puede elegir user_id',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, record_type, result, all_steps_confirmed, protocol_version, created_at)
       values ($1, 'apertura', 'completado', true, 'v0', '2000-01-01T00:00:00Z')`,
      [SHIFT_INVALID],
    ),
    'el cliente no puede elegir created_at',
  )
  console.log('✓ Identidad, organización y hora manipuladas rechazadas')

  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, record_type, result, comment, all_steps_confirmed, protocol_version)
       values ($1, 'apertura', 'incidencia', $2, false, 'v0')`,
      [SHIFT_INVALID, ' \n\t '],
    ),
    'una incidencia exige comentario',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, record_type, result, comment, all_steps_confirmed, protocol_version)
       values ($1, 'apertura', 'incidencia', $2, false, 'v0')`,
      [SHIFT_INVALID, 'x'.repeat(601)],
    ),
    'el comentario no supera 600 caracteres',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, record_type, result, all_steps_confirmed, protocol_version)
       values ($1, 'apertura', 'completado', false, 'v0')`,
      [SHIFT_INVALID],
    ),
    'un completado exige confirmación',
  )
  await expectFail(
    () => db.query(
      `insert into public.shift_protocol_logs
        (shift_id, record_type, result, all_steps_confirmed, protocol_version)
       values ($1, 'apertura', 'completado', true, 'v1')`,
      [SHIFT_INVALID],
    ),
    'la versión queda fijada',
  )

  const ownCurrentLogs = await db.query('select * from public.shift_protocol_logs')
  assert(ownCurrentLogs.rows.length === 12, 'el coach conserva cuatro turnos completos el mismo día')
  assert(ownCurrentLogs.rows.every((row) => row.user_id === COACH_ID), 'user_id viene de auth.uid()')
  assert(ownCurrentLogs.rows.every((row) => row.org_id === ORG_ID), 'org_id viene del perfil')
  assert(new Set(ownCurrentLogs.rows.map((row) => row.shift_id)).size === 4, 'cada turno queda separado')
  console.log('✓ Varios turnos diarios separados, sin sobrescritura')

  await expectFail(
    () => db.query("update public.shift_protocol_logs set comment = 'editado'"),
    'el entrenador no puede editar registros',
  )
  await expectFail(
    () => db.query('delete from public.shift_notes'),
    'el entrenador no puede borrar notas',
  )
  await expectFail(
    () => db.query("update public.profiles set role = 'programmer' where id = auth.uid()"),
    'el entrenador no puede elevar su rol',
  )
  await db.query("update public.profiles set full_name = 'Coach Actualizado' where id = auth.uid()")
  const updatedProfile = await db.query('select full_name from public.profiles where id = auth.uid()')
  assert(updatedProfile.rows[0]?.full_name === 'Coach Actualizado', 'puede editar su nombre')
  console.log('✓ Registros inmutables y escalada de rol bloqueada')

  await completeSimpleShift(db, SHIFT_OLD, { teamNote: true })
  await db.exec('reset role;')
  await db.query(
    "update public.shift_protocol_logs set created_at = now() - interval '2 days' where shift_id = $1",
    [SHIFT_OLD],
  )
  await db.query(
    "update public.shift_notes set created_at = now() - interval '2 days' where shift_id = $1",
    [SHIFT_OLD],
  )

  await useIdentity(db, TEAM_COACH_ID)
  await completeSimpleShift(db, SHIFT_TEAM, { teamNote: true })

  await useIdentity(db, OTHER_COACH_ID)
  await completeSimpleShift(db, SHIFT_OTHER_ORG, { teamNote: true })

  await useIdentity(db, COACH_ID)
  const coachVisibleLogs = await db.query('select * from public.shift_protocol_logs')
  const coachVisibleNotes = await db.query('select * from public.shift_notes')
  assert(coachVisibleLogs.rows.length === 12, 'el coach solo ve sus turnos del día actual')
  assert(coachVisibleLogs.rows.every((row) => row.user_id === COACH_ID && row.org_id === ORG_ID), 'no ve logs ajenos')
  assert(coachVisibleNotes.rows.length === 3, 've notas de hoy de su organización')
  assert(coachVisibleNotes.rows.every((row) => row.org_id === ORG_ID), 'no ve notas de otra organización')
  console.log('✓ Lectura del coach limitada al día actual y a su organización')

  await db.exec('reset role; set role anon;')
  await expectFail(() => db.query('select * from public.shift_protocol_logs'), 'anon no lee turnos')
  await expectFail(() => db.query('select * from public.shift_notes'), 'anon no lee notas')

  await useIdentity(db, PROGRAMMER_ID)
  await expectFail(
    () => insertCompletedLog(db, SHIFT_INVALID, 'apertura'),
    'Dirección no crea registros de turno',
  )
  const directionLogs = await db.query('select * from public.shift_protocol_logs')
  const directionNotes = await db.query('select * from public.shift_notes')
  const directionProfiles = await db.query('select id, full_name, role from public.profiles')
  assert(directionLogs.rows.length === 18, 'Dirección ve el historial de su organización')
  assert(directionLogs.rows.every((row) => row.org_id === ORG_ID), 'Dirección no ve otra organización')
  assert(directionNotes.rows.length === 4, 'Dirección ve notas actuales e históricas de su organización')
  assert(directionNotes.rows.every((row) => row.org_id === ORG_ID), 'Dirección no ve notas de otra organización')
  assert(directionProfiles.rows.length === 3, 'Dirección resuelve solo perfiles de su organización')
  console.log('✓ Dirección consulta historial y perfiles solo de su organización')

  await db.exec('reset role;')
  await db.close()
  console.log('RESULTADO: control de turno guiado validado en PostgreSQL local en memoria')
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
