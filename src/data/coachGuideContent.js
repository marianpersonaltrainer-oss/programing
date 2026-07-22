import {
  buildCoachInventoryItems,
  buildCoachInventoryRooms,
} from '../domain/method/evoInventory.js'

/**
 * Texto fuente: Seccion_Coach_ProgramingEvo_v1.docx (ProgramingEvo · EVO Granada).
 * Overrides: tabla Supabase coach_guide_settings (material_override, contact_channel, contact_response).
 */

/** Intro general de la guía (antes del §1 en el Word). */
export const COACH_GUIDE_INTRO_BLURB = [
  'Contenido: El centro · Las clases · Los mesociclos · Cómo usar la programación · Material · Soporte',
  'Esta sección es tu referencia de trabajo. Aquí encontrarás todo lo que necesitas saber para dar clases en EVO y usar la app de programación. Léela antes de tu primera clase y consúltala siempre que tengas dudas.',
]

export const COACH_CENTRO_PARAS = [
  'Evolution Boutique Fitness (EVO) es un centro de entrenamiento funcional boutique en Granada Centro. No somos un gimnasio convencional ni un box de CrossFit al uso. Somos un espacio donde la gente vuelve porque le funciona, porque se siente acompañada y porque cada sesión tiene sentido.',
  'Nuestro público es el adulto activo de 28 a 55 años que quiere entrenar con cabeza, progresar de verdad y sentirse parte de algo. Muchos de nuestros alumnos llevan meses o años con nosotros — eso no es casualidad.',
]

export const COACH_CENTRO_VALUES = 'Confianza · Esperanza · Familia'

export const COACH_CENTRO_MISSION =
  'Acompañar a cada persona a entrenar con método y constancia: sesiones con sentido, progresión real y un ambiente en el que se sienta vista y parte de algo.'

export const COACH_CENTRO_TRANSMIT =
  'Transmitimos que aquí el entrenamiento tiene cabeza y corazón — sin postureo ni extremos. Confianza en el proceso, esperanza de mejora y familia de sala; cada clase debe sonar y sentirse así.'

export const COACH_CENTRO_EXPECT = [
  'Que el alumno entienda qué está entrenando y por qué.',
  'Que salga entendiendo qué ha entrenado, con una exigencia coherente con la intención del día.',
  'Que quiera volver mañana.',
  'Que sienta que el coach estaba ahí para él, no gestionando el tiempo.',
]

