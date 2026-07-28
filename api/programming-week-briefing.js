/**
 * POST /api/programming-week-briefing
 * Ensambla datos de Supabase (service role) y llama a Anthropic para la propuesta conversacional
 * del modal «Generar programación semanal».
 *
 * Body JSON:
 * - mesociclo (string), semana (number) — semana objetivo a programar
 * - phase (string, opcional)
 * - messages (opcional) — array Anthropic { role, content } para refinar propuesta; si viene,
 *   no se reconsulta Supabase y se reutiliza el último user message con el paquete o el cliente
 *   debe reenviar "contextPack" en el primer user.
 * - contextPack (opcional) — si messages tiene más de 0 elementos y el primer user no incluye
 *   el paquete, el cliente puede mandar contextPack para prefijarlo (o ya va en messages[0]).
 *
 * Respuesta: { proposal: { title, narrative, suggestedFocus, weeklyArchitecture }, contextPack, model? }
 */

import { createClient } from '@supabase/supabase-js'
import { buildMesocycleProgrammingBlock } from '../src/constants/mesocycleGenerationBlocks.js'
import {
  DEFAULT_SUPPORT_MODEL,
  resolveProgrammingModel,
} from '../src/constants/anthropicModels.js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import { buildMethodEvoV1Prompt } from '../src/domain/method/methodEvoV1.js'
import {
  filterFeedbackForSelectedWeekIds,
  selectProgrammingContextWeeks,
} from '../src/utils/programmingContextSelection.js'
import {
  formatWeeklyStructuralFingerprints,
  normalizeWeeklyArchitecturePlan,
  replaceWeeklyArchitectureBlock,
} from '../src/utils/weeklyArchitecturePlan.js'
import { parseAssistantBriefingJson } from '../src/utils/parseAssistantWeekJson.js'
import { loadPublishedWeeksForContext } from './lib/loadPublishedWeeksForContext.js'

// El briefing decide arquitectura, no redacta sesiones. Evitar aquí el contrato de
// salida y la política de feedback mantiene identidad, modalidades, progresión y
// logística sin duplicar reglas que se vuelven a inyectar en la generación final.
const BRIEFING_METHOD_CONTEXT = buildMethodEvoV1Prompt({
  includeValidators: false,
  includeOutputContract: false,
  includeFeedbackPolicy: false,
})
const MAX_CONTEXT_PACK_CHARS = 48_000
const BRIEFING_MAX_TOKENS = 2400
const BRIEFING_UPSTREAM_TIMEOUT_MS = (() => {
  const configured = Number(process.env.PROGRAMMING_BRIEFING_TIMEOUT_MS)
  if (Number.isFinite(configured) && configured >= 20_000 && configured <= 90_000) {
    return Math.floor(configured)
  }
  return 75_000
})()

export const BRIEFING_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    narrative: { type: 'string' },
    suggestedFocus: { type: 'string' },
    weeklyArchitecture: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          day: { type: 'string' },
          intent: { type: 'string' },
          classPlans: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                classKey: { type: 'string' },
                plan: { type: 'string' },
              },
              required: ['classKey', 'plan'],
            },
          },
          sharedFatigue: { type: 'string' },
          antiRepetition: { type: 'string' },
        },
        required: ['day', 'intent', 'classPlans', 'sharedFatigue', 'antiRepetition'],
      },
    },
  },
  required: ['title', 'narrative', 'suggestedFocus', 'weeklyArchitecture'],
}

