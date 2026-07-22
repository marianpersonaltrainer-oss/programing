/**
 * Núcleo compartido V1 — Chat, generación Excel y edición diaria.
 * Las reglas proceden del contrato estructurado y versionado de Método EVO.
 */
import {
  METHOD_EVO_V1_FEEDBACK_POLICY,
  METHOD_EVO_V1_LABEL,
  METHOD_EVO_V1_OUTPUT_CONTRACT,
  METHOD_EVO_V1_VERSION,
} from '../domain/method/methodEvoV1.js'

export const SYSTEM_PROMPT_CORE_OUTPUT_POLICY = METHOD_EVO_V1_OUTPUT_CONTRACT
export const SYSTEM_PROMPT_CORE_FEEDBACK_POLICY = METHOD_EVO_V1_FEEDBACK_POLICY

export const SYSTEM_PROMPT_CORE_SOURCE_POLICY = `FUENTE Y AUTORIDAD
- Los tres flujos V1 consumen ${METHOD_EVO_V1_LABEL}; ningún prompt local puede redefinir la identidad de una modalidad.
- Una decisión reciente y explícita de Marian puede ampliar o corregir el método. Un histórico, ejemplo o regla automática no puede hacerlo.
- Las observaciones automáticas pendientes no se aplican como reglas hasta que Marian las apruebe.`

export const SYSTEM_PROMPT_SHARED_CORE = `════════════════════════════════════════
NÚCLEO COMPARTIDO — MÉTODO EVO ${METHOD_EVO_V1_VERSION}
════════════════════════════════════════

${SYSTEM_PROMPT_CORE_SOURCE_POLICY}

${SYSTEM_PROMPT_CORE_OUTPUT_POLICY}

${SYSTEM_PROMPT_CORE_FEEDBACK_POLICY}`

/** Conceptos legacy cuya reaparición en un prompt debe romper las pruebas. */
export const SYSTEM_PROMPT_DEPRECATED_CONCEPTS = [
  /juego siempre en calentamiento/i,
  /nadie sale destrozado/i,
  /fuerza accesible/i,
  /fuerza funcional b[aá]sica/i,
  /completa(?:r|rse)?\s+(?:visualmente\s+)?58\s*[-–]\s*60/i,
  /CERO log[ií]stica/i,
  /BIENVENIDA\s*\+\s*A\)\s*B\)\s*C\)\s*\+\s*CIERRE/i,
]

/** Compatibilidad temporal con imports de la primera consolidación. */
export const SYSTEM_PROMPT_CORE_WARMUP_POLICY = METHOD_EVO_V1_OUTPUT_CONTRACT
export const SYSTEM_PROMPT_DEPRECATED_WARMUP_PHRASES = [
  'El calentamiento SIEMPRE se incluye',
  'POLÍTICA GLOBAL ACTUAL — CALENTAMIENTO NO OBLIGATORIO',
  'el calentamiento NO es obligatorio',
]
