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
 * Opcional: --print-sql     → imprime SQL para revisarlo o pegarlo en el editor de Supabase
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
  ['Deadlift con barra + %RM', 'bisagra', ['evofuncional', 'evofit', 'evobasics'], 'intermedio', 'Patrón principal. Porcentaje o carga según semana y modalidad.'],
  ['Romanian Deadlift con barra', 'bisagra', ['evofuncional', 'evofit'], 'intermedio', 'Excéntrico controlado y rodilla estable.'],
  ['Romanian Deadlift con DB', 'bisagra', ['evofit', 'evofuncional'], 'intermedio', 'Variante con mancuernas. Tempo 2-1-2 cuando proceda.'],
  ['Romanian Deadlift con KB', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Bisagra guiada. Ideal para aprender el patrón.'],
  ['LM Deadlift', 'landmine', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Bisagra guiada con landmine.'],
  ['LM Romanian DL', 'landmine', ['evofit', 'evofuncional'], 'intermedio', 'Excéntrico con landmine.'],
  ['KB Swing ruso', 'bisagra', ['evofuncional', 'evobasics', 'evofit'], 'basico', 'Cadena posterior y potencia.'],
  ['KB Swing americano', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Solo si domina el ruso. Overhead control necesario.'],
  ['Hip Thrust con barra', 'bisagra', ['evofuncional', 'evofit'], 'intermedio', 'Glúteo principal. Banco necesario (3 uds disponibles).'],
  ['Hip Thrust con DB', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Variante con mancuerna del hip thrust.'],
  ['Banded Glute Bridge', 'bisagra', ['evobasics', 'evofit'], 'basico', 'Mini banda. Activación glúteo. Accesorio frecuente.'],
  ['Good Morning', 'bisagra', ['evofuncional', 'evofit'], 'intermedio', 'Cadena posterior. Carga subordinada al control del tronco.'],
  ['Nordic Curl', 'bisagra', ['evofuncional'], 'avanzado', 'Excéntrico isquiotibial. Solo EvoGimnástica o Funcional.'],

  // SQUAT
  ['Back Squat con barra + %RM', 'squat', ['evofuncional', 'evofit', 'evobasics'], 'intermedio', 'Fuerza con barra. Porcentaje o carga según mesociclo y modalidad.'],
  ['Front Squat', 'squat', ['evofuncional', 'evofit'], 'avanzado', 'Fuerza con barra; ajustar agarre a la movilidad disponible.'],
  ['Goblet Squat con KB', 'squat', ['evobasics', 'evofit'], 'basico', 'Squat guiado. Ideal para aprender el patrón.'],
  ['2DB Front Squat', 'squat', ['evofit', 'evofuncional'], 'intermedio', 'Variante con dos mancuernas del front squat.'],
  ['Bulgarian Split Squat', 'squat', ['evofuncional', 'evofit'], 'intermedio', 'Unilateral. Banco o banco necesario.'],
  ['LM Hack Squat', 'landmine', ['evofit', 'evofuncional'], 'intermedio', 'Squat guiado con landmine.'],
  ['Air Squat', 'squat', ['evobasics'], 'basico', 'Squat técnico sin carga. Aprender el patrón.'],
  ['Box Step Up', 'squat', ['evobasics', 'evofit'], 'basico', 'Trabajo unilateral. 12 cajones disponibles.'],
  ['Jumping Squat', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Potencia baja. WOD. Aterrizaje suave.'],
  ['Lateral Lunge', 'squat', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Movilidad lateral. Frecuente en calentamiento.'],
  ['Reverse Lunge', 'squat', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Unilateral. Más seguro que lunge hacia delante.'],
  ['Cossack Squat', 'squat', ['evofuncional'], 'avanzado', 'Movilidad extrema. Solo Funcional.'],
  ['Pistol Squat', 'squat', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica o Funcional avanzado.'],

  // EMPUJE HORIZONTAL
  ['Bench Press con barra + %RM', 'empuje_horizontal', ['evofuncional', 'evofit'], 'intermedio', 'Empuje horizontal principal. Banco necesario.'],
  ['DB Chest Press', 'empuje_horizontal', ['evofit', 'evofuncional'], 'intermedio', 'Variante con mancuernas del press horizontal.'],
  ['Push Up', 'empuje_horizontal', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Ajustar con banco o rack si hace falta conservar volumen y posición.'],
  ['Ring Push Up', 'empuje_horizontal', ['evofuncional'], 'avanzado', 'Inestabilidad añadida. Anillas necesarias.'],
  ['Floor Press con barra', 'empuje_horizontal', ['evofuncional', 'evofit'], 'intermedio', 'Empuje sin banco. ROM limitado.'],

  // EMPUJE VERTICAL
  ['Strict Press con barra', 'empuje_vertical', ['evofuncional', 'evofit', 'evobasics'], 'intermedio', 'Desde rack. Carga según mesociclo y modalidad. Tronco estable.'],
  ['Push Press', 'empuje_vertical', ['evofuncional', 'evobasics'], 'intermedio', 'Impulso de piernas. En Basics se trabaja como aprendizaje técnico gestionable.'],
  ['DB Shoulder Press', 'empuje_vertical', ['evofit', 'evofuncional'], 'intermedio', 'Desde sentado o de pie según la intención.'],
  ['LM Shoulder Press', 'landmine', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Empuje guiado con landmine.'],
  ['LM 1-Arm Push Press', 'landmine', ['evofuncional'], 'avanzado', 'Unilateral. Complejidad alta.'],
  ['Pike HSPU', 'empuje_vertical', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica. Progresión hacia HSPU.'],
  ['DB Lateral Raise', 'empuje_vertical', ['evofit', 'evobasics'], 'basico', 'Deltoides. Accesorio frecuente.'],

  // JALÓN
  ['Pull Up estricto', 'jalon', ['evofuncional', 'evofit'], 'avanzado', 'En EvoFit es una opción directa para quien ya la domina; no se enseña como skill.'],
  ['Chin Up', 'jalon', ['evofuncional', 'evofit'], 'avanzado', 'Agarre supino. En EvoFit se usa solo como capacidad ya dominada.'],
  ['Ring Row', 'jalon', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Fundamental. Ajustar inclinación según nivel.'],
  ['Bent Over Barbell Row', 'jalon', ['evofuncional', 'evofit'], 'intermedio', 'Tirón horizontal con barra. Carga según mesociclo.'],
  ['Pendlay Row', 'jalon', ['evofuncional', 'evofit'], 'intermedio', 'Variante del bent over row desde el suelo.'],
  ['DB Single Arm Row', 'jalon', ['evofit', 'evofuncional', 'evobasics'], 'basico', 'Unilateral. Muy versátil. Frecuente en todas las clases.'],
  ['KB Single Arm Row', 'jalon', ['evofit', 'evofuncional', 'evobasics'], 'basico', 'Igual que DB row pero con KB.'],
  ['LM Row', 'landmine', ['evofuncional', 'evobasics', 'evofit'], 'basico', 'Tirón guiado con landmine.'],
  ['Scap Pull Up', 'jalon', ['evofuncional', 'evobasics'], 'basico', 'Activación escapular. Frecuente en calentamiento.'],
  ['Face Pull con banda', 'jalon', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Trabajo escapular y rotadores como accesorio.'],
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
  ['Tuck Up', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Variante de acceso al V-up.'],
  ['Dead Bug', 'core', ['evobasics', 'evofit'], 'basico', 'Anti-extensión. Muy seguro. Frecuente en Basics.'],
  ['Plank', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Isométrico. Base del core.'],
  ['Single Arm Plank', 'core', ['evofit', 'evofuncional'], 'intermedio', 'Anti-rotación. Más difícil que plank normal.'],
  ['L-Sit', 'core', ['evofuncional'], 'avanzado', 'Solo EvoGimnástica. Progresión: tuck-sit.'],
  ['Toes to Bar', 'core', ['evofuncional'], 'avanzado', 'Gimnástico. Solo Funcional. Escalar: knee raise.'],
  ['Hanging Knee Raise', 'core', ['evofuncional', 'evofit'], 'intermedio', 'Trabajo de core colgado con menor amplitud que T2B.'],
  ['Handstand Hold', 'empuje_vertical', ['evofuncional', 'evogimnastica', 'evofit'], 'avanzado', 'En EvoFit solo como opción directa para quien ya domina el pino; no se programa progresión.'],
  ['Wall Walk', 'empuje_vertical', ['evofuncional', 'evogimnastica', 'evobasics', 'evofit'], 'intermedio', 'Control invertido. En EvoFit se ofrece como opción prevista, no como bloque de aprendizaje.'],
  ['Bear Crawl', 'core', ['evofuncional', 'evobasics'], 'basico', 'Core + coordinación. Frecuente en calentamiento.'],
  ['Bird Dog', 'core', ['evobasics', 'evofit'], 'basico', 'Estabilización lumbar. Accesorio.'],
  ['Inchworm', 'core', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Movilidad + core. Frecuente en calentamiento.'],

  // OLÍMPICOS
  ['Power Clean', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica previa obligatoria. Mín 10-12 min de técnica.'],
  ['Hang Power Clean', 'olimpico', ['evofuncional', 'evobasics'], 'intermedio', 'En Basics se usa como aprendizaje con pocas variables y carga controlada.'],
  ['KB Clean', 'olimpico', ['evofuncional'], 'avanzado', 'Introducir en Funcional con técnica previa. No en WOD sin prep.'],
  ['Power Snatch', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica avanzada. Solo si el grupo tiene base.'],
  ['KB Snatch', 'olimpico', ['evofuncional'], 'avanzado', 'Técnica avanzada KB. Introducir progresivamente.'],
  ['Push Jerk', 'olimpico', ['evofuncional'], 'avanzado', 'Requiere press técnico previo.'],

  // METABÓLICO
  ['Box Jump', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Aterrizaje suave obligatorio. 12 cajones disponibles.'],
  ['Box Step Up', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Alternativa segura al box jump.'],
  ['Burpee', 'metabolico', ['evobasics', 'evofit', 'evofuncional', 'evohybrix'], 'basico', 'Metabólico de cuerpo completo; revisar el impacto acumulado en la semana.'],
  ['Burpee Box Jump', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Versión exigente. Cajón necesario.'],
  ['Wall Ball', 'metabolico', ['evofuncional', 'evofit', 'evohybrix'], 'intermedio', '6 unidades de 7kg; organizar tandas o combinar cargas disponibles.'],
  ['Slam Ball', 'metabolico', ['evofuncional', 'evofit'], 'basico', 'Solo en rotación o parejas. 3 uds de 8/10kg.'],
  ['Thruster', 'metabolico', ['evofuncional', 'evofit'], 'intermedio', 'Revisar la acumulación semanal de squat y empuje antes de usarlo.'],
  ['DB Thruster', 'metabolico', ['evofuncional', 'evofit', 'evobasics'], 'intermedio', 'Variante con mancuernas del thruster.'],
  ['Remo Concept 2', 'metabolico', ['evofuncional', 'evofit', 'evobasics', 'evohybrix'], 'basico', '1 RowErg. Usar por parejas, relevos o estación; no como tarea individual simultánea.'],
  ['Air Bike', 'metabolico', ['evofuncional', 'evofit', 'evohybrix'], 'basico', '2 bicicletas compartidas entre salas. Organizar estaciones o relevos.'],
  ['SkiErg', 'metabolico', ['evohybrix', 'evofuncional', 'evofit'], 'basico', '2 SkiErg compartidos entre salas. Organizar estaciones o relevos.'],
  ['Run 200m / 400m', 'metabolico', ['evofuncional', 'evofit', 'evobasics', 'evohybrix'], 'basico', 'Cardio sin material; ajustar distancia al tiempo objetivo del bloque.'],
  ['Double Unders', 'metabolico', ['evofuncional', 'evofit'], 'avanzado', '8 combas en estado regular. En EvoFit, opción directa para quien ya los domina.'],
  ['Single Unders', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Alternativa a DU. Mismas combas.'],
  ['Mountain Climber', 'metabolico', ['evobasics', 'evofit', 'evofuncional'], 'basico', 'Sin material. Frecuente en WOD.'],
  ['Jumping Lunge', 'metabolico', ['evobasics', 'evofit'], 'basico', 'Potencia baja. Aterrizaje controlado.'],
  ['Farmer Carry', 'metabolico', ['evofuncional', 'evofit', 'evohybrix'], 'basico', '2 farmer handles disponibles. Parejas, tandas o circuito.'],
  ['Sled Push', 'metabolico', ['evofuncional', 'evofit', 'evohybrix'], 'intermedio', '2 trineos. Organizar parejas, tandas o circuito.'],
  ['Burpee Broad Jump', 'metabolico', ['evohybrix', 'evofuncional'], 'intermedio', 'Reservar un pasillo claro y ajustar metros para conservar el tiempo de trabajo.'],
  ['Walking Lunge', 'squat', ['evohybrix', 'evofit', 'evofuncional'], 'intermedio', 'Zancada en desplazamiento; ajustar carga y metros al espacio disponible.'],
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