/** Guía ampliada EvoGimnástica (rotación, escalados, ejemplos). Visible en app → Clases. */
export const COACH_GIMNASTICA_EXTENDED_BLOCKS = [
  {
    title: 'Identidad — qué la diferencia',
    body: [
      'EvoGimnástica no es «más dominadas»: es cuerpo libre con cabeza, progresión clara y sensación de equipo. La marca es la mezcla técnica + juego (relevos, carreras cortas, circuitos con tiempo, ritmo) para que la gente salga pensando «esto no lo hago en otro sitio».',
      'Regla de oro para el coach: máximo ~1 minuto de explicación por bloque; el resto es hacer, corregir y animar. Escalados listos abajo — cópialos a pizarra o WodBuster sin reescribir.',
    ],
  },
  {
    title: 'Rotación semanal (variedad)',
    body: [
      'Semana tipo A — Tracción + core: pull-ups y variantes, scapular, hollow/arch, holds de plancha lateral/frontal.',
      'Semana tipo B — Empuje + balance: pike push y progresiones, handstand (pared o free scale), shoulder taps, L-sit scaled si encaja.',
      'Semana tipo C — Acrobático + dinámico: cartwheels básicos, kipping educado, saltos seguros, juegos de agilidad (conos, relevos).',
      'Rota A → B → C en semanas sucesivas cuando programes; si la hoja trae un skill concreto, encaja ese skill dentro del tipo de semana que toque.',
    ],
  },
  {
    title: 'Escalados copy-paste (por movimiento)',
    body: [
      'Pull-up — Beginner: dead hang 20–40 s + banda gruesa o ring rows 3×8–12. Intermedio: scap pulls + pull-up asistido ligero o negativas 3×3–5. Avanzado: strict pull-ups 4×4–8 o variaciones temporizadas.',
      'Handstand / vertical — Beginner: pike en caja + wall walk 1–2 subidas controladas. Intermedio: chest-to-wall hold 20–40 s + shoulder taps asistidos. Avanzado: hold freestanding cortos o HSPU scaled a déficit bajo.',
      'Dip anillas — Beginner: soporte en rack/box, dips de banco pies en suelo. Intermedio: ring support hold + dip negatives 3×3–5. Avanzado: ring dips completos en volumen moderado.',
      'Core — Beginner: dead bug + plank 20–30 s. Intermedio: hollow hold + arch rocks. Avanzado: L-sit en paralelas o barra + hollow rocks en combo.',
    ],
  },
  {
    title: 'Semana ejemplo 1 — Tracción + core (35 min de trabajo visible)',
    body: [
      'A) HABILIDAD — 15 MIN: progresión principal de tracción con una opción de acceso y una de capacidad.',
      'B) CONTROL — 10 MIN: hollow/arch en parejas, práctica de calidad y descansos claros.',
      'C) AMRAP — 10 MIN: tracción adaptada + plancha + arch rocks, sin perder la técnica.',
      'La organización concreta y el cue prioritario se explican en el feedback de esa sesión.',
    ],
  },
  {
    title: 'Semana ejemplo 2 — Empuje + balance (38 min de trabajo visible)',
    body: [
      'A) HABILIDAD — 18 MIN: Pike Push / HSPU con una progresión y una regresión claras.',
      'B) CONTROL — 12 MIN: Handstand chest-to-wall + taps; quien no invierte, plancha alta con elevación de manos.',
      'C) TRABAJO EN PAREJAS — 8 MIN: acumulación de holds con cambios definidos y técnica prioritaria.',
      'El feedback recuerda un solo cue de hombros y explica la organización si hace falta.',
    ],
  },
  {
    title: 'Semana ejemplo 3 — Acrobático + dinámico (37 min de trabajo visible)',
    body: [
      'A) HABILIDAD — 15 MIN: Cartwheel con aterrizaje controlado y opciones por capacidad.',
      'B) TÉCNICA — 10 MIN: Kipping controlado en barra baja o anillas, pocas repeticiones de calidad.',
      'C) INTERVALOS — 12 MIN: saltos y desplazamientos sencillos con una dinámica divertida.',
      'La sesión publicada no incluye la preparación general de la hora; el coach la calcula y usa el feedback para las dudas reales.',
    ],
  },
  {
    title: 'Diversión sin perder técnica',
    body: [
      'Cuando aporte a la intención, puede utilizarse un relevo, parejas, AMRAP corto, EMOM ligero o una dinámica por equipos para romper la monotonía.',
      'El marco lúdico es una posibilidad, no una obligación: no se añade si distrae de la capacidad principal o complica la sala.',
    ],
  },
]

