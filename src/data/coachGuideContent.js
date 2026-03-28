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
  'Los tres valores de EVO: Confianza · Esperanza · Familia',
]

export const COACH_CENTRO_EXPECT = [
  'Que el alumno entienda qué está entrenando y por qué.',
  'Que salga sintiéndose bien — no destrozado, no confuso.',
  'Que quiera volver mañana.',
  'Que sienta que el coach estaba ahí para él, no gestionando el tiempo.',
]

export const COACH_CLASS_CARDS = [
  {
    id: 'funcional',
    title: 'EVOFUNCIONAL — Donde ocurre el progreso real',
    audience: 'Nivel intermedio-avanzado. Alumnos con base técnica, que llevan tiempo entrenando y buscan seguir progresando.',
    has: 'Fuerza con porcentajes + skill técnico (halterofilia, gimnásticos) + WOD de intensidad media-alta.',
    structure:
      'Warm up (5-7\') → Calentamiento específico (7\') → Explicación y aproximación (8-10\') → Fuerza/OLY (12-15\') → WOD Prep (7\') → WOD (12-15\') → Cierre (5\').',
    can: 'Halterofilia (clean, snatch, jerk), gimnásticos (pull-ups, T2B, HSPU accesible), fuerza con barra y porcentajes, WODs complejos.',
    cannot: 'Muscle ups, deficit HSPU, rope climb, pegboard, overhead squat como principal.',
    feel: '«He trabajado fuerte y con cabeza. Sé lo que he hecho y por qué.»',
  },
  {
    id: 'basics',
    title: 'EVOBASICS — Donde se construye la base',
    audience: 'Nivel principiante-intermedio. Personas que empiezan o que llevan poco tiempo. El objetivo es que en 5-6 meses estén listos para EvoFit.',
    has: 'Técnica + control + comprensión del movimiento. WOD sencillo y guiado. Siempre juego en el calentamiento.',
    structure:
      'Warm up con juego (10\') → Calentamiento (7\') → Explicación técnica y práctica (10-15\') → Fuerza accesible (10-12\') → WOD sencillo (10-12\') → Cierre (5\').',
    can: 'Un solo movimiento técnico por sesión. Kettlebells, mancuernas, landmine básico, barra con pesos ligeros.',
    cannot: 'Varios técnicos juntos, impacto alto, movimientos olímpicos complejos, demasiados ejercicios nuevos a la vez.',
    feel: '«He aprendido algo. He entendido el movimiento. Esto lo puedo hacer.»',
  },
  {
    id: 'fit',
    title: 'EVOFIT — Donde todo el mundo encaja',
    audience:
      'Todos los niveles. Puede entrar un alumno de Basics con 3-4 meses y uno de Funcional de años — los dos entrenan bien sin romper el flujo.',
    has: 'Fuerza con tempos, biseries, triseries y accesorios. Más movilidad en el calentamiento. WODs tipo bodybuilding funcional. Puede tener 3-4 partes en días de intensidad.',
    structure:
      'Warm up con movilidad (7-10\') → Fuerza/accesorios en biserie o triserie (15-20\') → WOD funcional (12-15\') → Cierre (5\').',
    can: 'Fuerza básica con barra y porcentajes (back squat, RDL, bench, row), kettlebells, mancuernas, landmine básico, cardio funcional.',
    cannot: 'Halterofilia (clean, snatch, jerk), movimientos olímpicos con barra. Sin técnica compleja.',
    scale:
      'Binario — haces esto o esto otro. No progresiones intermedias. Ejemplo: 5 strict push ups → ring row. Double unders → single unders.',
    feel: '«Me he dado caña pero podría repetir mañana. Me siento bien.»',
  },
  {
    id: 'hybrix',
    title: 'EVOHYBRIX — Donde se juega con el esfuerzo',
    audience: 'Todos los niveles. Formato más libre y dinámico.',
    has: 'Bloques metabólicos, trabajo en parejas o equipos, máquinas + cardio. Más diversión y estrategia.',
    structure: 'Warm up (10\') → 2-3 bloques largos (6-10\' cada uno) + finisher → Cierre.',
    can: 'Remo, air bike, KB swings, wall balls, slam balls, burpees, movimientos sencillos en circuito o relevos.',
    cannot: 'Técnica compleja, halterofilia, landmine.',
    feel: '«Me lo he pasado bien sufriendo. Ha sido diferente.»',
  },
]

export const COACH_CLASSES_FOOTNOTE =
  'Clave: las clases NO son versiones escaladas unas de otras. Son sesiones distintas con objetivos distintos. EvoFuncional y EvoBasics nunca repiten el mismo ejercicio principal el mismo día.'

