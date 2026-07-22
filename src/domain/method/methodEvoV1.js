import METHOD_EVO_V1_CONTRACT from './methodEvoV1.json' with { type: 'json' }

/**
 * Fuente metodológica estructurada de V1.
 *
 * El JSON es deliberadamente legible por herramientas externas (incluido Cursor),
 * mientras este módulo es la única puerta de entrada usada por la aplicación.
 */
export const METHOD_EVO_V1 = Object.freeze(METHOD_EVO_V1_CONTRACT)

export const METHOD_EVO_V1_ID = METHOD_EVO_V1.meta.id
export const METHOD_EVO_V1_VERSION = METHOD_EVO_V1.meta.version
export const METHOD_EVO_V1_STATUS = METHOD_EVO_V1.meta.status
export const METHOD_EVO_V1_LABEL = `Método EVO ${METHOD_EVO_V1_VERSION}`

const AUTHORITY_LABELS = {
  explicit_recent_marian_decision: 'Decisión expresa y reciente de Marian',
  approved_method_version: 'Método EVO vigente y aprobado',
  current_offer_schedule_inventory: 'Oferta, horarios, simultaneidad e inventario actuales',
  confirmed_real_week_corrections: 'Correcciones confirmadas sobre semanas reales',
  recent_approved_history: 'Semanas recientes aprobadas o realmente impartidas',
  recent_method_documents: 'Documentos metodológicos recientes',
  old_templates_and_history: 'Plantillas e históricos antiguos',
  examples_and_external_banks: 'Ejemplos y bancos externos',
}

