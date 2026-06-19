# ProgramingEvo — Paquete de arreglos para Cursor

> Cómo usar este archivo: déjalo en la raíz de tu repo `programingevo`. Abre Cursor,
> selecciona una sección (R1 → R5 → R4, en ese orden) y dile a Cursor:
> *"Implementa la sección Rx de CODE_FIXES_ProgramingEvo.md"*. Prueba después de cada una.
> Empieza por R1: es el de mayor impacto y el más pequeño.

Los tres arreglos atacan la causa de que **tengas que reeditar cada semana**:
la IA no recibía el día objetivo, los vídeos se resolvían en vivo, y tu aprendizaje
vivía en un sitio que la IA no lee.

---

## 🔴 R1 — Pasar el "día objetivo" al motor anti-repetición

**Por qué:** `buildContextSynthesis` sabe decirle a la IA "no repitas lo de ayer/anteayer"
y "varía respecto al mismo día de semanas previas"… pero solo si recibe un `targetDay`.
En el chat se llama con `targetDay: null`, así que esos dos bloques devuelven *"no aplica"*
y la IA repite grupos musculares. **Este es el arreglo nº1.**

**Archivo:** `src/hooks/useAgent.js`

### 1. Añade el import (arriba, junto al resto)

```js
import { DAYS_ORDER, DAYS_ES } from '../constants/evoColors.js'
```

### 2. Añade este helper (fuera del componente, antes de `export function useAgent`)

```js
/**
 * Resuelve el día que se está programando:
 * 1) si el mensaje del usuario nombra un día ("programa el jueves"), ese.
 * 2) si no, el primer día de la semana sin sesión confirmada.
 */
function resolveTargetDay(userText, weekState) {
  const t = String(userText || '').toLowerCase()
  for (const key of DAYS_ORDER) {
    const name = (DAYS_ES[key] || '').toLowerCase()
    if (name && t.includes(name)) return key
  }
  const sessions = weekState?.sessions || {}
  for (const key of DAYS_ORDER) {
    if (!sessions[key]?.confirmed) return key
  }
  return null
}
```

### 3. En `sendMessage`, calcula el día y pásalo a la síntesis

```js
// ANTES
const synthesis = buildContextSynthesis({
  weekState,
  exerciseLibraryRows: libraryRowsRef.current,
  previousWeeks: previousWeeksRef.current,
  coachFeedback: coachFeedbackRef.current,
  targetDay: null,
})

// DESPUÉS
const targetDay = resolveTargetDay(userText, weekState)
const synthesis = buildContextSynthesis({
  weekState,
  exerciseLibraryRows: libraryRowsRef.current,
  previousWeeks: previousWeeksRef.current,
  coachFeedback: coachFeedbackRef.current,
  targetDay,
})
```

**Cómo comprobar:** programa lunes y martes, pide el miércoles y mira que el bloque
`⛔ NO REPETIR HOY` del system ya NO dice "no aplica" (puedes loguear `synthesis`).

---

## 🔴 R5 — Vídeos fiables (dejar de scrapear YouTube en vivo)

**Por qué:** en la biblioteca casi todos los ejercicios tienen `video_url = null`, así que
la app intenta resolverlos en el momento scrapeando YouTube (`/api/video-resolve`),
que falla, devuelve el vídeo equivocado o un enlace de búsqueda.

### Parte A — Curar los vídeos UNA vez (sin tocar código)

Tu importador de biblioteca ya sella `video_url_verified = true` al importar desde xlsx
(`api/import-exercise-library-xlsx.js`). Camino más rápido:

1. Abre la plantilla de biblioteca de ejercicios (xlsx).
2. Añade/rellena la columna de **vídeo** con la URL de YouTube buena de cada ejercicio.
3. Re-impórtala desde el admin (**Contenido Coach → Biblioteca**).
   Quedan guardadas y verificadas en Supabase para siempre.

> Alternativa: ve ejercicio por ejercicio en el admin (`CoachExerciseLibraryAdmin`),
> pega la URL y marca "verificado". Para ~120 ejercicios, una tarde.

### Parte B — Apagar el resolutor en vivo

**Archivo:** `src/hooks/useAgent.js` — en el `useEffect` que carga la biblioteca,
quita el segundo paso de auto-resolución por scraping:

