/**
 * Seed Fase 1 V2: org EVO, programmer, clases, ejercicios y semana de ejemplo.
 *
 * Requisitos en .env:
 *   VITE_SUPABASE_URL (o SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 *   PE2_SEED_PASSWORD  (contraseña del usuario programmer)
 *
 * Ejecutar tras migración 20260629150000_pe2_structured_auth.sql:
 *   npm run db:seed-pe2-phase1
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

const PROGRAMMER_EMAIL = 'marianpersonaltrainer@gmail.com'
const PROGRAMMER_NAME = 'Marian EVO'

const CLASS_TYPES = [
  { slug: 'funcional', label: 'EvoFuncional', sort: 1, dna: { objetivo: 'Condicionamiento variado', duracion_min: 30, material: ['KB', 'mancuernas', 'cajón'] } },
  { slug: 'basics', label: 'EvoBasics', sort: 2, dna: { objetivo: 'Técnica y progresión', duracion_min: 28, material: ['mancuernas', 'bandas'] } },
  { slug: 'fit', label: 'EvoFit', sort: 3, dna: { objetivo: 'Alta intensidad breve', duracion_min: 24, material: ['barra', 'remo'] } },
  { slug: 'hyrox', label: 'EvoHyrox', sort: 4, dna: { objetivo: 'Hybrid race prep', duracion_min: 35, material: ['sled', 'remo', 'wall ball'] } },
  { slug: 'fuerza', label: 'EvoFuerza', sort: 5, dna: { objetivo: 'Fuerza máxima', duracion_min: 40, material: ['barra', 'rack'] } },
  { slug: 'gimnastica', label: 'EvoGimnástica', sort: 6, dna: { objetivo: 'Control corporal', duracion_min: 32, material: ['anillas', 'paralelas'] } },
]

const EXERCISES = [
  { name: 'Back Squat', pattern: 'squat', equipment: ['barbell'], aliases: ['sentadilla trasera'] },
  { name: 'Deadlift', pattern: 'hinge', equipment: ['barbell'], aliases: ['peso muerto'] },
  { name: 'Push Press', pattern: 'push', equipment: ['barbell'], aliases: [] },
  { name: 'Pull-up', pattern: 'pull', equipment: ['bar'], aliases: ['dominada'] },
  { name: 'Plank', pattern: 'core', equipment: [], aliases: ['plancha'] },
  { name: 'AMRAP mixto', pattern: 'full', equipment: ['kb', 'box'], aliases: [] },
]

async function main() {
  loadDotEnv()
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const password = process.env.PE2_SEED_PASSWORD

  if (!url || !serviceKey) {
    console.error('Faltan SUPABASE_URL/VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env')
    process.exit(1)
  }
  if (!password) {
    console.error('Define PE2_SEED_PASSWORD en .env (contraseña del programmer de prueba).')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  // Org EVO
  let orgId
  const { data: existingOrg } = await admin.from('organizations').select('id').eq('slug', 'evo').maybeSingle()
  if (existingOrg?.id) {
    orgId = existingOrg.id
    console.log('Org EVO existente:', orgId)
  } else {
    const { data: org, error: orgErr } = await admin.from('organizations').insert({ name: 'EVO', slug: 'evo' }).select('id').single()
    if (orgErr) throw orgErr
    orgId = org.id
    console.log('Org EVO creada:', orgId)
  }

  // Auth user
  let userId
  const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const found = listData?.users?.find((u) => u.email === PROGRAMMER_EMAIL)
  if (found) {
    userId = found.id
    await admin.auth.admin.updateUserById(userId, { password, email_confirm: true })
    console.log('Usuario existente actualizado:', PROGRAMMER_EMAIL)
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: PROGRAMMER_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: PROGRAMMER_NAME },
    })
    if (createErr) throw createErr
    userId = created.user.id
    console.log('Usuario creado:', PROGRAMMER_EMAIL)
  }

  // Profile
  const { error: profileErr } = await admin.from('profiles').upsert(
    { id: userId, full_name: PROGRAMMER_NAME, role: 'programmer', org_id: orgId, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  )
  if (profileErr) throw profileErr

  // Programmer state
  await admin.from('pe2_programmer_state').upsert({
    user_id: userId,
    org_id: orgId,
    mesociclo: 'fuerza',
    semana: 1,
    phase: 'Acumulación',
    updated_at: new Date().toISOString(),
  })

  // Class types
  const classTypeIds = {}
  for (const ct of CLASS_TYPES) {
    const { data, error } = await admin
      .from('pe2_class_types')
      .upsert({ org_id: orgId, slug: ct.slug, label: ct.label, sort_order: ct.sort, is_active: true, dna: ct.dna }, { onConflict: 'org_id,slug' })
      .select('id, slug')
      .single()
    if (error) throw error
    classTypeIds[ct.slug] = data.id
  }
  console.log('Clases:', Object.keys(classTypeIds).length)

  // Exercises
  const exerciseIds = {}
  for (const ex of EXERCISES) {
    const { data: existing } = await admin.from('pe2_exercises').select('id').eq('org_id', orgId).eq('name', ex.name).maybeSingle()
    if (existing?.id) {
      exerciseIds[ex.name] = existing.id
      continue
    }
    const { data, error } = await admin
      .from('pe2_exercises')
      .insert({ org_id: orgId, name: ex.name, pattern: ex.pattern, equipment: ex.equipment, aliases: ex.aliases })
      .select('id')
      .single()
    if (error) throw error
    exerciseIds[ex.name] = data.id
  }

  // Backfill org en borradores antiguos sin org_id
  await admin.from('pe2_weeks').update({ org_id: orgId }).is('org_id', null)

  // Example week
  const mesociclo = 'fuerza'
  const semana = 1
  let weekId
  const { data: existingWeek } = await admin
    .from('pe2_weeks')
    .select('id')
    .eq('org_id', orgId)
    .eq('mesociclo', mesociclo)
    .eq('semana', semana)
    .eq('is_primary', true)
    .neq('status', 'archived')
    .maybeSingle()

  if (existingWeek?.id) {
    weekId = existingWeek.id
    console.log('Semana ejemplo existente:', weekId)
  } else {
    const { data: week, error: weekErr } = await admin
      .from('pe2_weeks')
      .insert({
        org_id: orgId,
        mesociclo,
        semana,
        phase: 'Acumulación',
        titulo: 'Fuerza · S1 · ejemplo seed',
        status: 'draft',
        is_primary: true,
        data: {},
      })
      .select('id')
      .single()
    if (weekErr) throw weekErr
    weekId = week.id
    console.log('Semana ejemplo creada:', weekId)
  }

  // Clear old seed sessions for idempotency
  await admin.from('pe2_sessions').delete().eq('week_id', weekId)

  const seedSessions = [
    { slug: 'funcional', weekday: 1, title: 'Squat + engine', pattern: 'squat', status: 'confirmed', est: 30 },
    { slug: 'basics', weekday: 1, title: 'Hinge técnica', pattern: 'hinge', status: 'ai_draft', est: 28 },
    { slug: 'fit', weekday: 1, title: 'Push metcon', pattern: 'push', status: 'confirmed', est: 24 },
    { slug: 'funcional', weekday: 2, title: 'Pull volume', pattern: 'pull', status: 'confirmed', est: 30 },
    { slug: 'basics', weekday: 2, title: 'Core + squat', pattern: 'core', status: 'confirmed', est: 28 },
    { slug: 'fit', weekday: 3, title: 'Full AMRAP', pattern: 'full', status: 'ai_draft', est: 22 },
  ]

  for (const s of seedSessions) {
    const { data: session, error: sErr } = await admin
      .from('pe2_sessions')
      .insert({
        week_id: weekId,
        org_id: orgId,
        class_type_id: classTypeIds[s.slug],
        weekday: s.weekday,
        title: s.title,
        dominant_pattern: s.pattern,
        objective: `Objetivo ${s.title}`,
        est_minutes: s.est,
        status: s.status,
      })
      .select('id')
      .single()
    if (sErr) throw sErr

    const blocks = [
      { kind: 'warmup', name: 'Calentamiento', dose: '2 rondas', duration_min: 8, sort: 0, items: [{ text: 'Movilidad cadera + activación', rx: "8'/lado" }] },
      { kind: 'A', name: 'Fuerza', dose: '5x5', duration_min: 12, sort: 1, items: [{ ex: 'Back Squat', text: 'Back Squat', rx: '@75%' }] },
      { kind: 'B', name: 'Accesorio', dose: '3x10', duration_min: 8, sort: 2, items: [{ ex: 'Plank', text: 'Plank', rx: '40s' }] },
      { kind: 'C', name: 'WOD', dose: 'AMRAP 10', duration_min: 10, sort: 3, items: [{ ex: 'AMRAP mixto', text: 'KB swing + box step', rx: "10'" }] },
    ]

    for (const b of blocks) {
      const { data: block, error: bErr } = await admin
        .from('pe2_blocks')
        .insert({
          session_id: session.id,
          org_id: orgId,
          kind: b.kind,
          name: b.name,
          dose: b.dose,
          duration_min: b.duration_min,
          sort_order: b.sort,
        })
        .select('id')
        .single()
      if (bErr) throw bErr

      for (let i = 0; i < b.items.length; i += 1) {
        const it = b.items[i]
        await admin.from('pe2_block_items').insert({
          block_id: block.id,
          org_id: orgId,
          exercise_ref: it.ex ? exerciseIds[it.ex] : null,
          raw_text: it.text,
          prescription: it.rx,
          sort_order: i,
        })
      }
    }
  }

  console.log('\nSeed V2 listo.')
  console.log(`  Email: ${PROGRAMMER_EMAIL}`)
  console.log(`  Org: EVO (${orgId})`)
  console.log(`  Semana ejemplo: ${weekId} · ${mesociclo} S${semana}`)
  console.log('  Entra en /?v2 con esas credenciales.')
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