const TOKEN_LABELS = {
  clear_daily_intent: 'intención diaria clara',
  mesocycle_alignment: 'alineación con mesociclo y semana',
  access_and_capacity_options_when_skill_exists: 'opción de acceso y opción de capacidad cuando haya skill',
  barbell_percentages: 'barra y porcentajes',
  weightlifting: 'halterofilia con propósito',
  gymnastics: 'gimnásticos',
  advanced_skill: 'skills avanzados',
  complexes: 'complejos',
  heavy_strength: 'fuerza pesada',
  strategy: 'estrategia',
  single_long_block: 'parte única larga',
  multiple_unrelated_complex_skills_in_one_session: 'varios skills complejos sin relación en la misma sesión',
  complex_skill_plus_complex_coordinative_wod_without_reason: 'skill complejo y WOD coordinativo complejo sin motivo',
  one_meaningful_bar_or_strength_exposure: 'una exposición significativa de barra o fuerza',
  one_transferable_skill_exposure: 'una habilidad transferible a Funcional',
  one_application_or_conditioning_exposure: 'una aplicación o acondicionamiento con flow',
  jump_rope: 'comba',
  clean: 'Clean',
  thruster: 'Thruster',
  slam_ball: 'Slam Ball',
  deadlift_hinge: 'bisagra y Deadlift',
  push_press: 'Push Press',
  vertical_pull: 'tracción vertical',
  wall_walk: 'Wall Walk',
  box_jump_landing: 'recepción de Box Jump',
  kettlebell_swing: 'Kettlebell Swing',
  d_ball_ground_to_shoulder: 'D-Ball Ground to Shoulder',
  ring_support: 'soporte en anillas',
  strength_accessories_conditioning: 'fuerza + accesorios + acondicionamiento',
  two_long_strength_blocks: 'dos bloques largos de fuerza',
  strength_plus_long_conditioning: 'fuerza + acondicionamiento largo',
  single_continuous_strength_endurance_block_when_deliberate:
    'un bloque continuo de fuerza-resistencia cuando sea deliberado',
  barbell_basic_lifts: 'básicos con barra',
  hang_power_clean_learning: 'aprendizaje de Hang Power Clean',
  push_press_learning: 'aprendizaje de Push Press',
  jump_rope_skill: 'skill de comba',
  hangs_and_ring_support: 'hangs y soporte en anillas',
  wall_walk: 'Wall Walk',
  partner: 'parejas',
  relay: 'relevos',
  simple_stations: 'estaciones sencillas',
  automatic_barbell_to_dumbbell_replacement: 'sustituir automáticamente la barra por mancuernas',
  multiple_difficult_skills_same_session: 'varias habilidades difíciles en la misma sesión',
  light_copy_of_functional_without_learning: 'copia ligera de Funcional sin aprendizaje',
  real_strength: 'fuerza real',
  accessories: 'accesorios',
  conditioning: 'WOD o acondicionamiento',
  barbell: 'barra',
  percentages: 'porcentajes',
  rpe_rir: 'RPE y RIR',
  heavy_days: 'días pesados',
  light_days: 'días ligeros',
  strict_pull_up_if_already_owned: 'dominada estricta si ya se domina',
  handstand_option_if_already_owned: 'pino si ya se domina',
  intervals: 'intervalos',
  amrap: 'AMRAP',
  for_time: 'trabajo por tiempo',
  stations: 'estaciones',
  relays: 'relevos',
  definition_as_basic_light_or_accessible_strength: 'reducir Fit automáticamente a una versión básica o light',
  weightlifting_learning_block: 'bloque de aprendizaje de halterofilia',
  gymnastics_skill_progression_block: 'bloque de progresión gimnástica',
  automatic_barbell_downgrade_to_dumbbells: 'bajar automáticamente la barra a mancuernas',
  high_volume_repeat_of_main_strength_pattern_in_wod: 'repetir con alto volumen en el WOD el patrón principal de fuerza',
  default_floor_press_row_carry_core_template: 'usar por defecto la plantilla press-row-carry-core',
  strict_pull_up_or_ring_row: 'dominada estricta / Ring Row',
  controlled_handstand_or_planned_wall_variant: 'pino controlado / variante prevista en pared',
  full_push_up_or_adaptation: 'Push-up completo / adaptación',
  inventory_viable_distribution: 'distribución viable según inventario',
  pacing_or_transition_intent: 'intención de pacing o transiciones',
  variation_between_weekly_days: 'variación entre los días semanales',
  monday_intensity: 'lunes de intensidad',
  wednesday_continuous_or_zone_2: 'miércoles continuo o Zona 2',
  generic_functional_circuit_with_decorative_machine: 'circuito funcional genérico con una máquina decorativa',
  ten_people_waiting_for_one_erg: 'diez personas esperando una sola máquina',
  one_main_capacity: 'una capacidad principal',
  clear_regression: 'regresión clara',
  clear_progression: 'progresión clara',
  quality_practice: 'práctica de calidad',
  coherent_complement: 'complemento coherente',
  few_movements: 'pocos movimientos',
  clear_sets_load_rir_and_rest: 'series, carga, RIR y descanso claros',
  complementary_accessories: 'accesorios complementarios',
  exact_duplicate_of_same_day_functional_heavy_stimulus: 'duplicar el estímulo pesado de Funcional del mismo día',
  block_titles_include_duration: 'duración incluida en el título de cada bloque',
  daily_intent: 'intención del día',
  expected_session_feeling: 'cómo queremos que se sienta la sesión',
  open_with_session_intent: 'abrir explicando qué buscamos en la sesión',
  connect_blocks_to_expected_feeling: 'conectar los bloques con la sensación buscada',
  add_only_decisive_coach_action: 'añadir solo la acción decisiva del coach',
  weight_choice: 'elección de pesos',
  pair_station_space_or_material_organization: 'organización real de parejas, estaciones, espacio o material',
  likely_bottleneck: 'cuello de botella probable',
  main_adaptation: 'adaptación principal',
  invented_exercise: 'ejercicio inventado',
  invented_material: 'material inventado',
  invented_pair_or_station: 'pareja o estación inventada',
  general_whiteboard_scores: 'scores o marcas generales en pizarra',
  feedback_for_unprogrammed_class: 'feedback para una clase no programada',
  telegraphic_command_chain: 'cadena de órdenes telegráficas o frases cortadas',
  generic_hype_or_slogan: 'motivación genérica o eslóganes',
  corporate_or_ai_jargon: 'lenguaje corporativo o propio de una IA',
  structured_objective_sensations_anticipation_headings:
    'encabezados rígidos OBJETIVO / SENSACIONES / ANTICIPACIÓN',
  rm_only_on_real_test: 'RM únicamente en un test real',
  working_weight_when_useful: 'peso de trabajo cuando sea útil',
  percentage_when_useful: 'porcentaje cuando sea útil',
  last_set_when_useful: 'última serie cuando sea útil',
  explanation: 'explicación',
  equipment_setup: 'preparación de material',
  progressions: 'progresiones',
  warm_up: 'calentamiento',
  Spanish: 'español',
  official_team_nomenclature: 'la nomenclatura oficial del equipo',
}

