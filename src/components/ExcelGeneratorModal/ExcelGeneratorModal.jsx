import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  SYSTEM_PROMPT_EXCEL,
  SYSTEM_PROMPT_REGENERATE_FEEDBACK,
  EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK,
} from '../../constants/systemPromptExcel.js'
import { SYSTEM_PROMPT_DAY_EDIT } from '../../constants/systemPromptDayEdit.js'
import { generateWeekExcel } from '../../utils/generateExcel.js'
import {
  saveWeekToHistory,
  getHistoryForMesocycle,
  deleteWeekFromHistory,
  getAllMesocycleSummaries,
} from '../../hooks/useWeekHistory.js'
import {
  publishWeek,
  getActiveWeek,
  getCoachExerciseLibrary,
  updatePublishedWeekData,
  getPublishedWeekByMesocycleAndWeek,
  listPublishedWeeksForMesocycle,
} from '../../lib/supabase.js'
import { buildGeneratorLibraryBlock } from '../../utils/buildGeneratorLibraryContext.js'
import {
  buildWeekSkeleton,
  mergeGeneratedDaysIntoAccumulator,
  applyPreservedFromOverlay,
  applyFestivoToNonGeneratedDays,
  maskUnselectedSessionColumns,
  resolveDaysToGenerateFromSelection,
  EXCEL_DAY_ORDER,
} from '../../utils/excelGenerationPlan.js'
import { buildWeekWodBusterPaste } from '../../utils/formatWodBusterPaste.js'
import { getMethodText } from '../MethodPanel/MethodPanel.jsx'
import { AI_CONFIG, PROGRAMMING_MODEL, SUPPORT_MODEL } from '../../constants/config.js'
import { explainAnthropicFetchFailure } from '../../utils/explainAnthropicFetchFailure.js'
import { parseAnthropicProxyBody, isAnthropicProxyFailure } from '../../utils/parseAnthropicProxyBody.js'
import { parseAssistantWeekJson } from '../../utils/parseAssistantWeekJson.js'
import { parseAssistantDayJson } from '../../utils/parseAssistantDayJson.js'
import { mergeDayFromAiPatch, listSessionFieldsChanged } from '../../utils/mergeDayFromAiPatch.js'
import { sanitizePromptTextForLLM } from '../../utils/sanitizePromptTextForLLM.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { buildWeekContext } from '../../utils/buildWeekContext.js'
import { extractMainExerciseFromBlockB } from '../../utils/sessionBlockB.js'
import {
  buildWeekSessionClassReview,
  formatReviewHintsForGenerationPrompt,
} from '../../utils/weekSessionReview.js'
import { buildMesocycleProgrammingBlock } from '../../constants/mesocycleGenerationBlocks.js'

/** Máximo de caracteres de ejemplos reales en el system (evita prompts enormes y timeouts). */
const EXCEL_REAL_PROGRAMMING_EXAMPLES_MAX_CHARS = 12000
/** Techo por POST (1 día por llamada; JSON de 6 columnas puede ser largo). */
const EXCEL_GENERATION_MAX_TOKENS_PER_CALL = 6500
/** Límite de caracteres del pack de briefing por petición (el mismo bloque va en weekContext → system). */
const EXCEL_GENERATION_PACK_MAX_CHARS = 42_000

const ADDENDUM_MAX_CHARS = 300

function sliceText(s, max) {
  const t = String(s || '').trim()
  if (!t) return ''
  return t.length <= max ? t : `${t.slice(0, Math.max(0, max - 1)).trim()}…`
}

/**
 * Trozos de días consecutivos (orden LUN→SÁ) por llamada.
 * Con `chunkSize` 1 se reduce mucho el JSON por petición (útil si el prompt es muy largo).
 */
function buildConsecutiveDayChunks(daysToGenerateSet, chunkSize = 2) {
  const size = chunkSize === 1 ? 1 : 2
  const ordered = EXCEL_DAY_ORDER.filter((d) => daysToGenerateSet.has(d))
  const chunks = []
  for (let i = 0; i < ordered.length; i += size) {
    chunks.push(new Set(ordered.slice(i, i + size)))
  }
  return chunks
}

const EDIT_SESSION_FIELDS = EVO_SESSION_CLASS_DEFS.map(({ key, label, color, feedbackKey }) => ({
  key,
  label,
  color,
  feedbackKey,
}))

function sessionFingerprintKey(diaIdx, sessionKey) {
  return `${diaIdx}::${sessionKey}`
}

function feedbackStaleKey(diaIdx, feedbackKey) {
  return `${diaIdx}::${feedbackKey}`
}

function buildWeeklyClassBSummary(dias, currentDiaIdx, sessionKey) {
  const out = []
  const max = Math.min(Math.max(0, currentDiaIdx - 1), Math.max(0, (dias || []).length - 1))
  for (let i = 0; i <= max; i += 1) {
    const dia = dias?.[i]
    const raw = String(dia?.[sessionKey] || '').trim()
    if (!raw || /^\(no programada esta semana\)\s*$/i.test(raw) || /^FESTIVO\b/i.test(raw)) continue
    const main = extractMainExerciseFromBlockB(raw)
    if (!main) continue
    out.push({ dayLabel: dia?.nombre || `Día ${i + 1}`, main })
  }
  return out
}

function weekReviewSeverityShell(row, highlightDayIdx) {
  const ring = row.dayIdx === highlightDayIdx ? ' ring-2 ring-evo-accent/35 ring-offset-1' : ''
  if (row.placeholder) {
    return `rounded-lg px-2 py-1.5 text-[11px] leading-snug border-l-4 border-slate-300 bg-slate-50/90 text-slate-600${ring}`
  }
  const bar =
    row.severity === 'red'
      ? 'border-l-4 border-red-500 bg-red-50/55'
      : row.severity === 'orange'
        ? 'border-l-4 border-orange-400 bg-orange-50/45'
        : row.severity === 'yellow'
          ? 'border-l-4 border-amber-400 bg-amber-50/40'
          : 'border-l-4 border-emerald-500/55 bg-emerald-50/35'
  return `rounded-lg px-2 py-1.5 text-[11px] leading-snug ${bar}${ring}`
}