const SYSTEM = `Eres el copiloto de programación de Evolution Boutique Fitness (EVO), Granada.
Marian va a generar la próxima semana de clases. Recibes un paquete de datos REALES: semanas ya publicadas
(progresión verificada del ciclo exacto y referencias antiguas separadas), historial de cambios guardados
en Supabase, check-ins semanales de coaches, pases de turno diarios, reglas del método, huellas
estructurales y feedback por sesión ligado exclusivamente a las semanas seleccionadas.

Tu tarea:
1) Sintetiza patrones útiles (carga, fatiga, energía, incidentes, notas de coaches, coherencia con semanas previas).
2) Propón un enfoque para LA SEMANA que se indica al final del mensaje (no inventes datos que no vengan del paquete; si algo falta, dilo con suavidad).
3) ANTES de que se genere ningún día, decide una arquitectura semanal completa para todos los días y clases seleccionados. Debe contrastar formatos, fatiga, material y relación trabajo/descanso; no puede repetir el mismo esqueleto en días consecutivos.
4) Responde SOLO con un objeto JSON válido (sin markdown, sin \`\`\`, sin texto fuera del JSON) con exactamente estas claves:
   - "title": string corto, p. ej. "PROPUESTA PARA SEMANA 6"
   - "narrative": string en español, 2–5 frases, tono profesional y cercano
   - "suggestedFocus": una línea, p. ej. "Consolidación + descarga parcial de hombro"
   - "weeklyArchitecture": array con un objeto por cada día seleccionado, sin añadir días. Cada objeto contiene exactamente:
     - "day": día en MAYÚSCULAS
     - "intent": intención concreta del día
     - "classPlans": array con un objeto por cada clase seleccionada. Cada objeto contiene exactamente:
       - "classKey": identificador EXACTO de la clase seleccionada (evofuncional, evobasics, etc.)
       - "plan": resumen de fuerza/skill + formato metabólico + trabajo/descanso + material
     - "sharedFatigue": fatiga compartida que debe protegerse entre modalidades
     - "antiRepetition": diferencia estructural obligatoria respecto a días contiguos e histórico reciente

No redactes todavía sesiones, ejercicios con repeticiones completas ni WODs. weeklyArchitecture es un mapa previo compacto, no la programación día a día.

${BRIEFING_METHOD_CONTEXT}`

function buildBriefingSystemPrompt(body) {
  const meso = String(body?.mesociclo || '').trim()
  const week = Number(body?.semana)
  const phase = String(body?.phase || '').trim()
  const twRaw = body?.totalWeeks
  const tw = twRaw == null || twRaw === '' ? NaN : Number(twRaw)
  const block = buildMesocycleProgrammingBlock({
    mesocycle: meso,
    week: Number.isFinite(week) ? week : undefined,
    totalWeeks: Number.isFinite(tw) ? tw : null,
    phase: phase || null,
  })
  if (!block) return SYSTEM
  return `${SYSTEM}

════════════════════════════════════════
INTENCIÓN DEL MESOCICLO (obligatoria para la propuesta)
════════════════════════════════════════
La semana objetivo pertenece a este mesociclo. La propuesta (title, narrative, suggestedFocus) DEBE estar alineada con estas reglas, no con un mesociclo genérico ni con plantillas de otro bloque.

${block}`
}

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (typeof raw === 'object') return raw
  return null
}

function normalizeContextSelection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const cleanIds = (ids) =>
    Array.isArray(ids)
      ? [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))].slice(0, 20)
      : []
  const mode = value.mode === 'exact-cycle-date' ? value.mode : 'legacy-slot'
  const snapshotAt = String(value.snapshotAt || '').trim()
  return {
    mode,
    snapshotAt,
    progressionWeekIds: cleanIds(value.progressionWeekIds),
    historicalWeekIds: cleanIds(value.historicalWeekIds),
    selectedWeekIds: cleanIds(value.selectedWeekIds),
  }
}

