/**
 * Reglas fijas de programación por mesociclo para el generador Excel.
 * Se inyectan en el system de cada petición; priorizan el estímulo del mesociclo
 * frente a plantillas genéricas del resto del prompt.
 */

function normMeso(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
  if (!s) return ''
  if (s === 'gimnasticos' || s === 'gimnastica' || s === 'gimnasico') return 'autocarga'
  return s
}

function blockFuerza(week, totalWeeks, phase) {
  return `════════════════════════════════════════
MESOCICLO ACTIVO — FUERZA (prioridad sobre plantillas genéricas)
════════════════════════════════════════
Identificador: fuerza · Semana ${week}/${totalWeeks || 6}${phase ? ` · Fase: ${phase}` : ''}

Objetivo del bloque: progresión de fuerza con barra/mancuernas y accesorios de calidad; volumen e intensidad coherentes con la semana del mesociclo (S1–S6).

Reglas:
- El trabajo pesado y la calidad de series son el eje; no sustituir el día por un WOD largo ligero “para rellenar”.
- Respeta la filosofía de ondas/formatos ya definida en el system prompt para NO repetir el mismo formato de fuerza dominante en días consecutivos.
- EvoGimnástica / trabajo corporal, si existe esa columna, es complementario: técnica y volumen moderado, no debe robar el protagonismo al bloque de fuerza del día en EvoFuncional/Fit/Basics cuando el foco del mesociclo es fuerza.
- Variedad: alterna implementaciones (barra, DB, KB) y patrones de movimiento a lo largo de la semana sin solapar el mismo lift principal en días seguidos salvo criterio pedagógico explícito en el briefing.`
}

function blockAutocarga(week, totalWeeks, phase) {
  const w = Number(week) || 1
  const late = w >= 4
  return `════════════════════════════════════════
MESOCICLO ACTIVO — AUTOCARGA = GIMNÁSTICO / CALISTENIA (prioridad absoluta)
════════════════════════════════════════
Identificador: autocarga · Semana ${w}/${totalWeeks || 5}${phase ? ` · Fase: ${phase}` : ''}

Qué ES este mesociclo (no negociable):
- Bloque de 5 semanas centrado en DOMINIO de movimientos de peso corporal, anillas, pino/handstand, suelo, progresiones unilaterales, equilibrio y propiocepción, con progresión semanal clara.
- NO es “una semana de fuerza con menos carga”. Si aparece barra o carga externa, va en segundo plano y con intención técnica o mantenimiento, no como copia del mesociclo de fuerza.

Distribución de estímulos (orientación):
- Prioriza cada semana mezcla de: tracción (dominadas, ring row, escalados), empuje en pino/handstand y variantes, trabajo en anillas (support, dips, MU escalado si toca), suelo (hollow/arch, L-sit progresiones en suelo/caja), unilateral y anti-rotación, equilibrio.
- Incluye a menudo formatos sociales o motivadores acordes a EVO: parejas, relevos, equipos, mini-competiciones amistosas, “carrera” por bloques, cuando encaje con el objetivo técnico del día (sin convertir todo en juego vacío).

Fuerza con barra / mancuernas cuando toque combinar:
- Mantén % moderados en la mayoría de semanas (orientación aproximada S1–S3: zona técnica ~65–75% o RIR alto; prioriza calidad y rangos completos).
- En semanas ${late ? '4–5 (peak/test) y en general en tramos finales del mesociclo' : 'finales del mesociclo (4–5)'} puedes rozar cargas altas SOLO si el briefing lo apoya: series cortas, DESCANSOS LARGOS, pocas reps, SIN sesión centrada en “perseguir RM” ni en test máximo salvo que el briefing o la nota de la programadora lo pidan explícitamente.
- Nunca el mismo día: bloque principal gimnástico exigente + WOD de fuerza pesada ambos como núcleos; compensa según reglas de timing ya definidas en el system prompt.

Variedad y no solapamiento:
- Varía formatos de condicionamiento: EMOM, AMRAP corto, FOR TIME, Every X min, circuitos por rondas, acumulación de calidad, trabajo por calidad en intervalos. Evita que TODA la semana sea solo “AMRAP” o solo “FOR TIME”.
- Evita repetir el mismo patrón dominante de la semana anterior (mismo esquema + mismo foco gimnástico) en dos semanas seguidas si el historial del briefing lo muestra; introduce nuevo reto técnico o nuevo ángulo (empuje vs tracción vs suelo).
- Respeta landmine y reglas EVO existentes; si chocan con este bloque en el ESTÍMULO del día, gana este bloque para autocarga.

EvoGimnástica (si la columna está activa): máximo protagonismo técnico, escalados A/B/C, sensación de progresión y “solo pasa aquí”.`
}

function blockMixto(week, totalWeeks, phase) {
  return `════════════════════════════════════════
MESOCICLO ACTIVO — MIXTO (prioridad sobre plantillas genéricas)
════════════════════════════════════════
Identificador: mixto · Semana ${week}/${totalWeeks || 4}${phase ? ` · Fase: ${phase}` : ''}

Objetivo: cada semana debe mezclar de forma explícita estímulo de fuerza moderada-alta y trabajo gimnástico/técnico en peso corporal, sin que una mitad “coma” a la otra todos los días.

Reglas:
- Reparte a lo largo de L–V (y sábado si aplica): días con sesión más cargada + días con sesión más gimnástica; alterna el protagonista del día.
- Cuando el día lleve barra pesada, el gimnástico del mismo día va a volumen técnico o accesorio, no a máxima complejidad simultánea.
- Variedad de formatos (no solo FOR TIME / AMRAP): incluye parejas, equipos o bloques por calidad cuando encaje.
- No repitas el mismo formato dominante de fuerza dos días seguidos (ya reglado en el system); aplica criterio equivalente para el bloque gimnástico principal (no mismo skill max 3 días seguidos en la misma clase).`
}

/**
 * Texto a añadir al system del generador Excel. Cadena vacía si no hay mesociclo conocido.
 */
export function buildMesocycleProgrammingBlock({ mesocycle, week, totalWeeks, phase }) {
  const key = normMeso(mesocycle)
  const w = Number(week) || 1
  const tw = Number(totalWeeks) || null

  if (key === 'fuerza') return blockFuerza(w, tw || 6, phase)
  if (key === 'autocarga') return blockAutocarga(w, tw || 5, phase)
  if (key === 'mixto') return blockMixto(w, tw || 4, phase)
  return ''
}
