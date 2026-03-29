/**
 * Parche puntual: semana ACTIVA en Supabase.
 * - MIÉRCOLES: rellena EvoFuncional, EvoBasics, EvoFit (+ feedbacks); conserva evogimnastica y feedback_gimnastica.
 * - JUEVES, VIERNES, SÁBADO: vacía todas las clases y feedbacks.
 *
 * Uso (Node 20+):
 *   node --env-file=.env scripts/patch-active-week-wednesday.mjs
 *
 * Requiere que la clave anon (o service role) tenga permiso UPDATE en `published_weeks`.
 * Si falla por RLS, copia el JSON que imprime el script y pégalo en el panel de Supabase.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (o SUPABASE_SERVICE_ROLE_KEY) en el entorno.')
  process.exit(1)
}

const supabase = createClient(url, key)

const EVOFUNCIONAL = `(0' - 5') BIENVENIDA — 5min
Movilidad cadera y tobillos
Objetivo del día y reparto de material

(5' - 14') CALENTAMIENTO — 9min
3 rondas suaves:
200m remo técnico
10 pasos canguro
8 scap pull

(14' - 32') TÉCNICA + FUERZA — 18min
Deadlift — revisión bisagra 3'
Progresión: barra x8, 50% x6, 60% x4, 70% x3
Trabajo: 4 series x4 @75-80%
Descanso 2'30 entre series (cronometrado en bloque)

(32' - 38') TRANSICIÓN + ORGANIZACIÓN — 6min
Cambio a mancuernas/kettlebells según WOD
Parejas por altura de carga; repaso del formato

(38' - 43') WOD PREP — 5min
Demo thruster + estándar de profundidad
2 series de prueba ligeras

(43' - 55') WOD — AMRAP 12' — 12min
12 DB Thrusters @2x22,5/15kg
10 Burpees over DB
8 DB Hang Clean @mismo peso

(55' - 60') CIERRE — 5min
Estirar cadena posterior y glúteo
Choca la mano`

const EVOBASICS = `(0' - 5') BIENVENIDA — 5min
Movilidad hombro y muñeca

(5' - 15') CALENTAMIENTO + JUEGO — 10min
Juego "Teléfono escacharrado fitness": en fila de 8, el primero hace un movimiento (squat), el último debe adivinarlo solo con gestos del compañero de delante sin hablar. 2 rondas. Coach anima y cambia el movimiento entre rondas.

(15' - 30') TÉCNICA — 15min
Kettlebell Goblet Squat — profundidad y codos dentro
3x10 @ligero con pausa 1" abajo
Descanso 60''

(30' - 38') ACCESORIO — 8min
Banded Good Morning 3x12
Descanso 45''

(38' - 43') WOD PREP — 5min
Organizar estaciones: 4 sitios con KB del mismo peso

(43' - 55') WOD — 3 rondas FOR TIME — TC 12' — 12min
15 KB Swings @ruso moderado
12 Push-ups escalonados si hace falta
200m run

(55' - 60') CIERRE — 5min
Estirar y cierre`

const EVOFIT = `(0' - 5') BIENVENIDA — 5min
Movilidad dinámica cadera

(5' - 12') ACTIVACIÓN — 7min
2 rondas:
10 pasos farmer carry ligero
8 bird dog

(12' - 35') BISERIE — 23min
A1: DB Romanian Deadlift 4x10 @medio — descanso 45'' tras A1
A2: Single Arm DB Row 4x10 @medio por lado — descanso 90'' tras completar A1+A2
Incluye tiempo de cambio de mancuerna y ajuste de banco (2-3 min repartidos en el bloque)

(35' - 40') ORGANIZACIÓN WOD — 5min
Todos con mismo peso de DB; repaso estándar de thruster ligero

(40' - 52') WOD — EMOM 12' — 12min
Min 1-3: 12 DB Alt. Snatch @ligero (6+6)
Min 4: descanso activo movilidad hombro
Min 5-7: 15 Sit-ups
Min 8: descanso
Min 9-12: 10 DB Front Squat @ligero

(52' - 60') CIERRE — 8min
Estiramientos básicos`

const FB_FUNCIONAL = `Esta sesión tiene deadlift pesado y WOD con thruster: antes del trabajo fuerte dedica 2 minutos a recordar que el tirón sale de la bisagra y no de la espalda. En el AMRAP, coloca el burpee de forma que nadie cruce trayectorias con las DB. Cierra pidiendo que anoten cargas si alguien subió de peso en el deadlift.`

const FB_BASICS = `El juego del teléfono necesita que cuentes bien las reglas antes de empezar y que tú marques el ritmo del cambio de ronda. En el WOD, vigila el swing: si la espalda redondea, bajan peso sin drama. Termina recordando que el run es técnico, no sprint descontrolado.`

const FB_FIT = `La biserie se va al tiempo si no dejas claro el orden A1→A2 y el descanso entre rondas completas; haz una demo en pareja antes de soltarlos. En el EMOM, en los minutos de snatch alterna lado cada rep o cada serie para equilibrar. Última acción: revisar que todos dejen el material en su sitio antes del cierre.`

function emptyDayFields() {
  return {
    evofuncional: '',
    evobasics: '',
    evofit: '',
    evohybrix: '',
    evofuerza: '',
    evogimnastica: '',
    evotodos: '',
    feedback_funcional: '',
    feedback_basics: '',
    feedback_fit: '',
    feedback_hybrix: '',
    feedback_fuerza: '',
    feedback_gimnastica: '',
    feedback_evotodos: '',
    wodbuster: '',
  }
}

async function main() {
  const { data: row, error: fetchErr } = await supabase
    .from('published_weeks')
    .select('*')
    .eq('is_active', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fetchErr) {
    console.error('Error leyendo semana activa:', fetchErr.message)
    process.exit(1)
  }
  if (!row?.data) {
    console.error('No hay semana activa o sin campo data.')
    process.exit(1)
  }

  const data = structuredClone(row.data)
  if (!Array.isArray(data.dias) || data.dias.length < 6) {
    console.error('data.dias no tiene 6 entradas; no se parchea automáticamente.')
    process.exit(1)
  }

  const idxMie = data.dias.findIndex((d) => String(d?.nombre || '').toUpperCase().includes('MIÉ'))
  const i = idxMie >= 0 ? idxMie : 2
  const prev = data.dias[i] || {}
  const cleared = emptyDayFields()

  data.dias[i] = {
    nombre: 'MIÉRCOLES',
    ...cleared,
    evofuncional: EVOFUNCIONAL,
    evobasics: EVOBASICS,
    evofit: EVOFIT,
    evogimnastica: prev.evogimnastica ?? '',
    feedback_funcional: FB_FUNCIONAL,
    feedback_basics: FB_BASICS,
    feedback_fit: FB_FIT,
    feedback_gimnastica: prev.feedback_gimnastica ?? '',
  }

  for (const j of [3, 4, 5]) {
    const name = data.dias[j]?.nombre || ['JUEVES', 'VIERNES', 'SÁBADO'][j - 3]
    data.dias[j] = { nombre: name, ...emptyDayFields() }
  }

  const { error: upErr } = await supabase
    .from('published_weeks')
    .update({ data, titulo: data.titulo || row.titulo })
    .eq('id', row.id)

  if (upErr) {
    console.error('UPDATE falló (¿RLS?):', upErr.message)
    console.log('\n--- Copia manual JSON data (fragmento dias) ---\n')
    console.log(JSON.stringify(data.dias.slice(2, 6), null, 2))
    process.exit(1)
  }

  console.log('OK: semana activa actualizada (miércoles rellenado, jue–sáb vacíos). id=', row.id)
}

main()
