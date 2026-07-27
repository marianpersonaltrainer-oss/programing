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
import { DEFAULT_PROGRAMMING_MODEL, resolveProgrammingModel } from '../src/constants/anthropicModels.js'
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
import { loadPublishedWeeksForContext } from './lib/loadPublishedWeeksForContext.js'

const BRIEFING_METHOD_CONTEXT = buildMethodEvoV1Prompt({ includeValidators: false })

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
     - "classPlans": objeto cuyas claves son EXACTAMENTE las clases seleccionadas para ese día (evofuncional, evobasics, etc.) y cuyo valor resume fuerza/skill + formato metabólico + trabajo/descanso + material
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
        bits.push(`${k}: ${sliceText(v.replace(/\s+/g, ' '), 380)}`)
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

function extractTopLevelJsonObject(text) {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/s, '')
  const start = raw.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

function parseProposalJson(assistantText, options = {}) {
  const slice = extractTopLevelJsonObject(assistantText)
  if (!slice) throw new Error('La IA no devolvió un JSON {…} reconocible.')
  let o
  try {
    o = JSON.parse(slice)
  } catch {
    throw new Error('La IA devolvió JSON inválido o truncado.')
  }
  const title = String(o.title || '').trim()
  const narrative = String(o.narrative || '').trim()
  const suggestedFocus = String(o.suggestedFocus || '').trim()
  if (!title || !narrative) throw new Error('JSON incompleto: faltan title o narrative.')
  const weeklyArchitecture = normalizeWeeklyArchitecturePlan(o.weeklyArchitecture, options)
  return { title, narrative, suggestedFocus, weeklyArchitecture }
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
    historicalLimit: 6,
  })
  const progressionWeeks = selection.progressionWeeks
  const historicalWeeks = selection.historicalReferenceWeeks
  const selectedWeeks = [...progressionWeeks, ...historicalWeeks]
  const weekIds = selection.selectedWeekIds
  let sessionRows = []
  if (weekIds.length) {
    const { data: fb, error: fErr } = await supabase
      .from('coach_session_feedback')
      .select(
        'day_key, class_label, coach_name, session_how, changed_something, changed_details, notes_next_week, week_id, created_at',
      )
      .in('week_id', weekIds)
      .order('created_at', { ascending: false })
      .limit(200)
    if (fErr) logOptionalTableSkip('coach_session_feedback', fErr)
    else sessionRows = filterFeedbackForSelectedWeekIds(fb || [], weekIds)
  }

  let checkins = []
  {
    const sinceCheckins = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error: cErr } = await supabase
      .from('weekly_checkins')
      .select('coach_name, week_iso, mood_score, feedback_text, highlights, improvements, created_at')
      .gte('created_at', sinceCheckins)
      .order('created_at', { ascending: false })
      .limit(80)
    if (cErr) logOptionalTableSkip('weekly_checkins', cErr)
    else checkins = data || []
  }

  let handoffs = []
  {
    const sinceHandoffs = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error: hErr } = await supabase
      .from('daily_handoffs')
      .select('coach_name, class_type, class_time, energy_level, had_incident, note, created_at')
      .gte('created_at', sinceHandoffs)
      .order('created_at', { ascending: false })
      .limit(120)
    if (hErr) logOptionalTableSkip('daily_handoffs', hErr)
    else handoffs = data || []
  }

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
    text: blocks.join('\n'),
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

  const model = resolveProgrammingModel(
    process.env.VITE_CLAUDE_MODEL || process.env.PROGRAMMING_MODEL || DEFAULT_PROGRAMMING_MODEL,
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
  const targetCycle = {
    mesociclo,
    semana,
    cycle_id: String(body.cycleId ?? body.cycle_id ?? '').trim(),
    cycle_start_date: String(body.cycleStartDate ?? body.cycle_start_date ?? '').trim(),
    week_start_date: String(body.targetWeekStartDate ?? body.weekStartDate ?? body.week_start_date ?? '').trim(),
  }

  try {
    let messages
    let contextPack = String(body.contextPack || '').trim()
    let contextSelection = null

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

      const fetchedContext = await fetchContextPack(supabase, targetCycle)
      contextPack = fetchedContext.text
      contextSelection = fetchedContext.selection
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

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2600,
        system: systemPrompt,
        messages,
      }),
    })

    const rawText = await upstream.text()
    let data
    try {
      data = rawText ? JSON.parse(rawText) : {}
    } catch {
      return res.status(502).json({ error: 'Anthropic devolvió cuerpo no JSON', preview: rawText?.slice(0, 200) })
    }

    if (!upstream.ok) {
      const msg = data?.error?.message || `Anthropic HTTP ${upstream.status}`
      return res.status(502).json({ error: msg })
    }

    const assistantText = extractAnthropicTextBlocks(data)
    if (!assistantText) {
      const contentTypes = summarizeAnthropicContentTypes(data)
      console.error('[programming-week-briefing] Anthropic sin texto utilizable:', {
        status: upstream.status,
        model: data?.model || model,
        contentTypes,
      })
      return res.status(502).json({
        error:
          'Anthropic devolvió una respuesta sin texto utilizable para el briefing. Reintenta; si persiste, revisa prompt/modelo.',
      })
    }
    let proposal
    try {
      proposal = parseProposalJson(assistantText, {
        generationDays,
        weeklyOffer,
      })
    } catch (e) {
      return res.status(502).json({ error: e?.message || 'La IA devolvió una propuesta inválida.' })
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