function readableToken(value) {
  const key = String(value || '').trim()
  return TOKEN_LABELS[key] || key.replaceAll('_', ' ')
}

function bulletList(values) {
  return (values || []).map((value) => `- ${readableToken(value)}`).join('\n')
}

function inlineList(values) {
  return (values || []).map(readableToken).join(', ')
}

function renderAuthority() {
  return METHOD_EVO_V1.authority_order
    .map((key, index) => `${index + 1}. ${AUTHORITY_LABELS[key] || readableToken(key)}`)
    .join('\n')
}

function renderGlobalRules() {
  return METHOD_EVO_V1.global_rules
    .map((rule) => `- [${rule.id} · ${rule.level}] ${rule.text}`)
    .join('\n')
}

function renderClassProfiles() {
  return Object.entries(METHOD_EVO_V1.class_profiles)
    .map(([name, profile]) => {
      const sections = [`${name.toUpperCase()}\nFinalidad: ${profile.purpose}`]
      if (profile.session_components?.length) {
        sections.push(`Componentes de sesión:\n${bulletList(profile.session_components)}`)
      }
      if (profile.weekly_components?.length) {
        sections.push(`Componentes que deben aparecer en el conjunto de la semana:\n${bulletList(profile.weekly_components)}`)
      }
      if (profile.valid_session_structures?.length) {
        sections.push(`Estructuras de sesión válidas:\n${bulletList(profile.valid_session_structures)}`)
      }
      if (profile.weekly_current_offer_targets?.length) {
        sections.push(`Objetivos de la oferta semanal actual:\n${bulletList(profile.weekly_current_offer_targets)}`)
      }
      if (profile.required?.length) sections.push(`Debe cumplir:\n${bulletList(profile.required)}`)
      if (profile.allowed?.length) sections.push(`Puede incluir:\n${bulletList(profile.allowed)}`)
      if (profile.direct_level_options_not_skill?.length) {
        sections.push(
          `Opciones directas de capacidad (no son un skill):\n${bulletList(profile.direct_level_options_not_skill)}`,
        )
      }
      if (profile.preferences?.length) sections.push(`Preferencias, no obligaciones:\n${bulletList(profile.preferences)}`)
      if (profile.forbidden?.length) sections.push(`No debe hacer:\n${bulletList(profile.forbidden)}`)
      if (profile.logistics) {
        sections.push(
          `Logística: máximo ${profile.logistics.room_2_max_technical_bars} barras técnicas en Sala II; organizar por parejas o tandas.`,
        )
      }
      if (profile.skill_rotation) {
        const rotation = profile.skill_rotation
        sections.push(
          `Rotación móvil de skills: dos colas independientes y sin reinicio semanal. Cada bloque de ${rotation.block_size} clases realmente impartidas contiene exactamente ${rotation.target_per_block.complex} complejos y ${rotation.target_per_block.simple} sencillos. Una cancelación no avanza. La app puede recolocar el orden por ${inlineList(rotation.reorder_allowed_for)}, pero debe conservar la cuota. Cada clase de Basics lleva un skill principal identificable de ${rotation.default_minutes.join('-')} minutos; solo el principal avanza, no el refuerzo ni la aplicación.`,
        )
      }
      if (profile.skill_catalog) {
        const catalog = profile.skill_catalog
        sections.push(
          `Clasificación EVO confirmada (${catalog.confirmed_counts.complex} complejos / ${catalog.confirmed_counts.simple} sencillos):\n- Complejos: ${catalog.complex.join('; ')}.\n- Sencillos: ${catalog.simple.join('; ')}.\n- Skills operativos adicionales: complejos — ${(catalog.additional_operational_skills?.complex || []).join('; ')}; sencillos — ${(catalog.additional_operational_skills?.simple || []).join('; ')}.\nLas progresiones pueden compartir familia e histórico, pero Back Squat, Front Squat, Push Press, Push Jerk y Thruster conservan aprendizajes diferenciados.`,
        )
      }
      if (profile.movement_banks) {
        sections.push(
          `Bancos de movimientos: la checklist decide qué se enseña, no limita el entrenamiento. Usa también ${inlineList(profile.movement_banks.training)} y complementarios como ${inlineList(profile.movement_banks.complementary)}. Un movimiento enseñado puede reaparecer como refuerzo o aplicación sin consumir otra posición.`,
        )
      }
      if (profile.landmine_family) {
        sections.push(
          `Familia landmine en Basics (sencilla): ${profile.landmine_family.allowed.join(', ')}. Evita normalmente: ${profile.landmine_family.normally_avoid.join(', ')}. Si se monta, úsala coherentemente en varios movimientos o bloques.`,
        )
      }
      return sections.join('\n')
    })
    .join('\n\n')
}