function WeekSessionClassReviewAside({ dias, sessionKey, label, highlightDayIdx, resumenFoco }) {
  const review = useMemo(
    () => buildWeekSessionClassReview(dias || [], sessionKey, { resumenFoco: resumenFoco || '' }),
    [dias, sessionKey, resumenFoco],
  )
  const statusEmoji = review.hasAnyIssue ? '⚠️' : review.hasAnyProgram ? '✅' : '—'
  return (
    <details className="rounded-xl border border-black/10 bg-[#faf8fc] shadow-sm overflow-hidden">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#4a2a52] flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <span className="truncate min-w-0">Revisión de semana — {label}</span>
        <span className="shrink-0 text-[10px] opacity-80 tabular-nums">{statusEmoji}</span>
      </summary>
      <div className="px-3 pb-3 pt-0 border-t border-black/6 space-y-2 max-h-[min(60vh,420px)] overflow-y-auto">
        <p className="text-[10px] text-[#6B5A6B] leading-snug pt-2">
          Detección orientativa (heurística); siempre revisa el texto completo.
        </p>
        {!review.hasAnyProgram ? (
          <p className="text-xs text-[#6B5A6B]">Sin sesiones programadas para esta clase en la semana.</p>
        ) : (
          <ul className="space-y-1.5">
            {review.rows.map((row) => (
              <li key={row.dayIdx} className={weekReviewSeverityShell(row, highlightDayIdx)}>
                <div className="font-bold text-[#1A0A1A] flex flex-wrap items-center gap-x-1 gap-y-0">
                  <span>{row.dayLabel}</span>
                  {row.dayIdx === highlightDayIdx && (
                    <span className="text-[9px] font-bold uppercase text-evo-accent tracking-wide">· editando</span>
                  )}
                </div>
                {row.placeholder ? (
                  <p className="text-[10px] text-neutral-600 mt-0.5">Sin programa</p>
                ) : (
                  <>
                    <p className="text-[10px] text-[#1A0A1A]/90 mt-0.5 font-mono break-words">{row.mainLine}</p>
                    {row.hints.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-[10px] text-[#5c1a1a] list-disc pl-3.5">
                        {row.hints.map((h, hi) => (
                          <li key={hi}>{h}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[10px] text-emerald-900/85 mt-0.5">Sin avisos heurísticos</p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}

function buildSessionFingerprintMap(weekData) {
  const m = new Map()
  ;(weekData?.dias || []).forEach((dia, diaIdx) => {
    for (const { key } of EVO_SESSION_CLASS_DEFS) {
      m.set(sessionFingerprintKey(diaIdx, key), dia[key] ?? '')
    }
  })
  return m
}

/** Contexto breve del resto de la semana + resumen, para coherencia al editar un solo día con IA. */
function buildCompactWeekContextForDayEdit(weekData, diaIdx) {
  const parts = []
  const r = weekData?.resumen
  if (r && typeof r === 'object') {
    parts.push('RESUMEN SEMANAL (JSON):')
    parts.push(
      JSON.stringify({
        estimulo: r.estimulo || '',
        intensidad: r.intensidad || '',
        foco: r.foco || '',
        nota: r.nota || '',
      }),
    )
  }
  const dias = weekData?.dias || []
  parts.push('\nOTROS DÍAS (extracto; no debes modificarlos):')
  dias.forEach((d, i) => {
    if (i === diaIdx) return
    const bits = []
    for (const { key, label } of EVO_SESSION_CLASS_DEFS) {
      const t = String(d[key] || '').trim()
      if (!t) continue
      const one = t.replace(/\s+/g, ' ').slice(0, 100)
      bits.push(`${label}: ${one}${t.length > 100 ? '…' : ''}`)
    }
    parts.push(`- ${d.nombre || `Día ${i + 1}`}: ${bits.join(' | ') || '(sin texto de sesión)'}`)
  })
  return parts.join('\n')
}

function stripCodeFences(text) {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/s, '')
  }
  return t.trim()
}

const REAL_PROGRAMMING_CONTEXT_PATH = '/context/evo-programacion-real.txt'

async function loadRealProgrammingContextForGenerator() {
  try {
    const res = await fetch(REAL_PROGRAMMING_CONTEXT_PATH, { cache: 'no-store' })
    if (!res.ok) return ''
    const raw = await res.text()
    return sanitizePromptTextForLLM(raw).trim()
  } catch {
    return ''
  }
}

export default function ExcelGeneratorModal({ weekState, onClose, onSyncWeekFromHistory }) {
  const [existingBuffer, setExistingBuffer] = useState(null)
  const [isExcelFile, setIsExcelFile] = useState(false)
  /** Briefing conversacional: carga automática al abrir (Supabase + IA). */
  const [briefingStatus, setBriefingStatus] = useState('loading') // loading | ready | error
  const [briefingErrorMsg, setBriefingErrorMsg] = useState('')
  const [briefingContextPack, setBriefingContextPack] = useState('')
  const [briefingApiMessages, setBriefingApiMessages] = useState([])
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalNarrative, setProposalNarrative] = useState('')
  const [proposalSuggestedFocus, setProposalSuggestedFocus] = useState('')
  /** review | refine | addons */
  const [proposalStep, setProposalStep] = useState('review')
  const [proposalAccepted, setProposalAccepted] = useState(false)
  const [addendum, setAddendum] = useState('')
  const [refineDraft, setRefineDraft] = useState('')
  const [refineBusy, setRefineBusy] = useState(false)

  const [status, setStatus]     = useState('idle')
  const [genStep, setGenStep]   = useState('')
  const [weekData, setWeekData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [editingJson, setEditingJson] = useState(false)
  const [previewTab, setPreviewTab]   = useState('resumen') // 'resumen' | 'wodbuster'
  const [wbCopied, setWbCopied]       = useState(false)
  const [rawJson, setRawJson]         = useState('')
  // Campos editables antes de descargar
  const [editTitle, setEditTitle]     = useState('')
  const [editSheetName, setEditSheetName] = useState(`S${weekState.week || 1}`)
  const [history, setHistory]         = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [isEditingExistingWeek, setIsEditingExistingWeek] = useState(false)
  const [publishing, setPublishing]   = useState(false)
  const [published, setPublished]     = useState(false)
  const [editingPublishedRowId, setEditingPublishedRowId] = useState(null)
  const [editingPublishedIsActive, setEditingPublishedIsActive] = useState(false)
  const [savingPublishedEdit, setSavingPublishedEdit] = useState(false)
  const [savedPublishedEdit, setSavedPublishedEdit] = useState(false)
  const [activePublishedWeek, setActivePublishedWeek] = useState(null)
  /** Texto de sesión alineado con el feedback (solo memoria del modal). */
  const sessionFingerprintsRef = useRef(new Map())
  const [staleFeedbackKeys, setStaleFeedbackKeys] = useState(() => new Set())
  const [regeneratingFeedbackKey, setRegeneratingFeedbackKey] = useState(null)
  /** LUNES–SÁBADO: fuente de verdad de qué días pide generar el cliente (el texto solo añade preservados/excluidos). */
  const [dayPicker, setDayPicker] = useState(() =>
    Object.fromEntries(EXCEL_DAY_ORDER.map((d) => [d, true])),
  )
  /** Columnas de sesión (EvoFuncional, Basics, …) que deben rellenarse en la generación. */
  const [classPicker, setClassPicker] = useState(() =>
    Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, true])),
  )
  /** Pestaña «Editar»: día visible (el resto de la semana en tabs, sin scroll infinito). */
  const [editFocusDayIdx, setEditFocusDayIdx] = useState(0)
  /** Borradores de instrucciones para «IA · este día» (por índice de día). */
  const [dayAiDraftByIdx, setDayAiDraftByIdx] = useState({})
  const [dayEditAiBusy, setDayEditAiBusy] = useState(false)
  const [regenDayFeedbacksAfterAi, setRegenDayFeedbacksAfterAi] = useState(false)
  const [briefingRetry, setBriefingRetry] = useState(0)
  /** Evita escrituras repetidas al historial local si el JSON no cambió. */
  const lastPersistedDraftRef = useRef('')
  /** Aviso breve: borrador / guardado manual en localStorage. */
  const [draftNotice, setDraftNotice] = useState('')

  // Cargar historial del mesociclo al abrir
  useEffect(() => {
    if (weekState.mesocycle) {
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
    }
  }, [weekState.mesocycle])

  useEffect(() => {
    setClassPicker(Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, true])))
  }, [weekState.mesocycle])

  useEffect(() => {
    let cancelled = false
    async function loadBriefing() {
      if (!weekState?.mesocycle || weekState.week == null) {
        setBriefingStatus('error')
        setBriefingErrorMsg('Selecciona mesociclo y semana en el panel izquierdo.')
        return
      }
      setBriefingStatus('loading')
      setBriefingErrorMsg('')
      setProposalAccepted(false)
      setProposalStep('review')
      setAddendum('')
      setRefineDraft('')
      try {
        const res = await fetch('/api/programming-week-briefing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mesociclo: weekState.mesocycle,
            semana: Number(weekState.week),
            phase: weekState.phase || '',
            totalWeeks: weekState.totalWeeks ?? null,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
        if (cancelled) return
        setBriefingContextPack(String(json.contextPack || ''))
        setProposalTitle(String(json.proposal?.title || '').trim())
        setProposalNarrative(String(json.proposal?.narrative || '').trim())
        setProposalSuggestedFocus(String(json.proposal?.suggestedFocus || '').trim())
        setBriefingApiMessages(Array.isArray(json.initialMessages) ? json.initialMessages : [])
        setBriefingStatus('ready')
      } catch (e) {
        if (!cancelled) {
          setBriefingStatus('error')
          setBriefingErrorMsg(e?.message || 'No se pudo generar la propuesta.')
        }
      }
    }
    loadBriefing()
    return () => {
      cancelled = true
    }
  }, [weekState.mesocycle, weekState.week, weekState.phase, briefingRetry])

  /** Tras cargar el briefing, alinear historial local con semanas ya publicadas en Supabase (p. ej. S6 en Hub pero no en localStorage). */
  useEffect(() => {
    if (briefingStatus !== 'ready' || !weekState.mesocycle) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listPublishedWeeksForMesocycle(weekState.mesocycle)
        if (cancelled) return
        for (const row of rows) {
          if (!row?.data || !Array.isArray(row.data.dias)) continue
          const data = JSON.parse(JSON.stringify(row.data))
          data.semana = Number(row.semana)
          data.titulo = row.titulo || data.titulo
          data.mesociclo = weekState.mesocycle
          saveWeekToHistory(weekState.mesocycle, Number(row.semana), data)
        }
        setHistory(getHistoryForMesocycle(weekState.mesocycle))
      } catch (e) {
        console.warn('[ExcelGeneratorModal] sync historial desde Supabase:', e?.message || e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [briefingStatus, weekState.mesocycle])

  useEffect(() => {
    const n = weekData?.dias?.length ?? 0
    if (n <= 0) return
    setEditFocusDayIdx((i) => Math.min(Math.max(0, i), n - 1))
  }, [weekData?.dias?.length])

  /**
   * Guarda la semana actual en el historial del navegador (localStorage) sin publicar en el Hub.
   * No sustituye a «Guardar cambios» cuando editas una fila ya publicada en Supabase.
   */
  const persistDraftToLocalHistory = useCallback(() => {
    if (!weekState.mesocycle || weekData == null) return false
    let data
    try {
      data = editingJson ? JSON.parse(rawJson) : { ...weekData }
    } catch {
      return false
    }
    if (!data || !Array.isArray(data.dias)) return false
    data.titulo = String(editTitle || data.titulo || '').trim() || data.titulo
    data.semana = weekState.week
    data.mesociclo = weekState.mesocycle
    const sig = JSON.stringify(data)
    if (sig === lastPersistedDraftRef.current) return false
    saveWeekToHistory(weekState.mesocycle, weekState.week, data)
    setHistory(getHistoryForMesocycle(weekState.mesocycle))
    lastPersistedDraftRef.current = sig
    return true
  }, [weekState.mesocycle, weekState.week, weekData, rawJson, editingJson, editTitle])

  /** Autoguardado local ~3 s después de dejar de editar (misma copia que el historial del mesociclo). */
  useEffect(() => {
    if (status !== 'previewing' || !weekState.mesocycle || weekData == null) return undefined
    let innerClear = null
    const t = window.setTimeout(() => {
      if (persistDraftToLocalHistory()) {
        setDraftNotice('Borrador guardado en este navegador')
        innerClear = window.setTimeout(() => setDraftNotice(''), 3800)
      }
    }, 2800)
    return () => {
      clearTimeout(t)
      if (innerClear) clearTimeout(innerClear)
    }
  }, [status, weekData, rawJson, editingJson, editTitle, weekState.mesocycle, weekState.week, persistDraftToLocalHistory])

  useEffect(() => {
    let cancelled = false
    async function loadActivePublishedWeek() {
      try {
        const row = await getActiveWeek()
        if (!cancelled) setActivePublishedWeek(row || null)
      } catch {
        if (!cancelled) setActivePublishedWeek(null)
      }
    }
    loadActivePublishedWeek()
    return () => {
      cancelled = true
    }
  }, [])

  // Si la semana ya existe (publicada activa o guardada en historial local), se considera edición.
  useEffect(() => {
    let cancelled = false

    async function detectExistingWeekMode() {
      if (!weekState.mesocycle || !weekState.week) {
        if (!cancelled) setIsEditingExistingWeek(false)
        return
      }

      const hasHistoryEntry = getHistoryForMesocycle(weekState.mesocycle).some(
        (entry) => Number(entry.semana) === Number(weekState.week),
      )
      if (hasHistoryEntry) {
        if (!cancelled) setIsEditingExistingWeek(true)
        return
      }

      try {
        const active = await getActiveWeek()
        const matchesActive =
          active &&
          active.mesociclo === weekState.mesocycle &&
          Number(active.semana) === Number(weekState.week)
        if (!cancelled) setIsEditingExistingWeek(!!matchesActive)
      } catch {
        if (!cancelled) setIsEditingExistingWeek(false)
      }
    }

    detectExistingWeekMode()
    return () => {
      cancelled = true
    }
  }, [weekState.mesocycle, weekState.week])

  async function sendProposalRefinement() {
    const line = sanitizePromptTextForLLM(refineDraft || '').trim()
    if (!line) {
      setErrorMsg('Escribe qué quieres cambiar de la propuesta.')
      return
    }
    if (!briefingApiMessages.length) {
      setErrorMsg('No hay historial de briefing para refinar.')
      return
    }
    setRefineBusy(true)
    setErrorMsg('')
    try {
      const nextMessages = [...briefingApiMessages, { role: 'user', content: line }]
      const res = await fetch('/api/programming-week-briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          contextPack: briefingContextPack,
          mesociclo: weekState.mesocycle,
          semana: Number(weekState.week),
          phase: weekState.phase || '',
          totalWeeks: weekState.totalWeeks ?? null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      const assistantText = JSON.stringify(json.proposal || {})
      setProposalTitle(String(json.proposal?.title || '').trim())
      setProposalNarrative(String(json.proposal?.narrative || '').trim())
      setProposalSuggestedFocus(String(json.proposal?.suggestedFocus || '').trim())
      setBriefingApiMessages([...nextMessages, { role: 'assistant', content: assistantText }])
      setRefineDraft('')
      setProposalStep('review')
    } catch (e) {
      setErrorMsg(e?.message || 'No se pudo actualizar la propuesta.')
    } finally {
      setRefineBusy(false)
    }
  }

  /**
   * Una llamada API = un POST. La semana se parte en tramos de 1 día (varias llamadas)
   * para evitar timeouts con briefing + system largos en serverless.
   * Modelo: PROGRAMMING_MODEL (Sonnet u homólogo), max_tokens: `AI_CONFIG.maxTokens`.
   */
  async function callApi(userMessage, systemFull = SYSTEM_PROMPT_EXCEL, weekContext = '', retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const body = {
        model: PROGRAMMING_MODEL,
        max_tokens: Math.min(AI_CONFIG.maxTokens, EXCEL_GENERATION_MAX_TOKENS_PER_CALL),
        system: systemFull,
        weekContext,
        messages: [{ role: 'user', content: userMessage }],
      }
      console.log('API Request (Proxy):', { model: body.model, attempt })

      let response
      try {
        // Modelo: sonnet — generación JSON semanal (SYSTEM_PROMPT_EXCEL); núcleo del producto.
        response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })
      } catch (e) {
        throw new Error(explainAnthropicFetchFailure(e))
      }

      const responseText = await response.text()

      let data
      try {
        data = parseAnthropicProxyBody(responseText)
      } catch {
        throw new Error('La respuesta del servidor no es JSON válido.')
      }

      const failed = !response.ok || isAnthropicProxyFailure(data)
      const errType = data?.error?.type
      const retriable =
        response.status === 529 ||
        response.status === 503 ||
        response.status === 429 ||
        response.status === 504 ||
        response.status === 502 ||
        (failed && (errType === 'upstream_timeout' || errType === 'rate_limit_error'))
      if (retriable && attempt < retries) {
        const wait = (attempt + 1) * 15
        const hint =
          response.status === 504 ||
          response.status === 502 ||
          errType === 'upstream_timeout'
            ? 'Tiempo límite del servidor (504/502)'
            : 'API saturada o en mantenimiento'
        setGenStep(`${hint} — reintentando en ${wait}s…`)
        await new Promise((r) => setTimeout(r, wait * 1000))
        continue
      }

      if (failed) {
        let err = data
        if (!err || typeof err !== 'object') {
          err = {
            error: {
              message:
                responseText?.trim()?.slice(0, 500) ||
                `Error ${response.status} (el servidor no devolvió JSON; revisa logs en Vercel → Functions)`,
            },
          }
        }
        console.error('API Error Response:', err)
        if (response.status === 504 || response.status === 502 || errType === 'upstream_timeout') {
          throw new Error(
            'Tiempo de espera agotado: la IA tardó más de lo permitido en esta petición (límite del servidor / Anthropic). ' +
              'En Vercel el proyecto usa maxDuration 300 s; si ves esto a menudo, genera menos días a la vez o revisa la carga del modelo. ' +
              'Plan Hobby (~10 s de función) no basta para esta generación: hace falta Pro u otro plan con funciones largas.',
          )
        }
        const apiMsg =
          (typeof err?.error === 'object' && err?.error?.message) ||
          (typeof err?.error === 'string' && err.error) ||
          err?.message
        throw new Error(apiMsg || `Error ${response.status}`)
      }
      const text = data.content?.[0]?.text || ''
      try {
        return parseAssistantWeekJson(text)
      } catch (e) {
        throw new Error(
          `${e.message} — Si se repite, reduce el texto del DOCX/contexto o vuelve a generar; el modelo a veces rompe el JSON con comas o caracteres raros.`,
        )
      }
    }
    throw new Error('API saturada después de varios intentos. Inténtalo de nuevo en unos minutos.')
  }

  async function handleGenerate() {
    if (!weekState.mesocycle) {
      setErrorMsg('Primero selecciona el tipo de Mesociclo y la Semana en el panel de la izquierda (aparece como "Configuración pendiente").')
      setStatus('error')
      return
    }

    setErrorMsg('')

    const pack = String(briefingContextPack || '').trim()
    const regenerating = !!weekData

    if (!regenerating) {
      if (briefingStatus !== 'ready' || !pack) {
        setErrorMsg(
          briefingStatus === 'error'
            ? 'Corrige el error del briefing o recarga el modal.'
            : 'Espera a que termine el análisis automático de la IA.',
        )
        setStatus('error')
        return
      }
      if (!proposalAccepted) {
        setErrorMsg('Pulsa «Me parece bien» y luego «Generar semana» (o ajusta el enfoque con la IA).')
        setStatus('error')
        return
      }
    }

    setStatus('generating')

    let systemExcelFull = SYSTEM_PROMPT_EXCEL
    try {
      const libRows = await getCoachExerciseLibrary()
      const block = buildGeneratorLibraryBlock(libRows)
      if (block) systemExcelFull += `\n\n${block}`
    } catch {
      /* sin biblioteca: generación igual */
    }

    const methodText = sanitizePromptTextForLLM(getMethodText()).trim()
    if (methodText) {
      systemExcelFull += `\n\nMÉTODO Y REGLAS PERMANENTES DE EVO (panel «Tu método»):\n${methodText}`
    }

    const mesoProgrammingBlock = buildMesocycleProgrammingBlock({
      mesocycle: weekState.mesocycle,
      week: weekState.week,
      totalWeeks: weekState.totalWeeks,
      phase: weekState.phase,
    })
    if (mesoProgrammingBlock) {
      systemExcelFull += `\n\n${mesoProgrammingBlock}`
    }

    const realProgrammingExamples = await loadRealProgrammingContextForGenerator()
    if (realProgrammingExamples) {
      let block = realProgrammingExamples
      if (block.length > EXCEL_REAL_PROGRAMMING_EXAMPLES_MAX_CHARS) {
        block =
          block.slice(0, EXCEL_REAL_PROGRAMMING_EXAMPLES_MAX_CHARS) +
          '\n\n[…truncado por límite de tamaño del prompt para esta generación]'
      }
      systemExcelFull += `\n\nEJEMPLOS REALES DE ESTILO EVO — leer antes de programar:\n${block}`
    }

    const mesoInfo = weekState.mesocycle
      ? `Mesociclo: ${weekState.mesocycle} | Semana: ${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` | Fase: ${weekState.phase}` : ''}`
      : 'Mesociclo no configurado'

    const addendumClean = sanitizePromptTextForLLM(addendum || '').trim().slice(0, ADDENDUM_MAX_CHARS)

    const approvedBlock =
      regenerating && !proposalAccepted
        ? ''
        : [
            'PROPUESTA APROBADA POR LA PROGRAMADORA:',
            `Título: ${proposalTitle}`,
            '',
            proposalNarrative,
            '',
            `Enfoque sugerido: ${proposalSuggestedFocus}`,
            addendumClean ? `\nNotas adicionales al generar:\n${addendumClean}` : '',
          ]
            .filter(Boolean)
            .join('\n')

    const packForGeneration =
      pack.length > EXCEL_GENERATION_PACK_MAX_CHARS
        ? `${pack.slice(0, EXCEL_GENERATION_PACK_MAX_CHARS).trimEnd()}\n\n[…Paquete truncado por límite técnico (${pack.length} caracteres en origen). Prioriza coherencia con el texto visible.]`
        : pack

    const baseContext = [
      mesoInfo,
      pack
        ? 'DATOS CONSOLIDADOS (Supabase, briefing del mesociclo): están en la sección «CONTEXTO DE LA SEMANA» del system de esta petición (no se repiten aquí para aligerar la petición). Léelos antes de generar.'
        : '',
      approvedBlock,
    ]
      .filter(Boolean)
      .join('\n\n')

    const planSourceText = [proposalNarrative, addendumClean].filter(Boolean).join('\n\n')
    const selectedCanon = new Set(EXCEL_DAY_ORDER.filter((d) => dayPicker[d]))
    const { daysToGenerate, daysPreserved } = resolveDaysToGenerateFromSelection(
      selectedCanon,
      planSourceText,
    )
    // Siempre 1 día por POST: con briefing + método + ejemplos el prompt es muy grande; 2 días
    // en la misma llamada provocaba timeouts (504/502) frecuentes en Vercel.
    const dayChunks = buildConsecutiveDayChunks(daysToGenerate, 1)
    console.log('[ProgramingEvo][Excel UI] trozos (1 día/post) enviados a la IA', {
      numChunks: dayChunks.length,
      packChars: pack.length,
      chunks: dayChunks.map((c) => [...c]),
      juevesEnAlgunChunk: dayChunks.some((c) => c.has('JUEVES')),
    })

    if (daysToGenerate.size === 0) {
      setErrorMsg(
        'No hay días para generar: marca al menos un día arriba o revisa si pusiste «lunes ya está hecho» (eso preserva el día y no lo manda a la IA).',
      )
      setStatus('error')
      return
    }

    const selectedClassKeys = new Set(
      EVO_SESSION_CLASS_DEFS.filter(({ key }) => classPicker[key]).map(({ key }) => key),
    )
    const selectedClassLabels = EVO_SESSION_CLASS_DEFS.filter(({ key }) => classPicker[key]).map(
      ({ label }) => label,
    )
    if (selectedClassKeys.size === 0) {
      setErrorMsg('Marca al menos un tipo de clase (columna) para generar contenido.')
      setStatus('error')
      return
    }

    try {
      const weekContextText = pack
        ? `PAQUETE BRIEFING (Supabase — mesociclo actual, check-ins, handoffs, reglas, feedback, historial de ediciones)\n\n${packForGeneration}`
        : await buildWeekContext(weekState)
      let overlay = null
      if (weekData && Array.isArray(weekData.dias)) {
        overlay = weekData
      } else {
        try {
          const row = await getActiveWeek()
          if (
            row?.data &&
            row.mesociclo === weekState.mesocycle &&
            Number(row.semana) === Number(weekState.week)
          ) {
            overlay = row.data
          }
        } catch {
          overlay = null
        }
      }

      const acc = buildWeekSkeleton(weekState.week, weekState.mesocycle)
      applyPreservedFromOverlay(acc, overlay, daysPreserved)

      const planSummary = `PLAN DE DÍAS Y COLUMNAS (obligatorio):
- Días marcados en el selector del cliente: ${[...selectedCanon].join(', ')}
- Generar contenido real (sesiones y feedbacks) SOLO para: ${[...daysToGenerate].join(', ')}
  En esos días el campo wodbuster del JSON debe ser cadena vacía "" (el pegado WodBuster lo arma la app desde las columnas de clase).
- Columnas de clase a programar en esos días (solo estas; en el resto de columnas de los mismos días usa exactamente «(no programada esta semana)» y feedback vacío): ${selectedClassLabels.join(', ')}
- Preservados / ya hechos (no regenerar; el cliente fusiona desde copia si existe): ${[...daysPreserved].join(', ') || 'ninguno'}
- Para NO generar un día: desmárcalo en el selector (el texto ya no excluye días automáticamente).
- Resto de días del array "dias": cada campo de sesión (evofuncional, evobasics, evofit, etc.) debe ser exactamente: (no programada esta semana). Feedbacks "". wodbuster "". Festivo real del gimnasio (solo si el usuario lo indica): ver system prompt (FESTIVO).`

      function weekAccumulatorHasNonPlaceholderSessions(weekAcc) {
        for (const dia of weekAcc?.dias || []) {
          for (const { key } of EVO_SESSION_CLASS_DEFS) {
            const t = String(dia[key] || '').trim()
            if (t && !/^\(no programada esta semana\)\s*$/i.test(t) && !/^FESTIVO\b/i.test(t)) return true
          }
        }
        return false
      }

      function buildChunkMessage(chunkDays, coherenceBlock) {
        const list = [...chunkDays].join(', ')
        const core = `${baseContext}\n\n${planSummary}\n\n${EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK}\n\nGENERACIÓN DE DÍAS EN ESTA PETICIÓN: ${list}.

Devuelve JSON con titulo, resumen y dias (array de EXACTAMENTE 6 objetos en orden LUNES, MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO; cada uno con "nombre" en MAYÚSCULAS).

Solo rellena contenido completo (sesiones y feedbacks) para: ${list}, y SOLO en las columnas de clase listadas en PLAN DE DÍAS Y COLUMNAS; en otras columnas de esos mismos días deja «(no programada esta semana)» y feedback vacío. En esos días wodbuster = "".
Para el resto de días: cada sesión = exactamente (no programada esta semana); feedbacks ""; wodbuster "". Festivo real solo si el usuario lo pide (FESTIVO). No inventes sesiones para días fuera de la lista.

Respeta QUÉ DÍAS GENERAR del prompt del sistema.`
        return coherenceBlock ? `${core}\n\n${coherenceBlock}` : core
      }

      function isTimeoutLikeGenerationError(err) {
        const m = String(err?.message || '').toLowerCase()
        return (
          m.includes('504') ||
          m.includes('502') ||
          m.includes('timeout') ||
          m.includes('upstream_timeout') ||
          m.includes('failed to fetch') ||
          m.includes('conexión cortada')
        )
      }

      function buildCoherenceBlockFromAccumulator() {
        const jsonBlock = `CONTEXTO YA GENERADO EN ESTA SEMANA (sesiones ya cerradas o preservadas; al escribir los días nuevos de ESTA petición NO repitas el mismo lift principal, ni formatos de fuerza/WOD consecutivos, ni el mismo patrón muscular consecutivo en EvoFuncional respecto a estos días; mantén en tu salida vacíos los días que no te tocan):\n${JSON.stringify({ titulo: acc.titulo, resumen: acc.resumen, dias: acc.dias }, null, 2)}`
        const resumenFoco = (acc.resumen && acc.resumen.foco) || ''
        const heuristic = formatReviewHintsForGenerationPrompt(
          acc.dias,
          [...selectedClassKeys],
          resumenFoco,
        )
        return `${jsonBlock}\n\nCHEQUEO HEURÍSTICO (misma lógica que el panel del programador: rojo/naranja/amarillo; corrige en los días que generas EN ESTA petición, no asumas revisión manual después):\n${heuristic}`
      }

      async function generateChunkWithFallback(chunk, ci, total) {
        const chunkDaysText = [...chunk].join(' · ')
        const attachCoherence = ci > 0 || weekAccumulatorHasNonPlaceholderSessions(acc)
        const coherenceBlock = attachCoherence ? buildCoherenceBlockFromAccumulator() : ''
        setGenStep(total > 1 ? `Generando ${chunkDaysText}… (${ci + 1}/${total})` : `Generando ${chunkDaysText}…`)
        const userMessageForApi = buildChunkMessage(chunk, coherenceBlock)
        console.log('[ProgramingEvo][Excel → IA] petición', ci + 1, '/', total, {
          diasEnEstePOST: [...chunk],
          juevesEnEstePOST: chunk.has('JUEVES'),
        })
        try {
          const part = await callApi(userMessageForApi, systemExcelFull, weekContextText)
          mergeGeneratedDaysIntoAccumulator(acc, part, chunk)
          const ji = EXCEL_DAY_ORDER.indexOf('JUEVES')
          if (ji >= 0 && chunk.has('JUEVES')) {
            const jf = String(acc.dias[ji]?.evofuncional ?? '')
            console.log('[ProgramingEvo][Excel merge] tras chunk', ci + 1, 'JUEVES evofuncional length:', jf.length, {
              preview: jf.slice(0, 100),
            })
          }
        } catch (err) {
          if (chunk.size > 1 && isTimeoutLikeGenerationError(err)) {
            const splitDays = [...chunk]
            setGenStep(`Respuesta lenta en ${splitDays.join(' · ')}; reintentando por día…`)
            for (let si = 0; si < splitDays.length; si++) {
              const singleChunk = new Set([splitDays[si]])
              await generateChunkWithFallback(singleChunk, ci, total)
            }
            return
          }
          throw err
        }
      }

      for (let ci = 0; ci < dayChunks.length; ci++) {
        const chunk = dayChunks[ci]
        await generateChunkWithFallback(chunk, ci, dayChunks.length)
      }

      applyFestivoToNonGeneratedDays(acc, daysToGenerate, daysPreserved)
      maskUnselectedSessionColumns(acc, daysToGenerate, selectedClassKeys)

      const combined = {
        ...acc,
        titulo:
          acc.titulo?.trim() ||
          `S${weekState.week} – MESOCICLO ${(weekState.mesocycle || '').toUpperCase()}`,
        semana: weekState.week,
        mesociclo: weekState.mesocycle,
      }

      sessionFingerprintsRef.current = buildSessionFingerprintMap(combined)
      setStaleFeedbackKeys(new Set())
      setWeekData(combined)
      setRawJson(JSON.stringify(combined, null, 2))
      setEditTitle(combined.titulo || '')
      setEditSheetName(`S${weekState.week || 1}`)
      lastPersistedDraftRef.current = JSON.stringify(combined)
      /* Conservar edición de fila publicada: sigue pudiendo «Guardar cambios» y contexto sigue siendo opcional al regenerar. */
      setSavedPublishedEdit(false)
      setGenStep('')
      setStatus('previewing')
    } catch (err) {
      setErrorMsg(err.message)
      setGenStep('')
      setStatus('error')
    }
  }

  function handleSaveDraft() {
    setErrorMsg('')
    if (!persistDraftToLocalHistory()) {
      if (editingJson) {
        setErrorMsg('No se pudo guardar: el JSON en modo edición no es válido. Corrige el JSON o desactiva «Editar JSON».')
        return
      }
      setDraftNotice('Sin cambios nuevos que guardar')
      window.setTimeout(() => setDraftNotice(''), 2500)
      return
    }
    setDraftNotice('Guardado en el historial del mesociclo (solo este dispositivo). Puedes cerrar sin publicar.')
    window.setTimeout(() => setDraftNotice(''), 6000)
  }

  function handleCloseModal() {
    if (status === 'previewing' && weekState.mesocycle && weekData != null) {
      persistDraftToLocalHistory()
    }
    onClose()
  }

  async function handlePublish() {
    try {
      setPublishing(true)
      let data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      await publishWeek(data, weekState.mesocycle, weekState.week)
      setPublished(true)
    } catch (err) {
      setErrorMsg('Error publicando: ' + err.message)
    } finally {
      setPublishing(false)
    }
  }

  function loadWeekDataIntoEditor(data, semana, fallbackTitle = '') {
    sessionFingerprintsRef.current = buildSessionFingerprintMap(data)
    setStaleFeedbackKeys(new Set())
    setWeekData(data)
    setRawJson(JSON.stringify(data, null, 2))
    setEditTitle(data.titulo || fallbackTitle || '')
    setEditSheetName(`S${semana}`)
    setPublished(false)
    setSavedPublishedEdit(false)
    setPreviewTab('editar')
    setEditingJson(false)
    setStatus('previewing')
    try {
      const snap = JSON.parse(JSON.stringify(data))
      snap.titulo = String(data.titulo || fallbackTitle || '').trim() || snap.titulo
      snap.semana = semana
      snap.mesociclo = snap.mesociclo || weekState.mesocycle
      lastPersistedDraftRef.current = JSON.stringify(snap)
    } catch {
      lastPersistedDraftRef.current = ''
    }
  }

  async function handleSavePublishedEdit() {
    if (!editingPublishedRowId || !weekData) return
    try {
      setSavingPublishedEdit(true)
      setErrorMsg('')
      const data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      await updatePublishedWeekData(editingPublishedRowId, data)
      saveWeekToHistory(weekState.mesocycle, weekState.week, data)
      lastPersistedDraftRef.current = JSON.stringify(data)
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
      setWeekData(data)
      setRawJson(JSON.stringify(data, null, 2))
      setSavedPublishedEdit(true)
    } catch (err) {
      setErrorMsg('Error guardando cambios en Supabase: ' + err.message)
    } finally {
      setSavingPublishedEdit(false)
    }
  }

  function openPublishedRowForEdit(row, fallbackSemana = null, fallbackMeso = null) {
    if (!row?.data || !Array.isArray(row.data.dias)) {
      setErrorMsg('La semana publicada no tiene JSON editable válido en Supabase.')
      setStatus((s) => (s === 'previewing' ? 'previewing' : 'error'))
      return
    }
    const semana = Number(row.semana) || Number(fallbackSemana) || 1
    const mesociclo = row.mesociclo || fallbackMeso || weekState.mesocycle || null
    const sourceData = JSON.parse(JSON.stringify(row.data))
    sourceData.semana = semana
    sourceData.mesociclo = mesociclo || sourceData.mesociclo
    setEditingPublishedRowId(row.id || null)
    setEditingPublishedIsActive(!!row.is_active)
    loadWeekDataIntoEditor(sourceData, semana, row.titulo || sourceData.titulo || '')
    onSyncWeekFromHistory?.(semana, mesociclo, sourceData.phase || null)
  }

  function updateWeekData(updater) {
    setWeekData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setRawJson(JSON.stringify(next, null, 2))
      if (editingPublishedRowId) setSavedPublishedEdit(false)
      return next
    })
  }

  function handleSessionFieldChange(diaIdx, sessionKey, feedbackKey, newText) {
    updateWeekData((prev) => {
      const dias = [...(prev.dias || [])]
      dias[diaIdx] = { ...dias[diaIdx], [sessionKey]: newText }
      return { ...prev, dias }
    })
    const aligned = sessionFingerprintsRef.current.get(sessionFingerprintKey(diaIdx, sessionKey)) ?? ''
    setStaleFeedbackKeys((prev) => {
      const next = new Set(prev)
      const sk = feedbackStaleKey(diaIdx, feedbackKey)
      if (newText !== aligned) next.add(sk)
      else next.delete(sk)
      return next
    })
  }

  function handleFeedbackFieldChange(diaIdx, sessionKey, feedbackKey, newText) {
    updateWeekData((prev) => {
      const dias = [...(prev.dias || [])]
      const prevDia = dias[diaIdx] || {}
      const sessionSnapshot = prevDia[sessionKey] ?? ''
      sessionFingerprintsRef.current.set(sessionFingerprintKey(diaIdx, sessionKey), sessionSnapshot)
      dias[diaIdx] = { ...prevDia, [feedbackKey]: newText }
      return { ...prev, dias }
    })
    setStaleFeedbackKeys((prev) => {
      const next = new Set(prev)
      next.delete(feedbackStaleKey(diaIdx, feedbackKey))
      return next
    })
  }

  async function regenerateFeedbackForClass(
    diaIdx,
    sessionKey,
    feedbackKey,
    dayName,
    classLabel,
    sessionText,
  ) {
    const sk = feedbackStaleKey(diaIdx, feedbackKey)
    setRegeneratingFeedbackKey(sk)
    setErrorMsg('')
    try {
      const userMsg = [
        `La clase es: ${classLabel}. Usa en la salida los tres prefijos que corresponden a esta clase según las instrucciones del sistema.`,
        '',
        `Día: ${dayName || '—'}`,
        '',
        'SESIÓN COMPLETA DE LA CLASE:',
        sessionText || '(vacía)',
      ].join('\n')

      let response
      try {
        response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: SUPPORT_MODEL,
            max_tokens: AI_CONFIG.feedbackRegenerateMaxTokens,
            system: SYSTEM_PROMPT_REGENERATE_FEEDBACK,
            messages: [{ role: 'user', content: userMsg }],
          }),
        })
      } catch (e) {
        throw new Error(explainAnthropicFetchFailure(e))
      }

      const responseText = await response.text()
      let data
      try {
        data = parseAnthropicProxyBody(responseText)
      } catch {
        throw new Error('La respuesta del servidor no es JSON válido.')
      }

      if (!response.ok || isAnthropicProxyFailure(data)) {
        throw new Error(data?.error?.message || `Error ${response.status}`)
      }
      const raw = data.content?.[0]?.text || ''
      const feedback = stripCodeFences(raw)
      if (!feedback.trim()) throw new Error('La API no devolvió texto de feedback.')

      updateWeekData((prev) => {
        const dias = [...(prev.dias || [])]
        dias[diaIdx] = { ...dias[diaIdx], [feedbackKey]: feedback }
        return { ...prev, dias }
      })
      sessionFingerprintsRef.current.set(sessionFingerprintKey(diaIdx, sessionKey), sessionText ?? '')
      setStaleFeedbackKeys((prev) => {
        const next = new Set(prev)
        next.delete(sk)
        return next
      })
    } catch (err) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo regenerar el feedback.')
    } finally {
      setRegeneratingFeedbackKey(null)
    }
  }

  async function handleApplyDayAiEdit(diaIdx, dia) {
    const instr = sanitizePromptTextForLLM(dayAiDraftByIdx[diaIdx] || '').trim()
    if (!instr) {
      setErrorMsg('Escribe qué quieres cambiar o revisar en este día antes de usar la IA.')
      return
    }
    if (!weekData?.dias?.[diaIdx]) return

    setDayEditAiBusy(true)
    setErrorMsg('')
    try {
      let systemFull = SYSTEM_PROMPT_DAY_EDIT
      try {
        const libRows = await getCoachExerciseLibrary()
        const block = buildGeneratorLibraryBlock(libRows)
        if (block) systemFull += `\n\n${block}`
      } catch {
        /* sin biblioteca */
      }
      const methodText = sanitizePromptTextForLLM(getMethodText()).trim()
      if (methodText) {
        systemFull += `\n\nMÉTODO Y REGLAS PERMANENTES DE EVO (panel «Tu método»):\n${methodText}`
      }

      const weekCtx = buildCompactWeekContextForDayEdit(weekData, diaIdx)
      const briefingHint =
        briefingContextPack && proposalNarrative
          ? `CONTEXTO DE LA PROPUESTA SEMANAL APROBADA (resumen):\n${sliceText(proposalNarrative, 900)}\nEnfoque: ${sliceText(proposalSuggestedFocus, 200)}`
          : ''
      const userMsg = [
        briefingHint,
        weekCtx,
        '',
        `DÍA A EDITAR: ${dia.nombre || `Día ${diaIdx + 1}`} (posición ${diaIdx} en el array "dias").`,
        '',
        'INSTRUCCIONES DEL PROGRAMADOR:',
        instr,
        '',
        'CONTENIDO ACTUAL DEL DÍA (JSON — conserva claves y tipos; respuesta solo en "dia"):',
        JSON.stringify(dia),
      ]
        .filter(Boolean)
        .join('\n\n')

      let response
      try {
        response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: PROGRAMMING_MODEL,
            max_tokens: Math.max(AI_CONFIG.maxTokens, 8192),
            system: systemFull,
            messages: [{ role: 'user', content: userMsg }],
          }),
        })
      } catch (e) {
        throw new Error(explainAnthropicFetchFailure(e))
      }

      const responseText = await response.text()
      let data
      try {
        data = parseAnthropicProxyBody(responseText)
      } catch {
        throw new Error('La respuesta del servidor no es JSON válido.')
      }
      if (!response.ok || isAnthropicProxyFailure(data)) {
        throw new Error(data?.error?.message || `Error ${response.status}`)
      }

      const raw = data.content?.[0]?.text || ''
      if (!raw.trim()) throw new Error('La API no devolvió texto.')

      const parsedDia = parseAssistantDayJson(raw)
      const prevDia = { ...(weekData.dias[diaIdx] || {}) }
      const merged = mergeDayFromAiPatch(prevDia, parsedDia)
      const changedSessions = listSessionFieldsChanged(prevDia, merged)

      updateWeekData((prev) => {
        const dias = [...(prev.dias || [])]
        dias[diaIdx] = merged
        return { ...prev, dias }
      })

      setStaleFeedbackKeys((prev) => {
        const next = new Set(prev)
        for (const { feedbackKey } of changedSessions) {
          next.add(feedbackStaleKey(diaIdx, feedbackKey))
        }
        return next
      })

      if (regenDayFeedbacksAfterAi) {
        for (const { key, feedbackKey, label } of EVO_SESSION_CLASS_DEFS) {
          if (!String(merged[key] || '').trim()) continue
          await regenerateFeedbackForClass(
            diaIdx,
            key,
            feedbackKey,
            merged.nombre || dia.nombre,
            label,
            merged[key] || '',
          )
        }
      }

      setDayAiDraftByIdx((prev) => ({ ...prev, [diaIdx]: '' }))
    } catch (err) {
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo aplicar la edición con IA.')
    } finally {
      setDayEditAiBusy(false)
    }
  }

  function switchPreviewTab(id) {
    if (previewTab === 'json' && id !== 'json') {
      try {
        const parsed = JSON.parse(rawJson)
        if (!parsed || !Array.isArray(parsed.dias)) throw new Error('Falta el array "dias"')
        sessionFingerprintsRef.current = buildSessionFingerprintMap(parsed)
        setStaleFeedbackKeys(new Set())
        setWeekData(parsed)
        setRawJson(JSON.stringify(parsed, null, 2))
      } catch (e) {
        setErrorMsg(e.message || 'JSON no válido. Corrige la pestaña JSON antes de salir.')
        return
      }
    }
    setPreviewTab(id)
    setEditingJson(id === 'json')
    if (id !== 'json') setErrorMsg('')
  }

  async function openHistoryEntryForEdit(entry) {
    setErrorMsg('')
    const mesociclo = weekState.mesocycle
    let publishedRow = null
    try {
      if (mesociclo) {
        publishedRow = await getPublishedWeekByMesocycleAndWeek(mesociclo, entry?.semana)
      }
    } catch {
      publishedRow = null
    }
    if (!publishedRow) {
      try {
        const active = await getActiveWeek()
        if (
          active &&
          active.mesociclo === mesociclo &&
          Number(active.semana) === Number(entry?.semana)
        ) {
          publishedRow = active
        }
      } catch {
        /* noop */
      }
    }

    let sourceData = null
    if (entry?.weekDataFull && Array.isArray(entry.weekDataFull.dias)) {
      sourceData = JSON.parse(JSON.stringify(entry.weekDataFull))
      setEditingPublishedRowId(publishedRow?.id || null)
      setEditingPublishedIsActive(!!publishedRow?.is_active)
    } else if (publishedRow?.data && Array.isArray(publishedRow.data.dias)) {
      openPublishedRowForEdit(publishedRow, entry?.semana, mesociclo)
      return
    }

    if (!sourceData) {
      setErrorMsg(
        'No hay JSON editable en historial ni en Supabase para esta semana. Si esta semana es la activa, prueba refrescar y volver a abrir el modal.',
      )
      setStatus((s) => (s === 'previewing' ? 'previewing' : 'error'))
      return
    }

    sourceData.semana = entry.semana
    sourceData.mesociclo = mesociclo || sourceData.mesociclo
    loadWeekDataIntoEditor(sourceData, entry.semana, entry.titulo || publishedRow?.titulo || '')
    onSyncWeekFromHistory?.(entry.semana, sourceData.mesociclo || mesociclo, sourceData.phase || null)
  }

  async function handleDownload() {
    try {
      setStatus('downloading')
      let data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      data.sheetName = editSheetName || `S${weekState.week || 1}`
      let libRows = []
      try {
        libRows = await getCoachExerciseLibrary()
      } catch {
        /* Excel sin hoja Supabase si falla red */
      }
      await generateWeekExcel(data, isExcelFile ? existingBuffer : null, libRows)
      // Guardar en historial automáticamente
      saveWeekToHistory(weekState.mesocycle, weekState.week, data)
      lastPersistedDraftRef.current = JSON.stringify(data)
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
      setStatus('previewing')
    } catch (err) {
      setErrorMsg('Error generando Excel: ' + err.message)
      setStatus('error')
    }
  }

  const localMesoSummaries = getAllMesocycleSummaries()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
      <div
        className={`w-full bg-white border border-black/5 rounded-3xl flex flex-col max-h-[min(94vh,900px)] animate-fade-in shadow-2xl overflow-hidden ${
          status === 'previewing' ? 'max-w-[min(96vw,1280px)]' : 'max-w-3xl'
        }`}
      >

        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white shadow-sm">
          <div>
            <h2 className="text-display text-base font-bold text-[#1A0A1A] uppercase tracking-tight">Generar Programación Semanal</h2>
            <p className="text-[11px] text-[#2d2430] font-semibold mt-1.5 uppercase tracking-wide">
              {weekState.mesocycle
                ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
                : 'Configuración pendiente'
              }
            </p>
            {status === 'previewing' && weekData && (
              <p className="text-[9px] text-neutral-500 font-medium mt-2 max-w-xl leading-relaxed">
                Borrador: se guarda en este navegador (historial del mesociclo) al pulsar «Guardar borrador», al bajar el
                Excel, al cerrar el modal o unos segundos después de editar. «Publicar Hub» sigue siendo lo único que
                activa la semana en la app.
                {editingPublishedRowId ? (
                  <span className="block text-indigo-700/90 mt-0.5">
                    Semana ya en Supabase: usa «Guardar cambios» para actualizar el Hub sin publicar de nuevo.
                  </span>
                ) : null}
              </p>
            )}
            {draftNotice ? (
              <p className="text-[9px] text-emerald-700 font-semibold mt-1.5" role="status">
                {draftNotice}
              </p>
            ) : null}
          </div>
          <button onClick={handleCloseModal} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-neutral-600 hover:text-red-500 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-4 space-y-4">

          {/* IDLE / INPUT */}
          {(status === 'idle' || status === 'error') && (
            <>
              {briefingStatus === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-evo-accent/30 border-t-evo-accent animate-spin" />
                  <p className="text-sm font-bold text-[#1A0A1A] text-center">Analizando datos de Supabase…</p>
                  <p className="text-[11px] text-neutral-700 text-center max-w-lg leading-relaxed">
                    Semanas ya publicadas en Supabase del mesociclo que tienes en el panel, cambios guardados en el Hub,
                    check-ins de coaches, pases de turno, reglas del método y notas por sesión. No hace falta pegar
                    contexto manual: solo tus notas opcionales después de aceptar la propuesta.
                  </p>
                </div>
              )}

              {briefingStatus === 'error' && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 space-y-3">
                  <p className="text-sm font-bold text-red-900">No se pudo preparar la propuesta</p>
                  <p className="text-xs text-red-800/90">{briefingErrorMsg}</p>
                  <button
                    type="button"
                    onClick={() => setBriefingRetry((x) => x + 1)}
                    className="text-[11px] font-bold uppercase px-4 py-2 rounded-xl bg-white border border-red-300 text-red-900 hover:bg-red-100"
                  >
                    Reintentar
                  </button>
                </div>
              )}

              {briefingStatus === 'ready' && proposalStep === 'refine' && (
                <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3 shadow-sm">
                  <p className="text-[11px] font-bold text-[#1A0A1A] uppercase">Ajustar propuesta</p>
                  <div className="max-h-52 overflow-y-auto space-y-2 text-xs text-neutral-700">
                    {briefingApiMessages.map((m, idx) => (
                      <div
                        key={idx}
                        className={`rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-neutral-100 ml-2' : 'bg-evo-accent/5 mr-2'}`}
                      >
                        <span className="font-bold text-[10px] uppercase text-neutral-500">{m.role}</span>
                        <p className="whitespace-pre-wrap mt-1 leading-snug">{sliceText(m.content, 2000)}</p>
                      </div>
                    ))}
                  </div>
                  <textarea
                    value={refineDraft}
                    onChange={(e) => setRefineDraft(e.target.value)}
                    rows={3}
                    placeholder="Ej.: Más tren inferior y menos volumen de empuje esta semana…"
                    className="w-full bg-gray-50 border border-black/10 rounded-xl px-3 py-2 text-sm !text-[#1A0A1A]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={refineBusy}
                      onClick={sendProposalRefinement}
                      className="px-4 py-2 rounded-xl bg-evo-accent text-white text-[11px] font-bold uppercase disabled:opacity-50"
                    >
                      {refineBusy ? 'Pensando…' : 'Enviar a la IA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setProposalStep('review')}
                      className="px-4 py-2 rounded-xl border border-black/10 text-[11px] font-bold uppercase text-neutral-700"
                    >
                      Volver a la propuesta
                    </button>
                  </div>
                </div>
              )}

              {briefingStatus === 'ready' && proposalStep !== 'refine' && (
                <div className="rounded-2xl border border-evo-accent/25 bg-gradient-to-br from-[#faf7fc] to-white p-5 shadow-sm space-y-4">
                  <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">Propuesta de enfoque</p>
                  <h3 className="text-lg font-bold text-[#1A0A1A] leading-tight">{proposalTitle}</h3>
                  <p className="text-sm text-[#1A0A1A]/90 leading-relaxed">&ldquo;{proposalNarrative}&rdquo;</p>
                  <p className="text-xs font-semibold text-neutral-700">
                    <span className="uppercase tracking-wider text-neutral-500">Enfoque sugerido: </span>
                    {proposalSuggestedFocus}
                  </p>
                  {proposalStep === 'review' && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setProposalStep('refine')}
                        className="px-4 py-2.5 rounded-xl border border-black/15 bg-white text-[11px] font-bold uppercase text-neutral-800 hover:bg-gray-50"
                      >
                        Cambiar enfoque
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProposalAccepted(true)
                          setProposalStep('addons')
                        }}
                        className="px-4 py-2.5 rounded-xl bg-evo-accent text-white text-[11px] font-bold uppercase shadow-sm hover:bg-evo-accent-hover"
                      >
                        Me parece bien →
                      </button>
                    </div>
                  )}
                  {proposalStep === 'addons' && (
                    <div className="space-y-3 pt-2 border-t border-black/10">
                      <label className="block text-[11px] font-bold text-[#1A0A1A]">
                        Solo para esta semana (opcional){' '}
                        <span className="text-neutral-500 font-normal">
                          — lesiones, material, énfasis… máx. {ADDENDUM_MAX_CHARS} caracteres
                        </span>
                      </label>
                      <textarea
                        value={addendum}
                        onChange={(e) => setAddendum(e.target.value.slice(0, ADDENDUM_MAX_CHARS))}
                        rows={2}
                        maxLength={ADDENDUM_MAX_CHARS}
                        placeholder="Lesiones, material, restricción especial…"
                        className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-sm !text-[#1A0A1A]"
                      />
                      <button
                        type="button"
                        onClick={handleGenerate}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl bg-evo-accent text-white text-[12px] font-bold uppercase tracking-wide shadow-md hover:bg-evo-accent-hover"
                      >
                        Generar semana
                      </button>
                    </div>
                  )}
                </div>
              )}

              {briefingStatus === 'ready' && (
                <div className="rounded-2xl border border-evo-accent/15 bg-evo-accent/[0.04] px-4 py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Días que quieres generar
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setDayPicker(Object.fromEntries(EXCEL_DAY_ORDER.map((d) => [d, true])))
                        }
                        className="text-[9px] font-bold uppercase text-evo-accent px-2 py-1 rounded-lg border border-evo-accent/20 hover:bg-evo-accent/10"
                      >
                        Todos
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDayPicker(Object.fromEntries(EXCEL_DAY_ORDER.map((d) => [d, false])))
                        }
                        className="text-[9px] font-bold uppercase text-neutral-600 px-2 py-1 rounded-lg border border-black/10 hover:bg-gray-100"
                      >
                        Ninguno
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-neutral-600 font-medium leading-relaxed">
                    Marca los días que debe rellenar la IA. Para omitir un día, desmárcalo. Si en la propuesta o en el
                    chat mencionaste preservar un día (p. ej. «lunes ya hecho»), el generador lo respeta.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {EXCEL_DAY_ORDER.map((d) => (
                      <label
                        key={d}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold uppercase cursor-pointer select-none transition-colors ${
                          dayPicker[d]
                            ? 'border-evo-accent/40 bg-white text-[#1A0A1A] shadow-sm'
                            : 'border-black/10 bg-gray-50/80 text-neutral-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!dayPicker[d]}
                          onChange={() => setDayPicker((p) => ({ ...p, [d]: !p[d] }))}
                          className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                        />
                        {d === 'MIÉRCOLES' ? 'MIÉ' : d.slice(0, 3)}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {briefingStatus === 'ready' && (
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 space-y-2 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Tipos de clase a programar
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClassPicker(Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, true])))
                        }
                        className="text-[9px] font-bold uppercase text-evo-accent px-2 py-1 rounded-lg border border-evo-accent/20 hover:bg-evo-accent/10"
                      >
                        Todas
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const o = Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, false]))
                          o.evofuncional = true
                          o.evobasics = true
                          o.evofit = true
                          setClassPicker(o)
                        }}
                        className="text-[9px] font-bold uppercase text-neutral-600 px-2 py-1 rounded-lg border border-black/10 hover:bg-gray-100"
                      >
                        Func. + Basics + Fit
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] text-neutral-600 font-medium leading-relaxed">
                    Solo se rellenan las columnas marcadas; el resto queda «no programada» en los días que generes.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    {EVO_SESSION_CLASS_DEFS.map(({ key, label }) => (
                      <label
                        key={key}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold cursor-pointer select-none transition-colors ${
                          classPicker[key]
                            ? 'border-evo-accent/40 bg-evo-accent/[0.06] text-[#1A0A1A]'
                            : 'border-black/10 bg-gray-50/80 text-neutral-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={!!classPicker[key]}
                          onChange={() => setClassPicker((p) => ({ ...p, [key]: !p[key] }))}
                          className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {briefingStatus === 'ready' && (
                <details className="rounded-xl border border-black/10 bg-neutral-50/80 px-4 py-2.5 text-left">
                  <summary className="text-[10px] font-bold text-[#1A0A1A] uppercase tracking-wider cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    Historial local y cambio de mesociclo
                  </summary>
                  <p className="text-[9px] text-neutral-600 leading-relaxed mt-2">
                    Cada mesociclo tiene su propia copia en este navegador (no se borra al cambiar de mesociclo en el
                    panel). El listado «Historial del mesociclo» del modal solo muestra el mesociclo seleccionado ahora.
                    Las semanas en Supabase para el análisis automático de la IA son las del mesociclo actual. Si
                    empiezas otro mesociclo, el contexto de Supabase cambia al nuevo nombre; las semanas antiguas
                    siguen en el Hub y en tu historial local bajo su mesociclo.
                  </p>
                  <ul className="mt-2 space-y-1 text-[9px] text-neutral-700 max-h-32 overflow-y-auto">
                    {localMesoSummaries.map(({ mesociclo: m, count }) => (
                      <li key={m} className="flex justify-between gap-2 border-b border-black/5 pb-1">
                        <span className={m === weekState.mesocycle ? 'font-bold text-evo-accent' : ''}>{m}</span>
                        <span className="tabular-nums text-neutral-500">{count} sem.</span>
                      </li>
                    ))}
                    {localMesoSummaries.length === 0 ? (
                      <li className="text-neutral-500">Aún no hay borradores guardados en este dispositivo.</li>
                    ) : null}
                  </ul>
                </details>
              )}

              {errorMsg && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-800 font-medium">{errorMsg}</p>
                </div>
              )}

              {!weekState.mesocycle && activePublishedWeek?.data && (
                <div className="border border-indigo-200 rounded-2xl bg-indigo-50/60 px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-800">
                      Semana activa en Supabase detectada
                    </p>
                    <p className="text-[10px] text-indigo-900 font-semibold mt-1">
                      {activePublishedWeek.mesociclo || '—'} · S{activePublishedWeek.semana || '—'} · {activePublishedWeek.titulo || 'Sin título'}
                    </p>
                    <p className="text-[9px] text-indigo-700/90 mt-1">
                      Puedes abrirla y editarla sin configurar mesociclo en el panel izquierdo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openPublishedRowForEdit(activePublishedWeek)}
                    className="shrink-0 text-[9px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border border-indigo-300 bg-white text-indigo-800 hover:bg-indigo-100 transition-all"
                  >
                    Editar activa
                  </button>
                </div>
              )}

              {/* Historial del mesociclo */}
              {history.length > 0 && (
                <div className="border border-black/5 rounded-2xl overflow-hidden shadow-soft bg-white">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-3.5 bg-gray-50/50 hover:bg-gray-100/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-[#1A0A1A] uppercase tracking-widest">Historial del Mesociclo</span>
                      <span className="text-[9px] bg-evo-accent/10 text-evo-accent px-2 py-0.5 rounded-full font-bold">{history.length} SEMANAS</span>
                    </div>
                    <span className="text-neutral-600 text-xs">{showHistory ? '▲' : '▼'}</span>
                  </button>
                  {showHistory && (
                    <div className="animate-fade-in">
                      <div className="divide-y divide-black/5">
                        {history.map((entry) => (
                          <div key={entry.semana} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-gray-50/30 transition-all">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-[#1A0A1A] uppercase tracking-tight">Semana {entry.semana} — {entry.titulo || 'Sin título'}</p>
                              {entry.resumen && (
                                <p className="text-[9px] text-neutral-600 font-medium mt-1">
                                  {entry.resumen.estimulo} · {entry.resumen.foco}
                                </p>
                              )}
                              <p className="text-[9px] text-neutral-500 mt-1">
                                {new Date(entry.savedAt).toLocaleDateString()}
                                {!entry.weekDataFull && (
                                  <span className="block text-amber-700 font-bold mt-0.5">
                                    Sin JSON local — intenta «Editar» (carga Supabase si existe)
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => openHistoryEntryForEdit(entry)}
                                className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 px-2 py-1 rounded-lg transition-all border border-evo-accent/20"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteWeekFromHistory(weekState.mesocycle, entry.semana)
                                  setHistory(getHistoryForMesocycle(weekState.mesocycle))
                                }}
                                className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 px-2 py-1 rounded-lg transition-all"
                              >
                                Eliminar
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-[10px] text-indigo-600 font-bold bg-indigo-50/50 rounded-2xl px-5 py-4 border border-indigo-100/50 uppercase tracking-tight shadow-sm">
                <span className="text-sm">💡</span>
                <span>
                  Generaremos Lunes→Sábado (Funcional + Basics + Fit). Tiempo real en servidor: ~1–5 min (varias
                  llamadas a la IA, según días marcados); en Vercel hace falta plan Pro y redeploy para tiempos largos.
                </span>
              </div>
            </>
          )}

          {/* GENERATING */}
          {status === 'generating' && (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="w-20 h-20 rounded-3xl bg-evo-bg flex items-center justify-center shadow-elevated border border-black/5 animate-bounce">
                <span className="text-display text-4xl font-black text-evo-accent">E</span>
              </div>
              <div className="space-y-2">
                <p className="text-base font-bold text-[#1A0A1A] text-center uppercase tracking-tight">
                  {genStep || 'Iniciando generación...'}
                </p>
                <p className="text-[11px] text-neutral-600 text-center font-bold uppercase tracking-widest">Memoria AI activa · Coherencia EVO</p>
              </div>
              <div className="flex gap-2.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2.5 h-2.5 rounded-full bg-evo-accent animate-pulse" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {status === 'previewing' && weekData && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-xl shadow-inner border border-black/5">
                  {[
                    { id: 'resumen', label: 'Resumen' },
                    { id: 'editar', label: 'Editar' },
                    { id: 'wodbuster', label: 'WodBuster' },
                    { id: 'json', label: 'JSON (avanzado)' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => switchPreviewTab(tab.id)}
                      className={`text-[10px] px-3 py-1.5 rounded-lg transition-all font-bold uppercase tracking-tight ${
                        previewTab === tab.id
                          ? 'bg-white shadow-sm text-evo-accent'
                          : 'text-neutral-600 hover:text-[#1A0A1A]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Listo para Exportar</p>
                </div>
              </div>
              {editingPublishedRowId && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
                  editingPublishedIsActive
                    ? 'bg-indigo-50 border-indigo-100'
                    : 'bg-amber-50 border-amber-100'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${editingPublishedIsActive ? 'bg-indigo-500' : 'bg-amber-500'}`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${
                    editingPublishedIsActive ? 'text-indigo-700' : 'text-amber-800'
                  }`}>
                    {editingPublishedIsActive ? 'Editando semana publicada activa' : 'Editando semana publicada'}
                  </p>
                </div>
              )}

              {history.length > 0 && (
                <details className="rounded-xl border border-amber-200/80 bg-amber-50/50 px-4 py-2">
                  <summary className="text-[10px] font-bold uppercase text-amber-950 cursor-pointer select-none">
                    Historial del mesociclo — cargar otra semana
                  </summary>
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-black/5 bg-white divide-y divide-black/5">
                    {history.map((entry) => (
                      <div key={`pv-${entry.semana}`} className="px-4 py-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#1A0A1A] uppercase">S{entry.semana} — {entry.titulo || 'Sin título'}</p>
                          {!entry.weekDataFull && (
                            <p className="text-[9px] text-amber-800 font-medium mt-0.5">Sin JSON local (se intenta Supabase)</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openHistoryEntryForEdit(entry)}
                            className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 px-2 py-1 rounded border border-evo-accent/20"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteWeekFromHistory(weekState.mesocycle, entry.semana)
                              setHistory(getHistoryForMesocycle(weekState.mesocycle))
                            }}
                            className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 px-2 py-1 rounded"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {/* Campos editables: título y pestaña */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-1.5 block ml-1">Título del Documento</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Ej: S4 – MESOCICLO FUERZA · 80-85%"
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-medium focus:outline-none focus:border-evo-accent shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest mb-1.5 block ml-1">Pestaña</label>
                  <input
                    type="text"
                    value={editSheetName}
                    onChange={(e) => setEditSheetName(e.target.value)}
                    placeholder="S4"
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs !text-[#1A0A1A] caret-[#1A0A1A] font-medium focus:outline-none focus:border-evo-accent shadow-sm"
                  />
                </div>
              </div>

              {isExcelFile && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm">
                  <span className="text-emerald-500 text-xs">●</span>
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-tight">
                    Excel Detectado: Se añadirá como pestaña <span className="text-emerald-900">"{editSheetName}"</span>
                  </p>
                </div>
              )}

              {/* Resumen de semana */}
              {weekData.resumen && previewTab === 'resumen' && (
                <div className="bg-evo-accent/5 border border-evo-accent/10 rounded-2xl p-5 space-y-3 shadow-soft">
                  <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">Resumen de Orientación Semanal</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">Estímulo</p>
                      <p className="text-[11px] text-[#1A0A1A] font-semibold">{weekData.resumen.estimulo}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">Intensidad · Foco</p>
                      <p className="text-[11px] text-[#1A0A1A] font-semibold">{weekData.resumen.intensidad} · {weekData.resumen.foco}</p>
                    </div>
                    <div className="space-y-1 sm:col-span-1">
                      <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-widest">Nota Metodológica</p>
                      <p className="text-[11px] text-[#1A0A1A] font-semibold leading-relaxed">{weekData.resumen.nota}</p>
                    </div>
                  </div>
                </div>
              )}

              {previewTab === 'editar' && weekData && (
                <div className="space-y-5 border border-black/5 rounded-2xl p-4 sm:p-5 bg-gray-50/30">
                  <p className="text-xs text-neutral-600 font-bold uppercase tracking-widest leading-relaxed">
                    Cambia textos aquí; al publicar o descargar se usa esta versión. Usa las pestañas de día para
                    enfocar un día — el editor de sesión gana altura en pantalla.
                  </p>

                  <div className="rounded-2xl border border-evo-accent/20 bg-white p-4 sm:p-5 space-y-3 shadow-sm">
                    <p className="text-xs font-bold text-evo-accent uppercase tracking-widest">Orientación semanal</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { k: 'estimulo', label: 'Estímulo' },
                        { k: 'intensidad', label: 'Intensidad' },
                        { k: 'foco', label: 'Foco' },
                      ].map(({ k, label }) => (
                        <label key={k} className="block space-y-1">
                          <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">{label}</span>
                          <input
                            type="text"
                            value={(weekData.resumen && weekData.resumen[k]) || ''}
                            onChange={(e) =>
                              updateWeekData((prev) => ({
                                ...prev,
                                resumen: { ...(prev.resumen || {}), [k]: e.target.value },
                              }))
                            }
                            className="w-full text-sm !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-evo-accent/40"
                          />
                        </label>
                      ))}
                    </div>
                    <label className="block space-y-1">
                      <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">Nota metodológica</span>
                      <textarea
                        rows={3}
                        value={(weekData.resumen && weekData.resumen.nota) || ''}
                        onChange={(e) =>
                          updateWeekData((prev) => ({
                            ...prev,
                            resumen: { ...(prev.resumen || {}), nota: e.target.value },
                          }))
                        }
                        className="w-full text-sm !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-evo-accent/40 leading-relaxed"
                      />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest w-full sm:w-auto sm:mr-2">
                      Día
                    </span>
                    {(weekData.dias || []).map((d, i) => (
                      <button
                        key={d.nombre || i}
                        type="button"
                        onClick={() => setEditFocusDayIdx(i)}
                        className={`px-3 py-2 rounded-xl text-sm font-bold uppercase tracking-wide border transition-colors ${
                          editFocusDayIdx === i
                            ? 'bg-evo-accent text-white border-evo-accent shadow-sm'
                            : 'bg-white text-[#1A0A1A] border-black/10 hover:border-evo-accent/40 hover:bg-evo-accent/5'
                        }`}
                      >
                        {d.nombre || `Día ${i + 1}`}
                      </button>
                    ))}
                  </div>

                  {(() => {
                    const dias = weekData.dias || []
                    const diaIdx = Math.min(Math.max(0, editFocusDayIdx), Math.max(0, dias.length - 1))
                    const dia = dias[diaIdx]
                    if (!dia) return null
                    const sessionTextareaClass =
                      'w-full min-h-[min(52vh,520px)] sm:min-h-[min(56vh,560px)] text-sm sm:text-[15px] font-mono !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-4 py-3 focus:outline-none focus:border-evo-accent/50 focus:ring-2 focus:ring-evo-accent/15 leading-relaxed resize-y'
                    const secondaryTextareaClass =
                      'w-full text-sm !text-[#1A0A1A] caret-[#1A0A1A] border rounded-xl px-4 py-3 focus:outline-none leading-relaxed resize-y'
                    return (
                      <div key={dia.nombre || diaIdx} className="rounded-2xl border border-black/8 bg-white p-4 sm:p-5 space-y-4 shadow-sm">
                        <p className="text-sm font-bold text-[#1A0A1A] uppercase tracking-wide border-b border-black/5 pb-2">
                          {dia.nombre || `Día ${diaIdx + 1}`}
                        </p>

                        <div className="rounded-2xl border border-black/10 bg-white p-4 space-y-3 shadow-sm">
                          <p className="text-xs font-bold text-evo-accent uppercase tracking-widest">
                            Ajustes con IA (solo este día)
                          </p>
                          <p className="text-[11px] text-neutral-600 leading-relaxed">
                            Indica qué quieres cambiar en{' '}
                            <span className="font-semibold text-[#1A0A1A]">{dia.nombre || `día ${diaIdx + 1}`}</span>.
                            El resto de la semana solo se usa como contexto; no se modifica.
                          </p>
                          <textarea
                            rows={3}
                            value={dayAiDraftByIdx[diaIdx] ?? ''}
                            onChange={(e) =>
                              setDayAiDraftByIdx((prev) => ({ ...prev, [diaIdx]: e.target.value }))
                            }
                            disabled={dayEditAiBusy}
                            placeholder="Ej.: Suaviza el WOD de Funcional; deja el bloque A igual…"
                            spellCheck
                            className="w-full text-sm !text-[#1A0A1A] caret-[#1A0A1A] border border-black/10 rounded-xl px-3 py-2.5 focus:outline-none focus:border-evo-accent/40 leading-relaxed resize-y min-h-[4.5rem] disabled:opacity-50"
                          />
                          <label className="flex items-start gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={regenDayFeedbacksAfterAi}
                              onChange={(e) => setRegenDayFeedbacksAfterAi(e.target.checked)}
                              disabled={dayEditAiBusy}
                              className="mt-0.5 rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                            />
                            <span className="text-[11px] text-neutral-600 leading-snug">
                              Después, regenerar los feedbacks de coaching de las clases con sesión (varias llamadas).
                            </span>
                          </label>
                          <button
                            type="button"
                            disabled={dayEditAiBusy}
                            onClick={() => handleApplyDayAiEdit(diaIdx, dia)}
                            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wide border border-black/10 bg-white text-[#1A0A1A] hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none shadow-sm"
                          >
                            {dayEditAiBusy ? 'Aplicando…' : 'Aplicar con IA'}
                          </button>
                        </div>

                        {EDIT_SESSION_FIELDS.map(({ key, label, color, feedbackKey }) => {
                          const resumenFoco = (weekData.resumen && weekData.resumen.foco) || ''
                          return (
                            <div
                              key={key}
                              className="flex flex-col lg:flex-row-reverse lg:items-start gap-3 lg:gap-4"
                            >
                              <aside className="w-full lg:w-[280px] lg:max-w-[280px] lg:shrink-0 lg:sticky lg:top-3 self-start">
                                <WeekSessionClassReviewAside
                                  dias={dias}
                                  sessionKey={key}
                                  label={label}
                                  highlightDayIdx={diaIdx}
                                  resumenFoco={resumenFoco}
                                />
                              </aside>
                              <label className="block min-w-0 flex-1 space-y-2">
                                <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                                  {label}
                                </span>
                                <textarea
                                  rows={14}
                                  value={dia[key] || ''}
                                  onChange={(e) =>
                                    handleSessionFieldChange(diaIdx, key, feedbackKey, e.target.value)
                                  }
                                  placeholder={`Texto de la sesión ${label}…`}
                                  spellCheck={false}
                                  className={sessionTextareaClass}
                                />
                                {(() => {
                                  const summary = buildWeeklyClassBSummary(dias, diaIdx, key)
                                  const hasAny = summary.length > 0
                                  return (
                                    <details className="rounded-xl border border-black/8 bg-[#faf8fc]">
                                      <summary className="cursor-pointer list-none px-3 py-2.5 text-[11px] font-bold uppercase tracking-widest text-[#6A1F6D] flex items-center justify-between [&::-webkit-details-marker]:hidden">
                                        <span>Lo que llevas esta semana — {label}</span>
                                        <span className="text-[9px] opacity-70">
                                          {hasAny ? `${summary.length} días` : 'sin datos'}
                                        </span>
                                      </summary>
                                      <div className="px-3 pb-3 pt-0.5 border-t border-black/5">
                                        {hasAny ? (
                                          <ul className="space-y-1.5">
                                            {summary.map((row) => (
                                              <li key={`${row.dayLabel}-${row.main}`} className="text-xs text-[#1A0A1A]">
                                                <span className="font-bold">{row.dayLabel}</span>
                                                <span className="mx-1.5 text-black/40">→</span>
                                                <span>{row.main}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="text-xs text-[#6B5A6B]">
                                            Aún no hay bloque B detectado en días anteriores de esta clase.
                                          </p>
                                        )}
                                      </div>
                                    </details>
                                  )
                                })()}
                              </label>
                            </div>
                          )
                        })}

                        <div className="pt-2 border-t border-dashed border-black/10 space-y-4">
                          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest">
                            Feedbacks (coaching)
                          </p>
                          {EVO_SESSION_CLASS_DEFS.map(({ key: sessionKey, feedbackKey, label }) => {
                            const shortLabel = `Feedback · ${label.replace(/^Evo/, '')}`
                            const sk = feedbackStaleKey(diaIdx, feedbackKey)
                            const isStale = staleFeedbackKeys.has(sk)
                            const isBusy = regeneratingFeedbackKey === sk
                            return (
                              <div key={feedbackKey} className="block space-y-2">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <span className="text-xs font-bold text-neutral-600 uppercase tracking-widest">
                                    {shortLabel}
                                  </span>
                                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                                    {isStale && (
                                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-200/80">
                                        Desactualizado
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        regenerateFeedbackForClass(
                                          diaIdx,
                                          sessionKey,
                                          feedbackKey,
                                          dia.nombre,
                                          label,
                                          dia[sessionKey] || '',
                                        )
                                      }
                                      className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-800 hover:bg-indigo-50 disabled:opacity-50 disabled:pointer-events-none"
                                    >
                                      {isBusy ? 'Regenerando…' : 'Regenerar feedback'}
                                    </button>
                                  </div>
                                </div>
                                {isStale && (
                                  <p className="text-xs text-amber-900/90 leading-snug bg-amber-50/80 border border-amber-100 rounded-lg px-2.5 py-1.5">
                                    Sesión editada: el feedback puede no coincidir con el entrenamiento actual.
                                  </p>
                                )}
                                <label className="block">
                                  <textarea
                                    rows={4}
                                    value={dia[feedbackKey] || ''}
                                    onChange={(e) =>
                                      handleFeedbackFieldChange(
                                        diaIdx,
                                        sessionKey,
                                        feedbackKey,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Briefing Marian (~80–110 palabras): líneas con foco, org (-…), ⚠️ riesgo, ⏱ solo si crítico, ✅ tarea…"
                                    spellCheck={false}
                                    className={`${secondaryTextareaClass} border-indigo-100 focus:border-indigo-300 bg-indigo-50/20 min-h-[5.5rem]`}
                                  />
                                </label>
                              </div>
                            )
                          })}
                        </div>

                        <label className="block space-y-2 pt-2 border-t border-black/5">
                          <span className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
                            WodBuster (vista alumno)
                          </span>
                          <textarea
                            rows={8}
                            value={dia.wodbuster || ''}
                            onChange={(e) =>
                              updateWeekData((prev) => {
                                const nextDias = [...(prev.dias || [])]
                                nextDias[diaIdx] = { ...nextDias[diaIdx], wodbuster: e.target.value }
                                return { ...prev, dias: nextDias }
                              })
                            }
                            spellCheck={false}
                            className={`${secondaryTextareaClass} border-emerald-100 focus:border-emerald-300 bg-emerald-50/15 min-h-[10rem]`}
                          />
                        </label>
                      </div>
                    )
                  })()}
                </div>
              )}

              {previewTab === 'wodbuster' && (() => {
                const wbText = buildWeekWodBusterPaste(weekData)

                return (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest">
                        Pegar en WodBuster (sin timings ni feedback)
                      </p>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(wbText)
                          setWbCopied(true)
                          setTimeout(() => setWbCopied(false), 2000)
                        }}
                        className={`text-[10px] px-4 py-1.5 rounded-xl transition-all shadow-sm font-bold uppercase ${
                          wbCopied
                            ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                            : 'bg-white border border-black/10 text-[#1A0A1A] hover:bg-gray-50'
                        }`}
                      >
                        {wbCopied ? '✓ Copiado' : 'Copiar Todo'}
                      </button>
                    </div>
                    <pre className="w-full bg-gray-50 border border-black/5 rounded-2xl px-5 py-5 text-[11px] text-[#1A0A1A] font-medium leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto font-sans shadow-inner">
                      {wbText || 'Sin datos WodBuster — regenera la semana para obtener esta versión'}
                    </pre>
                  </div>
                )
              })()}

              {previewTab === 'json' && (
                <div className="space-y-2">
                  <p className="text-[10px] text-amber-800/90 font-bold uppercase tracking-widest bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                    Solo para usuarios avanzados. Si algo falla, vuelve a «Editar» o regenera la semana.
                  </p>
                  <textarea
                    value={rawJson}
                    onChange={(e) => setRawJson(e.target.value)}
                    rows={16}
                    className="evo-json-console w-full bg-gray-900 border border-gray-800 rounded-2xl px-5 py-5 text-[10px] text-emerald-400 font-mono focus:outline-none leading-relaxed shadow-2xl"
                    spellCheck={false}
                  />
                </div>
              )}

              {previewTab === 'resumen' && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {weekData.dias?.map((dia) => {
                    const ALL = [
                      { key: 'evofuncional', label: 'Funcional', color: '#2F7BBE' },
                      { key: 'evobasics', label: 'Basics', color: '#E07B39' },
                      { key: 'evofit', label: 'Fit', color: '#2FBE7B' },
                      { key: 'evohybrix', label: 'Hybrix', color: '#BE2F2F' },
                      { key: 'evofuerza', label: 'Fuerza', color: '#BE2F2F' },
                      { key: 'evogimnastica', label: 'Gimnástica', color: '#D93F8E' },
                      { key: 'evotodos', label: 'EvoTodos', color: '#A729AD' },
                    ]
                    const active = ALL.filter((c) => dia[c.key])
                    return (
                      <div key={dia.nombre} className="bg-white rounded-2xl p-4 border border-black/5 shadow-soft">
                        <p className="text-[11px] font-bold text-[#1A0A1A] uppercase tracking-widest mb-3 ml-1">{dia.nombre}</p>
                        <div className={`grid gap-2 ${active.length <= 3 ? 'grid-cols-3' : 'grid-cols-3'}`}>
                          {active.map(({ key, label, color }) => (
                            <div key={key} className="relative rounded-lg p-2 group/class" style={{ backgroundColor: `${color}11`, border: `1px solid ${color}33` }}>
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[9px] font-medium" style={{ color }}>{label}</p>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    navigator.clipboard.writeText(dia[key])
                                    const btn = e.currentTarget
                                    const oldHtml = btn.innerHTML
                                    btn.innerHTML = '✓'
                                    setTimeout(() => btn.innerHTML = oldHtml, 2000)
                                  }}
                                  className="opacity-0 group-hover/class:opacity-100 transition-opacity text-[8px] bg-white px-1.5 py-0.5 rounded border border-black/15 text-neutral-600 hover:text-[#1A0A1A] hover:bg-gray-50"
                                  title={`Copiar sesión de ${label}`}
                                >
                                  Copiar
                                </button>
                              </div>
                              <p className="text-[9px] text-neutral-600 leading-relaxed line-clamp-4" style={{ whiteSpace: 'pre-line' }}>
                                {dia[key]?.slice(0, 200) || '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {errorMsg && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-xs text-red-800 font-medium">{errorMsg}</p>
                </div>
              )}
            </div>
          )}

          {/* DOWNLOADING */}
          {status === 'downloading' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <p className="text-sm text-[#1A0A1A] font-medium">Generando archivo Excel...</p>
              <div className="flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-[#2FBE7B] animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0 bg-gray-50/50 backdrop-blur-md">
          <button onClick={handleCloseModal} className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest hover:text-[#1A0A1A] transition-all">
            Cancelar
          </button>
          <div className="flex flex-wrap justify-end gap-3">
            {status === 'previewing' && (
              <button
                onClick={handleGenerate}
                className="px-5 py-2.5 rounded-xl border border-black/10 bg-white text-neutral-600 hover:text-[#1A0A1A] hover:bg-gray-50 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Regenerar
              </button>
            )}
            {status === 'previewing' && weekData && (
              <button
                type="button"
                onClick={handleSaveDraft}
                className="px-5 py-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Guardar borrador
              </button>
            )}
            {status === 'previewing' && (
              <>
                {editingPublishedRowId && (
                  <button
                    onClick={handleSavePublishedEdit}
                    disabled={savingPublishedEdit}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                  >
                    {savedPublishedEdit ? '✓ Cambios guardados' : savingPublishedEdit ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                )}
                <button
                  onClick={handlePublish}
                  disabled={publishing || published}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-evo-accent/20 bg-evo-accent/5 hover:bg-evo-accent/10 disabled:opacity-50 text-evo-accent text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                >
                  {published ? '✓ Publicado' : publishing ? 'Publicando...' : 'Publicar Hub'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar Excel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
