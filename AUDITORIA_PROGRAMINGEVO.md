# AUDITORÍA PROGRAMINGEVO
**Fecha:** Junio 2026 · **Versión analizada:** producción (Vercel) + código fuente local

---

## RESUMEN EJECUTIVO

La app tiene una base técnica sólida y un system prompt bien construido. Los fallos no son de concepto — son de **arquitectura de contexto**. La IA comete errores porque recibe información incompleta, truncada o que se pierde entre sesiones. Las mejoras de mayor impacto no tocan el diseño visual: están en cómo se construye y persiste el contexto que le llega al modelo.

---

## STACK TÉCNICO

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + Tailwind CSS |
| Hosting | Vercel (Serverless Functions) |
| Base de datos | Supabase (PostgreSQL) |
| IA | Claude (Anthropic API) vía proxy `/api/anthropic` |
| Persistencia local | localStorage (estado semana, historial, reglas aprendidas) |

---

## HALLAZGOS CRÍTICOS
> Estos son los que explican directamente "comete muchos fallos" y "no cuida los grupos musculares"

---

### C1 — El historial y las reglas aprendidas viven en localStorage, no en Supabase

**Archivos:** `useWeekState.js`, `buildWeekContext.js`, `methodLearnedStorage.js`

```js
// useWeekState.js — el estado de la semana activa
localStorage.setItem('programingevo_week', JSON.stringify(state))

// buildWeekContext.js — el historial de semanas anteriores
const history = safeJson(localStorage.getItem('programingevo_history'), {})

// methodLearnedStorage.js — las reglas que "aprende" la app
localStorage.setItem(METHOD_LEARNED_KEY, JSON.stringify(state))
```

**Consecuencia directa:** Si limpias caché, cambias de navegador o abres la app en otro dispositivo, la IA pierde todo el historial de semanas previas y todas las reglas aprendidas. El contexto que construye `buildWeekContext` devuelve `'Primera semana del mesociclo. Sin historial previo.'` aunque lleves meses programando.

**Lo que falla:** La IA no puede evitar repetir grupos musculares ni patrones porque no recuerda lo que ya hizo.

**Fix:** Migrar `programingevo_history` y `METHOD_LEARNED_KEY` a Supabase (ya tienes las tablas `published_weeks` y `method_rules` — es extender lo existente, no construir desde cero).

---

### C2 — Las sesiones de la semana anterior se truncan a 450 caracteres por clase

**Archivo:** `buildWeekContext.js`, función `buildPreviousWeekDays`

```js
const ef = truncate(safeWeekText(d, ['wodFuncional', 'evofuncional']), 450)
```

Una sesión real de EvoFuncional tiene entre 800 y 1500 caracteres. Con 450 chars el AI recibe el calentamiento y la mitad del bloque A — nunca llega a ver el WOD ni los ejercicios finales.

**Consecuencia:** El modelo no puede saber qué ejercicios se usaron el día anterior. Por eso repite patrones: técnicamente no los ve en el contexto.

**Fix:** Subir el truncado a 1200-1500 chars, o mejor: guardar un resumen estructurado `{ patronPrincipal, patrones[], equipamiento[] }` junto a cada sesión.

---

### C3 — No hay tracking estructurado de grupos musculares

**Archivo:** `useWeekState.js`

```js
sessions: {
  monday: { content: "texto libre de la sesión", classes: [...], confirmed: true }
}
```

El sistema depende de que Claude **lea texto y deduzca** qué grupos musculares se trabajaron. No hay ningún campo estructurado como:
```js
{ primaryPattern: "squat", secondaryPattern: "push", equipment: ["barbell", "KB"] }
```

**Consecuencia:** Cuando el AI genera el martes, tiene que parsear el texto del lunes, identificar los ejercicios, inferir los patrones musculares y aplicar las reglas. Con texto truncado (C2) y ruido textual, falla con frecuencia.

**Fix:** Al confirmar una sesión, extraer automáticamente `{ patronPrimario, patronSecundario, equipoUsado }` (con una pequeña llamada IA o con regex sobre los ejercicios del texto). Mostrarlo en el WeekPanel y pasarlo como contexto estructurado al generar el día siguiente.

---

### C4 — El filtro de "reglas aprendidas automáticas" es demasiado restrictivo

**Archivo:** `highImpactLearnedRules.js`

```js
const HIGH_IMPACT_RE = [
  /\bregular\b/, /\bmal\b/, /\bfalto tiempo\b/, /\bwod\b.*\blargo\b/,
  // ... solo 12 patrones, mínimo 28 chars
]
```

Ejemplos de reglas que **no pasan el filtro** y se pierden:
- "En Basics evitar barbell squat en lunes, les cuesta demasiado" (no hay `regular`, `mal`, ni ninguno de los 12)
- "KB Swing siempre 1KB en Basics, nunca 2" (no hay señales de impacto)
- "No combinar T2B + box jumps en la misma sesión" (no pasa)