export const COACH_CLASS_CARDS = [
  {
    id: 'funcional',
    title: 'EVOFUNCIONAL — Progreso técnico y rendimiento',
    audience: 'Nivel intermedio-avanzado. Alumnos con base técnica, que llevan tiempo entrenando y buscan seguir progresando.',
    has: 'Fuerza con porcentajes + skill técnico (halterofilia, gimnásticos) + WOD de intensidad media-alta.',
    structure:
      'Salida publicada: A/B/C o Parte Única, con duración en cada título. Puede ser fuerza + intensidad, skill + aplicación, fuerza sin WOD o una parte larga según la intención.',
    can: 'Halterofilia (clean, snatch, jerk), gimnásticos (pull-ups, T2B, HSPU accesible), fuerza con barra y porcentajes, WODs complejos.',
    cannot: 'Varios skills complejos sin relación en la misma sesión, o un skill complejo más un WOD coordinativo complejo sin una razón clara.',
    feel: '«He trabajado fuerte y con cabeza. Sé lo que he hecho y por qué.»',
  },
  {
    id: 'basics',
    title: 'EVOBASICS — Donde se construye la base',
    audience: 'Nivel principiante-intermedio. Personas que empiezan o quieren construir fuerza y habilidades transferibles antes de asumir progresiones más avanzadas.',
    has: 'Aprendizaje, fuerza estructurada y aplicación. El juego es una herramienta opcional y pedagógica, no una obligación.',
    structure:
      'Salida publicada: A/B/C o Parte Única. Cada clase real lleva un skill principal; la rotación móvil cierra cada cinco clases con 2 complejos y 3 sencillos, sin reiniciarse cada lunes.',
    can: 'Back/Front Squat, presses, jerk, clean, snatch, dominadas, anillas y pino desde su progresión más básica; también barra, landmine, comba, pelotas, máquinas, core, burpees y trabajo sencillo de acondicionamiento.',
    cannot: 'Acumular varios movimientos complejos en el mismo WOD, exigir que el alumno consiga el skill, o convertir la checklist en el único banco de ejercicios.',
    feel: '«He aprendido algo. He entendido el movimiento. Esto lo puedo hacer.»',
  },
  {
    id: 'fit',
    title: 'EVOFIT — Fuerza real con menor complejidad técnica',
    audience:
      'Todos los niveles. Puede entrar un alumno de Basics con 3-4 meses y uno de Funcional de años — los dos entrenan bien sin romper el flujo.',
    has: 'Fuerza real + accesorios + WOD o acondicionamiento. Puede haber días pesados, ligeros, individuales, por parejas o por intervalos.',
    structure:
      'La salida puede organizarse en A/B/C o combinar contenidos con sentido. Menor complejidad técnica no significa menor carga, intensidad ni nivel de fuerza.',
    can: 'Barra, porcentajes, RPE/RIR, back squat, front squat, peso muerto, hip thrust, press, remo, landmine y una opción superior directa para quien ya la domina.',
    cannot: 'Bloques de aprendizaje de halterofilia o progresiones gimnásticas. El WOD no repite con alto volumen el patrón principal de fuerza.',
    scale:
      'Opción directa según capacidad, sin convertirla en skill: dominada estricta / Ring Row, pino controlado / variante prevista, Push-up completo / adaptación.',
    feel: '«He entrenado de verdad, con una sesión completa y sin perder tiempo en una técnica que no toca aprender aquí.»',
  },
  {
    id: 'hybrix',
    title: 'EVOHYBRIX — Donde se juega con el esfuerzo',
    audience: 'Todos los niveles. Formato más libre y dinámico.',
    has: 'Bloques metabólicos, trabajo en parejas o equipos, máquinas + cardio. Más diversión y estrategia.',
    structure: 'Salida publicada en bloques claros o Parte Única. Cuando la explicación es breve puede acercarse a 40-42 minutos efectivos.',
    can: 'Carrera, SkiErg, RowErg, Bike, trineo, Burpee Broad Jump, Farmer Carry, lunges y Wall Ball, con estaciones o salidas escalonadas.',
    cannot: 'Técnica compleja o halterofilia como protagonistas. Un accesorio no debe desplazar carrera, máquinas, trineo, carries, lunges o Wall Ball.',
    feel: '«Me lo he pasado bien sufriendo. Ha sido diferente.»',
  },
  {
    id: 'fuerza',
    title: 'EVOFUERZA — Functional bodybuilding (solo si está en programación)',
    audience:
      'Cuando el programador incluye esta columna en la semana. Perfil que tolera cargas y control de RIR; no es una clase diaria para todos los públicos.',
    has: 'Progresión por RIR (reps in reserve). Bloques tipo triset A1/A2/A3. Fuerza con volumen moderado y mucha calidad de ejecución.',
    structure:
      'Pocos bloques visibles con series, porcentajes, RIR y descansos definidos; accesorios complementarios.',
    can: 'Back squat, RDL, press, remos, accesorios de brazo y pierna con mancuernas/barras controladas.',
    cannot: 'Sustituir a EvoFuncional u otras clases si la semana no trae columna EvoFuerza.',
    feel: '«He trabajado musculación con intención; sé cuánto me quedaba en depósito.»',
    weekNote:
      'Cuando la semana incluye EvoFuerza, la progresión en sala suele seguir lógica RIR (aprox. S1–S5) y test (S6); el detalle concreto viene siempre en la programación publicada.',
  },
  {
    id: 'gimnastica',
    title: 'EVOGIMNÁSTICA — Skills + diversión (solo si está en programación)',
    audience:
      'Intermedio EVO: muchos dominan o van hacia pull-up; handstand poco trabajado; ring dips raros. No es clase de competición: es técnica accesible, variada y con sensación de «esto solo pasa aquí».',
    has: 'Una capacidad principal, regresión y progresión claras, práctica de calidad y un complemento coherente. Las parejas o dinámicas divertidas son opcionales.',
    structure:
      'Una capacidad principal con regresión, progresión, práctica de calidad y complemento coherente. La salida empieza en A/B/C o Parte Única.',
    can: 'Dead hang, scap pull, wall walk, pike en caja, kipping controlado, hollow/arch, cartwheels básicos, relevos, circuitos por tiempo, música si encaja.',
    cannot: 'Repetir semana tras semana el mismo bloque de tracción dura o improvisar skills que no vengan en la programación. Si aparece monotonía, puede romperse con una dinámica sencilla sin convertirla en obligación.',
    feel: '«He progresado en algo concreto, me lo he pasado bien y no era «otro día igual de anillas».»',
    extendedBlocks: COACH_GIMNASTICA_EXTENDED_BLOCKS,
  },
  {
    id: 'evotodos',
    title: 'EVOTODOS — Abierta a todos los niveles (solo si está en programación)',
    audience:
      'Cuando el programador o las instrucciones lo indican. Clase para aforo ampliado (12–14 personas), suele ser sábado u otros días especiales.',
    has: 'Juego, equipo o parejas. Ritmo social y disfrute sin perder la identidad EVO.',
    structure: 'Bloques visibles en equipo, parejas o relevos cuando la oferta activa incluya esta clase.',
    can: 'Movimientos sencillos, cardio ligero, KB/mancuernas básicas, trabajo cooperativo.',
    cannot: 'Técnica compleja ni halterofilia.',
    feel: '«Me lo he pasado bien y lo he hecho con mi gente.»',
  },
]

