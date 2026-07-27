#!/usr/bin/env node
/**
 * Valida la publicación versionada de published_weeks en PostgreSQL embebido.
 *
 * No lee .env, no usa fetch, no carga credenciales y no puede conectarse a
 * Supabase remoto.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATION = readFileSync(
  join(
    ROOT,
    'supabase',
    'migrations',
    '20260723220000_published_weeks_versioned_publication.sql',
  ),
  'utf8',
)

const LEGACY_ACTIVE_OLD = '10000000-0000-4000-8000-000000000001'
const LEGACY_ACTIVE_NEW = '10000000-0000-4000-8000-000000000002'
const LEGACY_HISTORY = '10000000-0000-4000-8000-000000000003'

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`)
}

async function expectFail(operation, expectedMessage) {
  try {
    await operation()
  } catch (error) {
    const message = String(error?.message || error)
    if (expectedMessage && !message.includes(expectedMessage)) {
      throw new Error(
        `ASSERT FAIL: error inesperado; se esperaba «${expectedMessage}» y llegó «${message}»`,
      )
    }
    return
  }
  throw new Error(`ASSERT FAIL: se esperaba rechazo — ${expectedMessage}`)
}

function rpcJson(result, columnName) {
  const raw = result.rows[0]?.[columnName]
  return typeof raw === 'string' ? JSON.parse(raw) : raw
}

async function main() {
  console.log('Entorno: PGlite en memoria · sin red · sin credenciales')
  const db = new PGlite()

  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;

    create table public.published_weeks (
      id uuid primary key default gen_random_uuid(),
      mesociclo text not null,
      semana integer not null,
      titulo text not null,
      data jsonb not null,
      is_active boolean not null default false,
      published_at timestamptz not null default now(),
      edit_history jsonb not null default '[]'::jsonb
    );

    grant select, insert, update, delete on public.published_weeks
      to anon, authenticated;

    insert into public.published_weeks
      (id, mesociclo, semana, titulo, data, is_active, published_at)
    values
      (
        '${LEGACY_ACTIVE_OLD}',
        'fuerza',
        4,
        'Activa vieja',
        '{"titulo":"Activa vieja","dias":[]}'::jsonb,
        true,
        '2026-07-01T09:00:00Z'
      ),
      (
        '${LEGACY_ACTIVE_NEW}',
        'fuerza',
        5,
        'Activa reciente',
        '{"titulo":"Activa reciente","dias":[]}'::jsonb,
        true,
        '2026-07-08T09:00:00Z'
      ),
      (
        '${LEGACY_HISTORY}',
        'fuerza',
        5,
        'Histórico',
        '{"titulo":"Histórico","dias":[]}'::jsonb,
        false,
        '2026-07-02T09:00:00Z'
      );
  `)

  await db.exec(MIGRATION)
  console.log('✓ Migración SQL ejecutada')

  const normalized = await db.query(`
    select id, is_active, publication_status, revision, version_number
    from public.published_weeks
    order by published_at, id
  `)
  assert(
    normalized.rows.filter((row) => row.is_active).length === 1,
    'solo puede sobrevivir una fila legacy activa',
  )
  assert(
    normalized.rows.find((row) => row.id === LEGACY_ACTIVE_NEW)?.publication_status ===
      'published',
    'la activa más reciente debe quedar publicada',
  )
  assert(
    normalized.rows.find((row) => row.id === LEGACY_ACTIVE_OLD)?.publication_status ===
      'superseded',
    'una fila que fue activa conserva evidencia suficiente para ser historial',
  )
  assert(
    normalized.rows.find((row) => row.id === LEGACY_HISTORY)?.publication_status ===
      'legacy_unverified',
    'una fila legacy siempre inactiva queda en cuarentena',
  )
  assert(
    normalized.rows.every(
      (row) => Number(row.revision) >= 1 && Number(row.version_number) >= 1,
    ),
    'todas las filas deben tener revisión y versión',
  )
  console.log('✓ Normalización legacy conservadora, cuarentena y una sola semana activa')

  await db.exec('set role anon;')

  await expectFail(
    () =>
      db.query(
        `update public.published_weeks
         set titulo = 'edición directa'
         where id = $1`,
        [LEGACY_ACTIVE_NEW],
      ),
    'permission denied',
  )
  await expectFail(
    () => db.query('delete from public.published_weeks where id = $1', [LEGACY_HISTORY]),
    'permission denied',
  )
  await expectFail(
    () =>
      db.query(
        `select public.save_published_week_draft_v2(
          p_mesociclo => 'fuerza',
          p_semana => 6,
          p_titulo => 'Borrador anónimo',
          p_data => '{"dias":[]}'::jsonb
        )`,
      ),
    'permission denied',
  )
  await expectFail(
    () =>
      db.query(
        `select public.publish_published_week_draft_v2(
          p_draft_id => '${LEGACY_ACTIVE_NEW}',
          p_expected_revision => 1,
          p_expected_content_fingerprint => 'x',
          p_expected_validation_fingerprint => 'x'
        )`,
      ),
    'permission denied',
  )
  console.log('✓ anon no puede editar, borrar ni ejecutar las RPC de escritura')

  await db.exec('reset role; set role service_role;')
  const contextSnapshotAt = new Date().toISOString()
  const initialData = {
    titulo: 'Semana 6',
    mesociclo: 'fuerza',
    semana: 6,
    cycle_id: 'fuerza:2026-06-29',
    cycle_start_date: '2026-06-29',
    week_start_date: '2026-08-03',
    resumen: { foco: 'Pico controlado' },
    publication_context: { context_snapshot_at: contextSnapshotAt },
    dias: [],
  }
  const initialSave = await db.query(
    `select public.save_published_week_draft_v2(
      p_mesociclo => $1,
      p_semana => $2,
      p_titulo => $3,
      p_data => $4::jsonb
    )`,
    ['fuerza', 6, 'Semana 6', JSON.stringify(initialData)],
  )
  const draftV1 = rpcJson(initialSave, 'save_published_week_draft_v2')
  assert(draftV1.publication_status === 'draft', 'la primera escritura crea borrador')
  assert(draftV1.is_active === false, 'el borrador nunca es visible como activo')
  assert(Number(draftV1.revision) === 1, 'el borrador nuevo empieza en revisión 1')
  assert(
    typeof draftV1.content_fingerprint === 'string' &&
      draftV1.content_fingerprint.length === 32,
    'la base calcula fingerprint canónico',
  )

  await db.exec('set role anon;')
  const hiddenDraft = await db.query(
    'select id from public.published_weeks where id = $1',
    [draftV1.id],
  )
  assert(hiddenDraft.rows.length === 0, 'anon no puede leer borradores')
  const visiblePublished = await db.query(
    `select id
     from public.published_weeks
     where publication_status in ('published', 'superseded')`,
  )
  assert(visiblePublished.rows.length >= 1, 'anon conserva lectura del historial publicado')
  await db.exec('reset role; set role service_role;')
  console.log('✓ RLS oculta borradores y conserva solo versiones publicadas')

  const otherCycleData = {
    titulo: 'Semana 6 · ciclo posterior',
    mesociclo: 'fuerza',
    semana: 6,
    cycle_id: 'fuerza:2026-09-07',
    cycle_start_date: '2026-09-07',
    week_start_date: '2026-10-12',
    publication_context: { context_snapshot_at: contextSnapshotAt },
    dias: [],
  }
  const otherCycleResult = await db.query(
    `select public.save_published_week_draft_v2(
      p_mesociclo => 'fuerza',
      p_semana => 6,
      p_titulo => 'Semana 6 · ciclo posterior',
      p_data => $1::jsonb
    )`,
    [JSON.stringify(otherCycleData)],
  )
  const otherCycleDraft = rpcJson(
    otherCycleResult,
    'save_published_week_draft_v2',
  )
  assert(
    otherCycleDraft.id !== draftV1.id &&
      otherCycleDraft.cycle_id === 'fuerza:2026-09-07',
    'dos ciclos con el mismo mesociclo/semana no colisionan',
  )
  console.log('✓ La identidad exacta de ciclo separa slots con el mismo nombre y semana')
  const validationTargetFingerprint = 'fp1:week6-force-context-a'

  await expectFail(
    () =>
      db.query(
        `select public.save_published_week_draft_v2(
          p_mesociclo => 'fuerza',
          p_semana => 6,
          p_titulo => 'Duplicado',
          p_data => $1::jsonb
        )`,
        [JSON.stringify(initialData)],
      ),
    'draft_exists_pass_id_and_expected_revision',
  )

  await expectFail(
    () =>
      db.query(
        `select public.save_published_week_draft_v2(
          p_mesociclo => 'fuerza',
          p_semana => 6,
          p_titulo => 'Stale',
          p_data => $1::jsonb,
          p_draft_id => $2,
          p_expected_revision => 0
        )`,
        [JSON.stringify(initialData), draftV1.id],
      ),
    'draft_revision_conflict',
  )
  console.log('✓ Borrador único y revisión optimista obligatoria')

  await expectFail(
    () =>
      db.query(
        `select public.save_published_week_draft_v2(
          p_mesociclo => 'fuerza',
          p_semana => 6,
          p_titulo => 'Semana 6',
          p_data => $1::jsonb,
          p_draft_id => $2,
          p_expected_revision => 1,
          p_validation_fingerprint => $3,
          p_validation_status => 'approved',
          p_validation_score => 79,
          p_validation_blockers => '[]'::jsonb,
          p_validation_pending => '[]'::jsonb,
          p_validated_at => now()
        )`,
        [JSON.stringify(initialData), draftV1.id, validationTargetFingerprint],
      ),
    'approved_validation_gate_failed',
  )

  await expectFail(
    () =>
      db.query(
        `select public.publish_published_week_draft_v2(
          p_draft_id => $1,
          p_expected_revision => 1,
          p_expected_content_fingerprint => $2,
          p_expected_validation_fingerprint => $3
        )`,
        [draftV1.id, draftV1.content_fingerprint, validationTargetFingerprint],
      ),
    'validation_fingerprint_gate_failed',
  )
  console.log('✓ Nota 79 y borrador pendiente no pueden publicarse')

  const approvedSave = await db.query(
    `select public.save_published_week_draft_v2(
      p_mesociclo => 'fuerza',
      p_semana => 6,
      p_titulo => 'Semana 6 aprobada',
      p_data => $1::jsonb,
      p_draft_id => $2,
      p_expected_revision => 1,
      p_content_fingerprint => $3,
      p_validation_fingerprint => $4,
      p_validation_status => 'approved',
      p_validation_score => 92,
      p_validation_blockers => '[]'::jsonb,
      p_validation_pending => '[]'::jsonb,
      p_validated_at => now()
    )`,
    [
      JSON.stringify(initialData),
      draftV1.id,
      draftV1.content_fingerprint,
      validationTargetFingerprint,
    ],
  )
  const draftV2 = rpcJson(approvedSave, 'save_published_week_draft_v2')
  assert(Number(draftV2.revision) === 2, 'la aprobación incrementa la revisión')
  assert(draftV2.validation_status === 'approved', 'estado aprobado exacto conservado')
  assert(
    draftV2.validation_fingerprint === validationTargetFingerprint &&
      draftV2.validation_fingerprint !== draftV2.content_fingerprint,
    'la huella de validación/contexto se conserva separada del MD5 de contenido',
  )

  await expectFail(
    () =>
      db.query(
        `select public.publish_published_week_draft_v2(
          p_draft_id => $1,
          p_expected_revision => 2,
          p_expected_content_fingerprint => 'fingerprint-equivocado',
          p_expected_validation_fingerprint => $2
        )`,
        [draftV2.id, draftV2.validation_fingerprint],
      ),
    'content_fingerprint_gate_failed',
  )

  const publishResult = await db.query(
    `select public.publish_published_week_draft_v2(
      p_draft_id => $1,
      p_expected_revision => 2,
      p_expected_content_fingerprint => $2,
      p_expected_validation_fingerprint => $3
    )`,
    [draftV2.id, draftV2.content_fingerprint, draftV2.validation_fingerprint],
  )
  const published = rpcJson(publishResult, 'publish_published_week_draft_v2')
  assert(published.publication_status === 'published', 'se crea una publicación nueva')
  assert(published.is_active === true, 'la publicación nueva queda activa')
  assert(published.source_week_id === draftV2.id, 'la publicación enlaza el borrador')
  assert(
    published.consumed_draft_id === draftV2.id,
    'la respuesta identifica el borrador consumido',
  )

  const atomicSnapshotAt = new Date().toISOString()
  const atomicData = {
    titulo: 'Semana atómica',
    mesociclo: 'mixto',
    semana: 1,
    cycle_id: 'mixto:2026-07-06',
    cycle_start_date: '2026-07-06',
    week_start_date: '2026-07-06',
    publication_context: { context_snapshot_at: atomicSnapshotAt },
    dias: [],
  }
  const atomicResult = await db.query(
    `select public.save_and_publish_published_week_v2(
      p_mesociclo => 'mixto',
      p_semana => 1,
      p_titulo => 'Semana atómica',
      p_data => $1::jsonb,
      p_expected_revision => 0,
      p_validation_fingerprint => 'fp1:atomic-success',
      p_validation_score => 92,
      p_validation_blockers => '[]'::jsonb,
      p_validation_pending => '[]'::jsonb,
      p_validated_at => now()
    )`,
    [JSON.stringify(atomicData)],
  )
  const atomicPublished = rpcJson(
    atomicResult,
    'save_and_publish_published_week_v2',
  )
  assert(
    atomicPublished.publication_status === 'published' &&
      atomicPublished.is_active === true,
    'la envoltura guarda y publica en una sola llamada',
  )

  const rollbackData = {
    titulo: 'No debe persistir',
    mesociclo: 'autocarga',
    semana: 1,
    cycle_id: 'autocarga:2026-07-13',
    cycle_start_date: '2026-07-13',
    week_start_date: '2026-07-13',
    publication_context: { context_snapshot_at: '2000-01-01T00:00:00.000Z' },
    dias: [],
  }
  await expectFail(
    () =>
      db.query(
        `select public.save_and_publish_published_week_v2(
          p_mesociclo => 'autocarga',
          p_semana => 1,
          p_titulo => 'No debe persistir',
          p_data => $1::jsonb,
          p_expected_revision => 0,
          p_validation_fingerprint => 'fp1:atomic-rollback',
          p_validation_score => 92,
          p_validation_blockers => '[]'::jsonb,
          p_validation_pending => '[]'::jsonb,
          p_validated_at => now()
        )`,
        [JSON.stringify(rollbackData)],
      ),
    'publication_context_changed',
  )
  const rolledBack = await db.query(
    `select id
     from public.published_weeks
     where cycle_id = 'autocarga:2026-07-13'`,
  )
  assert(
    rolledBack.rows.length === 0,
    'un fallo de activación revierte también el borrador creado en la envoltura',
  )
  console.log('✓ Guardar + aprobar + publicar es una sola transacción recuperable')

  const staleSnapshotAt = new Date().toISOString()
  const staleData = {
    titulo: 'Semana 7 con contexto antiguo',
    mesociclo: 'fuerza',
    semana: 7,
    cycle_id: 'fuerza:2026-06-29',
    cycle_start_date: '2026-06-29',
    week_start_date: '2026-08-10',
    publication_context: { context_snapshot_at: staleSnapshotAt },
    dias: [],
  }
  const staleDraftResult = await db.query(
    `select public.save_published_week_draft_v2(
      p_mesociclo => 'fuerza',
      p_semana => 7,
      p_titulo => 'Semana 7',
      p_data => $1::jsonb
    )`,
    [JSON.stringify(staleData)],
  )
  const staleDraftV1 = rpcJson(staleDraftResult, 'save_published_week_draft_v2')
  const staleGateFingerprint = 'fp1:week7-context-before-concurrent-publish'
  const staleApprovedResult = await db.query(
    `select public.save_published_week_draft_v2(
      p_mesociclo => 'fuerza',
      p_semana => 7,
      p_titulo => 'Semana 7',
      p_data => $1::jsonb,
      p_draft_id => $2,
      p_expected_revision => 1,
      p_content_fingerprint => $3,
      p_validation_fingerprint => $4,
      p_validation_status => 'approved',
      p_validation_score => 92,
      p_validation_blockers => '[]'::jsonb,
      p_validation_pending => '[]'::jsonb,
      p_validated_at => now()
    )`,
    [
      JSON.stringify(staleData),
      staleDraftV1.id,
      staleDraftV1.content_fingerprint,
      staleGateFingerprint,
    ],
  )
  const staleDraftV2 = rpcJson(staleApprovedResult, 'save_published_week_draft_v2')

  await db.exec(`
    begin;
    select set_config('app.published_weeks_v2_internal', 'on', true);
    insert into public.published_weeks (
      mesociclo, semana, cycle_id, cycle_start_date, week_start_date,
      titulo, data, is_active, published_at,
      publication_status, revision, version_number
    )
    values (
      'mixto', 1, 'mixto:2026-07-01', '2026-07-01', '2026-07-01',
      'Publicación concurrente',
      '{"mesociclo":"mixto","semana":1,"cycle_id":"mixto:2026-07-01","cycle_start_date":"2026-07-01","week_start_date":"2026-07-01","dias":[]}'::jsonb,
      false,
      '${staleSnapshotAt}'::timestamptz + interval '1 second',
      'superseded', 1, 1
    );
    commit;
  `)
  await expectFail(
    () =>
      db.query(
        `select public.publish_published_week_draft_v2(
          p_draft_id => $1,
          p_expected_revision => 2,
          p_expected_content_fingerprint => $2,
          p_expected_validation_fingerprint => $3
        )`,
        [
          staleDraftV2.id,
          staleDraftV2.content_fingerprint,
          staleDraftV2.validation_fingerprint,
        ],
      ),
    'publication_context_changed',
  )
  console.log('✓ Una publicación concurrente invalida el contexto antes de activar')

  const finalRows = await db.query(`
    select
      id,
      titulo,
      is_active,
      publication_status,
      revision,
      version_number,
      source_week_id
    from public.published_weeks
    order by version_number, id
  `)
  assert(
    finalRows.rows.filter((row) => row.is_active).length === 1,
    'la activación atómica conserva exactamente una activa',
  )
  assert(
    finalRows.rows.filter((row) => row.publication_status === 'publishing').length === 0,
    'no queda ninguna fila en publishing',
  )
  const consumed = finalRows.rows.find((row) => row.id === draftV2.id)
  assert(consumed?.publication_status === 'consumed', 'el borrador queda consumido')
  assert(Number(consumed?.revision) === 3, 'consumir invalida revisiones antiguas')
  assert(
    finalRows.rows.find((row) => row.id === published.id)?.source_week_id === draftV2.id,
    'el linaje queda persistido',
  )
  console.log('✓ Publicación/activación atómica, linaje e historial conservados')

  await expectFail(
    () =>
      db.query(
        `select public.publish_published_week_draft_v2(
          p_draft_id => $1,
          p_expected_revision => 2,
          p_expected_content_fingerprint => $2,
          p_expected_validation_fingerprint => $2
        )`,
        [draftV2.id, draftV2.content_fingerprint],
      ),
    'draft_is_not_publishable',
  )

  await db.exec('reset role;')
  await expectFail(
    () =>
      db.query(
        `update public.published_weeks
         set data = '{"alterado":true}'::jsonb
         where id = $1`,
        [published.id],
      ),
    'published_week_history_is_immutable',
  )
  await expectFail(
    () => db.query('delete from public.published_weeks where id = $1', [published.id]),
    'published_week_history_is_immutable',
  )
  console.log('✓ Publicaciones e históricos permanecen inmutables')

  await db.exec(MIGRATION)
  const afterRerun = await db.query(`
    select
      count(*) filter (where is_active) as active_count,
      count(*) filter (where publication_status = 'publishing') as publishing_count
    from public.published_weeks
  `)
  assert(
    Number(afterRerun.rows[0]?.active_count) === 1 &&
      Number(afterRerun.rows[0]?.publishing_count) === 0,
    'reaplicar la migración no debe alterar el estado estable',
  )
  console.log('✓ Re-ejecución segura sin renumerar ni mutar historial')

  await db.close()
  console.log('RESULTADO: invariantes V2 de published_weeks validados')
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error)
  process.exit(1)
})