function renderMesocycles() {
  const names = { force: 'FUERZA', bodyweight: 'AUTOCARGA', mixed: 'MIXTO' }
  return Object.entries(METHOD_EVO_V1.mesocycles)
    .map(([key, mesocycle]) => {
      const sequence = mesocycle.sequence
        .map((week) => {
          const load = week.load ? ` · carga: ${readableToken(week.load)}` : ''
          return `- S${week.week}: ${readableToken(week.intent)}${load}`
        })
        .join('\n')
      return `${names[key] || key.toUpperCase()} — ${mesocycle.weeks} semanas\n${sequence}`
    })
    .join('\n\n')
}

function renderOperationalContext() {
  const context = METHOD_EVO_V1.current_context
  const offer = Object.entries(context.offer)
    .map(([className, days]) => {
      const value = Array.isArray(days) ? days.join(', ') : readableToken(days)
      return `- ${className}: ${value}`
    })
    .join('\n')
  const inventory = context.inventory
  const machines = inventory.machines
  const bars = inventory.bars
  const plates = Object.entries(inventory.plates_units)
    .map(([weight, amount]) => `${weight.replace('.', ',')} kg × ${amount}`)
    .join(', ')
  const dumbbells = Object.entries(inventory.dumbbell_pairs)
    .map(([weight, amount]) => `${weight.replace('.', ',')} kg × ${amount} pares`)
    .join(', ')
  const kettlebells = Object.entries(inventory.kettlebell_units)
    .map(([weight, amount]) => `${weight} kg × ${amount}`)
    .join(', ')
  const wallBalls = Object.entries(inventory.wall_ball_units)
    .map(([weight, amount]) => `${weight} kg × ${amount}`)
    .join(', ')
  return `Vigente desde ${context.effective_from}; inventario revisado ${inventory.updated_at}. Criterio: material útil de 2023 menos lo roto, más toda la compra de 2026.\n\nOferta:\n${offer}\n\nInventario operativo único:\n- Salas: ${inventory.rooms.large.racks} racks fijos en Sala grande y ${inventory.rooms.small.racks} racks fijos en Sala pequeña; no se trasladan. En Sala II, máximo ${inventory.rooms.small.technical_bar_limit} barras en halterofilia técnica.\n- Máquinas: ${machines.rowerg} RowErg, ${machines.bike} bicicletas y ${machines.skierg} SkiErg en una sala. Se desplazan las personas; reservar por parejas, estaciones o salidas escalonadas.\n- Trineos: ${inventory.sled.total}, compartidos y con montaje alto.\n- Landmine: ${inventory.landmine.total} puestos movibles, normalmente por parejas. Se permiten dos clases con unos cuatro puestos por sala; aprovechar el montaje en varios movimientos o bloques.\n- Barras: 10 kg × ${bars.by_weight_kg['10']}, 15 kg × ${bars.by_weight_kg['15']}, 20 kg × ${bars.by_weight_kg['20']}, técnicas × ${bars.technical_180cm}. Discos: ${plates}. Evitar dos clases pesadas simultáneas con gran consumo de discos.\n- Mancuernas: ${dumbbells}.\n- Kettlebells: ${kettlebells}.\n- Wall balls: ${wallBalls}.\n- Anillas: ${inventory.rings.total} fijas en sus salas; no se trasladan ni se promete el total a una única sala.\n- Cajones: ${inventory.boxes.total}, movibles entre salas.\n- Otros: ${inventory.other.benches} bancos, ${inventory.other.parallettes} paralettes, ${inventory.other.ab_mats} AB mats, ${inventory.other.jump_ropes} combas y ${inventory.other.mats} esterillas.\n- Capacidad de referencia: ${context.reference_class_capacity} personas por clase.\n\nNo asumas que disponer de material significa poder usarlo simultáneamente en ambas salas. Comprueba ubicación, movilidad, parejas, discos y coste de montaje.`
}