**Consecuencia:** La mayoría de preferencias tuyas que se generan al editar sesiones no se guardan. El sistema aprende muy poco.

**Fix:** Ampliar los patrones del filtro para capturar reglas de ejercicios específicos, equipamiento, y restricciones de combinación. O directamente subir el umbral y confiar en que si se generó al guardar una edición, es relevante.

---

### C5 — El chat no usa el briefing de Supabase, el Excel Generator sí

**Archivos:** `useAgent.js` vs `api/programming-week-briefing.js`

El generador Excel hace primero un **briefing completo**: lee todas las semanas publicadas, check-ins de coaches, pases de turno, reglas del método — todo desde Supabase con service role. El chat del dashboard hace exactamente lo contrario: solo lee localStorage.

**Consecuencia práctica:** El Excel Generator produce mejores semanas completas porque tiene más contexto real. El chat produce sesiones sueltas que cometen más errores porque trabaja con menos información.

**Fix:** El chat debería hacer la misma llamada de briefing que el Excel antes de iniciar la conversación, o al menos inyectar los datos clave de Supabase en el contexto.

---

## HALLAZGOS IMPORTANTES
> Degradan la calidad pero no son los causantes principales

---

### I1 — El historial se limita a las 2 últimas semanas

**Archivo:** `buildWeekContext.js`

```js
const recent = weeks.sort(...).slice(0, 2)
```

En un mesociclo de fuerza de 6 semanas, el AI solo ve las 2 semanas más recientes. No tiene visibilidad de la progresión completa del ciclo.

**Fix:** Aumentar a 4 semanas o, mejor, mostrar todas las semanas del mesociclo actual.

---

### I2 — El bloque de contexto de referencia puede tener 18.000 chars

**Archivo:** `referenceMesocycleContextStorage.js`

```js
export const REFERENCE_MESOCYCLE_CONTEXT_PROMPT_MAX_CHARS = 18000
```

Con 18k chars de contexto de referencia + system prompt + reglas del método + biblioteca de ejercicios, el contexto total puede superar 30.000 chars. Tanto contexto puede diluir las instrucciones más importantes (especialmente las reglas de grupos musculares).

**Fix:** Poner el contexto de referencia al final del system (ya lo hace) y limitar a 8.000-10.000 chars. Priorizar densidad sobre volumen.

---

### I3 — La biblioteca de ejercicios puede no estar lista al primer mensaje

**Archivo:** `useAgent.js`

```js
useEffect(() => {
  getCoachExerciseLibrary().then(async (rows) => {
    setLibraryAppend(buildGeneratorLibraryBlock(rows))
    // Segundo paso: auto-resolución de vídeos (puede tardar varios segundos)
    const auto = await fetchLibraryAutoVideoMap(rows, { maxResolve: 18 })
    setLibraryAppend(buildGeneratorLibraryBlock(rows, auto))
  })
}, [])
```

Si envías el primer mensaje antes de que termine la carga de la biblioteca (especialmente la resolución de vídeos), el AI genera sin conocer los ejercicios disponibles en EVO.

**Fix:** Mostrar un indicador de "cargando contexto..." en el input del chat mientras `libraryAppend` sea vacío. Bloquear o advertir el envío hasta que esté listo.

---

### I4 — Los accesos rápidos no son contextuales

Los botones "Programar sesión de FUERZA", "Programar sesión de GIMNÁSTICOS", etc. son atajos que lanzan un mensaje genérico al chat, sin saber:
- Qué día es el siguiente sin programar
- Qué ya se programó esa semana
- En qué semana del mesociclo estás

**Fix:** Hacer los accesos rápidos dinámicos: "Programar LUNES [próximo pendiente]" con el contexto del día y mesociclo inyectado automáticamente en el mensaje.

---

## HALLAZGOS DE UX/DISEÑO
> No son urgentes pero sí visibles

---

### D1 — No hay visualización de balance muscular semanal

El WeekPanel muestra los días con sus sesiones confirmadas, pero no hay ningún indicador visual de:
- Patrones musculares utilizados (empuje, tirón, cadera, rodilla, core)
- Equipamiento comprometido
- Si hay acumulación de overhead o push consecutive

Un coach mirando la semana tiene que leer cada sesión mentalmente para evaluar el balance. La app debería hacer ese trabajo.

**Fix (bajo impacto de implementación):** Después de confirmar una sesión, parsear el texto para extraer un "badge" de patrón (ej: `[TIRÓN] [CADERA]`) y mostrarlo en cada día del WeekPanel.

---

### D2 — "GENERAR SEMANA COMPLETA → EXCEL" está enterrado

Es la función más potente de la app y está en el bottom right como botón secundario. Muchos usuarios nuevos no la verán.

**Fix:** Promoverlo como acción principal en el estado vacío (0 días programados), no solo como footer persistente.

---