export const COACH_MESOCICLO_INTRO = [
  'Un mesociclo es un bloque de entrenamiento con un objetivo claro que dura varias semanas. En EVO trabajamos con mesociclos de 6 semanas. Cada semana tiene una fase distinta que va aumentando la intensidad de forma progresiva.',
  'Estructura de un mesociclo de fuerza (ejemplo)',
]

export const COACH_MESOCICLO_ROWS = [
  { semana: 'S1', fase: 'Base', intensidad: '50-55%', notas: 'Pesos ligeros, técnica perfecta, aprender el movimiento.' },
  { semana: 'S2', fase: 'Adaptación', intensidad: '60-65%', notas: 'Empezamos a cargar. Sensación de trabajo real.' },
  { semana: 'S3', fase: 'Fuerza I', intensidad: '70-75%', notas: 'Las series cuestan. Foco en posición y control.' },
  { semana: 'S4', fase: 'Fuerza II', intensidad: '75-80%', notas: 'Exigente. Las últimas series no deben llegar al fallo.' },
  { semana: 'S5', fase: 'Pico', intensidad: '80-85%', notas: 'Series cortas y pesadas. Descanso completo entre sets.' },
  { semana: 'S6', fase: 'Test', intensidad: 'Máximos', notas: 'Buscar marcas personales. Registrar resultados.' },
]

export const COACH_MESOCICLO_COACH = [
  'Lo que esto significa para ti en sala',
  'Cada semana la programación cambia de intensidad — no improvises más peso del indicado.',
  'Si un alumno quiere ir más pesado, revisa en qué semana del mesociclo estáis antes de decidir.',
  'En S1 y S2 el foco es técnica — no presiones para subir peso.',
  'En S5 y S6 los alumnos van a límite — supervisa más, corrige más, anima más.',
  'La semana de test (S6) es especial: ayuda a los alumnos a registrar sus marcas en la app o en la pizarra.',
]

export const COACH_USO_SECTIONS = [
  {
    h: 'Qué tiene cada sesión',
    lines: [
      'Timing por bloque con reloj acumulado — te dice cuánto dura cada parte.',
      'Ejercicios con enlace al vídeo si son técnicos o poco comunes.',
      'Pesos de referencia por nivel — ligero, medio, pesado.',
      'Feedback del día — el objetivo de cada bloque y las adaptaciones necesarias.',
    ],
  },
  {
    h: 'Cómo leer el timing',
    lines: [
      'Cada bloque tiene su tiempo marcado. Ejemplo:',
      'WARM UP — 0:00 a 5:00 (5\')',
      'CALENTAMIENTO — 5:00 a 12:00 (7\')',
      'EXPLICACIÓN + APROXIMACIÓN — 12:00 a 21:00 (9\')',
      'STRENGTH — 21:00 a 34:00 (13\')',
      'WOD PREP — 34:00 a 42:00 (8\')',
      'WOD — 42:00 a 55:00 (13\')',
      'CIERRE — 55:00 a 60:00 (5\')',
      'Regla fundamental: el tiempo de trabajo real máximo es 30 minutos. Si te pasas de tiempo en las explicaciones, el WOD sufre. Si la clase va a tiempo, el alumno sale bien.',
    ],
  },
  {
    h: 'Cómo leer el feedback del día',
    lines: [
      'El feedback está al final de cada sesión. No es un resumen — es la guía que te dice qué tiene que pasar en esa clase. Tiene esta estructura:',
      'Objetivo en [fuerza / técnica / OLY / WOD]: qué debe conseguir el alumno en ese bloque.',
      'Adaptación (cuando la sesión la requiere): qué hacer si alguien no puede ejecutar el movimiento.',
      'Léelo ANTES de la clase, no durante. Si no has leído el feedback, no estás listo para dar la clase.',
    ],
  },
  {
    h: 'Las adaptaciones y progresiones',
    lines: [
      'Cada clase tiene un nivel de escalado distinto:',
      'EvoFuncional y EvoBasics: progresiones del movimiento — de menos a más complejidad o carga.',
      'EvoFit: escalado binario — haces esto o esto otro. Sin progresiones intermedias.',
      'Ejemplo: 5 strict push ups → ring row.',
      'Ejemplo: double unders → single unders.',
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
      'Aplicar el escalado que marca la programación, no el que se te ocurra en el momento.',
      'Registrar cómo fue la sesión si se te pide — qué funcionó, qué no, qué ajustar.',
      'Si algo no encaja con el grupo que tienes, consultar antes de clase.',
    ],
  },
]