function renderValidators() {
  return METHOD_EVO_V1.validators
    .map((validator) => `- [${validator.id} · ${validator.severity}] ${readableToken(validator.checks)}`)
    .join('\n')
}

function minuteRange(value) {
  if (!Array.isArray(value) || value.length < 2) return String(value ?? '')
  return `${value[0]}-${value[1]}`
}

function naturalList(values, conjunction = 'y') {
  const list = (values || []).map(String).filter(Boolean)
  if (list.length < 2) return list[0] || ''
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${list.at(-1)}`
}

function renderOutputContract() {
  const contract = METHOD_EVO_V1.output_contract
  const durations = contract.duration_rules
  const formats = contract.format_semantics
  const visible = naturalList(
    contract.visible_blocks.map((block) => (block.length === 1 ? `${block})` : block)),
    'o',
  )
  const internal = naturalList(contract.internal_only_planning.map(readableToken))

  return `CONTRATO DE SALIDA COMPARTIDO
- La programación visible empieza directamente en ${visible}.
- No muestres ${contract.forbidden_visible_sections.join(', ')}.
- Calcula internamente ${internal} para que la clase quepa en ${contract.class_total_minutes} minutos.
- Incluye la duración en cada título. Semántica exacta: ${formats.amrap_title}; ${formats.for_time_title}. TC se usa solo para ${readableToken(formats.time_cap_only_for)}.
- Varias partes suelen sumar ${minuteRange(durations.multi_part_typical_minutes)} minutos efectivos y pueden llegar a ${durations.multi_part_allowed_when_last_rest_omitted} cuando se omite deliberadamente el último descanso. Una especialidad técnica ronda ${durations.technical_specialty_approx_minutes}; una parte sencilla o Hybrix con poco briefing puede acercarse a ${minuteRange(durations.simple_single_part_or_hybrix_minutes)}.
- ${contract.never_stretch_wod_to_fill_time ? 'No alargues un WOD solo para llenar tiempo.' : ''}
- Los títulos van en ${readableToken(formats.titles_language)} y los ejercicios usan ${readableToken(formats.exercise_names)}. No dupliques el formato en el título y la primera línea.
- ${contract.feedback_separate_from_session ? 'Entrenamiento y feedback van en campos separados.' : ''} Una clase no ofertada no recibe sesión ni feedback.`
}

function renderFeedbackPolicy() {
  const rules = METHOD_EVO_V1.feedback_rules
  const required = (rules.required || []).map(readableToken).join(' y ')
  const flow = (rules.flow || []).map(readableToken).join('; después ')
  const useful = rules.include_only_when_useful.map(readableToken).join(', ')
  const forbidden = rules.forbidden.map(readableToken).join(', ')
  const records = rules.allowed_records.map(readableToken).join(', ')

  return `FEEDBACK AL ENTRENADOR