export const COACH_CLASSES_FOOTNOTE =
  'Clave: las clases no son versiones escaladas unas de otras. Comparten intención cuando ayuda, pero conservan identidad, carga y aprendizaje propios. EvoFuerza, EvoGimnástica y EvoTodos solo existen cuando la oferta o la semana publicada las incluye.'

/** Coherencia muscular entre clases del mismo día (guía + prompts alineados). */
export const COACH_CLASS_DAY_COHERENCE =
  'Las modalidades del mismo día deben ser compatibles para quien mezcla clases, pero no están obligadas a copiar el mismo ejercicio ni patrón principal. Primero se protege la fatiga, después la intención del mesociclo y la identidad de cada clase; se comparte una familia de estímulo cuando ayuda.'

export const COACH_MESOCICLO_INTRO = [
  'Un mesociclo es un bloque de entrenamiento con un objetivo claro. En EVO usamos tres duraciones según el tipo: Fuerza 6 semanas, Gimnástico/Autocarga 5 semanas, Mixto 4 semanas. Cada semana tiene una fase que ordena el estímulo y lo que deberías notar en sala.',
]

export const COACH_MESOCICLO_ROWS = [
  { semana: 'S1', fase: 'Referencias', intensidad: 'Single técnico o 2-3RM', notas: 'Test o actualización de referencias operativas cuando sea seguro.' },
  { semana: 'S2', fase: 'Volumen y control', intensidad: '65-75% · RIR 2-3', notas: 'Construir series sólidas y repetibles.' },
  { semana: 'S3', fase: 'Producción de fuerza', intensidad: '75-80% · hasta 85% según movimiento', notas: 'Sube la exigencia sin perder velocidad ni posición.' },
  { semana: 'S4', fase: 'Intensificación', intensidad: '80-85% · RIR 1-2', notas: 'Pocas repeticiones, descanso suficiente y sin fallo.' },
  { semana: 'S5', fase: 'Pico controlado', intensidad: '90-95% · volumen muy bajo', notas: 'Series cortas, técnica prioritaria y sin fallo.' },
  { semana: 'S6', fase: 'Retest o verificación', intensidad: '95-100% cuando proceda', notas: 'RM solo en una prueba real; también puede usarse 2-3RM o test submáximo.' },
]

export const COACH_MESOCICLO_COACH = [
  'Lo que esto significa para ti en sala',
  'Cada semana la programación cambia de intensidad — no improvises más peso del indicado.',
  'Si un alumno quiere ir más pesado, revisa en qué semana del mesociclo estáis antes de decidir.',
  'La técnica manda siempre sobre el porcentaje y ninguna semana obliga a llegar al fallo.',
  'En S5 el volumen baja mucho; en S6 solo se busca RM cuando la sesión está planteada como prueba real.',
  'Registra peso o porcentaje únicamente cuando ese dato sirve para la progresión siguiente.',
]

export const COACH_MESOCICLO_FUERZA_TITLE = 'Mesociclo de Fuerza (6 semanas)'

