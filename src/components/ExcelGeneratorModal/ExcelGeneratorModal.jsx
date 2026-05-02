import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import {
  SYSTEM_PROMPT_EXCEL,
  SYSTEM_PROMPT_REGENERATE_FEEDBACK,
  EXCEL_GENERATION_FIRST_PASS_PUBLISHABLE,
  EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK,
} from '../../constants/systemPromptExcel.js'
import { SYSTEM_PROMPT_DAY_EDIT } from '../../constants/systemPromptDayEdit.js'
import { generateWeekExcel } from '../../utils/generateExcel.js'
import { importProgramingEvoWeekFromXlsxBuffer } from '../../utils/importProgramingEvoWeekXlsx.js'
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
  resolveDaysToGenerateFromSelection,
  EXCEL_DAY_ORDER,
} from '../../utils/excelGenerationPlan.js'
import { buildWeekWodBusterPaste } from '../../utils/formatWodBusterPaste.js'
import { getMethodText } from '../MethodPanel/MethodPanel.jsx'
import { AI_CONFIG, PROGRAMMING_MODEL, SUPPORT_MODEL } from '../../constants/config.js'
import { explainAnthropicFetchFailure } from '../../utils/explainAnthropicFetchFailure.js'
import {
  parseAnthropicProxyBody,
  isAnthropicProxyFailure,
  getAnthropicProxyErrorMessage,
} from '../../utils/parseAnthropicProxyBody.js'
import { extractAnthropicTextBlocks } from '../../utils/extractAnthropicTextBlocks.js'
import { parseAssistantWeekJson } from '../../utils/parseAssistantWeekJson.js'
import { parseAssistantDayJson } from '../../utils/parseAssistantDayJson.js'
import { mergeDayFromAiPatch, listSessionFieldsChanged } from '../../utils/mergeDayFromAiPatch.js'
import { sanitizePromptTextForLLM } from '../../utils/sanitizePromptTextForLLM.js'
import {
  getReferenceMesocycleContextForLLM,
  getReferenceMesocycleContextForLLMFromRaw,
  mergeReferenceMesocycleContexts,
  loadReferenceMesocycleContextRaw,
  buildReferenceMesocycleSystemAppendix,
} from '../../utils/referenceMesocycleContextStorage.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { buildWeekContext } from '../../utils/buildWeekContext.js'
import { extractMainExerciseFromBlockB } from '../../utils/sessionBlockB.js'
import {
  buildWeekSessionClassReview,
  formatReviewHintsForGenerationPrompt,
  summarizeWeekQuality,
} from '../../utils/weekSessionReview.js'
import { buildMesocycleProgrammingBlock } from '../../constants/mesocycleGenerationBlocks.js'
import { buildInferredMethodFromReference } from '../../utils/buildInferredMethodFromReference.js'

/** Máximo de caracteres de ejemplos reales en el system (evita prompts enormes y timeouts). */
const EXCEL_REAL_PROGRAMMING_EXAMPLES_MAX_CHARS = 12000
/** Techo por POST (1 día por llamada; JSON de 6 columnas puede ser largo). */
const EXCEL_GENERATION_MAX_TOKENS_PER_CALL = 6500
/** Límite de caracteres del pack de briefing por petición (el mismo bloque va en weekContext → system). */
const EXCEL_GENERATION_PACK_MAX_CHARS = 42_000
/** Tope del JSON «días ya generados» en el user (POST muy grande → timeouts / conexión cortada). */
const EXCEL_COHERENCE_JSON_MAX_CHARS = 45_000

const ADDENDUM_MAX_CHARS = 3000
const QA_AUTO_FIX_MAX_PASSES = 5
const QA_TARGET_SCORE = 8.2

function buildAllClassesSelection() {
  return Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, true]))
}

function buildDayClassSelection(allSelected = true) {
  return Object.fromEntries(
    EXCEL_DAY_ORDER.map((day) => [
      day,
      Object.fromEntries(EVO_SESSION_CLASS_DEFS.map(({ key }) => [key, !!allSelected])),
    ]),
  )
}

/**
 * Serializa el acumulador para el bloque de coherencia: compacta y recorta textos largos si hace falta.
 * @param {{ titulo?: string, resumen?: unknown, dias?: unknown[] }} acc
 */
function stringifyAccumulatorForCoherence(acc) {
  const MAX = EXCEL_COHERENCE_JSON_MAX_CHARS
  const trimDay = (day, cap) => {
    const d = { ...(day && typeof day === 'object' ? day : {}) }
    for (const k of Object.keys(d)) {
      if (typeof d[k] === 'string' && d[k].length > cap) {
        d[k] = `${d[k].slice(0, Math.max(12, cap - 14))} …[recortado]`
      }
    }
    return d
  }
  const diasSrc = Array.isArray(acc?.dias) ? acc.dias : []
  const caps = [1200, 800, 550, 380, 240]
  for (const dayCap of caps) {
    for (const includeResumen of [true, false]) {
      const o = {
        titulo: acc?.titulo,
        ...(includeResumen ? { resumen: acc?.resumen } : {}),
        dias: diasSrc.map((d) => trimDay(d, dayCap)),
      }
      let s = JSON.stringify(o, null, 2)
      if (s.length > MAX) s = JSON.stringify(o)
      if (s.length <= MAX) return s
    }
  }
  return JSON.stringify({
    titulo: acc?.titulo,
    nota: 'JSON de días omitido por tamaño; prioriza el bloque heurístico siguiente.',
  })
}

/** En reintentos tardíos, quita apéndices largos del system para acortar la petición. */
function trimExcelSystemForAnthropicRetry(systemFull, attempt) {
  if (attempt < 2) return String(systemFull || '')
  let s = String(systemFull || '')
  const cutAt = (marker) => {
    const i = s.indexOf(marker)
    if (i >= 0) s = s.slice(0, i)
  }
  cutAt('\n\nEJEMPLOS REALES DE ESTILO EVO')
  cutAt('\n\n════════════════════════════════════════\nCONTEXTO DE REFERENCIA (OTROS MESOCICLOS')
  const full = String(systemFull || '')
  if (s.length + 120 < full.length) {
    s +=
      '\n\n[Reintento: se omitieron temporalmente ejemplos Drive y/o contexto de referencia para acortar la petición.]'
  }
  return s
}

function trimWeekContextForAnthropicRetry(weekContext, attempt) {
  const t = String(weekContext || '')
  if (attempt < 2 || t.length <= 24_000) return t
  return `${t.slice(0, 21_000).trimEnd()}\n\n[…contexto recortado en reintento por tamaño]`
}

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

function buildSessionGridQuickSummary(rawSessionText) {
  const text = String(rawSessionText || '').trim()
  if (!text || /^\(no programada esta semana\)\s*$/i.test(text) || /^FESTIVO\b/i.test(text)) return ''
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const mainB = extractMainExerciseFromBlockB(text)
  const blockA = lines.find((l) => /^A\)\s+/i.test(l)) || ''
  const blockC = lines.find((l) => /^C\)\s+/i.test(l)) || ''
  const parts = []
  if (blockA) parts.push(blockA.replace(/^A\)\s*/i, 'A: '))
  if (mainB) parts.push(`B: ${mainB}`)
  if (blockC) parts.push(blockC.replace(/^C\)\s*/i, 'C: '))
  return parts.slice(0, 3).join('\n')
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