- Es una nota de Marian al entrenador con estilo natural, cercano y oral; normalmente un párrafo fluido de ${minuteRange(rules.preferred_sentences)} frases y ${minuteRange(rules.preferred_words)} palabras.
- Siempre deja claros ${required}. Orden recomendado: ${flow}.
- ${rules.single_cohesive_paragraph ? 'Escribe frases completas conectadas entre sí y devuelve un único párrafo cohesionado.' : ''}
- ${rules.bullets_required ? 'Usa viñetas.' : 'No impongas viñetas.'} ${rules.summarize_entire_session ? 'Resume la sesión.' : 'No resumas todo el entrenamiento.'} ${rules.explain_obvious ? 'Explica también lo básico.' : 'No expliques lo obvio.'}
- Incluye únicamente cuando sea útil: ${useful}.
- La logística está permitida de forma selectiva. Los detalles largos de organización van en ${readableToken(rules.long_organization_details_location)}, no dentro del entrenamiento.
- ${rules.entity_coherence_required ? 'Antes de devolverlo, comprueba que cada ejercicio, material, formato, pareja, estación y detalle organizativo mencionado existe realmente en la sesión.' : ''}
- No incluyas: ${forbidden}.
- Registros permitidos: ${records}.`
}

export const METHOD_EVO_V1_OUTPUT_CONTRACT = renderOutputContract()

export const METHOD_EVO_V1_FEEDBACK_POLICY = renderFeedbackPolicy()

/**
 * Proyección compacta y única para Chat, Excel, edición diaria y briefing.
 * @param {{ includeOperationalContext?: boolean, includeValidators?: boolean, includeOutputContract?: boolean, includeFeedbackPolicy?: boolean }} [options]
 */
export function buildMethodEvoV1Prompt(options = {}) {
  const includeOperationalContext = options.includeOperationalContext !== false
  const includeValidators = options.includeValidators !== false
  const includeOutputContract = options.includeOutputContract !== false
  const includeFeedbackPolicy = options.includeFeedbackPolicy !== false
  const sections = [
    `════════════════════════════════════════\n${METHOD_EVO_V1_LABEL.toUpperCase()} — FUENTE METODOLÓGICA ÚNICA\n════════════════════════════════════════\nVersión de contrato: ${METHOD_EVO_V1_VERSION}. Las decisiones recientes de Marian prevalecen; los históricos y ejemplos nunca crean reglas por sí solos.`,
    `JERARQUÍA DE AUTORIDAD\n${renderAuthority()}`,
    `REGLAS GLOBALES\n${renderGlobalRules()}`,
  ]
  if (includeOutputContract) sections.push(METHOD_EVO_V1_OUTPUT_CONTRACT)
  sections.push(`IDENTIDAD DE MODALIDADES\n${renderClassProfiles()}`)
  sections.push(`MESOCICLOS\n${renderMesocycles()}`)
  if (includeFeedbackPolicy) sections.push(METHOD_EVO_V1_FEEDBACK_POLICY)
  if (includeOperationalContext) sections.push(`CONTEXTO OPERATIVO ACTUAL\n${renderOperationalContext()}`)
  if (includeValidators) sections.push(`VALIDACIONES OBLIGATORIAS\n${renderValidators()}`)
  return sections.join('\n\n')
}

export const METHOD_EVO_V1_PROMPT = buildMethodEvoV1Prompt()