```js
// ANTES
getCoachExerciseLibrary()
  .then(async (rows) => {
    if (cancelled) return
    libraryRowsRef.current = rows
    setExerciseLibraryRowsCache(rows)
    setLibraryAppend(buildGeneratorLibraryBlock(rows))
    try {
      const auto = await fetchLibraryAutoVideoMap(rows, { maxResolve: 18 })
      if (cancelled) return
      setLibraryAppend(buildGeneratorLibraryBlock(rows, auto))
    } catch { /* ... */ }
    if (!cancelled) setLibraryReady(true)
  })

// DESPUÉS — usa solo las URLs curadas en Supabase + el mapa estático EVO
getCoachExerciseLibrary()
  .then((rows) => {
    if (cancelled) return
    libraryRowsRef.current = rows
    setExerciseLibraryRowsCache(rows)
    setLibraryAppend(buildGeneratorLibraryBlock(rows))
    setLibraryReady(true)
  })
```

Puedes borrar el import de `fetchLibraryAutoVideoMap` si no se usa en otro sitio.
El emparejado por `coachLibraryVideoMatch.js` ya prioriza `video_url` verificada → estático → (búsqueda).

---

## 🟠 R4 — Un solo sistema de aprendizaje (que la IA sí lea)

**Por qué:** cuando editas una sesión, las "reglas aprendidas" se guardan en **localStorage**
(`programingevo_method_learned`) — se pierden al cambiar de navegador/dispositivo.
Pero el chat inyecta las reglas desde **Supabase `method_rules`** (que se rellena por otro lado).
Resultado: editas, pero la IA no relee tu criterio. Hay que mandar el aprendizaje al
**mismo sitio** que la IA ya lee: `method_rules`.

### Parte A — Endpoint para guardar una regla (service role)

**Nuevo archivo:** `api/method-rule.js`

```js
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }
  const { rule_text, trigger_context = 'edicion', rule_type = 'preferencia', confidence = 70 } = req.body || {}
  const text = String(rule_text || '').trim()
  if (!text) return res.status(400).json({ ok: false, error: 'rule_text requerido' })

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
  const { error } = await supabase.from('method_rules').insert({
    rule_text: text,
    trigger_context: String(trigger_context).slice(0, 120),
    rule_type: String(rule_type).slice(0, 60),
    confidence: Number(confidence) || 70,
    active: true,
  })
  if (error) return res.status(500).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true })
}
```

> Ajusta los nombres de columna a tu esquema real de `method_rules`
> (ver `supabase/migrations/20260417130500_cerebro_evo.sql`).

### Parte B — Al guardar una edición, mandar la regla a Supabase

**Archivo:** `src/components/EditModal/EditModal.jsx` (donde hoy se construyen las
líneas aprendidas con `methodLearnedFromEdit.js`). Tras construir las líneas, además de
guardarlas en local, persístelas en `method_rules`:

```js
// líneas que ya construyes con buildLearnedLinesWithDetectedChange(...)
for (const line of learnedLines) {
  fetch('/api/method-rule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule_text: line, trigger_context: 'edicion_sesion' }),
  }).catch(() => {}) // no bloquear el guardado si falla la red
}
```

### Parte C — No filtrar tus ediciones

En `src/utils/methodLearnedStorage.js`, `appendAutoLearnedLines` ya usa
`highImpactOnly = false` por defecto. **Asegúrate de no llamarla con `highImpactOnly: true`**
desde el guardado de ediciones: si lo editaste, es relevante por definición.
(El filtro `highImpactLearnedRules.js` descarta demasiado.)

**Cómo comprobar:** edita una sesión con un motivo → mira en Supabase que aparece una fila
nueva en `method_rules` → en el siguiente mensaje del chat, el bloque
`--- SEÑALES DEL CENTRO ---` del system la incluye.

---

## Orden y tiempo estimado

| # | Arreglo | Impacto | Esfuerzo |
|---|---------|---------|----------|
| 1 | R1 · día objetivo | 🔴 Máximo | ~1-2 h |
| 2 | R5 · vídeos curados | 🔴 Alto | 1 tarde (datos) + 15 min (código) |
| 3 | R4 · aprendizaje único | 🟠 Alto | ~1 día |

Después de R1 + R4, los "borradores IA" de la tabla rediseñada saldrán cada vez
más cerca de tu criterio → menos edición, menos 2 horas.

---

## Lo que NO hay que tocar (funciona bien)

- El `SYSTEM_PROMPT` y los bloques por mesociclo (`mesocycleGenerationBlocks.js`).
- El generador de Excel con briefing previo — es tu referencia de calidad.
- El proxy de Anthropic con streaming.
- La estructura de la biblioteca de ejercicios.
