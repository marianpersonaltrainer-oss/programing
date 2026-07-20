#!/usr/bin/env node
/**
 * Prueba local de la migración method_rules_scope (Opción A).
 *
 * ENTORNO: PostgreSQL embebido (@electric-sql/pglite) en memoria.
 *
 * Garantías de seguridad:
 * - NO lee .env, .env.local ni variables de entorno de Supabase.
 * - NO utiliza credenciales, tokens ni URLs de producción.
 * - NO realiza conexiones de red (fetch, pg remoto, Supabase client).
 * - NO puede modificar Supabase remoto: solo SQL en memoria local.
 *
 * Alcance de la validación:
 * - Valida esquema, columnas legacy, CHECK constraints y la función atómica
 *   del Centro de revisión.
 * - NO valida políticas RLS. El rol service_role local solo existe para poder
 *   cargar el DDL de permisos; no reproduce JWT ni políticas de Supabase.
 *
 * Comprueba:
 * - 53 filas legacy → rule_status = legacy_unreviewed
 * - Ninguna rule_status = active automáticamente
 * - Inserción pending_review y exclusión del Context Compiler
 * - Rechazo de reglas inválidas (constraints)
 * - Guardar pendiente, aprobar, rechazar y rollback atómico del Centro
 *
 * Uso: npm run test:migration:rules
 */
import { readFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { PGlite } from '@electric-sql/pglite'
import { compileMethodRules } from '../api/lib/contextCompiler.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const NEW_COLUMNS = [
  'rule_status',
  'rule_validity',
  'rule_strength',
  'rule_origin',
  'rule_key',
  'org_id',
  'season_key',
  'mesocycle_key',
  'week_number',
  'valid_from',
  'valid_to',
  'day_of_week',
  'class_types',
  'room_key',
  'time_slot',
  'priority',
  'version',
  'supersedes_id',
  'origin_detail',
  'change_reason',
  'created_by',
  'metadata',
]

const CONSTRAINTS = [
  'method_rules_rule_status_check',
  'method_rules_rule_validity_check',
  'method_rules_rule_strength_check',
  'method_rules_rule_origin_check',
  'method_rules_active_complete_check',
  'method_rules_valid_dates_check',
  'method_rules_temporary_window_check',
  'method_rules_weekly_scope_check',
  'method_rules_week_number_check',
  'method_rules_day_of_week_check',
]

function loadSql(rel) {
  return readFileSync(join(ROOT, rel), 'utf8')
}

async function execSqlFile(db, sql, label) {
  try {
    await db.exec(sql)
    return { ok: true, label }
  } catch (e) {
    return { ok: false, label, error: e.message }
  }
}

async function queryOne(db, sql, params = []) {
  const r = await db.query(sql, params)
  return r.rows[0]
}