### D3 — El sidebar mezcla utilidades y configuración sin jerarquía

El sidebar izquierdo tiene: Tu método, Código coach, Biblioteca, Conversaciones, Contenido Coach.

No hay separación visual entre "herramientas de programación" (Biblioteca, Tu método) y "configuración del centro" (Código coach, Contenido Coach).

---

### D4 — El modal "Tu método" mezcla demasiadas cosas

Método base (textarea grande) + Reglas aprendidas manual + Reglas aprendidas automáticas + Contexto de mesociclos + Drive — todo en un solo modal scroll.

**Fix:** Separar en tabs: Método | Aprendido | Referencia.

---

## MAPA DE PRIORIDADES

| Prioridad | Hallazgo | Impacto | Esfuerzo |
|---|---|---|---|
| 🔴 1 | C2 — Truncado de sesiones a 450 chars | Máximo | Bajo — cambiar un número |
| 🔴 2 | C4 — Filtro reglas aprendidas muy restrictivo | Alto | Bajo — ampliar HIGH_IMPACT_RE |
| 🔴 3 | C1 — Historial en localStorage | Máximo | Medio — migrar a Supabase |
| 🟠 4 | C3 — Sin tracking estructurado de grupos musculares | Alto | Medio |
| 🟠 5 | C5 — Chat sin briefing de Supabase | Alto | Medio — reutilizar lógica existente |
| 🟡 6 | I1 — Historial solo 2 semanas | Medio | Bajo |
| 🟡 7 | I3 — Biblioteca no lista en primer mensaje | Medio | Bajo — añadir estado loading |
| 🟡 8 | I4 — Accesos rápidos no contextuales | Medio | Medio |
| ⚪ 9 | D1 — Sin balance muscular visual | Medio | Medio |
| ⚪ 10 | D2 — Excel Generator oculto | Bajo | Muy bajo |
| ⚪ 11 | D3/D4 — UX sidebar y modal | Bajo | Bajo |

---

## QUÉ ESTÁ FUNCIONANDO BIEN (no tocar)

- **El system prompt** es excelente: las reglas de carga, el landmine obligatorio, los formatos de WOD, la distinción por tipo de clase — todo bien calibrado.
- **`mesocycleGenerationBlocks.js`** — los bloques por mesociclo son precisos y están bien diferenciados.
- **El proxy de Anthropic** con streaming y AbortController funciona limpio.
- **La CoachView** (`?coach`) es una feature sólida de cara al entrenador.
- **El feedback de coaches** (Supabase) se integra correctamente en el briefing.
- **La biblioteca de ejercicios** con resolución automática de vídeos es un gran activo.
- **El modal de Excel Generator** con briefing previo es la parte más completa del sistema.

---

## FIXES DE ALTA PRIORIDAD EN DETALLE

### Fix 1 — Truncado (30 min, máximo impacto inmediato)

**Archivo:** `src/utils/buildWeekContext.js`, líneas 59-61

```js
// ANTES
const ef = truncate(safeWeekText(d, ['wodFuncional', 'evofuncional']), 450)
const fit = truncate(safeWeekText(d, ['wodFit', 'evofit']), 450)
const basics = truncate(safeWeekText(d, ['wodBasics', 'evobasics']), 450)

// DESPUÉS
const ef = truncate(safeWeekText(d, ['wodFuncional', 'evofuncional']), 1400)
const fit = truncate(safeWeekText(d, ['wodFit', 'evofit']), 1200)
const basics = truncate(safeWeekText(d, ['wodBasics', 'evobasics']), 1200)
```

---

### Fix 2 — Historial 2 semanas → 4 (15 min)

**Archivo:** `src/utils/buildWeekContext.js`, línea 47

```js
// ANTES
.slice(0, 2)

// DESPUÉS
.slice(0, 4)
```

---

### Fix 3 — Filtro de reglas aprendidas más amplio (45 min)

**Archivo:** `src/utils/highImpactLearnedRules.js`

Añadir al array `HIGH_IMPACT_RE`:
```js
/\bevitar\b/,
/\bno combinar\b/,
/\bno mezclar\b/,
/\bsiempre\b.*\bclase\b/,
/\bnunca\b/,
/\bbasics\b/,
/\bfuncional\b/,
/\bfit\b/,
/\blandmine\b/,
/\bequipamiento\b/,
/\bbarbell\b/,
/\bkb\b/,
/\bdb\b/,
```

Y reducir la longitud mínima de 28 a 20 caracteres.

---

### Fix 4 — Indicador de carga biblioteca (20 min)

**Archivo:** `src/components/AgentChat/AgentChat.jsx`

Pasar el estado `libraryAppend` como prop y añadir en el input:
```jsx
{!libraryAppend && (
  <span className="text-xs text-yellow-400">Cargando biblioteca de ejercicios...</span>
)}
```

---

*Informe generado por auditoría automática + revisión de código — Junio 2026*