function humanizeNetworkLikeError(err, fallback = 'Error de red') {
  const raw = String(err?.message || '').trim()
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return explainAnthropicFetchFailure(err)
  }
  if (/specified api usage limits|credit balance is too low|insufficient credits|rate limit/i.test(raw)) {
    const until =
      raw.match(/regain access on ([^.]+)/i)?.[1]?.trim() ||
      raw.match(/retry after[:\s]+([^.]+)/i)?.[1]?.trim() ||
      ''
    return until
      ? `Límite de uso de la API alcanzado. Debes recargar saldo o esperar hasta ${until}.`
      : 'Límite de uso de la API alcanzado. Recarga saldo de Anthropic o espera al próximo ciclo de facturación.'
  }
  return raw || fallback
}

async function postJsonWithRetry(url, payload, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const rawText = await res.text()
      let json = {}
      try {
        json = rawText ? JSON.parse(rawText) : {}
      } catch {
        json = {}
      }
      const errorMessage =
        (typeof json?.error === 'string' && json.error) ||
        (typeof json?.error === 'object' && json?.error?.message) ||
        (typeof json?.message === 'string' && json.message) ||
        rawText?.trim()?.slice(0, 500) ||
        `Error ${res.status}`
      const retriable = [429, 502, 503, 504, 529].includes(Number(res.status))
      if (!res.ok && retriable && attempt < retries) {
        const waitMs = (attempt + 1) * 2500
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      return { res, json, errorMessage }
    } catch (e) {
      if (attempt < retries) {
        const waitMs = (attempt + 1) * 2500
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw e
    }
  }
  throw new Error('No se pudo completar la petición tras varios intentos.')
}