function sliceText(s, max) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, max - 1).trim()}…`
}

function compactPublishedWeek(row) {
  const d = row?.data
  if (!d || typeof d !== 'object') return `— ${row?.titulo || 'sin título'} (sin JSON)`
  const lines = [
    `=== ${row.mesociclo || '—'} · S${row.semana ?? '?'} · ${row.titulo || ''} (publicada ${row.published_at || ''}) ===`,
  ]
  const r = d.resumen
  if (r && typeof r === 'object') {
    lines.push(
      `Resumen: estímulo=${sliceText(r.estimulo, 120)} | intensidad=${sliceText(r.intensidad, 120)} | foco=${sliceText(r.foco, 120)}`,
    )
    if (r.nota) lines.push(`Nota: ${sliceText(r.nota, 220)}`)
  }
  for (const dia of d.dias || []) {
    const nm = String(dia?.nombre || '').toUpperCase()
    const bits = []
    for (const k of ['evofuncional', 'evobasics', 'evofit', 'evohybrix', 'evofuerza', 'evogimnastica', 'evotodos']) {
      const v = String(dia[k] || '').trim()
      if (v && !/^\(no programada/i.test(v) && !/^FESTIVO/i.test(v)) {
        bits.push(`${k}: ${sliceText(v.replace(/\s+/g, ' '), 300)}`)
      }
    }
    if (bits.length) lines.push(`${nm}: ${bits.join(' | ')}`)
  }
  return lines.join('\n')
}

function formatCheckins(rows) {
  if (!rows?.length) return '(Sin check-ins en ventana.)'
  return rows
    .map((r) => {
      const parts = [
        `- ${r.week_iso || '—'} · ${r.coach_name || 'Coach'} · ánimo ${r.mood_score ?? '—'}/5`,
        r.feedback_text ? `  feedback: ${sliceText(r.feedback_text, 200)}` : '',
        r.highlights ? `  destacados: ${sliceText(r.highlights, 160)}` : '',
        r.improvements ? `  mejorar: ${sliceText(r.improvements, 160)}` : '',
      ]
      return parts.filter(Boolean).join('\n')
    })
    .join('\n')
}

function formatHandoffs(rows) {
  if (!rows?.length) return '(Sin pases de turno en ventana.)'
  return rows
    .map(
      (h) =>
        `- ${h.created_at?.slice(0, 16) || '—'} · ${h.coach_name || ''} · ${h.class_type || ''} @ ${h.class_time || ''} · energía ${h.energy_level ?? '—'}/5${h.had_incident ? ' · incidente' : ''}${h.note ? ` · ${sliceText(h.note, 220)}` : ''}`,
    )
    .join('\n')
}

function formatSessionFeedback(rows) {
  if (!rows?.length) return '(Sin feedback por sesión en las semanas consultadas.)'
  return rows
    .map((r) => {
      const how = r.session_how || '—'
      const line = `- ${r.day_key || '—'} ${r.class_label || ''} (${r.coach_name || ''}): ${how}`
      const n = r.notes_next_week ? ` | nota próx. sem.: ${sliceText(r.notes_next_week, 160)}` : ''
      const ch = r.changed_something && r.changed_details ? ` | cambió en sala: ${sliceText(r.changed_details, 140)}` : ''
      return `${line}${n}${ch}`
    })
    .join('\n')
}

/** Resumen de guardados en Supabase (edit_history) por semana del mesociclo. */
function formatEditHistoryForPack(weeks) {
  if (!weeks?.length) return '(Sin historial de ediciones en Supabase para estas semanas.)'
  const parts = []
  for (const w of weeks) {
    const hist = Array.isArray(w.edit_history) ? w.edit_history : []
    if (!hist.length) continue
    const last = hist.slice(-3)
    parts.push(`### S${w.semana} · ${sliceText(w.titulo || 'sin título', 56)}`)
    for (const e of last) {
      const ch = Array.isArray(e.changes) ? e.changes : []
      const when = e.at ? String(e.at).slice(0, 16) : '—'
      parts.push(`- ${when} (${e.source || 'guardado'}${e.actor ? ` · ${e.actor}` : ''}): ${ch.length} cambio(s)`)
      const first = ch[0]
      if (first && (first.class || first.day)) {
        parts.push(
          `  p. ej. ${first.day || '—'} · ${first.class || '—'} · ${first.field || '—'}: ${sliceText(String(first.after || first.before || ''), 140)}`,
        )
      }
    }
  }
  return parts.length ? parts.join('\n') : '(Sin historial de ediciones en Supabase para estas semanas.)'
}

