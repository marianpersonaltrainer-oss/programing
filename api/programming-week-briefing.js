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
 * Respuesta: { proposal: { title, narrative, suggestedFocus }, contextPack, model? }
 */

import { createClient } from '@supabase/supabase-js'

const ALLOWED_ORIGIN_PREFIXES = [
  'https://programing-evo.vercel.app',
  'http://localhost:5173',
]

const SYSTEM = `Eres el copiloto de programación de Evolution Boutique Fitness (EVO), Granada.
Marian va a generar la próxima semana de clases. Recibes un paquete de datos REALES: semanas ya publicadas
(mismo mesociclo que indica el bloque final salvo modo legacy), historial de cambios guardados en Supabase,
check-ins semanales de coaches, pases de turno diarios, reglas del método y feedback por sesión ligado a esas semanas.

Tu tarea:
1) Sintetiza patrones útiles (carga, fatiga, energía, incidentes, notas de coaches, coherencia con semanas previas).
2) Propón un enfoque para LA SEMANA que se indica al final del mensaje (no inventes datos que no vengan del paquete; si algo falta, dilo con suavidad).
3) Responde SOLO con un objeto JSON válido (sin markdown, sin \`\`\`, sin texto fuera del JSON) con exactamente estas claves:
   - "title": string corto, p. ej. "PROPUESTA PARA SEMANA 6"
   - "narrative": string en español, 2–5 frases, tono profesional y cercano
   - "suggestedFocus": una línea, p. ej. "Consolidación + descarga parcial de hombro"

No incluyas la programación día a día; solo la propuesta de enfoque.`

function getRequestOrigin(req) {
  const origin = String(req.headers?.origin || '').trim()
  if (origin) return origin
  const referer = String(req.headers?.referer || '').trim()
  return referer
}

function isOriginAllowed(originValue) {
  const v = String(originValue || '').trim()
  if (!v) return false
  return ALLOWED_ORIGIN_PREFIXES.some((p) => v.startsWith(p))
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

function formatMethodRules(rows) {
  if (!rows?.length) return '(Sin reglas activas en method_rules.)'
  return rows
    .map(
      (r) =>
        `- [${r.rule_type || 'rule'}] ${sliceText(r.trigger_context || 'general', 80)}: ${sliceText(r.rule_text, 240)} (conf. ${r.confidence ?? 50}%)`,
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

function parseProposalJson(assistantText) {
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
  return { title, narrative, suggestedFocus }
}

/**
 * Semanas publicadas en Supabase para CONTEXTO del briefing.
 * Si hay `mesociclo`, solo filas de ese mesociclo (hasta 8 semanas distintas, última publicación por S#).
 * Si no, últimas 4 filas globales (compatibilidad).
 */
/**
 * Tablas auxiliares del pack (check-ins, handoffs, reglas, feedback por sesión).
 * Si la migración no está aplicada en Supabase o falla RLS, el briefing sigue funcionando sin ese bloque.
 */
function logOptionalTableSkip(label, err) {
  const msg = err?.message || String(err || '')
  console.warn(`[programming-week-briefing] ${label} omitido:`, msg)
}

async function fetchContextPack(supabase, mesocicloRaw) {
  const mesociclo = String(mesocicloRaw || '').trim()

  let weeks = []
  if (mesociclo) {
    const { data: rows, error: wErr } = await supabase
      .from('published_weeks')
      .select('id, mesociclo, semana, titulo, published_at, data, edit_history')
      .eq('mesociclo', mesociclo)
      .order('published_at', { ascending: false })
      .limit(40)

    if (wErr) throw new Error(`published_weeks: ${wErr.message}`)

    const seenSem = new Set()
    for (const r of rows || []) {
      const sn = Number(r.semana)
      if (!Number.isFinite(sn) || seenSem.has(sn)) continue
      seenSem.add(sn)
      weeks.push(r)
      if (weeks.length >= 8) break
    }
    weeks.sort((a, b) => Number(a.semana) - Number(b.semana))
  } else {
    const { data: rows, error: wErr } = await supabase
      .from('published_weeks')
      .select('id, mesociclo, semana, titulo, published_at, data, edit_history')
      .order('published_at', { ascending: false })
      .limit(4)

    if (wErr) throw new Error(`published_weeks: ${wErr.message}`)
    weeks = rows || []
  }

  const weekIds = (weeks || []).map((r) => r.id).filter(Boolean)
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
    else sessionRows = fb || []
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

  let rules = []
  {
    const { data, error: rErr } = await supabase
      .from('method_rules')
      .select('rule_type, trigger_context, rule_text, confidence')
      .eq('active', true)
      .order('confidence', { ascending: false })
      .limit(30)
    if (rErr) logOptionalTableSkip('method_rules', rErr)
    else rules = data || []
  }

  const mesoLabel = mesociclo ? `mesociclo «${mesociclo}»` : 'todos los mesociclos (ventana corta)'
  const blocks = [
    `## Semanas ya publicadas en Supabase (${mesoLabel}; texto de programación + resumen)`,
    (weeks || []).map(compactPublishedWeek).join('\n\n') || '(Ninguna semana publicada aún en este criterio.)',
    '',
    '## Cambios guardados en el Hub (edit_history en Supabase, resumen por semana)',
    formatEditHistoryForPack(weeks || []),
    '',
    '## Check-ins semanales coaches (~últimas 2 semanas por fecha)',
    formatCheckins(checkins || []),
    '',
    '## Pases de turno diarios (últimos ~7 días)',
    formatHandoffs(handoffs || []),
    '',
    '## Reglas del método (activas)',
    formatMethodRules(rules || []),
    '',
    `## Feedback por sesión de coaches (vinculado a las semanas publicadas arriba, mismo ${mesoLabel})`,
    formatSessionFeedback(sessionRows),
  ]

  return blocks.join('\n')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isOriginAllowed(originValue)) {
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
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY o URL de Supabase.' })
  }

  const model =
    (process.env.VITE_CLAUDE_MODEL || process.env.PROGRAMMING_MODEL || 'claude-sonnet-4-20250514').trim()

  const messagesIn = Array.isArray(body.messages) ? body.messages : null
  const mesociclo = String(body.mesociclo || '').trim()
  const semana = Number(body.semana)
  const phase = String(body.phase || '').trim()

  try {
    let messages
    let contextPack = String(body.contextPack || '').trim()

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

      const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
      contextPack = await fetchContextPack(supabase, mesociclo)

      const tail = [
        '',
        '---',
        `Semana OBJETIVO a programar a continuación (en el generador Excel): mesociclo="${mesociclo}", semana=${semana}${phase ? `, fase="${phase}"` : ''}.`,
        'Genera el JSON de propuesta (title, narrative, suggestedFocus) descrito en el system.',
      ].join('\n')

      messages = [
        {
          role: 'user',
          content: `PAQUETE DE DATOS:\n\n${contextPack}\n${tail}`,
        },
      ]
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1400,
        system: SYSTEM,
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

    const assistantText = data?.content?.[0]?.text || ''
    const proposal = parseProposalJson(assistantText)

    const payload = {
      proposal,
      contextPack: contextPack || undefined,
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