export const COACH_MATERIAL_INTRO =
  'Este bloque es editable y se actualiza cuando cambia el material del centro. Consúltalo siempre que tengas dudas sobre qué hay disponible.'

export const COACH_MATERIAL_ROOMS = [
  {
    sala: 'Sala grande',
    text: '4 racks de jaula + barras de dominadas integradas · Prioridad: EvoFuncional',
  },
  {
    sala: 'Sala pequeña',
    text: '4 racks portátiles (también funcionan como dominadas) + barras de dominadas en pared · Prioridad: EvoBasics / EvoFit',
  },
]

export const COACH_MATERIAL_ITEMS = [
  {
    name: 'Barras',
    detail:
      '10kg (rosa): 7 · 15kg: 7 · 20kg: 4 · Técnica 180cm: 2 · TOTAL: 20 barras\nMáx 4 barras por clase. Clases simultáneas: sala grande para EvoFuncional.',
  },
  {
    name: 'Mancuernas',
    detail:
      '4kg: 7p · 6kg: 6p · 8kg: 9p · 10kg: 8p · 12,5kg: 9p · 15kg: 7p · 17,5kg: 4p · 20kg: 4p · 22,5kg: 2p · 25kg: 2p · 27,5kg: 1p · 30kg: 1p\n⚠ 27,5 y 30kg solo en accesorios, no en WODs de reps altas.',
  },
  {
    name: 'Kettlebells',
    detail:
      '8kg: 8 · 12kg: 10 · 16kg: 10 · 20kg: 8 · 24kg: 7 · 28kg: 3\n⚠ 28kg solo individual o accesorios. No en WODs para toda la clase.',
  },
  {
    name: 'Slam balls',
    detail:
      '8kg: 3 · 10kg: 3 · 15kg: 1 · 20kg: 2 · 30kg: 1\nSolo en rotación o cuando no toda la clase lo necesite a la vez.',
  },
  {
    name: 'Wall balls',
    detail:
      '6kg: 3 · 7kg: 6 · 8kg: 2\n⚠ Solo el 7kg tiene cantidad para clase completa. Si el WOD es para todos → siempre 7kg.',
  },
  {
    name: 'Máquinas',
    detail: 'Remo Concept 2: 1 · Air bike: 1\nMáx 2 por sesión. En clases simultáneas no usar las dos a la vez.',
  },
  {
    name: 'Landmine',
    detail: '8 uds · Suficiente para clase completa · No usar en Hybrix',
  },
  {
    name: 'Anillas',
    detail: 'Para 2 clases simultáneas · No usar en las dos al mismo tiempo',
  },
  {
    name: 'Cajones',
    detail: '2 altos madera · 1 bajo madera · 1 blando',
  },
  {
    name: 'Otro',
    detail:
      'Paralettes: 4 · Bancos: 3 · Trineos: 2 · Farmer carry: 2 · AB mats: 16 · Foam rollers: 4 · Bandas: 14 rojas + 5 mini · Combas: 8 (estado regular) · Esterillas: 16',
  },
]

export const COACH_SOPORTE_INTRO =
  'Si tienes dudas sobre la programación, el material, una sesión concreta o cualquier cosa relacionada con las clases, aquí está el protocolo.'

export const COACH_SOPORTE_SI = [
  'No entiendo un ejercicio de la programación o no sé cómo explicarlo.',
  'Creo que hay un error en el timing o en los pesos de una sesión.',
  'Un alumno tiene una limitación física y no sé cómo adaptar el movimiento.',
  'Quiero cambiar algo de lo programado y necesito confirmación.',
  'Tengo un problema con el acceso o el funcionamiento de la app.',
]

export const COACH_SOPORTE_NO = [
  'Dudas que puedes resolver consultando esta guía o la biblioteca de ejercicios.',
  'Cambios de última hora sin haberlo consultado previamente — eso no es soporte, es improvisar.',
]

export const COACH_SOPORTE_PLACEHOLDER_CHANNEL =
  '[EDITABLE POR EL ADMIN — añadir aquí: canal (WhatsApp / email / Notion), nombre de la persona de contacto y horario en el que se atienden dudas]'

export const COACH_SOPORTE_PLACEHOLDER_RESPONSE =
  '[EDITABLE POR EL ADMIN — añadir aquí el tiempo de respuesta habitual y qué hacer si es urgente antes de una clase]'

export const COACH_SOPORTE_FOOTER =
  'Evolution Boutique Fitness · ProgramingEvo · Sección Coach · v1.0 · 2026'