function parseProposalJson(assistantText, options = {}) {
  const o = parseAssistantBriefingJson(assistantText)
  const title = String(o.title || '').trim()
  const narrative = String(o.narrative || '').trim()
  const suggestedFocus = String(o.suggestedFocus || '').trim()
  if (!title || !narrative) throw new Error('JSON incompleto: faltan title o narrative.')
  const weeklyArchitecture = normalizeWeeklyArchitecturePlan(o.weeklyArchitecture, options)
  return { title, narrative, suggestedFocus, weeklyArchitecture }
}

async function requestBriefingFromAnthropic({ apiKey, model, systemPrompt, messages }) {
  const upstreamAbort = new AbortController()
  const timeoutId = setTimeout(
    () => upstreamAbort.abort(),
    BRIEFING_UPSTREAM_TIMEOUT_MS,
  )
  let upstream
  try {
    upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: BRIEFING_MAX_TOKENS,
        system: systemPrompt,
        messages,
        output_config: {
          format: {
            type: 'json_schema',
            schema: BRIEFING_OUTPUT_SCHEMA,
          },
        },
      }),
      signal: upstreamAbort.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(
        'La IA tardó demasiado en preparar la propuesta. La petición se ha cerrado; pulsa «Reintentar».',
      )
      timeoutError.httpStatus = 504
      throw timeoutError
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }

  const rawText = await upstream.text()
  let data
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    const err = new Error('Anthropic devolvió cuerpo no JSON')
    err.preview = rawText?.slice(0, 200)
    err.httpStatus = upstream.status
    throw err
  }

  if (!upstream.ok) {
    const err = new Error(data?.error?.message || `Anthropic HTTP ${upstream.status}`)
    err.httpStatus = upstream.status
    throw err
  }

  const assistantText = extractAnthropicTextBlocks(data)
  if (!assistantText) {
    const contentTypes = summarizeAnthropicContentTypes(data)
    console.error('[programming-week-briefing] Anthropic sin texto utilizable:', {
      status: upstream.status,
      model: data?.model || model,
      contentTypes,
    })
    throw new Error(
      'Anthropic devolvió una respuesta sin texto utilizable para el briefing. Reintenta; si persiste, revisa prompt/modelo.',
    )
  }

  return { assistantText, data }
}

function extractAnthropicTextBlocks(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  return blocks
    .map((block) => {
      if (!block || typeof block !== 'object') return ''
      if (block.type && block.type !== 'text') return ''
      return typeof block.text === 'string' ? block.text : ''
    })
    .filter(Boolean)
    .join('\n')
    .trim()
}

function summarizeAnthropicContentTypes(data) {
  const blocks = Array.isArray(data?.content) ? data.content : []
  if (!blocks.length) return '(sin content)'
  return blocks.map((b) => String(b?.type || 'unknown')).join(', ')
}

/**
 * Tablas auxiliares del pack (check-ins, handoffs, reglas, feedback por sesión).
 * Si la migración no está aplicada en Supabase o falla RLS, el briefing sigue funcionando sin ese bloque.
 */
function logOptionalTableSkip(label, err) {
  const msg = err?.message || String(err || '')
  console.warn(`[programming-week-briefing] ${label} omitido:`, msg)
}