/** Gimnástico / Autocarga — 5 semanas (alineado con configurador). */
export const COACH_MESOCICLO_AUTOCARGA_SUB = 'Mesociclo Gimnástico / Autocarga (5 semanas)'

export const COACH_MESOCICLO_AUTOCARGA_ROWS = [
  {
    semana: 'S1',
    fase: 'Base',
    estimulo: 'Introducción técnica',
    notas: 'Aprender posiciones, sin fatiga, técnica perfecta',
  },
  {
    semana: 'S2',
    fase: 'Volumen mixto',
    estimulo: 'Skill + fuerza de apoyo',
    notas: 'Más trabajo acumulado sin perder calidad',
  },
  {
    semana: 'S3',
    fase: 'Densidad',
    estimulo: 'Variantes más exigentes',
    notas: 'Lastre moderado y menor pausa cuando proceda',
  },
  {
    semana: 'S4',
    fase: 'Peak',
    estimulo: 'Máxima complejidad',
    notas: 'Los movimientos más difíciles del mesociclo',
  },
  {
    semana: 'S5',
    fase: 'Test',
    estimulo: 'Evaluación técnica',
    notas: 'Comprobar progresión. Registrar resultados',
  },
]

export const COACH_MESOCICLO_MIXTO_TITLE = 'Mesociclo Mixto (4 semanas)'

export const COACH_MESOCICLO_MIXTO_ROWS = [
  {
    semana: 'S1',
    fase: 'Integración',
    estimulo: 'Volumen equilibrado',
    notas: 'Cargas alrededor de 70-80% cuando proceda',
  },
  {
    semana: 'S2',
    fase: 'Continuidad',
    estimulo: 'Variedad',
    notas: 'Cargas medias-bajas alrededor de 60-65%',
  },
  {
    semana: 'S3',
    fase: 'Volumen + potencia',
    estimulo: 'Fuerza-resistencia',
    notas: 'Cargas moderadas y buena fluidez',
  },
  {
    semana: 'S4',
    fase: 'Cierre del ciclo',
    estimulo: 'Densidad, resistencia y estrategia',
    notas: 'Velocidad y capacidad sin convertir cada día en una sesión larga',
  },
]

export const COACH_MESOCICLO_ESPECIALIDADES_TITLE = 'Especialidades EVO'

export const COACH_MESOCICLO_ESPECIALIDADES_PARAS = [
  'En cada mesociclo existe una especialidad complementaria:',
  'Mesociclo de Fuerza → especialidad Gimnástica.',
  'Mesociclo Gimnástico/Autocarga → especialidad Fuerza.',
  'Mesociclo Mixto → especialidad de ambas.',
  'Las especialidades trabajan las debilidades del bloque principal para un desarrollo equilibrado.',
]

export const COACH_PROGRESSION_PRINCIPLE_TITLE = 'Principio general de progresión en EVO'

export const COACH_PROGRESSION_PRINCIPLE_LINES = [
  'No existe una escalera obligatoria Basics → Fit → Funcional. Cada modalidad tiene identidad propia y la elección depende del objetivo y la complejidad técnica que la persona domina.',
  'EvoBasics construye fuerza y habilidades transferibles; EvoFit ofrece una sesión completa con menor complejidad técnica; EvoFuncional desarrolla progresiones intermedias y avanzadas.',
]