async function fetchServerReferenceContext() {
  try {
    const res = await fetch('/api/programming-reference-context', { method: 'GET' })
    if (!res.ok) return ''
    const json = await res.json().catch(() => ({}))
    return String(json?.contextText || '').trim()
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
  const [importingExcel, setImportingExcel] = useState(false)
  const excelImportInputRef = useRef(null)
  const [activePublishedWeek, setActivePublishedWeek] = useState(null)
  const [openingActiveEdit, setOpeningActiveEdit] = useState(false)
  /** Texto de sesión alineado con el feedback (solo memoria del modal). */
  const sessionFingerprintsRef = useRef(new Map())
  const [staleFeedbackKeys, setStaleFeedbackKeys] = useState(() => new Set())
  const [regeneratingFeedbackKey, setRegeneratingFeedbackKey] = useState(null)
  /** LUNES–SÁBADO: fuente de verdad de qué días pide generar el cliente (el texto solo añade preservados/excluidos). */
  const [dayPicker, setDayPicker] = useState(() =>
    Object.fromEntries(EXCEL_DAY_ORDER.map((d) => [d, true])),
  )
  /** Columnas de sesión (EvoFuncional, Basics, …) que deben rellenarse en la generación. */
  const [classPicker, setClassPicker] = useState(() => buildAllClassesSelection())
  /** Matriz día x clase: selección final de columnas a generar por día. */
  const [dayClassPicker, setDayClassPicker] = useState(() => buildDayClassSelection(true))
  /** Pestaña «Editar»: día visible (el resto de la semana en tabs, sin scroll infinito). */
  const [editFocusDayIdx, setEditFocusDayIdx] = useState(0)
  /** Clase enfocada en pestaña Editar (bloque activo de la parrilla semanal). */
  const [editFocusClassKey, setEditFocusClassKey] = useState(EDIT_SESSION_FIELDS[0]?.key || 'evofuncional')
  /** Borradores de instrucciones para «IA · este día» (por índice de día). */
  const [dayAiDraftByIdx, setDayAiDraftByIdx] = useState({})
  const [dayEditAiBusy, setDayEditAiBusy] = useState(false)
  const [regenDayFeedbacksAfterAi, setRegenDayFeedbacksAfterAi] = useState(false)
  const [briefingRetry, setBriefingRetry] = useState(0)
  /** Evita escrituras repetidas al historial local si el JSON no cambió. */
  const lastPersistedDraftRef = useRef('')
  /** Aviso breve: borrador / guardado manual en localStorage. */
  const [draftNotice, setDraftNotice] = useState('')
  const [weekGridSummaryMode, setWeekGridSummaryMode] = useState(true)
  const [weekGridColWidth, setWeekGridColWidth] = useState(190)

  const selectedClassKeysForReview = useMemo(() => {
    const out = new Set()
    for (const d of EXCEL_DAY_ORDER) {
      for (const { key } of EVO_SESSION_CLASS_DEFS) {
        if (dayClassPicker?.[d]?.[key]) out.add(key)
      }
    }
    return [...out]
  }, [dayClassPicker])

  const weekQuality = useMemo(() => {
    if (!weekData?.dias) return null
    return summarizeWeekQuality(
      weekData.dias,
      selectedClassKeysForReview,
      String(weekData?.resumen?.foco || ''),
    )
  }, [weekData, selectedClassKeysForReview])

  // Cargar historial del mesociclo al abrir
  useEffect(() => {
    if (weekState.mesocycle) {
      setHistory(getHistoryForMesocycle(weekState.mesocycle))
    }
  }, [weekState.mesocycle])

  useEffect(() => {
    const all = buildAllClassesSelection()
    setClassPicker(all)
    setDayClassPicker(buildDayClassSelection(true))
  }, [weekState.mesocycle])

  useEffect(() => {
    // El selector global de clases actúa como "aplicar a todos los días".
    setDayClassPicker((prev) => {
      const next = { ...prev }
      for (const d of EXCEL_DAY_ORDER) {
        next[d] = { ...(next[d] || {}), ...classPicker }
      }
      return next
    })
  }, [classPicker])

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
      setProposalTitle('')
      setProposalNarrative('')
      setProposalSuggestedFocus('')
      try {
        const { res, json, errorMessage } = await postJsonWithRetry('/api/programming-week-briefing', {
          mesociclo: weekState.mesocycle,
          semana: Number(weekState.week),
          phase: weekState.phase || '',
          totalWeeks: weekState.totalWeeks ?? null,
        })
        if (!res.ok) throw new Error(errorMessage || `Error ${res.status}`)
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
          setBriefingErrorMsg(humanizeNetworkLikeError(e, 'No se pudo generar la propuesta.'))
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
        const existingHistory = getHistoryForMesocycle(weekState.mesocycle)
        const existingBySemana = new Set(existingHistory.map((e) => Number(e?.semana || 0)))
        for (const row of rows) {
          if (!row?.data || !Array.isArray(row.data.dias)) continue
          // No pisar borradores locales ya guardados en este dispositivo.
          if (existingBySemana.has(Number(row.semana))) continue
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

  useEffect(() => {
    const keys = new Set(EDIT_SESSION_FIELDS.map((f) => f.key))
    if (!keys.has(editFocusClassKey)) {
      setEditFocusClassKey(EDIT_SESSION_FIELDS[0]?.key || 'evofuncional')
    }
  }, [editFocusClassKey])

  /**
   * Guarda la semana actual en el historial del navegador (localStorage) sin publicar en el Hub.
   * No sustituye a «Guardar cambios» cuando editas una fila ya publicada en Supabase.
   */
  const persistDraftToLocalHistory = useCallback((options = {}) => {
    const force = options.force === true
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
    if (!force && sig === lastPersistedDraftRef.current) return false
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

  const refreshActivePublishedWeek = useCallback(async () => {
    try {
      const row = await getActiveWeek()
      setActivePublishedWeek(row || null)
      return row || null
    } catch {
      setActivePublishedWeek(null)
      return null
    }
  }, [])

  useEffect(() => {
    refreshActivePublishedWeek()
  }, [refreshActivePublishedWeek])

  async function handleOpenActivePublishedWeekForEdit() {
    setOpeningActiveEdit(true)
    setErrorMsg('')
    try {
      if (status === 'previewing' && weekData) {
        persistDraftToLocalHistory()
        const go = window.confirm(
          'Antes de abrir la semana activa del Hub, se guardó un borrador local. ¿Quieres continuar?',
        )
        if (!go) return
      }
      const row = (await refreshActivePublishedWeek()) || activePublishedWeek
      if (!row?.data || !Array.isArray(row.data.dias)) {
        setErrorMsg(
          'No hay semana activa editable en el Hub ahora mismo. Si acabas de publicar, cierra y abre el modal para refrescar o revisa permisos de lectura.',
        )
        return
      }
      openPublishedRowForEdit(row)
    } finally {
      setOpeningActiveEdit(false)
    }
  }

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
      const { res, json, errorMessage } = await postJsonWithRetry('/api/programming-week-briefing', {
        messages: nextMessages,
        contextPack: briefingContextPack,
        mesociclo: weekState.mesocycle,
        semana: Number(weekState.week),
        phase: weekState.phase || '',
        totalWeeks: weekState.totalWeeks ?? null,
      })
      if (!res.ok) throw new Error(errorMessage || `Error ${res.status}`)
      const assistantText = JSON.stringify(json.proposal || {})
      setProposalTitle(String(json.proposal?.title || '').trim())
      setProposalNarrative(String(json.proposal?.narrative || '').trim())
      setProposalSuggestedFocus(String(json.proposal?.suggestedFocus || '').trim())
      setBriefingApiMessages([...nextMessages, { role: 'assistant', content: assistantText }])
      setRefineDraft('')
      setProposalStep('review')
    } catch (e) {
      setErrorMsg(humanizeNetworkLikeError(e, 'No se pudo actualizar la propuesta.'))
    } finally {
      setRefineBusy(false)
    }
  }

  /**
   * Una llamada API = un POST. La semana se parte en tramos de 1 día (varias llamadas)
   * para evitar timeouts con briefing + system largos en serverless.
   * Modelo: PROGRAMMING_MODEL (Sonnet u homólogo), max_tokens: `AI_CONFIG.maxTokens`.
   */
  async function callApi(userMessage, systemFull = SYSTEM_PROMPT_EXCEL, weekContext = '', retries = 5) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const body = {
        model: PROGRAMMING_MODEL,
        max_tokens: Math.min(AI_CONFIG.maxTokens, EXCEL_GENERATION_MAX_TOKENS_PER_CALL),
        system: trimExcelSystemForAnthropicRetry(systemFull, attempt),
        weekContext: trimWeekContextForAnthropicRetry(weekContext, attempt),
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
        const networkMsg = explainAnthropicFetchFailure(e)
        if (attempt < retries) {
          const wait = Math.min(12, 4 + attempt * 3)
          setGenStep(`Conexión inestable con la IA — reintentando en ${wait}s…`)
          await new Promise((r) => setTimeout(r, wait * 1000))
          continue
        }
        throw new Error(networkMsg)
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
        if (
          response.status === 403 &&
          (err?.error === 'origin_not_allowed' || data?.error === 'origin_not_allowed')
        ) {
          throw new Error(
            'El dominio desde el que abres la app no está autorizado para la API de generación. ' +
              'Si usas un dominio propio, en Vercel define EVO_ALLOWED_ORIGIN_PREFIXES con la URL exacta (https://…) y redeploy. ' +
              'Las URLs de preview tipo https://programing-evo*.vercel.app ya deberían funcionar sin configuración extra.',
          )
        }
        if (response.status === 504 || response.status === 502 || errType === 'upstream_timeout') {
          throw new Error(
            'Tiempo de espera agotado: la IA tardó más de lo permitido en esta petición (límite del servidor / Anthropic). ' +
              'En Vercel el proyecto usa maxDuration 300 s; si ves esto a menudo, genera menos días a la vez o revisa la carga del modelo. ' +
              'Plan Hobby (~10 s de función) no basta para esta generación: hace falta Pro u otro plan con funciones largas.',
          )
        }
        const apiMsg = getAnthropicProxyErrorMessage(err, responseText, response.status)
        throw new Error(apiMsg || `Error ${response.status}`)
      }
      const text = extractAnthropicTextBlocks(data)
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
      const acceptedManualProposal =
        proposalAccepted && String(proposalTitle || '').trim() && String(proposalNarrative || '').trim()
      if (briefingStatus === 'loading') {
        setErrorMsg('Espera a que termine el análisis automático de la IA.')
        setStatus('error')
        return
      }
      if (briefingStatus === 'ready') {
        if (!pack) {
          setErrorMsg('No se pudo cargar el contexto del briefing. Reintenta o usa propuesta manual.')
          setStatus('error')
          return
        }
        if (!proposalAccepted) {
          setErrorMsg('Pulsa «Me parece bien» y luego «Generar semana» (o ajusta el enfoque con la IA).')
          setStatus('error')
          return
        }
      } else if (!acceptedManualProposal) {
        setErrorMsg(
          'El briefing automático falló. Completa y acepta una propuesta manual (título + narrativa) para continuar.',
        )
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

    let referenceBody = getReferenceMesocycleContextForLLM()
    try {
      const remoteReferenceRaw = await fetchServerReferenceContext()
      if (remoteReferenceRaw) {
        const mergedRaw = mergeReferenceMesocycleContexts(loadReferenceMesocycleContextRaw(), remoteReferenceRaw)
        referenceBody = getReferenceMesocycleContextForLLMFromRaw(mergedRaw)
      }
    } catch {
      /* fallback a referencia local */
    }
    const referenceAppendix = buildReferenceMesocycleSystemAppendix(referenceBody)
    if (referenceAppendix) {
      systemExcelFull += referenceAppendix
      const inferredRules = buildInferredMethodFromReference(referenceBody)
      if (inferredRules) {
        systemExcelFull += `\n\n${inferredRules}`
      }
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

    const classesByDay = Object.fromEntries(
      EXCEL_DAY_ORDER.map((d) => [d, new Set(EVO_SESSION_CLASS_DEFS.filter(({ key }) => !!dayClassPicker?.[d]?.[key]).map(({ key }) => key))]),
    )
    const selectedClassKeys = new Set(
      [...daysToGenerate].flatMap((d) => [...(classesByDay[d] || new Set())]),
    )
    if (selectedClassKeys.size === 0) {
      setErrorMsg('Marca al menos una clase en algún día seleccionado para generar.')
      setStatus('error')
      return
    }
    const daysWithoutClasses = [...daysToGenerate].filter((d) => (classesByDay[d]?.size || 0) === 0)
    if (daysWithoutClasses.length) {
      setErrorMsg(
        `Hay días marcados sin clases seleccionadas: ${daysWithoutClasses.join(', ')}. Marca al menos una clase en cada día o desmarca el día.`,
      )
      setStatus('error')
      return
    }

    try {
      let weekContextText = ''
      if (pack) {
        weekContextText = `PAQUETE BRIEFING (Supabase — mesociclo actual, check-ins, handoffs, reglas, feedback, historial de ediciones)\n\n${packForGeneration}`
      } else {
        try {
          weekContextText = await buildWeekContext(weekState)
        } catch (ctxErr) {
          console.warn('[ExcelGeneratorModal] buildWeekContext falló; se continúa sin ese bloque:', ctxErr?.message || ctxErr)
          weekContextText =
            'CONTEXTO DE LA SEMANA\n' +
            'No se pudo cargar contexto histórico remoto en este intento (fallo de red o Supabase). ' +
            'Genera con método + briefing actual y coherencia interna de la semana.'
        }
      }
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

      const perDayPlanLines = EXCEL_DAY_ORDER
        .filter((d) => daysToGenerate.has(d))
        .map((d) => {
          const labels = EVO_SESSION_CLASS_DEFS.filter(({ key }) => classesByDay[d]?.has(key)).map(
            ({ label }) => label,
          )
          return `${d}: ${labels.length ? labels.join(', ') : '(sin clases)'}`
        })
      const planSummary = `PLAN DE DÍAS Y COLUMNAS (obligatorio):
- Días marcados en el selector del cliente: ${[...selectedCanon].join(', ')}
- Generar contenido real (sesiones y feedbacks) SOLO para: ${[...daysToGenerate].join(', ')}
  En esos días el campo wodbuster del JSON debe ser cadena vacía "" (el pegado WodBuster lo arma la app desde las columnas de clase).
- Columnas de clase por día (solo estas; en el resto de columnas del mismo día usa exactamente «(no programada esta semana)» y feedback vacío):
${perDayPlanLines.map((x) => `  - ${x}`).join('\n')}
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
        const core = `${baseContext}\n\n${planSummary}\n\n${EXCEL_GENERATION_FIRST_PASS_PUBLISHABLE}\n\n${EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK}\n\nGENERACIÓN DE DÍAS EN ESTA PETICIÓN: ${list}.

Devuelve JSON con titulo, resumen y dias (array de EXACTAMENTE 6 objetos en orden LUNES, MARTES, MIÉRCOLES, JUEVES, VIERNES, SÁBADO; cada uno con "nombre" en MAYÚSCULAS).

Antes de redactar, haz internamente una mini-matriz de semana (no la imprimas) con: patrón dominante del día, formato de fuerza, formato WOD, complejidad logística/material. Úsala para evitar repetición entre días consecutivos.

Solo rellena contenido completo (sesiones y feedbacks) para: ${list}, respetando exactamente las columnas por día listadas en PLAN DE DÍAS Y COLUMNAS; en otras columnas de esos mismos días deja «(no programada esta semana)» y feedback vacío. En esos días wodbuster = "".
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
        const jsonBlock = `CONTEXTO YA GENERADO EN ESTA SEMANA (sesiones ya cerradas o preservadas; al escribir los días nuevos de ESTA petición NO repitas el mismo lift principal, ni formatos de fuerza/WOD consecutivos, ni el mismo patrón muscular consecutivo en EvoFuncional respecto a estos días; mantén en tu salida vacíos los días que no te tocan):\n${stringifyAccumulatorForCoherence(acc)}`
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

      /**
       * Guardia de robustez:
       * si un día marcado para generar quedó vacío o en "(no programada esta semana)"
       * en TODAS las columnas seleccionadas, reintenta ese día una vez con instrucción explícita.
       */
      function isNoProgramadaLike(text) {
        const t = String(text || '').trim()
        if (!t) return true
        return /no programada esta semana/i.test(t)
      }
      function dayMissingSelectedProgramming(dayCanon) {
        const idx = EXCEL_DAY_ORDER.indexOf(dayCanon)
        if (idx < 0) return false
        const dia = acc?.dias?.[idx]
        if (!dia || typeof dia !== 'object') return true
        const keys = [...(classesByDay[dayCanon] || new Set())]
        if (!keys.length) return false
        return keys.every((k) => isNoProgramadaLike(dia[k]))
      }

      const missingDays = [...daysToGenerate].filter((d) => dayMissingSelectedProgramming(d))
      if (missingDays.length) {
        console.warn('[ProgramingEvo][Excel] días marcados sin contenido real tras primera pasada; reintento forzado:', missingDays)
        for (const d of missingDays) {
          const forceCoherence = buildCoherenceBlockFromAccumulator()
          const forceMsg =
            buildChunkMessage(new Set([d]), forceCoherence) +
            `\n\nREINTENTO FORZADO (${d}): este día estaba marcado para generar por el selector del cliente. ` +
            `Devuelve contenido REAL para ${d} en las columnas seleccionadas; no uses «(no programada esta semana)» en esas columnas.`
          setGenStep(`Reintentando ${d} (faltaba contenido)…`)
          const part = await callApi(forceMsg, systemExcelFull, weekContextText)
          mergeGeneratedDaysIntoAccumulator(acc, part, new Set([d]))
        }
      }

      /**
       * Semáforo bloqueante (fase QA):
       * Si detectamos días conflictivos (rojo o acumulado alto), reintenta SOLO esos días una vez
       * con instrucciones de corrección, en vez de llevar toda la semana a edición manual.
       */
      function buildCriticalHintsByDay(includeYellow = false) {
        const out = new Map()
        const foco = String(acc?.resumen?.foco || '')
        for (const sk of [...selectedClassKeys]) {
          const label = EVO_SESSION_CLASS_DEFS.find((d) => d.key === sk)?.label || sk
          const r = buildWeekSessionClassReview(acc.dias || [], sk, { resumenFoco: foco })
          for (const row of r.rows || []) {
            if (row.placeholder) continue
            if (
              !(
                row.severity === 'red' ||
                row.severity === 'orange' ||
                (includeYellow && row.severity === 'yellow')
              )
            ) {
              continue
            }
            if (!daysToGenerate.has(EXCEL_DAY_ORDER[row.dayIdx])) continue
            const prev = out.get(row.dayIdx) || []
            prev.push(`${label}: ${row.hints.join(' · ')}`)
            out.set(row.dayIdx, prev)
          }
        }
        return out
      }

      for (let qaPass = 1; qaPass <= QA_AUTO_FIX_MAX_PASSES; qaPass += 1) {
        const qualityBeforePass = summarizeWeekQuality(
          acc.dias || [],
          [...selectedClassKeys],
          String(acc?.resumen?.foco || ''),
        )
        const shouldChaseScore = qualityBeforePass.score < QA_TARGET_SCORE
        /** Desde la primera pasada si hace falta subir score (menos trabajo manual para el cliente). */
        const includeYellow = shouldChaseScore
        const criticalHintsByDay = buildCriticalHintsByDay(includeYellow)
        const blockingIdxSet = new Set([
          ...(qualityBeforePass.blockingDayIdx || []),
          ...[...criticalHintsByDay.keys()],
        ])
        let blockingCanonDays = [...blockingIdxSet]
          .map((idx) => EXCEL_DAY_ORDER[idx])
          .filter((d) => d && daysToGenerate.has(d))

        // En pasadas orientadas a score, priorizar días con más avisos para subir calidad rápido.
        if (includeYellow && blockingCanonDays.length > 3) {
          blockingCanonDays = blockingCanonDays
            .sort((a, b) => (criticalHintsByDay.get(EXCEL_DAY_ORDER.indexOf(b)) || []).length - (criticalHintsByDay.get(EXCEL_DAY_ORDER.indexOf(a)) || []).length)
            .slice(0, 3)
        }

        if (!blockingCanonDays.length) break

        setGenStep(
          `Auto-corrección QA ${qaPass}/${QA_AUTO_FIX_MAX_PASSES} (score ${qualityBeforePass.score}/10 → objetivo ${QA_TARGET_SCORE}) en ${blockingCanonDays.join(' · ')}…`,
        )
        for (const d of blockingCanonDays) {
          const dayIdx = EXCEL_DAY_ORDER.indexOf(d)
          const dayHints = (criticalHintsByDay.get(dayIdx) || []).slice(0, 5).join('\n- ')
          const forceCoherence = buildCoherenceBlockFromAccumulator()
          const forceMsg =
            buildChunkMessage(new Set([d]), forceCoherence) +
            `\n\nAUTO-CORRECCIÓN DE CALIDAD (${d}) — pasada ${qaPass}/${QA_AUTO_FIX_MAX_PASSES}: reescribe este día para eliminar avisos rojos/naranjas y no toques otros días.` +
            `\nPrioridad: variar lift/formato dominante, quitar repeticiones cercanas y mantener logística viable.` +
            `\nSi aparece calentamiento genérico, cámbialo por movilidad específica estratégica o elimínalo.` +
            `\nObjetivo global: subir score semanal hacia ${QA_TARGET_SCORE}/10 o más.` +
            `\n- ${dayHints || 'Evitar repetición dominante y mejorar coherencia de ese día.'}`
          const part = await callApi(forceMsg, systemExcelFull, weekContextText)
          mergeGeneratedDaysIntoAccumulator(acc, part, new Set([d]))
        }

        const qualityAfterPass = summarizeWeekQuality(
          acc.dias || [],
          [...selectedClassKeys],
          String(acc?.resumen?.foco || ''),
        )
        if (!qualityAfterPass.hasBlocking && qualityAfterPass.score >= QA_TARGET_SCORE) {
          break
        }
      }

      applyFestivoToNonGeneratedDays(acc, daysToGenerate, daysPreserved)
      for (let i = 0; i < EXCEL_DAY_ORDER.length; i += 1) {
        const dayName = EXCEL_DAY_ORDER[i]
        if (!daysToGenerate.has(dayName)) continue
        const row = acc?.dias?.[i]
        if (!row || typeof row !== 'object') continue
        const selectedForDay = classesByDay[dayName] || new Set()
        for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
          if (!selectedForDay.has(key)) {
            row[key] = '(no programada esta semana)'
            row[feedbackKey] = ''
          }
        }
      }

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
      setErrorMsg(humanizeNetworkLikeError(err, 'No se pudo generar la semana.'))
      setGenStep('')
      setStatus('error')
    }
  }

  function handleSaveDraft() {
    setErrorMsg('')
    if (!weekState.mesocycle) {
      setErrorMsg('Selecciona mesociclo y semana en el panel antes de guardar el borrador.')
      return
    }
    if (!persistDraftToLocalHistory({ force: true })) {
      if (editingJson) {
        setErrorMsg('No se pudo guardar: el JSON en modo edición no es válido. Corrige el JSON o desactiva «Editar JSON».')
        return
      }
      setErrorMsg('No hay datos de semana para guardar.')
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

  /**
   * Solo bloquea publicar si hay calentamiento realmente «genérico» (combinación explícita en texto).
   * No bloqueamos el aviso «Hay bloque de calentamiento» (solo amarillo informativo ni colgado junto con otra cosa).
   */
  const warmupPublishBlockPrefixes = ['Calentamiento genérico detectado']

  function getWarmupBlockingIssuesForPublish(dias) {
    const out = []
    const focus = String(weekData?.resumen?.foco || '')
    for (const sessionKey of selectedClassKeysForReview) {
      const classLabel = EVO_SESSION_CLASS_DEFS.find((d) => d.key === sessionKey)?.label || sessionKey
      const review = buildWeekSessionClassReview(dias || [], sessionKey, { resumenFoco: focus })
      for (const row of review.rows || []) {
        if (row.placeholder) continue
        if (!(row.severity === 'orange' || row.severity === 'red')) continue
        const warmupHints = (row.hints || []).filter((h) => {
          const s = String(h)
          return warmupPublishBlockPrefixes.some((p) => s.startsWith(p))
        })
        if (!warmupHints.length) continue
        out.push({
          dayLabel: row.dayLabel,
          classLabel,
          hint: warmupHints[0],
        })
      }
    }
    return out
  }

  function formatClientError(err) {
    const e = err && typeof err === 'object' ? err : { message: String(err) }
    const bits = [e.message, e.details, e.hint, e.code != null && `code=${e.code}`].filter(Boolean)
    return bits.join(' · ') || 'Error desconocido'
  }

  async function handlePublish() {
    try {
      setPublishing(true)
      setErrorMsg('')
      if (!weekState.mesocycle || weekState.week == null) {
        throw new Error('Falta mesociclo o número de semana en el panel izquierdo.')
      }
      let data = editingJson ? JSON.parse(rawJson) : { ...weekData }
      data.titulo = editTitle || data.titulo
      const warmupIssues = getWarmupBlockingIssuesForPublish(data?.dias || [])
      if (warmupIssues.length) {
        const top = warmupIssues
          .slice(0, 4)
          .map((x) => `${x.dayLabel} · ${x.classLabel}: ${x.hint}`)
          .join(' | ')
        throw new Error(
          `Publicación bloqueada: calentamiento claramente genérico (titulado + texto tipo «movilidad general», etc.). Ajusta esos casos y vuelve a publicar. ${top}`,
        )
      }
      await publishWeek(data, weekState.mesocycle, weekState.week)
      setPublished(true)
      try {
        window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'publish' } }))
      } catch {
        /* noop */
      }
    } catch (err) {
      setErrorMsg('Error publicando: ' + formatClientError(err))
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
      try {
        window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'save-published' } }))
      } catch {
        /* noop */
      }
    } catch (err) {
      setErrorMsg('Error guardando cambios en Supabase: ' + formatClientError(err))
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
        throw new Error(getAnthropicProxyErrorMessage(data, responseText, response.status))
      }
      const raw = extractAnthropicTextBlocks(data)
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
      const refDay = buildReferenceMesocycleSystemAppendix(getReferenceMesocycleContextForLLM())
      if (refDay) {
        systemFull += refDay
        const inferredRules = buildInferredMethodFromReference(getReferenceMesocycleContextForLLM())
        if (inferredRules) {
          systemFull += `\n\n${inferredRules}`
        }
      }

      const weekCtx = buildCompactWeekContextForDayEdit(weekData, diaIdx)
      const briefingHint =
        briefingContextPack && proposalNarrative
          ? `CONTEXTO DE LA PROPUESTA SEMANAL APROBADA (resumen):\n${sliceText(proposalNarrative, 900)}\nEnfoque: ${sliceText(proposalSuggestedFocus, 200)}`
          : ''
      const focusedClassLabel =
        EVO_SESSION_CLASS_DEFS.find((c) => c.key === editFocusClassKey)?.label || editFocusClassKey

      async function requestEditedDay(extraInstruction = '') {
        const userMsg = [
          briefingHint,
          weekCtx,
          '',
          `DÍA A EDITAR: ${dia.nombre || `Día ${diaIdx + 1}`} (posición ${diaIdx} en el array "dias").`,
          `CLASE EN FOCO (prioridad alta): ${focusedClassLabel} (${editFocusClassKey}).`,
          '',
          'INSTRUCCIONES DEL PROGRAMADOR:',
          instr,
          extraInstruction,
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
          throw new Error(getAnthropicProxyErrorMessage(data, responseText, response.status))
        }
        const raw = extractAnthropicTextBlocks(data)
        if (!raw.trim()) throw new Error('La API no devolvió texto.')
        return parseAssistantDayJson(raw)
      }

      const prevDia = { ...(weekData.dias[diaIdx] || {}) }
      let merged = { ...prevDia }
      let changedSessions = []
      let focusedChanged = false
      const wantsChange = true
      const wantsSoloFocusedClass =
        /\bsolo\b/i.test(instr) &&
        new RegExp(`\\b${String(editFocusClassKey).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(instr)

      const attemptGuidance = [
        '',
        `REINTENTO OBLIGATORIO: en la respuesta anterior no hubo cambios aplicables. Debes cambiar como mínimo la clase en foco (${editFocusClassKey}) o su feedback asociado según la instrucción del programador. No devuelvas el día idéntico.`,
        `ÚLTIMO REINTENTO ESTRICTO: cambia obligatoriamente ${editFocusClassKey}. Si no cambias ese campo, la respuesta se considerará inválida.`,
      ]

      for (let attempt = 0; attempt < attemptGuidance.length; attempt += 1) {
        const parsedDia = await requestEditedDay(attemptGuidance[attempt])
        merged = mergeDayFromAiPatch(prevDia, parsedDia)

        // Si la instrucción dice "solo <clase>", no dejamos que la IA toque otras clases del día.
        if (wantsSoloFocusedClass) {
          for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
            if (key === editFocusClassKey) continue
            merged[key] = prevDia[key] ?? ''
            merged[feedbackKey] = prevDia[feedbackKey] ?? ''
          }
          merged.wodbuster = prevDia.wodbuster ?? ''
        }

        changedSessions = listSessionFieldsChanged(prevDia, merged)
        focusedChanged = String(prevDia[editFocusClassKey] ?? '') !== String(merged[editFocusClassKey] ?? '')
        if (!wantsChange) break
        if (focusedChanged || changedSessions.length > 0) break
      }

      // Fallback duro: si no hubo cambios reales en la clase foco, pedimos SOLO ese campo en texto plano.
      if (!focusedChanged) {
        const focusedPrev = String(prevDia[editFocusClassKey] || '')
        const fallbackSystem = `Eres ProgramingEvo. Debes reescribir SOLO una clase de un día.
Devuelve SOLO texto plano de sesión (sin JSON, sin markdown, sin explicaciones), conservando estructura BIENVENIDA + A) + B) + C) + CIERRE.
No toques otros campos porque no se te piden.
Si la instrucción dice cambiar algo, NO devuelvas texto idéntico al original.`
        const fallbackUser = [
          `Día: ${dia.nombre || `Día ${diaIdx + 1}`}`,
          `Clase objetivo: ${focusedClassLabel} (${editFocusClassKey})`,
          '',
          'Instrucción del programador:',
          instr,
          '',
          'Texto actual de la clase objetivo:',
          focusedPrev || '(vacío)',
          '',
          'Devuelve SOLO el texto nuevo completo de esta clase.',
        ].join('\n')

        let fbRes
        try {
          fbRes = await fetch('/api/anthropic', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: PROGRAMMING_MODEL,
              max_tokens: 3200,
              system: fallbackSystem,
              messages: [{ role: 'user', content: fallbackUser }],
            }),
          })
        } catch (e) {
          throw new Error(explainAnthropicFetchFailure(e))
        }
        const fbText = await fbRes.text()
        let fbData
        try {
          fbData = parseAnthropicProxyBody(fbText)
        } catch {
          throw new Error('Fallback IA: respuesta no JSON válida del servidor.')
        }
        if (!fbRes.ok || isAnthropicProxyFailure(fbData)) {
          throw new Error(getAnthropicProxyErrorMessage(fbData, fbText, fbRes.status))
        }
        const forcedText = stripCodeFences(extractAnthropicTextBlocks(fbData)).trim()
        if (forcedText && forcedText !== focusedPrev) {
          merged[editFocusClassKey] = forcedText
          focusedChanged = true
          changedSessions = listSessionFieldsChanged(prevDia, merged)
        }
      }

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

      if (wantsChange && !focusedChanged && changedSessions.length === 0) {
        throw new Error(
          `La IA devolvió el día sin cambios aplicables tras todos los intentos (incluido fallback). Prueba una orden más específica de reemplazo para ${editFocusClassKey}.`,
        )
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

  async function recoverLatestLocalDraft() {
    setErrorMsg('')
    const entries = getHistoryForMesocycle(weekState.mesocycle)
      .filter((e) => Number(e?.semana) === Number(weekState.week))
      .sort((a, b) => new Date(b?.savedAt || 0).getTime() - new Date(a?.savedAt || 0).getTime())
    const latest = entries[0]
    if (!latest) {
      setErrorMsg('No hay borrador local para esta semana en este dispositivo.')
      return
    }
    await openHistoryEntryForEdit(latest)
    setDraftNotice(
      `Borrador local recuperado (${new Date(latest.savedAt).toLocaleString('es-ES', {
        dateStyle: 'short',
        timeStyle: 'short',
      })})`,
    )
    setTimeout(() => setDraftNotice(''), 4200)
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

  async function handleImportExcelChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!weekData) {
      setErrorMsg('Primero genera o carga una semana en el modal.')
      return
    }
    if (!/\.xlsx$/i.test(file.name)) {
      setErrorMsg('Sube un .xlsx exportado desde este modal (Descargar Excel).')
      return
    }
    try {
      setImportingExcel(true)
      setErrorMsg('')
      const buf = await file.arrayBuffer()
      let base
      try {
        base = editingJson ? JSON.parse(rawJson) : { ...weekData }
      } catch {
        setErrorMsg('El JSON en modo edición no es válido; desactiva «Editar JSON» o corrígelo antes de importar.')
        return
      }
      base.titulo = String(editTitle || base.titulo || '').trim() || base.titulo
      const { data, warnings } = await importProgramingEvoWeekFromXlsxBuffer(buf, base)
      loadWeekDataIntoEditor(data, weekState.week, data.titulo || editTitle || '')
      if (warnings.length) {
        setDraftNotice(`Excel importado con avisos: ${warnings.join(' · ')}`)
        window.setTimeout(() => setDraftNotice(''), 9000)
      } else {
        setDraftNotice('Excel importado: sesiones y feedbacks del archivo aplicados al borrador.')
        window.setTimeout(() => setDraftNotice(''), 5500)
      }
    } catch (err) {
      setErrorMsg(String(err?.message || err) || 'No se pudo importar el Excel.')
    } finally {
      setImportingExcel(false)
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
            <div className="mt-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={recoverLatestLocalDraft}
                  className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-all"
                >
                  Recuperar ultimo borrador local
                </button>
                <button
                  type="button"
                  onClick={handleOpenActivePublishedWeekForEdit}
                  disabled={openingActiveEdit}
                  className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-all disabled:opacity-50"
                >
                  {openingActiveEdit ? 'Abriendo semana activa…' : 'Editar semana activa del Hub'}
                </button>
              </div>
            </div>
            {status === 'previewing' && weekData && (
              <p className="text-[9px] text-neutral-500 font-medium mt-2 max-w-xl leading-relaxed">
                Borrador: se guarda en este navegador (historial del mesociclo) al pulsar «Guardar borrador», al bajar el
                Excel, al cerrar el modal o unos segundos después de editar. «Publicar Hub» sigue siendo lo único que
                activa la semana en la app. Si editaste el Excel descargado desde aquí, usa «Importar Excel» en vista previa
                para volcar sesiones y feedbacks al JSON antes de publicar o regenerar con la IA.
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

              {briefingStatus === 'error' && (
                <div className="rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 space-y-3">
                  <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">Modo manual (sin briefing IA)</p>
                  <p className="text-[10px] text-amber-900/85 leading-relaxed">
                    Puedes seguir aunque falle la API: escribe una propuesta mínima y marca los días/clases para generar.
                  </p>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Título de la propuesta
                    </label>
                    <input
                      type="text"
                      value={proposalTitle}
                      onChange={(e) => setProposalTitle(e.target.value.slice(0, 120))}
                      placeholder="Ej.: PROPUESTA PARA SEMANA 5"
                      className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-sm !text-[#1A0A1A]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Enfoque sugerido (1 línea)
                    </label>
                    <input
                      type="text"
                      value={proposalSuggestedFocus}
                      onChange={(e) => setProposalSuggestedFocus(e.target.value.slice(0, 160))}
                      placeholder="Ej.: Consolidación técnica + carga controlada de tren inferior"
                      className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-sm !text-[#1A0A1A]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Narrativa (2-5 frases)
                    </label>
                    <textarea
                      value={proposalNarrative}
                      onChange={(e) => setProposalNarrative(e.target.value.slice(0, 900))}
                      rows={4}
                      placeholder="Explica objetivo semanal, control de carga y dónde poner el foco técnico."
                      className="w-full bg-white border border-black/10 rounded-xl px-3 py-2 text-sm !text-[#1A0A1A]"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!String(proposalTitle || '').trim() || !String(proposalNarrative || '').trim()) {
                          setErrorMsg('En modo manual, completa al menos título y narrativa.')
                          setStatus('error')
                          return
                        }
                        setErrorMsg('')
                        setProposalAccepted(true)
                        setProposalStep('addons')
                      }}
                      className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-[11px] font-bold uppercase shadow-sm hover:bg-amber-700"
                    >
                      Usar propuesta manual
                    </button>
                    {proposalAccepted ? (
                      <span className="text-[10px] font-semibold text-emerald-700">Propuesta manual lista ✓</span>
                    ) : null}
                  </div>
                  {proposalAccepted && proposalStep === 'addons' ? (
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
                  ) : null}
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

              {(briefingStatus === 'ready' || briefingStatus === 'error') && (
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

              {(briefingStatus === 'ready' || briefingStatus === 'error') && (
                <div className="rounded-2xl border border-black/10 bg-white px-4 py-3 space-y-2 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[11px] font-bold text-[#1A0A1A] uppercase tracking-wider">
                      Tipos de clase a programar
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setClassPicker(buildAllClassesSelection())
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
                    Este selector aplica por defecto a todos los días; debajo puedes ajustar clases por día.
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
                  <div className="pt-2 border-t border-black/10 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#1A0A1A]">
                      Clases por día (ajuste fino)
                    </div>
                    <p className="text-[9px] text-neutral-600 font-medium leading-relaxed">
                      Marca exactamente qué clases quieres generar en cada día.
                    </p>
                    <div className="space-y-2">
                      {EXCEL_DAY_ORDER.map((d) => (
                        <div key={d} className="rounded-xl border border-black/10 bg-neutral-50/70 p-2">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-[#1A0A1A] mb-1.5">
                            {d}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {EVO_SESSION_CLASS_DEFS.map(({ key, label }) => (
                              <label
                                key={`${d}-${key}`}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-bold cursor-pointer select-none transition-colors ${
                                  dayClassPicker?.[d]?.[key]
                                    ? 'border-evo-accent/40 bg-white text-[#1A0A1A]'
                                    : 'border-black/10 bg-gray-50 text-neutral-500'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={!!dayClassPicker?.[d]?.[key]}
                                  onChange={() =>
                                    setDayClassPicker((prev) => ({
                                      ...prev,
                                      [d]: { ...(prev[d] || {}), [key]: !prev?.[d]?.[key] },
                                    }))
                                  }
                                  className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                                />
                                {label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
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

              {activePublishedWeek?.data && (
                <div className="border border-indigo-200 rounded-2xl bg-indigo-50/60 px-5 py-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-800">
                      Semana activa en Supabase detectada
                    </p>
                    <p className="text-[10px] text-indigo-900 font-semibold mt-1">
                      {activePublishedWeek.mesociclo || '—'} · S{activePublishedWeek.semana || '—'} · {activePublishedWeek.titulo || 'Sin título'}
                    </p>
                    <p className="text-[9px] text-indigo-700/90 mt-1">
                      {weekState.mesocycle
                        ? 'Puedes abrirla y editarla aunque ahora tengas otro mesociclo seleccionado en el panel.'
                        : 'Puedes abrirla y editarla sin configurar mesociclo en el panel izquierdo.'}
                    </p>
                    {weekState.mesocycle &&
                    activePublishedWeek.mesociclo &&
                    activePublishedWeek.mesociclo !== weekState.mesocycle ? (
                      <p className="text-[9px] text-indigo-700/90 mt-1">
                        Al abrirla, el modal sincronizará automáticamente semana y mesociclo para que puedas guardar cambios en esa publicada.
                      </p>
                    ) : null}
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
                      <span className="text-[9px] bg-evo-accent/10 text-evo-accent px-2 py-0.5 rounded-full font-bold">{history.length} VERSIONES</span>
                    </div>
                    <span className="text-neutral-600 text-xs">{showHistory ? '▲' : '▼'}</span>
                  </button>
                  {showHistory && (
                    <div className="animate-fade-in">
                      <div className="divide-y divide-black/5">
                        {history.map((entry) => (
                          <div key={entry.entryId || `${entry.semana}-${entry.savedAt}`} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-gray-50/30 transition-all">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-bold text-[#1A0A1A] uppercase tracking-tight">Semana {entry.semana} — {entry.titulo || 'Sin título'}</p>
                              {entry.resumen && (
                                <p className="text-[9px] text-neutral-600 font-medium mt-1">
                                  {entry.resumen.estimulo} · {entry.resumen.foco}
                                </p>
                              )}
                              <p className="text-[9px] text-neutral-500 mt-1">
                                {new Date(entry.savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
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
                                  deleteWeekFromHistory(weekState.mesocycle, entry.semana, entry.entryId || null)
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
              {weekQuality && (
                <div className={`rounded-xl border px-3 py-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide ${
                  weekQuality.hasBlocking
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : weekQuality.score < 7.5
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                  <span
                    title="El score usa la severidad máxima por día entre columnas activas; R/O/A son recuentos por celda en el panel."
                  >
                    Score calidad: {weekQuality.score}/10
                  </span>
                  <span>· rojos: {weekQuality.redCount}</span>
                  <span>· naranjas: {weekQuality.orangeCount}</span>
                  <span>· amarillos: {weekQuality.yellowCount}</span>
                  {typeof weekQuality.scoreDaysRed === 'number' ? (
                    <span
                      className="font-semibold normal-case max-w-full"
                      title="Para el número del score: un solo aviso por día y columna (peor caso entre clases ese día)."
                    >
                      · días (peor caso/día): {weekQuality.scoreDaysRed} rojo
                      {typeof weekQuality.scoreDaysOrange === 'number'
                        ? ` · ${weekQuality.scoreDaysOrange} naranja`
                        : ''}
                      {typeof weekQuality.scoreDaysYellow === 'number'
                        ? ` · ${weekQuality.scoreDaysYellow} amarillo`
                        : ''}
                    </span>
                  ) : null}
                  {weekQuality.hasBlocking ? <span>· requiere edición focalizada</span> : null}
                </div>
              )}
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
                      <div key={`pv-${entry.entryId || `${entry.semana}-${entry.savedAt}`}`} className="px-4 py-2.5 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold text-[#1A0A1A] uppercase">S{entry.semana} — {entry.titulo || 'Sin título'}</p>
                          <p className="text-[9px] text-neutral-500 mt-0.5">
                            {new Date(entry.savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
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
                              deleteWeekFromHistory(weekState.mesocycle, entry.semana, entry.entryId || null)
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
                    Vista semanal completa: pincha cualquier bloque (día + clase) para editarlo en grande abajo.
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-widest">
                        Semana completa (clic para editar bloque)
                      </span>
                      <span className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">
                        {weekData?.dias?.[editFocusDayIdx]?.nombre || `Día ${editFocusDayIdx + 1}`} ·{' '}
                        {EDIT_SESSION_FIELDS.find((f) => f.key === editFocusClassKey)?.label || editFocusClassKey}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-black/10 bg-white px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        <input
                          type="checkbox"
                          checked={weekGridSummaryMode}
                          onChange={(e) => setWeekGridSummaryMode(e.target.checked)}
                          className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                        />
                        Resumen principal (A/B/C)
                      </label>
                      <label className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                        Ancho columnas
                        <input
                          type="range"
                          min={150}
                          max={320}
                          step={10}
                          value={weekGridColWidth}
                          onChange={(e) => setWeekGridColWidth(Number(e.target.value) || 190)}
                          className="accent-[#A729AD]"
                        />
                        <span className="tabular-nums text-[10px] text-[#1A0A1A]">{weekGridColWidth}px</span>
                      </label>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-black/10 bg-white">
                      <div className="min-w-[980px]">
                        <div
                          className="grid border-b border-black/10 bg-gray-50"
                          style={{ gridTemplateColumns: `120px repeat(${EDIT_SESSION_FIELDS.length}, minmax(${weekGridColWidth}px, 1fr))` }}
                        >
                          <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                            Día
                          </div>
                          {EDIT_SESSION_FIELDS.map(({ key, label, color }) => (
                            <div key={`hdr-${key}`} className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color }}>
                              {label}
                            </div>
                          ))}
                        </div>
                        {(weekData.dias || []).map((d, dayIdx) => (
                          <div
                            key={`row-${d.nombre || dayIdx}`}
                            className="grid border-b border-black/5 last:border-b-0"
                            style={{ gridTemplateColumns: `120px repeat(${EDIT_SESSION_FIELDS.length}, minmax(${weekGridColWidth}px, 1fr))` }}
                          >
                            <div className="px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-[#1A0A1A] bg-gray-50/60">
                              {d.nombre || `Día ${dayIdx + 1}`}
                            </div>
                            {EDIT_SESSION_FIELDS.map(({ key, color }) => {
                              const active = editFocusDayIdx === dayIdx && editFocusClassKey === key
                              const text = String(d?.[key] || '').trim()
                              const isEmpty = !text || /^\(no programada esta semana\)$/i.test(text)
                              return (
                                <button
                                  key={`cell-${dayIdx}-${key}`}
                                  type="button"
                                  onClick={() => {
                                    setEditFocusDayIdx(dayIdx)
                                    setEditFocusClassKey(key)
                                  }}
                                  className={`text-left px-2 py-2 min-h-[58px] border-l border-black/5 transition-colors ${
                                    active ? 'bg-evo-accent/10 ring-1 ring-inset ring-evo-accent/40' : 'bg-white hover:bg-evo-accent/5'
                                  }`}
                                >
                                  <p className={`text-[10px] leading-snug ${isEmpty ? 'text-neutral-400 italic' : 'text-[#1A0A1A]'}`}>
                                    {isEmpty
                                      ? 'Sin sesión'
                                      : weekGridSummaryMode
                                        ? buildSessionGridQuickSummary(text) || text.slice(0, 78)
                                        : text.slice(0, 180)}
                                  </p>
                                  {active ? (
                                    <p className="text-[9px] font-bold uppercase tracking-widest mt-1" style={{ color }}>
                                      Editando
                                    </p>
                                  ) : null}
                                </button>
                              )
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
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

                        {EDIT_SESSION_FIELDS
                          .filter(({ key }) => key === editFocusClassKey)
                          .map(({ key, label, color, feedbackKey }) => {
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
                          {EVO_SESSION_CLASS_DEFS
                            .filter(({ key }) => key === editFocusClassKey)
                            .map(({ key: sessionKey, feedbackKey, label }) => {
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
                                    placeholder="Briefing Marian (~40–70 palabras): foco; línea - con org | pista calent/explicación corta; ⚠️; ⏱ solo si crítico; ✅ tarea…"
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
                <input
                  ref={excelImportInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleImportExcelChange}
                />
                <button
                  type="button"
                  title="Solo el Excel descargado desde aquí (mismo orden de columnas). Recupera ediciones hechas en Excel al JSON del modal."
                  onClick={() => excelImportInputRef.current?.click()}
                  disabled={importingExcel || !weekData}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-violet-200 bg-violet-50/90 hover:bg-violet-100 disabled:opacity-50 text-violet-900 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                >
                  {importingExcel ? 'Importando…' : 'Importar Excel'}
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