async function fetchContextPack(supabase, target) {
  const mesociclo = String(target?.mesociclo || '').trim()
  // Se toma antes de leer: cualquier publicación posterior deberá invalidar
  // este contexto en la transacción final, aunque sea de otro mesociclo.
  const snapshotAt = new Date().toISOString()
  const rows = await loadPublishedWeeksForContext(supabase, { limit: 160 })

  const selection = selectProgrammingContextWeeks(rows || [], target, {
    progressionLimit: 6,
    historicalLimit: 4,
  })
  const progressionWeeks = selection.progressionWeeks
  const historicalWeeks = selection.historicalReferenceWeeks
  const selectedWeeks = [...progressionWeeks, ...historicalWeeks]
  const weekIds = selection.selectedWeekIds
  const loadSessionRows = async () => {
    if (!weekIds.length) return []
    const { data, error } = await supabase
      .from('coach_session_feedback')
      .select(
        'day_key, class_label, coach_name, session_how, changed_something, changed_details, notes_next_week, week_id, created_at',
      )
      .in('week_id', weekIds)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) {
      logOptionalTableSkip('coach_session_feedback', error)
      return []
    }
    return filterFeedbackForSelectedWeekIds(data || [], weekIds)
  }

  const loadCheckins = async () => {
    const sinceCheckins = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('weekly_checkins')
      .select('coach_name, week_iso, mood_score, feedback_text, highlights, improvements, created_at')
      .gte('created_at', sinceCheckins)
      .order('created_at', { ascending: false })
      .limit(30)
    if (error) {
      logOptionalTableSkip('weekly_checkins', error)
      return []
    }
    return data || []
  }

  const loadHandoffs = async () => {
    const sinceHandoffs = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('daily_handoffs')
      .select('coach_name, class_type, class_time, energy_level, had_incident, note, created_at')
      .gte('created_at', sinceHandoffs)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) {
      logOptionalTableSkip('daily_handoffs', error)
      return []
    }
    return data || []
  }

  // Estas tres lecturas no dependen entre sí. Hacerlas en paralelo evita
  // sumar tres esperas de red antes de empezar el briefing.
  const [sessionRows, checkins, handoffs] = await Promise.all([
    loadSessionRows(),
    loadCheckins(),
    loadHandoffs(),
  ])

  const blocks = [
    `## Progresión verificada del ciclo objetivo (${mesociclo || 'sin mesociclo'}; solo semanas estrictamente anteriores)`,
    progressionWeeks.map(compactPublishedWeek).join('\n\n') ||
      '(Sin semanas anteriores verificadas del ciclo exacto. No inventes una progresión.)',
    '',
    '## Huella estructural de la progresión (formato + patrón + material; usar para no repetir esqueletos)',
    formatWeeklyStructuralFingerprints(progressionWeeks),
    '',
    '## Referencias históricas separadas (NO son progresión del ciclo actual; sirven solo para variedad y logística)',
    historicalWeeks.map(compactPublishedWeek).join('\n\n') ||
      '(Sin referencias históricas seleccionadas.)',
    '',
    '## Huella estructural de referencias antiguas (inspiración; no copiar)',
    formatWeeklyStructuralFingerprints(historicalWeeks),
    '',
    '## Cambios guardados en el Hub (solo semanas seleccionadas arriba)',
    formatEditHistoryForPack(selectedWeeks),
    '',
    '## Check-ins semanales coaches (~últimas 2 semanas por fecha)',
    formatCheckins(checkins || []),
    '',
    '## Pases de turno diarios (últimos ~7 días)',
    formatHandoffs(handoffs || []),
  ]

  blocks.push(
    '',
    `## Feedback por sesión de coaches (solo week_id de las ${weekIds.length} semanas seleccionadas arriba)`,
    formatSessionFeedback(sessionRows),
  )

  return {
    text: blocks.join('\n').slice(0, MAX_CONTEXT_PACK_CHARS),
    selection: {
      mode: selection.mode,
      snapshotAt,
      progressionWeekIds: progressionWeeks.map((row) => row.id).filter(Boolean),
      historicalWeekIds: historicalWeeks.map((row) => row.id).filter(Boolean),
      selectedWeekIds: weekIds,
    },
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed' })
  }

  const body = parseBody(req)
  if (body === null) {
    return res.status(400).json({ error: 'JSON inválido' })
  }

  const apiKey = (process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta ANTHROPIC_API_KEY en el servidor.' })
  }

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  const serverSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  if (!serviceKey || !supabaseUrl || !serverSecret) {
    return res.status(500).json({
      error:
        'Falta SUPABASE_SERVICE_ROLE_KEY, URL de Supabase o COACH_GUIDE_ADMIN_SECRET.',
    })
  }
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  try {
    const exceeded = await checkAdminRateLimit(supabase, req, {
      endpoint: '/api/programming-week-briefing',
      limit: 20,
      windowMinutes: 10,
    })
    if (exceeded) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        retry_after_seconds: 600,
      })
    }
  } catch (error) {
    console.error('[programming-week-briefing] rate limit unavailable:', error?.message || error)
    return res.status(503).json({ error: 'rate_limit_unavailable' })
  }
  if (!adminSecretsMatch(body.secret, serverSecret)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  // La propuesta es una arquitectura compacta previa. Reservamos Sonnet/Opus
  // para redactar y revisar las sesiones completas; Haiku reduce la latencia de
  // esta puerta sin quitarle el método ni el histórico seleccionado.
  const model = resolveProgrammingModel(
    process.env.PROGRAMMING_BRIEFING_MODEL || DEFAULT_SUPPORT_MODEL,
  )

  const messagesIn = Array.isArray(body.messages) ? body.messages : null
  const mesociclo = String(body.mesociclo || '').trim()
  const semana = Number(body.semana)
  const phase = String(body.phase || '').trim()
  const twRaw = body.totalWeeks
  const totalWeeks = twRaw == null || twRaw === '' ? NaN : Number(twRaw)
  const validDays = new Set(['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'])
  const generationDays = Array.isArray(body.generationDays)
    ? body.generationDays
        .map((day) => String(day || '').trim().toUpperCase())
        .filter((day, index, values) => validDays.has(day) && values.indexOf(day) === index)
    : []
  const weeklyOffer = body.weeklyOffer && typeof body.weeklyOffer === 'object'
    ? body.weeklyOffer
    : null
  const action = String(body.action || 'prepare').trim().toLowerCase()
  if (!['prepare', 'context', 'proposal'].includes(action)) {
    return res.status(400).json({ error: 'Acción de briefing no válida.' })
  }
  const targetCycle = {
    mesociclo,
    semana,
    cycle_id: String(body.cycleId ?? body.cycle_id ?? '').trim(),
    cycle_start_date: String(body.cycleStartDate ?? body.cycle_start_date ?? '').trim(),
    week_start_date: String(body.targetWeekStartDate ?? body.weekStartDate ?? body.week_start_date ?? '').trim(),
  }

  try {
    let messages
    let contextPack = String(body.contextPack || '').trim().slice(0, MAX_CONTEXT_PACK_CHARS)
    let contextSelection = normalizeContextSelection(body.contextSelection)

    if (messagesIn && messagesIn.length > 0) {
      messages = messagesIn
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m) => ({ role: m.role, content: m.content }))
      if (!messages.length) {
        return res.status(400).json({ error: 'messages vacío o inválido' })
      }
    } else {
      if (!mesociclo || !Number.isFinite(semana)) {
        return res.status(400).json({ error: 'Faltan mesociclo o semana para el briefing inicial.' })
      }

      if (action !== 'proposal') {
        const fetchedContext = await fetchContextPack(supabase, targetCycle)
        contextPack = fetchedContext.text
        contextSelection = fetchedContext.selection
        if (action === 'context') {
          return res.status(200).json({
            contextPack,
            contextSelection,
          })
        }
      } else if (!contextPack || !contextSelection) {
        return res.status(400).json({
          error: 'Falta el contexto preparado para diseñar la propuesta.',
        })
      }
      const userInstructions = String(body.userInstructions || '').trim().slice(0, 3000)
      const weeklyOfferDays = weeklyOffer?.dias
      const weeklyOfferLines = generationDays.map((day) => {
        const classes = Array.isArray(weeklyOfferDays?.[day]) ? weeklyOfferDays[day] : []
        return `- ${day}: ${classes.length ? classes.join(', ') : '(sin clases seleccionadas)'}`
      })

      const tail = [
        '',
        '---',
        `Semana OBJETIVO a programar a continuación (en el generador Excel): mesociclo="${mesociclo}", semana=${semana}${phase ? `, fase="${phase}"` : ''}.`,
        `DÍAS QUE MARIAN QUIERE DISEÑAR EN ESTA TANDA: ${generationDays.join(', ') || 'semana completa según oferta'}.`,
        weeklyOfferLines.length
          ? `CLASES SELECCIONADAS EN ESOS DÍAS:\n${weeklyOfferLines.join('\n')}`
          : '',
        userInstructions
          ? `CONTEXTO E INSTRUCCIONES ESCRITAS POR MARIAN (prioridad alta):\n${userInstructions}`
          : 'Marian no ha añadido contexto libre para esta tanda.',
        'La propuesta debe respetar expresamente estos días, clases e instrucciones; no propongas contenido para días no seleccionados.',
        'Genera el JSON de propuesta (title, narrative, suggestedFocus, weeklyArchitecture) descrito en el system.',
      ].filter(Boolean).join('\n')

      messages = [
        {
          role: 'user',
          content: `PAQUETE DE DATOS:\n\n${contextPack}\n${tail}`,
        },
      ]
    }

    const systemPrompt = buildBriefingSystemPrompt({
      mesociclo,
      semana,
      phase,
      totalWeeks: Number.isFinite(totalWeeks) ? totalWeeks : null,
    })

    let assistantText
    let data
    try {
      ;({ assistantText, data } = await requestBriefingFromAnthropic({
        apiKey,
        model,
        systemPrompt,
        messages,
      }))
    } catch (e) {
      if (e?.preview) {
        return res.status(502).json({ error: e.message, preview: e.preview })
      }
      return res
        .status(Number(e?.httpStatus) || 502)
        .json({ error: e?.message || 'Error al contactar con Anthropic.' })
    }

    const parseOptions = { generationDays, weeklyOffer }
    let proposal
    try {
      proposal = parseProposalJson(assistantText, parseOptions)
    } catch (firstParseErr) {
      console.warn('[programming-week-briefing] Reintento por propuesta no parseable:', firstParseErr?.message)
      try {
        const retryMessages = [
          ...messages,
          { role: 'assistant', content: assistantText.trim() },
          {
            role: 'user',
            content:
              'Reenvía ÚNICAMENTE un objeto JSON válido (sin markdown, sin texto extra) con las claves title, narrative, suggestedFocus y weeklyArchitecture. No repitas el paquete de datos.',
          },
        ]
        ;({ assistantText, data } = await requestBriefingFromAnthropic({
          apiKey,
          model,
          systemPrompt,
          messages: retryMessages,
        }))
        proposal = parseProposalJson(assistantText, parseOptions)
      } catch (retryErr) {
        return res.status(Number(retryErr?.httpStatus) || 502).json({
          error: retryErr?.message || firstParseErr?.message || 'La IA devolvió una propuesta inválida.',
        })
      }
    }

    contextPack = replaceWeeklyArchitectureBlock(contextPack, proposal.weeklyArchitecture)
    const payload = {
      proposal,
      contextPack: contextPack || undefined,
      contextSelection: contextSelection || undefined,
      model: data?.model || model,
    }
    if (!messagesIn?.length && messages?.[0]) {
      payload.initialMessages = [
        { role: 'user', content: messages[0].content },
        { role: 'assistant', content: assistantText.trim() },
      ]
    }
    return res.status(200).json(payload)
  } catch (e) {
    console.error('[programming-week-briefing]', e)
    return res.status(500).json({ error: e?.message || 'Error al generar briefing' })
  }
}
