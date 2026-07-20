/**
 * Núcleo compartido V1 — Chat, generación Excel y edición diaria.
 * Una sola fuente de verdad para reglas transversales del método EVO.
 */

/** Texto canónico de la política de calentamiento / presentación (V1). */
export const SYSTEM_PROMPT_CORE_WARMUP_POLICY = `En la programación y en el Excel no se muestran bloques de movilidad ni calentamiento. La clase empieza visualmente en Parte A, Parte B, fuerza, técnica o skill. El tiempo disponible sí debe calcularse teniendo en cuenta que el entrenador necesita explicar, preparar material, hacer progresiones y calentar. En el feedback se pueden incluir indicaciones breves de preparación cuando ayuden a organizar la clase.`

/** Regla compacta de cargas compartida por los tres flujos V1. */
export const SYSTEM_PROMPT_CORE_LOADS = `CARGAS (compartido): NUNCA uses kilogramos específicos en barra; usa porcentaje sobre 1RM o RPE. En mancuernas/kettlebells indica 1DB/2DB/1KB/2KB cuando aplique.`

/**
 * Bloque insertado una vez en cada system prompt V1.
 * @type {string}
 */
export const SYSTEM_PROMPT_SHARED_CORE = `════════════════════════════════════════
POLÍTICA GLOBAL COMPARTIDA — MÉTODO EVO (máxima prioridad)
════════════════════════════════════════

${SYSTEM_PROMPT_CORE_WARMUP_POLICY}

${SYSTEM_PROMPT_CORE_LOADS}`

/** Frases obsoletas que no deben permanecer tras la consolidación. */
export const SYSTEM_PROMPT_DEPRECATED_WARMUP_PHRASES = [
  'El calentamiento SIEMPRE se incluye',
  'POLÍTICA GLOBAL ACTUAL — CALENTAMIENTO NO OBLIGATORIO',
  'el calentamiento NO es obligatorio',
]