export const COACH_USO_SECTIONS = [
  {
    h: 'Qué tiene cada sesión',
    lines: [
      'Bloques A/B/C o Parte Única con la duración de trabajo dentro del título.',
      'Ejercicios con enlace al vídeo si son técnicos o poco comunes.',
      'Pesos de referencia por nivel — ligero, medio, pesado.',
      'Feedback del día — qué buscamos en la sesión, cómo debe sentirse y la decisión práctica que ayude a darla bien.',
    ],
  },
  {
    h: 'Cómo leer el timing',
    lines: [
      'La programación publicada empieza en A), B), C) o Parte Única. Ejemplo:',
      'A) FUERZA — 15 MIN',
      'B) INTERVALOS — 16 MIN',
      'La app no publica bienvenida, calentamiento, preparación, transiciones ni cierre.',
      'El coach sigue calculando internamente esos tiempos para que la hora fluya. Con varias partes suele haber unos 30-32 minutos efectivos; no se alarga un WOD solo para llenar.',
    ],
  },
  {
    h: 'Cómo leer el feedback del día',
    lines: [
      'El feedback está en un campo separado. No es un resumen: es una nota de Marian que explica qué buscamos en la sesión y cómo queremos que se sienta.',
      'Después añade solo lo que de verdad puede cambiar la clase: elección de pesos, adaptación u organización de parejas, estaciones y material cuando afecte al funcionamiento real.',
      'Se escribe como un párrafo natural y fluido, sin bloques rígidos de objetivo, sensaciones o anticipación.',
      'Todo lo mencionado debe existir en la sesión; no se inventan ejercicios ni logística.',
      'Léelo ANTES de la clase, no durante. Si no has leído el feedback, no estás listo para dar la clase.',
    ],
  },
  {
    h: 'Las adaptaciones y progresiones',
    lines: [
      'Cada clase tiene un nivel de escalado distinto:',
      'EvoBasics prioriza aprendizaje y progresiones transferibles a Funcional.',
      'EvoFuncional puede desarrollar skills más avanzados con opción de acceso y de capacidad.',
      'EvoFit no hace un bloque de aprendizaje técnico: ofrece directamente una opción que la persona ya domina y otra alternativa prevista.',
      'Ejemplo Fit: dominada estricta / Ring Row; pino controlado / variante en pared.',
    ],
  },
  {
    h: 'La biblioteca de ejercicios',
    lines: [
      'En la app hay una biblioteca con vídeos de referencia de los ejercicios más usados. Si ves un ejercicio que no conoces o del que no estás seguro, búscalo ahí antes de la clase — nunca improvises la explicación de un movimiento que no dominas.',
    ],
  },
  {
    h: 'Lo que se espera de ti',
    lines: [
      'Leer la sesión completa antes de clase — timing, ejercicios, pesos y feedback.',
      'No cambiar lo programado sin consultarlo antes.',
      'Aplica el escalado que marca la programación como punto de partida. Si hay una lesión, falta de movilidad o situación especial, usa tu criterio para adaptar. Si tienes dudas, consúltalo en el chat de Soporte.',
      'Registrar cómo fue la sesión si se te pide — qué funcionó, qué no, qué ajustar.',
      'Si algo no encaja con el grupo que tienes, consultar antes de clase.',
    ],
  },
]

export const COACH_MATERIAL_INTRO =
  'Este bloque es editable y se actualiza cuando cambia el material del centro. Consúltalo siempre que tengas dudas sobre qué hay disponible.'

export const COACH_MATERIAL_ROOMS = buildCoachInventoryRooms()

/** La guía y el generador consumen la misma fuente estructurada; no mantener otra copia manual aquí. */
export const COACH_MATERIAL_ITEMS = buildCoachInventoryItems()

export const COACH_SOPORTE_INTRO =
  'El asistente conoce la sesión publicada, su feedback y el material del centro. Úsalo para entender y adaptar el trabajo sin perder la intención del día; para errores de programación, accesos o decisiones permanentes utiliza el canal humano.'

export const COACH_SOPORTE_SI = [
  'Entender un ejercicio o explicar qué buscamos en un bloque concreto.',
  'Adaptar un movimiento por capacidad, molestias o falta de movilidad sin hacer un diagnóstico.',
  'Sustituir material o reorganizar parejas y estaciones conservando el estímulo.',
  'Ajustar repeticiones, tiempo, carga o rango cuando el bloque no fluye como estaba previsto.',
  'Valorar dos alternativas para la sesión real y saber cuál encaja mejor.',
]

export const COACH_SOPORTE_NO = [
  'Un posible error en la programación publicada que deba corregirse para todos.',
  'Un cambio que altera la intención completa de la sesión o una decisión permanente del Método EVO.',
  'Problemas de acceso, funcionamiento de la app o datos que no aparecen actualizados.',
  'Una lesión, incidente o situación de riesgo que necesita valoración profesional o actuación del responsable.',
]

export const COACH_SOPORTE_PLACEHOLDER_CHANNEL =
  '[EDITABLE POR EL ADMIN — añadir aquí: canal (WhatsApp / email / Notion), nombre de la persona de contacto y horario en el que se atienden dudas]'

export const COACH_SOPORTE_PLACEHOLDER_RESPONSE =
  '[EDITABLE POR EL ADMIN — añadir aquí el tiempo de respuesta habitual y qué hacer si es urgente antes de una clase]'

export const COACH_SOPORTE_FOOTER =
  'Evolution Boutique Fitness · ProgramingEvo · Sección Coach · v1.0 · 2026'
