/**
 * Inserta la biblioteca inicial EVO en coach_exercise_library (service role).
 *
 * Uso (desde la raíz del repo):
 *   export SUPABASE_SERVICE_ROLE_KEY="eyJ..."  # Dashboard → API → service_role
 *   export SUPABASE_URL="https://xxx.supabase.co"   # o usa VITE_SUPABASE_URL
 *   node scripts/seed-coach-exercise-library.mjs
 *
 * Idempotencia: por cada fila, si ya existe misma (name + category), no inserta.
 *
 * Opcional: --force-insert  → inserta aunque exista la pareja (evita duplicar por defecto)
 * Opcional: --print-sql     → imprime SQL (o supabase/seed_coach_exercise_library.sql)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadDotEnv() {
  try {
    const fromCwd = join(process.cwd(), '.env')
    const fromScript = join(__dirname, '..', '.env')
    let raw
    try {
      raw = readFileSync(fromCwd, 'utf8')
    } catch {
      raw = readFileSync(fromScript, 'utf8')
    }
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
      if (!m) continue
      const k = m[1]
      let v = m[2].trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      if (process.env[k] === undefined) process.env[k] = v
    }
  } catch {
    /* sin .env */
  }
}

const SEED = [
  // BISAGRA
  ['Deadlift con barra + %RM', 'bisagra', ['evofuncional'], 'avanzado', 'Patrón principal. % según semana del mesociclo.'],
  ['Romanian Deadlift con barra', 'bisagra', ['evofuncional'], 'intermedio', 'Excéntrico controlado. Rodillas fijas.'],
  ['Romanian Deadlift con DB', 'bisagra', ['evofit', 'evofuncional'], 'intermedio', 'Versión accesible. Tempo 2-1-2.'],
  ['Romanian Deadlift con KB', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Bisagra guiada. Ideal para aprender el patrón.'],
  ['LM Deadlift', 'landmine', ['evobasics', 'evofuncional'], 'basico', 'Bisagra guiada con landmine. Seguro y accesible.'],
  ['LM Romanian DL', 'landmine', ['evofuncional'], 'intermedio', 'Excéntrico con landmine. S3 del mesociclo LM.'],
  ['KB Swing ruso', 'bisagra', ['evofuncional', 'evobasics', 'evofit'], 'basico', 'Máx 2 días/semana. Cadena posterior + potencia.'],
  ['KB Swing americano', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Solo si domina el ruso. Overhead control necesario.'],
  ['Hip Thrust con barra', 'bisagra', ['evofuncional', 'evofit'], 'intermedio', 'Glúteo principal. Banco necesario (3 uds disponibles).'],
  ['Hip Thrust con DB', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Versión accesible del hip thrust.'],
  ['Banded Glute Bridge', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Mini banda. Activación glúteo. Accesorio frecuente.'],
  ['Good Morning', 'bisagra', ['evofuncional'], 'intermedio', 'Cadena posterior + lumbar. Siempre con carga ligera.'],
  ['Nordic Curl', 'bisagra', ['evofuncional'], 'avanzado', 'Excéntrico isquiotibial. Solo EvoGimnástica o Funcional.'],

  // SQUAT
  ['Back Squat con barra + %RM', 'squat', ['evofuncional'], 'avanzado', 'Máx 1 vez/semana por clase. % según mesociclo.'],
  ['Front Squat', 'squat', ['evofuncional'], 'avanzado', 'Requiere movilidad de muñeca y hombro. Técnica previa.'],
  ['Goblet Squat con KB', 'squat', ['evobasics', 'evofit'], 'basico', 'Squat guiado. Ideal para aprender el patrón.'],
  ['2DB Front Squat', 'squat', ['evofit', 'evofuncional'], 'intermedio', 'Alternativa al front squat. Más accesible.'],
  ['Bulgarian Split Squat', 'squat', ['evofuncional', 'evofit'], 'intermedio', 'Unilateral. Banco o banco necesario.'],
  ['LM Hack Squat', 'landmine', ['evofuncional'], 'intermedio', 'Squat guiado con landmine. S3 del mesociclo LM.'],
  ['Air Squat', 'squat', ['evobasics'], 'basico', 'Squat técnico sin carga. Aprender el patrón.'],
  ['Box Step Up', 'squat', ['evobasics', 'evofit'], 'basico', 'Unilateral accesible. 12 cajones disponibles.'],
  ['Jumping Squat', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Potencia baja. WOD. Aterrizaje suave.'],
  ['Lateral Lunge', 'squat', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Movilidad lateral. Frecuente en calentamiento.'],
  ['Reverse Lunge', 'squat', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Unilateral. Más seguro que lunge hacia delante.'],
  ['Cossack Squat', 'squat', ['evofuncional'], 'avanzado', 'Movilidad extrema. Solo Funcional.'],
  ['Pistol Squat', 'squat', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica o Funcional avanzado.'],

  // EMPUJE HORIZONTAL
  ['Bench Press con barra + %RM', 'empuje_horizontal', ['evofuncional'], 'avanzado', 'Empuje horizontal principal. Banco necesario.'],
  ['DB Chest Press', 'empuje_horizontal', ['evofit', 'evofuncional'], 'intermedio', 'Alternativa accesible al bench press.'],
  ['Push Up', 'empuje_horizontal', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Máx 2 días/semana. Escalar: banco o rack bajo.'],
  ['Ring Push Up', 'empuje_horizontal', ['evofuncional'], 'avanzado', 'Inestabilidad añadida. Anillas necesarias.'],
  ['Floor Press con barra', 'empuje_horizontal', ['evofuncional', 'evofit'], 'intermedio', 'Empuje sin banco. ROM limitado.'],

  // EMPUJE VERTICAL
  ['Strict Press con barra', 'empuje_vertical', ['evofuncional'], 'avanzado', 'Desde rack. % según mesociclo. Core activo.'],
  ['Push Press', 'empuje_vertical', ['evofuncional'], 'avanzado', 'Impulso de piernas. Técnica previa de strict press.'],
  ['DB Shoulder Press', 'empuje_vertical', ['evofit', 'evofuncional'], 'intermedio', 'Accesible. Desde sentado o de pie.'],
  ['LM Shoulder Press', 'landmine', ['evobasics', 'evofuncional'], 'basico', 'Empuje vertical guiado. Muy seguro para hombro.'],
  ['LM 1-Arm Push Press', 'landmine', ['evofuncional'], 'avanzado', 'Unilateral. Complejidad alta.'],
  ['Pike HSPU', 'empuje_vertical', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica. Progresión hacia HSPU.'],
  ['DB Lateral Raise', 'empuje_vertical', ['evofit', 'evobasics'], 'basico', 'Deltoides. Accesorio frecuente.'],

  // JALÓN
  ['Pull Up estricto', 'jalon', ['evofuncional'], 'avanzado', 'Base gimnástica. Escalar: ring row inclinado.'],
  ['Chin Up', 'jalon', ['evofuncional'], 'avanzado', 'Supinado. Más fácil que pull up.'],
  ['Ring Row', 'jalon', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Fundamental. Ajustar inclinación según nivel.'],
  ['Bent Over Barbell Row', 'jalon', ['evofuncional'], 'avanzado', 'Tirón horizontal con barra. % según mesociclo.'],
  ['Pendlay Row', 'jalon', ['evofuncional'], 'avanzado', 'Variante del bent over row. Desde el suelo.'],
  ['DB Single Arm Row', 'jalon', ['evofit', 'evofuncional', 'evobasics'], 'basico', 'Unilateral. Muy versátil. Frecuente en todas las clases.'],
  ['KB Single Arm Row', 'jalon', ['evofit', 'evofuncional', 'evobasics'], 'basico', 'Igual que DB row pero con KB.'],
  ['LM Row', 'landmine', ['evofuncional', 'evobasics'], 'basico', 'Tirón guiado con landmine.'],
  ['Scap Pull Up', 'jalon', ['evofuncional', 'evobasics'], 'basico', 'Activación escapular. Frecuente en calentamiento.'],
  ['Face Pull con banda', 'jalon', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Rotadores. Compensatorio. Meter siempre con empuje.'],
  ['Band Pull Apart', 'jalon', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Calentamiento de hombro. Frecuente.'],
  ['Ring Bicep Curl', 'jalon', ['evobasics', 'evofit'], 'basico', 'Bíceps. Accesorio. Anillas necesarias.'],

  // ROTACIÓN / LANDMINE / CORE (Russian Twist)
  ['LM Rotation sin carga', 'rotacion', ['evofuncional', 'evobasics'], 'basico', 'S1 del mesociclo LM. Aprender rotación desde cadera.'],
  ['LM Pallof Press', 'rotacion', ['evofuncional', 'evobasics'], 'basico', 'Anti-rotación. S1-S2 del mesociclo LM.'],
  ['LM Rotational Press', 'landmine', ['evofuncional'], 'avanzado', 'S4 del mesociclo LM. Ejercicio central.'],
  ['LM Rainbow', 'landmine', ['evofuncional'], 'avanzado', 'S5 del mesociclo LM. Complejidad máxima.'],
  ['LM Clean', 'landmine', ['evofuncional'], 'avanzado', 'S5 del mesociclo LM. Requiere clean técnico previo.'],
  ['LM Squat to Press', 'landmine', ['evofuncional'], 'avanzado', 'Movimiento complejo. Full body.'],
  ['Russian Twist', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Core rotacional. Frecuente en WOD y accesorios.'],

  // CORE
  ['Hollow Body Hold', 'core', ['evofuncional', 'evobasics', 'evofit'], 'basico', 'Base de todos los gimnásticos. Frecuente.'],
  ['Hollow Body Rock', 'core', ['evofuncional'], 'intermedio', 'Progresión del hold.'],
  ['V-Up', 'core', ['evofuncional', 'evofit'], 'intermedio', 'Core dinámico. Escalar: tuck-up.'],
  ['Tuck Up', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Versión accesible del V-up.'],
  ['Dead Bug', 'core', ['evobasics', 'evofit'], 'basico', 'Anti-extensión. Muy seguro. Frecuente en Basics.'],
  ['Plank', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Isométrico. Base del core.'],
  ['Single Arm Plank', 'core', ['evofit', 'evofuncional'], 'intermedio', 'Anti-rotación. Más difícil que plank normal.'],
  ['L-Sit', 'core', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica. Progresión: tuck-sit.'],
  ['Toes to Bar', 'core', ['evofuncional'], 'avanzado', 'Gimnástico. Solo Funcional. Escalar: knee raise.'],
  ['Hanging Knee Raise', 'core', ['evofuncional', 'evofit'], 'intermedio', 'Alternativa al T2B. Más accesible.'],
  ['Bear Crawl', 'core', ['evofuncional', 'evobasics'], 'basico', 'Core + coordinación. Frecuente en calentamiento.'],
  ['Bird Dog', 'core', ['evobasics', 'evofit'], 'basico', 'Estabilización lumbar. Accesorio.'],
  ['Inchworm', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Movilidad + core. Frecuente en calentamiento.'],

  // OLÍMPICOS
  ['Power Clean', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica previa obligatoria. Mín 10-12 min de técnica.'],
  ['Hang Power Clean', 'olimpico', ['evofuncional'], 'avanzado', 'Más accesible que el clean completo.'],
  ['KB Clean', 'olimpico', ['evofuncional'], 'avanzado', 'Introducir en Funcional con técnica previa. No en WOD sin prep.'],
  ['Power Snatch', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica avanzada. Solo si el grupo tiene base.'],
  ['KB Snatch', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica avanzada KB. Introducir progresivamente.'],
  ['Push Jerk', 'olimpico', ['evofuncional'], 'avanzado', 'Requiere press técnico previo.'],

  // METABÓLICO
  ['Box Jump', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Aterrizaje suave obligatorio. 12 cajones disponibles.'],
  ['Box Step Up', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Alternativa segura al box jump.'],
  ['Burpee', 'metabolico', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Metabólico clásico. Máx 2 días/semana.'],
  ['Burpee Box Jump', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Versión exigente. Cajón necesario.'],
  ['Wall Ball', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', '7kg única talla para clase completa. Máx 2 días/semana.'],
  ['Slam Ball', 'metabolico', ['evofuncional', 'evofit'], 'basico', 'Solo en rotación o parejas. 3 uds de 8/10kg.'],
  ['Thruster', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Máx 1 vez/semana en toda la programación.'],
  ['DB Thruster', 'metabolico', ['evofuncional', 'evofit', 'evobasics'], 'intermedio', 'Versión más accesible del thruster.'],
  ['Remo Concept 2', 'metabolico', ['evofuncional', 'evofit', 'evobasics'], 'basico', '1 máquina. Máx 2 por sesión. No en 2 clases simultáneas.'],
  ['Air Bike', 'metabolico', ['evofuncional', 'evofit'], 'basico', '1 máquina. Compartir con remo si hay 2 clases.'],
  ['Run 200m / 400m', 'metabolico', ['evofuncional', 'evofit', 'evobasics'], 'basico', 'Cardio simple. No requiere material.'],
  ['Double Unders', 'metabolico', ['evofuncional'], 'avanzado', '8 combas en estado regular. Solo Funcional.'],
  ['Single Unders', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Alternativa a DU. Mismas combas.'],
  ['Mountain Climber', 'metabolico', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Sin material. Frecuente en WOD.'],
  ['Jumping Lunge', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Potencia baja. Aterrizaje controlado.'],
  ['Farmer Carry', 'metabolico', ['evofuncional', 'evofit'], 'basico', '2 farmer handles disponibles. Parejas o circuito.'],
  ['Sled Push', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', '2 trineos. Siempre en parejas o circuito.'],
]

const IS_NEW_NAMES = new Set(['KB Clean', 'KB Snatch'])

function sqlEscape(s) {
  return String(s).replace(/'/g, "''")
}

function printSql() {
  const lines = [
    '-- Biblioteca inicial EVO (Documento Maestro). Generado: scripts/seed-coach-exercise-library.mjs --print-sql',
    '-- KB Clean y KB Snatch: is_new = true. Ejecutar en Supabase SQL Editor o: node scripts/seed-coach-exercise-library.mjs (con service role).',
    '',
    'begin;',
    '',
  ]
  for (const [name, category, classes, level, notes] of SEED) {
    const isNew = IS_NEW_NAMES.has(name)
    const arrSql = classes.map((c) => `'${sqlEscape(c)}'`).join(', ')
    lines.push(
      `insert into public.coach_exercise_library (name, category, classes, level, notes, is_new, active, video_url) values (` +
        `'${sqlEscape(name)}', '${sqlEscape(category)}', ARRAY[${arrSql}]::text[], '${sqlEscape(level)}', '${sqlEscape(notes)}', ${isNew}, true, null` +
        `);`,
    )
  }
  lines.push('', 'commit;')
  console.log(lines.join('\n'))
}

async function main() {
  loadDotEnv()

  if (process.argv.includes('--print-sql')) {
    printSql()
    process.exit(0)
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const forceInsert = process.argv.includes('--force-insert')

  if (!url || !key) {
    console.error('Faltan SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY en el entorno.')
    console.error('Añade SUPABASE_SERVICE_ROLE_KEY al .env (una vez) o: export SUPABASE_SERVICE_ROLE_KEY=...')
    console.error('Alternativa: node scripts/seed-coach-exercise-library.mjs --print-sql  → pega el SQL en Supabase SQL Editor.')
    process.exit(1)
  }

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  let inserted = 0
  let skipped = 0
  let errors = 0

  for (const [name, category, classes, level, notes] of SEED) {
    if (!forceInsert) {
      const { data: existing, error: qErr } = await supabase
        .from('coach_exercise_library')
        .select('id')
        .eq('name', name)
        .eq('category', category)
        .maybeSingle()
      if (qErr) {
        console.error('Consulta:', name, qErr.message)
        errors++
        continue
      }
      if (existing) {
        skipped++
        continue
      }
    }

    const row = {
      name,
      category,
      classes,
      level,
      notes,
      is_new: IS_NEW_NAMES.has(name),
      active: true,
      video_url: null,
    }

    const { error } = await supabase.from('coach_exercise_library').insert(row)
    if (error) {
      console.error('Insert:', name, error.message)
      errors++
    } else {
      inserted++
    }
  }

  console.log(JSON.stringify({ ok: errors === 0, inserted, skipped, errors, totalSeed: SEED.length }, null, 2))
  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