async function queryAll(db, sql, params = []) {
  const r = await db.query(sql, params)
  return r.rows
}

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT FAIL: ${message}`)
}

async function expectInsertFail(db, sql, label) {
  try {
    await db.query(sql)
    throw new Error(`Se esperaba fallo en: ${label}`)
  } catch (e) {
    if (e.message.startsWith('Se esperaba fallo')) throw e
    return true
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('Entorno: PGLite (PostgreSQL embebido, in-memory)')
  console.log('Credenciales/variables producción: NO utilizadas')
  console.log('Conexiones de red: NO')
  console.log('Supabase remoto: NO contactado (imposible modificar producción)')
  console.log('RLS/JWT: NO validados (sí esquema, constraints y transacción de revisión)')
  console.log('═══════════════════════════════════════════════════════════\n')

  const db = new PGlite()

  // Bootstrap mínimo (dependencias FK de la migración scope)
  await db.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS public;
    DO $$ BEGIN
      CREATE ROLE service_role;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE ROLE anon;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    DO $$ BEGIN
      CREATE ROLE authenticated;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
    CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.organizations (id uuid PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY REFERENCES auth.users(id),
      role text NOT NULL,
      org_id uuid REFERENCES public.organizations(id)
    );
    CREATE TABLE IF NOT EXISTS public.published_weeks (id uuid PRIMARY KEY);
  `)

  // Tabla base method_rules (equivalente a cerebro_evo, sin RLS — no aplica en PGLite local)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS public.method_rules (
      id bigserial primary key,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      rule_type text not null check (rule_type in ('timing', 'load', 'exercise', 'format', 'rest')),
      trigger_context text,
      rule_text text not null,
      source text not null check (source in ('manual_edit', 'coach_feedback', 'admin')),
      confidence int not null default 50 check (confidence >= 0 and confidence <= 100),
      active boolean not null default true,
      week_id uuid references public.published_weeks(id) on delete set null
    );
  `)

  // 53 filas legacy simuladas (mismo perfil que producción: manual_edit, active=true)
  const inserts = []
  for (let i = 1; i <= 53; i++) {
    inserts.push(
      `INSERT INTO public.method_rules (rule_type, trigger_context, rule_text, source, confidence, active)
       VALUES ('format', 'edicion_sesion', 'Regla legacy de prueba ${i}', 'manual_edit', 80, true);`,
    )
  }
  await db.exec(inserts.join('\n'))

  const before = await queryOne(db, `
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE active = true)::int AS active_bool
    FROM public.method_rules
  `)
  console.log('Antes de migración scope:', before)

  const scope = loadSql('supabase/migrations/20260720140000_method_rules_scope.sql')
  const scopeResult = await execSqlFile(db, scope, 'method_rules_scope')
  assert(scopeResult.ok, `method_rules_scope: ${scopeResult.error}`)

  // ── Verificación 1: columnas y restricciones ─────────────────────────────
  const cols = await queryAll(
    db,
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'method_rules'`,
  )
  const colSet = new Set(cols.map((r) => r.column_name))
  for (const c of NEW_COLUMNS) {
    assert(colSet.has(c), `Falta columna ${c}`)
  }
  for (const c of ['id', 'rule_type', 'trigger_context', 'rule_text', 'source', 'confidence', 'active', 'week_id', 'created_at', 'updated_at']) {
    assert(colSet.has(c), `Columna legacy perdida: ${c}`)
  }

  const cons = await queryAll(
    db,
    `SELECT conname FROM pg_constraint
     WHERE conrelid = 'public.method_rules'::regclass`,
  )
  const conSet = new Set(cons.map((r) => r.conname))
  for (const c of CONSTRAINTS) {
    assert(conSet.has(c), `Falta constraint ${c}`)
  }
  console.log('✓ 1. Columnas nuevas + legacy y constraints presentes')

  // ── Verificación 2 y 3: legacy_unreviewed, ninguna active (rule_status) ──
  const after = await queryOne(db, `
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE rule_status = 'legacy_unreviewed')::int AS legacy,
      count(*) FILTER (WHERE rule_status = 'active')::int AS status_active,
      count(*) FILTER (WHERE active = true)::int AS bool_active
    FROM public.method_rules
  `)
  assert(after.total === 53, `Esperadas 53 filas, hay ${after.total}`)
  assert(after.legacy === 53, `Esperadas 53 legacy_unreviewed, hay ${after.legacy}`)
  assert(after.status_active === 0, `Ninguna debe tener rule_status=active, hay ${after.status_active}`)
  console.log('✓ 2. Las 53 reglas quedan como legacy_unreviewed')
  console.log('✓ 3. Ninguna rule_status=active automáticamente')

  // ── Verificación 4: columnas legacy y active conservados ─────────────────
  assert(after.bool_active === 53, `Boolean active debe conservarse (53 true), hay ${after.bool_active}`)
  const sample = await queryOne(db, `
    SELECT id, rule_type, source, confidence, active, week_id, rule_origin
    FROM public.method_rules ORDER BY id LIMIT 1
  `)
  assert(sample.rule_type === 'format', 'rule_type legacy perdido')
  assert(sample.source === 'manual_edit', 'source legacy perdido')
  assert(sample.confidence === 80, 'confidence legacy perdido')
  assert(sample.active === true, 'active boolean debe seguir true')
  assert(sample.rule_origin === 'manual', 'rule_origin backfill desde source')
  console.log('✓ 4. Columnas legacy y campo active conservados')

  // ── Verificación 5: Context Compiler excluye legacy ─────────────────────
  const allRules = await queryAll(db, `SELECT * FROM public.method_rules ORDER BY id`)
  const compiled = compileMethodRules(allRules, {
    task: 'briefing',
    orgId: null,
    mesocycleKey: 'fuerza',
    weekNumber: 3,
    date: '2026-07-15',
    classType: 'evofuncional',
  })
  assert(compiled.applicableRules.length === 0, 'Compiler no debe aplicar reglas legacy')
  assert(
    compiled.excluded.filter((e) => e.reason === 'legacy_unreviewed').length === 53,
    'Compiler debe excluir 53 legacy_unreviewed',
  )
  console.log('✓ 5. Context Compiler excluye las 53 reglas legacy')

  // ── Verificación 6: nueva regla pending_review ───────────────────────────
  await db.query(
    `INSERT INTO public.method_rules (
      rule_type, rule_text, source, confidence, active,
      rule_status, rule_origin, rule_validity, rule_strength, rule_key, change_reason
    ) VALUES (
      'exercise', 'Corrección de prueba', 'manual_edit', 70, false,
      'pending_review', 'correction', 'permanent', 'preferred', 'warmup_visibility', 'test_local'
    )`,
  )
  const pending = await queryOne(db, `
    SELECT rule_status, active FROM public.method_rules WHERE change_reason = 'test_local'
  `)
  assert(pending.rule_status === 'pending_review', 'Nueva regla debe ser pending_review')
  assert(pending.active === false, 'Nueva corrección debe tener active=false')
  const allAfterInsert = await queryAll(db, `SELECT * FROM public.method_rules ORDER BY id`)
  const compiled2 = compileMethodRules(allAfterInsert, {
    task: 'briefing',
    orgId: null,
    mesocycleKey: 'fuerza',
    weekNumber: 3,
    date: '2026-07-15',
  })
  assert(
    compiled2.applicableRules.every((r) => r.rule_status !== 'pending_review'),
    'pending_review no debe entrar al compiler',
  )
  console.log('✓ 6. Regla nueva entra como pending_review y queda excluida del compiler')

  // ── Verificación 7: reglas inválidas rechazadas por constraints ─────────
  await expectInsertFail(
    db,
    `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status)
     VALUES ('format', 'x', 'manual_edit', 'not_a_valid_status')`,
    'rule_status inválido',
  )
  await expectInsertFail(
    db,
    `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status, active)
     VALUES ('format', 'x', 'manual_edit', 'active', true)`,
    'active incompleto sin dimensiones',
  )
  await expectInsertFail(
    db,
    `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status, rule_validity, rule_key, rule_strength, rule_origin, valid_from, valid_to)
     VALUES ('format', 'x', 'manual_edit', 'pending_review', 'temporary', 'summer_schedule', 'preferred', 'correction', '2026-08-01', '2026-07-01')`,
    'valid_from posterior a valid_to',
  )
  await expectInsertFail(
    db,
    `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status, rule_validity, rule_key, rule_strength, rule_origin)
     VALUES ('format', 'x', 'manual_edit', 'pending_review', 'temporary', 'summer_schedule', 'preferred', 'correction')`,
    'temporary sin ventana de fechas',
  )
  await expectInsertFail(
    db,
    `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status, rule_validity, rule_key, rule_strength, rule_origin, week_number)
     VALUES ('format', 'x', 'manual_edit', 'pending_review', 'weekly_exception', 'warmup_visibility', 'preferred', 'correction', 0)`,
    'week_number inválido (0)',
  )
  console.log('✓ 7. Reglas inválidas rechazadas por constraints')

  // ── Verificación 8: rollback documentado ─────────────────────────────────
  const rollbackDoc = readFileSync(join(ROOT, 'docs/CONTEXT_COMPILER.md'), 'utf8')
  assert(rollbackDoc.includes('## Rollback'), 'Falta sección Rollback en docs')
  assert(rollbackDoc.includes('CONTEXT_COMPILER_SHADOW_MODE=false'), 'Rollback: shadow mode')
  assert(rollbackDoc.includes('columnas nullable ignorables'), 'Rollback: columnas aditivas')
  console.log('✓ 8. Rollback documentado en docs/CONTEXT_COMPILER.md')

  // Constraint active_complete (caso explícito adicional)
  let activeBlocked = false
  try {
    await db.query(
      `INSERT INTO public.method_rules (rule_type, rule_text, source, rule_status, active)
       VALUES ('format', 'x', 'manual_edit', 'active', true)`,
    )
  } catch {
    activeBlocked = true
  }
  assert(activeBlocked, 'INSERT rule_status=active sin rule_key debe fallar por constraint')
  console.log('✓ Extra: ninguna regla se activa automáticamente (0 rule_status=active tras migración)')

  // ── Verificación 9: Centro de revisión atómico ───────────────────────────
  const orgId = '11111111-1111-4111-8111-111111111111'
  const reviewerId = '22222222-2222-4222-8222-222222222222'
  await db.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [orgId])
  await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [reviewerId])
  await db.query(
    `INSERT INTO public.profiles (id, role, org_id) VALUES ($1, 'programmer', $2)`,
    [reviewerId, orgId],
  )

  const reviewSql = loadSql('supabase/migrations/20260720170000_method_rule_review_center.sql')
  const reviewResult = await execSqlFile(db, reviewSql, 'method_rule_review_center')
  assert(reviewResult.ok, `method_rule_review_center: ${reviewResult.error}`)

  const callReview = async (payload) => {
    const row = await queryOne(
      db,
      `SELECT public.pe2_review_method_rule_group($1::jsonb) AS result`,
      [JSON.stringify({ orgId, reviewerId, allowUnscoped: true, ...payload })],
    )
    return row.result
  }

  const pendingResult = await callReview({
    action: 'save_pending',
    sourceIds: [1, 2],
    ruleKey: 'effective_duration',
    ruleText: 'Programar 30-32 minutos efectivos.',
    ruleType: 'timing',
    validity: 'permanent',
    strength: 'required',
    changeReason: 'prueba_local',
  })
  assert(pendingResult.status === 'pending_review', 'Guardar borrador debe crear pending_review')
  const pendingState = await queryOne(
    db,
    `SELECT rule_status, active FROM public.method_rules WHERE id = $1`,
    [pendingResult.canonicalId],
  )
  assert(pendingState.rule_status === 'pending_review', 'Borrador no queda pending_review')
  assert(pendingState.active === false, 'Guardar pendiente no puede activar la regla')
  const sourcesBeforeApproval = await queryOne(
    db,
    `SELECT count(*)::int AS legacy FROM public.method_rules
     WHERE id = ANY($1::bigint[]) AND rule_status = 'legacy_unreviewed'`,
    [[1, 2]],
  )
  assert(sourcesBeforeApproval.legacy === 2, 'Guardar pendiente no debe resolver fuentes')

  const approval = await callReview({
    action: 'approve',
    sourceIds: [1, 2],
    canonicalId: pendingResult.canonicalId,
    ruleKey: 'effective_duration',
    ruleText: 'Programar 30-32 minutos efectivos.',
    ruleType: 'timing',
    validity: 'permanent',
    strength: 'required',
  })
  assert(approval.status === 'active', 'Aprobación explícita debe activar la canónica')
  const approvedState = await queryOne(
    db,
    `SELECT rule_status, active, org_id FROM public.method_rules WHERE id = $1`,
    [approval.canonicalId],
  )
  assert(approvedState.rule_status === 'active' && approvedState.active === true, 'Canónica no activada')
  assert(approvedState.org_id === orgId, 'Canónica debe quedar acotada a la organización')
  const superseded = await queryOne(
    db,
    `SELECT count(*)::int AS total FROM public.method_rules
     WHERE id = ANY($1::bigint[]) AND rule_status = 'superseded' AND active = false`,
    [[1, 2]],
  )
  assert(superseded.total === 2, 'Las fuentes aprobadas deben quedar sustituidas')

  const rejected = await callReview({
    action: 'reject',
    sourceIds: [3, 4],
    changeReason: 'no pertenece al método',
  })
  assert(rejected.status === 'rejected', 'Rechazo explícito no aplicado')
  const rejectedRows = await queryOne(
    db,
    `SELECT count(*)::int AS total FROM public.method_rules
     WHERE id = ANY($1::bigint[]) AND rule_status = 'rejected' AND active = false`,
    [[3, 4]],
  )
  assert(rejectedRows.total === 2, 'El grupo rechazado debe quedar inactivo')

  const directPending = await queryOne(
    db,
    `INSERT INTO public.method_rules (
       rule_type, trigger_context, rule_text, source, confidence, active,
       rule_status, rule_validity, rule_strength, rule_origin, rule_key, org_id
     ) VALUES (
       'format', 'correccion_sesion', 'Feedback breve y operativo.', 'admin', 90, false,
       'pending_review', 'permanent', 'required', 'correction', 'feedback_format', $1
     ) RETURNING id`,
    [orgId],
  )
  const directApproval = await callReview({
    action: 'approve',
    sourceIds: [directPending.id],
    canonicalId: directPending.id,
    ruleKey: 'feedback_format',
    ruleText: 'Feedback breve y operativo.',
    ruleType: 'format',
    validity: 'permanent',
    strength: 'required',
  })
  const directApprovedState = await queryOne(
    db,
    `SELECT rule_status, active, supersedes_id FROM public.method_rules WHERE id = $1`,
    [directApproval.canonicalId],
  )
  assert(directApprovedState.rule_status === 'active', 'Corrección pending directa no activada')
  assert(directApprovedState.supersedes_id == null, 'Una regla no puede sustituirse a sí misma')
  const compiledAfterReview = compileMethodRules(
    await queryAll(db, `SELECT * FROM public.method_rules ORDER BY id`),
    { task: 'briefing', orgId, mesocycleKey: 'fuerza', weekNumber: 3, date: '2026-07-15' },
  )
  assert(
    compiledAfterReview.applicableRules.some((rule) => Number(rule.id) === Number(directPending.id)),
    'La corrección aprobada directamente debe ser elegible para el compiler',
  )

  let atomicFailure = false
  try {
    await callReview({
      action: 'approve',
      sourceIds: [5, 999999],
      ruleKey: 'feedback_format',
      ruleText: 'Feedback breve y operativo.',
      ruleType: 'format',
      validity: 'permanent',
      strength: 'required',
    })
  } catch {
    atomicFailure = true
  }
  assert(atomicFailure, 'Una fuente inexistente debe abortar la operación')
  const untouched = await queryOne(
    db,
    `SELECT rule_status, active FROM public.method_rules WHERE id = 5`,
  )
  assert(untouched.rule_status === 'legacy_unreviewed', 'El fallo atómico modificó una fuente válida')
  assert(untouched.active === true, 'El fallo atómico cambió el boolean legacy')

  const permissions = await queryOne(
    db,
    `SELECT
       has_function_privilege('service_role', 'public.pe2_review_method_rule_group(jsonb)', 'EXECUTE') AS service_ok,
       has_function_privilege('authenticated', 'public.pe2_review_method_rule_group(jsonb)', 'EXECUTE') AS auth_ok,
       has_function_privilege('anon', 'public.pe2_review_method_rule_group(jsonb)', 'EXECUTE') AS anon_ok`,
  )
  assert(permissions.service_ok === true, 'service_role debe poder ejecutar la función')
  assert(permissions.auth_ok === false, 'authenticated no debe ejecutar la función directamente')
  assert(permissions.anon_ok === false, 'anon no debe ejecutar la función')

  const secondOrgId = '33333333-3333-4333-8333-333333333333'
  const secondReviewerId = '44444444-4444-4444-8444-444444444444'
  await db.query(`INSERT INTO public.organizations (id) VALUES ($1)`, [secondOrgId])
  await db.query(`INSERT INTO auth.users (id) VALUES ($1)`, [secondReviewerId])
  await db.query(
    `INSERT INTO public.profiles (id, role, org_id) VALUES ($1, 'programmer', $2)`,
    [secondReviewerId, secondOrgId],
  )
  let crossOrgBlocked = false
  try {
    await queryOne(
      db,
      `SELECT public.pe2_review_method_rule_group($1::jsonb) AS result`,
      [JSON.stringify({
        action: 'reject',
        orgId: secondOrgId,
        reviewerId: secondReviewerId,
        allowUnscoped: false,
        sourceIds: [6],
        changeReason: 'intento_otra_org',
      })],
    )
  } catch {
    crossOrgBlocked = true
  }
  assert(crossOrgBlocked, 'Otra organización no debe reclamar legacy sin org_id')
  const crossOrgUntouched = await queryOne(
    db,
    `SELECT rule_status, org_id FROM public.method_rules WHERE id = 6`,
  )
  assert(crossOrgUntouched.rule_status === 'legacy_unreviewed', 'Intento cross-org cambió el estado')
  assert(crossOrgUntouched.org_id == null, 'Intento cross-org reclamó la regla')
  console.log('✓ 9. Centro: atomicidad, permisos y aislamiento entre organizaciones')

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('RESULTADO: migración verificada OK en PGLite (entorno local)')
  console.log('Producción Supabase NO modificada')
  console.log('═══════════════════════════════════════════════════════════')

  await db.close()
}

main().catch((e) => {
  console.error('\nFALLO:', e.message)
  process.exit(1)
})
