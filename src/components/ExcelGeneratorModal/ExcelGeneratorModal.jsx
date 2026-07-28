import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import {
  SYSTEM_PROMPT_EXCEL,
  SYSTEM_PROMPT_REGENERATE_FEEDBACK,
  EXCEL_GENERATION_FIRST_PASS_PUBLISHABLE,
  EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK,
} from '../../constants/systemPromptExcel.js'
import { SYSTEM_PROMPT_DAY_EDIT } from '../../constants/systemPromptDayEdit.js'
import { generateWeekExcel, buildWeekExcelBuffer } from '../../utils/generateExcel.js'
import { importProgramingEvoWeekFromXlsxBuffer } from '../../utils/importProgramingEvoWeekXlsx.js'
import {
  saveWeekToHistory,
  getHistoryForMesocycle,
  deleteWeekFromHistory,
  getAllMesocycleSummaries,
} from '../../hooks/useWeekHistory.js'
import {
  getActiveWeek,
  getPublishedWeekVersionsByIds,
  getCoachExerciseLibrary,
  getPublishedWeekDraftByMesocycleAndWeek,
  getPublishedWeekByMesocycleAndWeek,
  listPublishedWeekVersionsForMesocycle,
  listPublishedWeeksForMesocycle,
  upsertMissingExerciseVideos,
  listMissingExerciseVideos,
  updateMissingExerciseVideo,
  upsertPublishedWeekBySlot,
  publicationAdminSecret,
  supabase,
} from '../../lib/supabase.js'
import { buildGeneratorLibraryBlock } from '../../utils/buildGeneratorLibraryContext.js'
import { withTimeout } from '../../utils/withTimeout.js'
import { yieldToUi } from '../../utils/yieldToUi.js'
import { fetchLibraryAutoVideoMap } from '../../utils/fetchLibraryAutoVideoMap.js'
import {
  buildWeekSkeleton,
  mergeGeneratedDaysIntoAccumulator,
  applyPreservedFromOverlay,
  resolveDaysToGenerateFromSelection,
  resolveExplicitHolidayDays,
  EXCEL_DAY_ORDER,
} from '../../utils/excelGenerationPlan.js'
import { buildWeekWodBusterPaste } from '../../utils/formatWodBusterPaste.js'
import { buildMethodPromptAppendix } from '../../utils/methodPrompt.js'
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
import { EVO_WEEK_RESPONSE_FORMAT } from '../../constants/evoWeekOutputSchema.js'
import { EVO_BUILD_ID } from '../../constants/evoBuildId.js'
import { buildWeekContext } from '../../utils/buildWeekContext.js'
import { buildExcelDayContextSynthesis, excelCanonDayToTargetDay } from '../../utils/buildExcelDayContextSynthesis.js'
import { extractMainExerciseFromBlockB } from '../../utils/sessionBlockB.js'
import {
  buildWeekSessionClassReview,
  formatReviewHintsForGenerationPrompt,
  summarizeWeekQuality,
} from '../../utils/weekSessionReview.js'
import { buildMesocycleProgrammingBlock } from '../../constants/mesocycleGenerationBlocks.js'
import { validateEvoWeek } from '../../domain/method/validators/validateEvoWeek.js'
import {
  attachEvoMethodMetadata,
  buildEvoBasicsRotationContext,
} from '../../domain/method/evoBasicsSkills.js'
import { sanitizeCoachFeedbackText } from '../../utils/coachFeedbackText.js'
import {
  normalizeWeekDataForEditor,
  weekHasMeaningfulSessionContent,
} from '../../utils/normalizeWeekDataForEditor.js'
import {
  assertPublicationGateApproved,
  buildPublicationQualityGate,
  buildPublicationTargetFingerprint,
  hashPublicationValue,
  publicationGateIsApproved,
} from '../../utils/publicationQualityGate.js'
import {
  buildCurrentWeeklyOfferSelection,
  getSelectedClassKeysForDay,
  parseWeeklyOfferSelection,
  serializeWeeklyOfferSelection,
  weeklyOfferSelectionFromWeekData,
  weeklyOfferSelectionToValidationOffer,
} from '../../utils/weeklyOffer.js'
import { extractWeeklyArchitectureBlock } from '../../utils/weeklyArchitecturePlan.js'
import { METHOD_EVO_V1_LABEL } from '../../domain/method/methodEvoV1.js'
import {
  addProgrammingDays,
  normalizeProgrammingDate,
  selectProgrammingContextWeeks,
} from '../../utils/programmingContextSelection.js'
import {
  assertGenerationRequestStillCurrent,
  buildGenerationRequestFingerprint,
  StaleGenerationResponseError,
} from '../../utils/generationRequestFingerprint.js'
import { weekInstructionsStorageKey } from '../../utils/weekInstructionsStorage.js'
import {
  editorOpenTargetMatchesWeekState,
  publishedWeekMatchesExactTarget,
  resolvePendingEditorOpen,
  resolveEditorOpenTarget,
} from '../../utils/weekEditorOpenTarget.js'
import {
  publicationMutationSnapshotIsCurrent,
  publicationMutationTargetIsCurrent,
} from '../../utils/publicationMutationSnapshot.js'

/** Techo de salida por POST (1 día; bajar reduce coste sin cortar un día completo). */
const EXCEL_GENERATION_MAX_TOKENS_PER_CALL = 5500
/** Briefing en el mensaje de usuario (NO en weekContext→system: duplicaba ~30k y cortaba la conexión). */
const EXCEL_GENERATION_PACK_MAX_CHARS = 14_000
/** Tope del bloque «días ya generados» en el user (extracto compacto, no JSON completo). */
const EXCEL_COHERENCE_JSON_MAX_CHARS = 22_000
/** Ejercicios listados en biblioteca dentro del system (el resto sigue en Supabase). */
const EXCEL_LIBRARY_MAX_EXERCISES_IN_PROMPT = 60
/** Tiempo máximo de espera del cliente por POST a /api/anthropic (margen sobre maxDuration Vercel). */
const EXCEL_GENERATION_FETCH_TIMEOUT_MS = 310_000
/** Tiempo máximo cargando datos de Supabase antes de generar. */
const EXCEL_GENERATION_PREP_TIMEOUT_MS = 45_000
/** El briefing usa un modelo ligero y debe terminar antes del corte servidor (75 s). */
const BRIEFING_CLIENT_TIMEOUT_MS = 85_000
/** Lectura exacta de las semanas elegidas por el briefing. */
const BRIEFING_CONTEXT_TIMEOUT_MS = 20_000
/** Tiempo máximo montando el prompt en el navegador antes de pasar a la IA. */
const EXCEL_GENERATION_PROMPT_PREP_TIMEOUT_MS = 35_000
/** Narrativa de propuesta incluida en el prompt (evita bloqueos con textos enormes). */
const EXCEL_GENERATION_NARRATIVE_MAX_CHARS = 6000

const ADDENDUM_MAX_CHARS = 3000
/** Pasadas de auto-corrección heurística (cada una = otra llamada Sonnet/Haiku). */
const QA_AUTO_FIX_MAX_PASSES = 2
const QA_TARGET_SCORE = 8.2

function formatGenElapsed(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

function buildGenerationDaySelectionFromOffer(offerSelection) {
  return Object.fromEntries(
    EXCEL_DAY_ORDER.map((day) => [day, getSelectedClassKeysForDay(offerSelection, day).length > 0]),
  )
}

function getGenerationDays(daySelection, offerSelection) {
  return EXCEL_DAY_ORDER.filter(
    (day) => !!daySelection?.[day] && getSelectedClassKeysForDay(offerSelection, day).length > 0,
  )
}

function planningInputFingerprint({ addendum, generationDays, offerSelection, target }) {
  return JSON.stringify({
    instructions: String(addendum || '').trim(),
    generationDays: [...generationDays],
    weeklyOffer: serializeWeeklyOfferSelection(offerSelection),
    target,
  })
}

function readStoredWeekInstructions(weekState) {
  try {
    return localStorage.getItem(weekInstructionsStorageKey(weekState)) || ''
  } catch {
    return ''
  }
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

/** System base para generación Excel: sin ejemplos Drive ni referencia (van en briefing/propuesta). */
function buildLeanSystemExcelForGeneration(systemFull) {
  let s = String(systemFull || '')
  const cutAt = (marker) => {
    const i = s.indexOf(marker)
    if (i >= 0) s = s.slice(0, i)
  }
  cutAt('\n\nEJEMPLOS REALES DE ESTILO EVO')
  cutAt('\n\n════════════════════════════════════════\nCONTEXTO DE REFERENCIA (OTROS MESOCICLOS')
  cutAt('\n\nREGLAS INFERIDAS DESDE REFERENCIA')
  return s.trimEnd()
}

/** System más ligero en días 2+ de la misma generación (no repetir briefing/ejemplos enteros). */
function buildExcelSystemForGenerationCall(systemFull, generationCallIndex, retryAttempt) {
  let s = String(systemFull || '')
  if (generationCallIndex >= 1 || retryAttempt >= 1) {
    const cutAt = (marker) => {
      const i = s.indexOf(marker)
      if (i >= 0) s = s.slice(0, i)
    }
    cutAt('\n\nEJEMPLOS REALES DE ESTILO EVO')
    cutAt('\n\n════════════════════════════════════════\nCONTEXTO DE REFERENCIA (OTROS MESOCICLOS')
    cutAt('\n\nREGLAS INFERIDAS DESDE REFERENCIA')
    if (generationCallIndex >= 1) {
      s +=
        '\n\n[Generación en curso: ejemplos Drive y contexto de referencia omitidos en esta llamada para reducir tokens; reglas del system base siguen vigentes.]'
    }
  }
  if (generationCallIndex >= 2 || retryAttempt >= 2) {
    const cutAt = (marker) => {
      const i = s.indexOf(marker)
      if (i >= 0) s = s.slice(0, i)
    }
    cutAt('\n\n════════════════════════════════════════\nBIBLIOTECA OFICIAL DE EJERCICIOS EVO')
    if (generationCallIndex >= 2) {
      s += '\n\n[Biblioteca completa omitida en esta llamada; usa nombres ya vistos en días anteriores de esta semana.]'
    }
  }
  return trimExcelSystemForAnthropicRetry(s, retryAttempt)
}

/** Briefing Supabase solo en la primera llamada; el resto confía en coherencia del user. */
function buildWeekContextForGenerationCall(weekContextFull, generationCallIndex) {
  const t = String(weekContextFull || '').trim()
  if (!t) return ''
  if (generationCallIndex === 0) return t
  return (
    'CONTEXTO DE BRIEFING: ya enviado en la primera llamada de esta generación (no se repite para ahorrar tokens). ' +
    'Usa el bloque CONTEXTO YA GENERADO del mensaje de usuario y las reglas del system.'
  )
}

/** Extracto legible de la semana parcial (mucho más barato que JSON completo). */
function buildCompactAccumulatorCoherence(acc) {
  const lines = []
  if (acc?.titulo) lines.push(`titulo: ${acc.titulo}`)
  const r = acc?.resumen
  if (r && typeof r === 'object') {
    lines.push(
      `resumen: estimulo=${r.estimulo || '—'}; intensidad=${r.intensidad || '—'}; foco=${sliceText(r.foco, 200)}`,
    )
  }
  for (const d of acc?.dias || []) {
    const bits = []
    for (const { key, label, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
      const t = String(d[key] || '').trim()
      if (t && !/no programada esta semana/i.test(t) && !/^FESTIVO\b/i.test(t)) {
        bits.push(`${label}:${t.replace(/\s+/g, ' ').slice(0, 200)}`)
      }
      const fb = String(d[feedbackKey] || '').trim()
      if (fb) bits.push(`${label} FB:${fb.replace(/\s+/g, ' ').slice(0, 100)}`)
    }
    if (bits.length) lines.push(`${d.nombre || 'DÍA'}: ${bits.join(' | ')}`)
  }
  let s = lines.join('\n')
  if (s.length > EXCEL_COHERENCE_JSON_MAX_CHARS) {
    s = `${s.slice(0, EXCEL_COHERENCE_JSON_MAX_CHARS).trimEnd()}…`
  }
  return s
}

const COMODIN_EXERCISES = [
  { label: 'Goblet Squat', re: /goblet/i },
  { label: 'Box Step-up / Step-up', re: /step[\s-]?up/i },
  { label: 'Dead Bug', re: /dead[\s-]?bug/i },
  { label: 'Hollow Rock / Hollow Hold', re: /hollow/i },
  { label: 'Face Pull', re: /face[\s-]?pull/i },
  { label: 'Hip Thrust', re: /hip[\s-]?thrust/i },
  { label: 'Glute Bridge', re: /glute[\s-]?bridge/i },
]

function buildUsedExercisesTrackerBlock(acc) {
  // Para cada ejercicio comodín, busca en qué días y clases ya aparece
  const results = []
  for (const { label, re } of COMODIN_EXERCISES) {
    const appearances = []
    for (const dia of acc?.dias || []) {
      const dayName = dia?.nombre || '—'
      for (const { key, label: classLabel } of EVO_SESSION_CLASS_DEFS) {
        const text = String(dia[key] || '').trim()
        if (!text || /no programada esta semana/i.test(text)) continue
        // Contar cuántas veces aparece en este campo
        const matches = text.match(new RegExp(re.source, 'gi'))
        if (matches && matches.length > 0) {
          appearances.push(`${dayName} ${classLabel}`)
        }
      }
    }
    if (appearances.length > 0) {
      const remaining = Math.max(0, 2 - appearances.length)
      const status = remaining === 0 ? '→ PROHIBIDO — ya alcanzó el máximo de 2' : `→ ${remaining} aparición(es) más permitida(s) esta semana`
      results.push(`- ${label}: ${appearances.length}/2 ya usado (${appearances.join(', ')}) ${status}`)
    }
  }
  if (!results.length) return ''
  return `EJERCICIOS COMODÍN — CONTROL DE FRECUENCIA SEMANAL (máx. 2 por semana en total):\n${results.join('\n')}\nEsta lista es vinculante: si un ejercicio marca PROHIBIDO, no puede aparecer en los días que generas ahora, ni en calentamiento ni en WOD ni en accesorios.`
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

async function postJsonWithRetry(
  url,
  payload,
  retries = 2,
  {
    timeoutMs = BRIEFING_CLIENT_TIMEOUT_MS,
    timeoutMessage = 'La petición tardó demasiado en responder. Vuelve a intentarlo.',
  } = {},
) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    let didTimeout = false
    const timeoutId = setTimeout(() => {
      didTimeout = true
      controller.abort()
    }, timeoutMs)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
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
      const requestError = didTimeout ? new Error(timeoutMessage) : e
      if (attempt < retries) {
        const waitMs = (attempt + 1) * 2500
        await new Promise((r) => setTimeout(r, waitMs))
        continue
      }
      throw requestError
    } finally {
      clearTimeout(timeoutId)
    }
  }
  throw new Error('No se pudo completar la petición tras varios intentos.')
}

async function fetchServerReferenceContext() {
  const secret = publicationAdminSecret()
  if (!secret) return ''
  try {
    const res = await fetch('/api/programming-reference-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get', secret }),
    })
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
  /** Briefing conversacional: solo arranca cuando Marian confirma días y contexto. */
  const [briefingStatus, setBriefingStatus] = useState('idle') // idle | loading | ready | error
  const [briefingPhase, setBriefingPhase] = useState('idle') // idle | context | proposal | verify
  const [briefingElapsedSec, setBriefingElapsedSec] = useState(0)
  const [briefingErrorMsg, setBriefingErrorMsg] = useState('')
  const [briefingErrorCode, setBriefingErrorCode] = useState('')
  const [briefingAdminSecretInput, setBriefingAdminSecretInput] = useState('')
  const [briefingAuthBusy, setBriefingAuthBusy] = useState(false)
  const [briefingContextPack, setBriefingContextPack] = useState('')
  const [briefingApiMessages, setBriefingApiMessages] = useState([])
  const [briefingInputFingerprint, setBriefingInputFingerprint] = useState('')
  const briefingRunRef = useRef(0)
  const currentPlanningFingerprintRef = useRef('')
  /** IDs exactos elegidos por el briefing; evita mezclar feedback de otras semanas. */
  const briefingContextSelectionRef = useRef(null)
  const [publicationProgressionWeeks, setPublicationProgressionWeeks] = useState([])
  const [publicationContextVerified, setPublicationContextVerified] = useState(false)
  const [proposalTitle, setProposalTitle] = useState('')
  const [proposalNarrative, setProposalNarrative] = useState('')
  const [proposalSuggestedFocus, setProposalSuggestedFocus] = useState('')
  /** review | refine | addons */
  const [proposalStep, setProposalStep] = useState('review')
  const [proposalAccepted, setProposalAccepted] = useState(false)
  const [addendum, setAddendum] = useState(() => readStoredWeekInstructions(weekState))
  const addendumStorageKey = weekInstructionsStorageKey(weekState)
  const addendumStorageKeyRef = useRef(addendumStorageKey)
  const [refineDraft, setRefineDraft] = useState('')
  const [refineBusy, setRefineBusy] = useState(false)

  const [status, setStatus]     = useState('idle')
  const [genStep, setGenStep]   = useState('')
  const [genElapsedSec, setGenElapsedSec] = useState(0)
  const [weekData, setWeekData] = useState(null)
  // Footer: menú "Más opciones" (acciones secundarias) y evaluación de calidad (API real).
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalResult, setEvalResult] = useState(null)
  /** Huella exacta de contenido+ciclo+oferta+contexto que recibió el scoring. */
  const [evalFingerprint, setEvalFingerprint] = useState('')
  const [evalError, setEvalError] = useState('')
  const scoringRunRef = useRef(0)
  const generationRunRef = useRef(0)
  const generationFetchAbortRef = useRef(null)
  const generationActiveRef = useRef(false)
  const currentGenerationFingerprintRef = useRef('')
  const [showFullAnalysis, setShowFullAnalysis] = useState(false)
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
  const [savingHubDraft, setSavingHubDraft] = useState(false)
  const [published, setPublished]     = useState(false)
  const [editingPublishedRowId, setEditingPublishedRowId] = useState(null)
  /** Revisión CAS del borrador abierto; null significa que la fila abierta es inmutable o local. */
  const [editingDraftRevision, setEditingDraftRevision] = useState(null)
  const hasEditingDraftVersion =
    !!editingPublishedRowId &&
    editingDraftRevision != null &&
    Number.isInteger(Number(editingDraftRevision)) &&
    Number(editingDraftRevision) >= 1
  /** Versión inmutable de la que nace el borrador; nunca apunta al propio borrador mutable. */
  const [editingPublishedSourceId, setEditingPublishedSourceId] = useState(null)
  const [editingPublishedIsActive, setEditingPublishedIsActive] = useState(false)
  const [savingPublishedEdit, setSavingPublishedEdit] = useState(false)
  const [savedPublishedEdit, setSavedPublishedEdit] = useState(false)
  const [importingExcel, setImportingExcel] = useState(false)
  const publicationMutationLockRef = useRef(false)
  const excelImportInputRef = useRef(null)
  const [activePublishedWeek, setActivePublishedWeek] = useState(null)
  const [openingActiveEdit, setOpeningActiveEdit] = useState(false)
  /** Texto de sesión alineado con el feedback (solo memoria del modal). */
  const sessionFingerprintsRef = useRef(new Map())
  const [staleFeedbackKeys, setStaleFeedbackKeys] = useState(() => new Set())
  const [regeneratingFeedbackKey, setRegeneratingFeedbackKey] = useState(null)
  /**
   * Única fuente de verdad de la oferta semanal. Un día sin ninguna clase no se
   * manda a la IA; no existe un segundo selector capaz de contradecir esta parrilla.
   */
  const [dayClassPicker, setDayClassPicker] = useState(() => buildCurrentWeeklyOfferSelection())
  /** Días que se generarán en esta tanda. Independiente de las clases ofertadas. */
  const [generationDayPicker, setGenerationDayPicker] = useState(() =>
    buildGenerationDaySelectionFromOffer(buildCurrentWeeklyOfferSelection()),
  )
  /** Pestaña «Editar»: día visible (el resto de la semana en tabs, sin scroll infinito). */
  const [editFocusDayIdx, setEditFocusDayIdx] = useState(0)
  /** Clase enfocada en pestaña Editar (bloque activo de la parrilla semanal). */
  const [editFocusClassKey, setEditFocusClassKey] = useState(EDIT_SESSION_FIELDS[0]?.key || 'evofuncional')
  /** Borradores de instrucciones para «IA · este día» (por índice de día). */
  const [dayAiDraftByIdx, setDayAiDraftByIdx] = useState({})
  const [dayEditAiBusy, setDayEditAiBusy] = useState(false)
  const dayEditRunRef = useRef(0)
  const feedbackRunRef = useRef(0)
  const weekEditRevisionRef = useRef(0)
  const editorTargetIdentityRef = useRef('')
  const [regenDayFeedbacksAfterAi, setRegenDayFeedbacksAfterAi] = useState(false)
  /** Evita escrituras repetidas al historial local si el JSON no cambió. */
  const lastPersistedDraftRef = useRef('')
  /** Apertura que espera a que App cambie al ciclo/semana exactos antes de hidratar el editor. */
  const pendingEditorOpenRef = useRef(null)
  /** Aviso breve: borrador / guardado manual en localStorage. */
  const [draftNotice, setDraftNotice] = useState('')
  /** Resumen de última importación Excel automática. */
  const [lastImportReport, setLastImportReport] = useState(null)
  const [missingVideoRows, setMissingVideoRows] = useState([])
  const [missingVideoBusyId, setMissingVideoBusyId] = useState(null)
  const [weekGridSummaryMode, setWeekGridSummaryMode] = useState(true)
  const [weekGridColWidth, setWeekGridColWidth] = useState(190)
  const currentPublicationFingerprintRef = useRef('')
  const publicationMutationBusy =
    publishing || savingHubDraft || savingPublishedEdit || importingExcel

  const selectedClassKeysForReview = useMemo(() => {
    const out = new Set()
    for (const d of EXCEL_DAY_ORDER) {
      for (const { key } of EVO_SESSION_CLASS_DEFS) {
        if (dayClassPicker?.[d]?.[key]) out.add(key)
      }
    }
    return [...out]
  }, [dayClassPicker])

  const selectedGenerationDays = useMemo(
    () => getGenerationDays(generationDayPicker, dayClassPicker),
    [generationDayPicker, dayClassPicker],
  )

  const selectedGenerationDayCount = selectedGenerationDays.length
  const targetCycleStartDate = normalizeProgrammingDate(weekState.cycleStartDate)
  const targetWeekStartDate =
    targetCycleStartDate && Number(weekState.week) > 0
      ? addProgrammingDays(targetCycleStartDate, (Number(weekState.week) - 1) * 7)
      : ''
  const targetCycleId =
    String(weekState.cycleId || '').trim() ||
    (targetCycleStartDate && weekState.mesocycle
      ? `${weekState.mesocycle}:${targetCycleStartDate}`
      : '')
  const exactLocalHistoryOptions = useMemo(
    () => ({
      cycleId: targetCycleId,
      cycleStartDate: targetCycleStartDate,
    }),
    [targetCycleId, targetCycleStartDate],
  )
  const readExactLocalHistory = useCallback(
    () =>
      getHistoryForMesocycle(
        weekState.mesocycle,
        exactLocalHistoryOptions,
      ),
    [exactLocalHistoryOptions, weekState.mesocycle],
  )
  const attachExactCycleIdentity = useCallback(
    (source, targetWeek = weekState.week) => {
      const data = source && typeof source === 'object' ? { ...source } : source
      if (!data || typeof data !== 'object') return data
      const weekNumber = Number(targetWeek || data.semana || 0)
      const mesocycle = String(
        weekState.mesocycle || data.mesociclo || '',
      ).trim()
      const cycleStartDate =
        targetCycleStartDate ||
        normalizeProgrammingDate(data.cycle_start_date || data.cycleStartDate)
      const cycleId =
        cycleStartDate && mesocycle
          ? `${mesocycle}:${cycleStartDate}`
          : String(data.cycle_id || data.cycleId || targetCycleId || '').trim()
      const weekStartDate =
        cycleStartDate && Number.isInteger(weekNumber) && weekNumber > 0
          ? addProgrammingDays(cycleStartDate, (weekNumber - 1) * 7)
          : normalizeProgrammingDate(data.week_start_date || data.weekStartDate)
      return {
        ...data,
        mesociclo: mesocycle || data.mesociclo,
        semana: weekNumber || data.semana,
        cycle_id: cycleId || null,
        cycle_start_date: cycleStartDate || null,
        week_start_date: weekStartDate || null,
      }
    },
    [
      targetCycleId,
      targetCycleStartDate,
      weekState.mesocycle,
      weekState.week,
    ],
  )

  const currentPlanningInputFingerprint = useMemo(
    () =>
      planningInputFingerprint({
        addendum,
        generationDays: selectedGenerationDays,
        offerSelection: dayClassPicker,
        target: {
          mesocycle: weekState.mesocycle,
          week: Number(weekState.week),
          phase: weekState.phase || '',
          cycleId: targetCycleId,
          cycleStartDate: targetCycleStartDate,
          weekStartDate: targetWeekStartDate,
        },
      }),
    [
      addendum,
      dayClassPicker,
      selectedGenerationDays,
      targetCycleId,
      targetCycleStartDate,
      targetWeekStartDate,
      weekState.mesocycle,
      weekState.phase,
      weekState.week,
    ],
  )

  const currentGenerationRequestFingerprint = useMemo(
    () =>
      buildGenerationRequestFingerprint({
        mesocycle: weekState.mesocycle,
        week: weekState.week,
        phase: weekState.phase || '',
        targetWeekStartDate,
        generationDays: selectedGenerationDays,
        weeklyOffer: serializeWeeklyOfferSelection(dayClassPicker),
        instructions: addendum,
        selectedContextWeekIds: briefingContextSelectionRef.current?.selectedWeekIds || [],
        contextRevision: hashPublicationValue({
          briefingInputFingerprint,
          briefingContextPack,
          proposalTitle,
          proposalNarrative,
          proposalSuggestedFocus,
          proposalAccepted,
        }),
        weeklyArchitecture: extractWeeklyArchitectureBlock(briefingContextPack),
        completedDays: hashPublicationValue(weekData || null),
      }),
    [
      addendum,
      briefingContextPack,
      briefingInputFingerprint,
      dayClassPicker,
      proposalAccepted,
      proposalNarrative,
      proposalSuggestedFocus,
      proposalTitle,
      selectedGenerationDays,
      targetWeekStartDate,
      weekData,
      weekState.mesocycle,
      weekState.phase,
      weekState.week,
    ],
  )

  useEffect(() => {
    if (
      currentPlanningFingerprintRef.current &&
      currentPlanningFingerprintRef.current !== currentPlanningInputFingerprint
    ) {
      briefingRunRef.current += 1
      setBriefingStatus((current) => (current === 'loading' ? 'idle' : current))
    }
    currentPlanningFingerprintRef.current = currentPlanningInputFingerprint
  }, [currentPlanningInputFingerprint])

  useEffect(() => {
    if (generationActiveRef.current) return
    if (
      currentGenerationFingerprintRef.current &&
      currentGenerationFingerprintRef.current !== currentGenerationRequestFingerprint
    ) {
      generationRunRef.current += 1
      setStatus((current) => (current === 'generating' ? 'idle' : current))
      setGenStep('')
    }
    currentGenerationFingerprintRef.current = currentGenerationRequestFingerprint
  }, [currentGenerationRequestFingerprint])

  useEffect(() => {
    if (briefingStatus !== 'loading') {
      setBriefingElapsedSec(0)
      return undefined
    }
    const started = Date.now()
    setBriefingElapsedSec(0)
    const id = window.setInterval(() => {
      setBriefingElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [briefingStatus])

  useEffect(() => {
    if (status !== 'generating') {
      setGenElapsedSec(0)
      return undefined
    }
    const started = Date.now()
    setGenElapsedSec(0)
    const id = window.setInterval(() => {
      setGenElapsedSec(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [status])

  const briefingIsStale =
    briefingStatus === 'ready' &&
    !!briefingInputFingerprint &&
    briefingInputFingerprint !== currentPlanningInputFingerprint

  const weekQuality = useMemo(() => {
    if (!weekData?.dias) return null
    return summarizeWeekQuality(
      weekData.dias,
      selectedClassKeysForReview,
      String(weekData?.resumen?.foco || ''),
    )
  }, [weekData, selectedClassKeysForReview])

  const authorizedHolidayDays = useMemo(
    () =>
      new Set(
        (Array.isArray(weekData?.authorized_holiday_days)
          ? weekData.authorized_holiday_days
          : []
        ).map((day) => String(day || '').trim().toUpperCase()),
      ),
    [weekData?.authorized_holiday_days],
  )

  const methodReview = useMemo(() => {
    if (!weekData?.dias) return null
    const withMetadata = attachEvoMethodMetadata(weekData)
    return validateEvoWeek(withMetadata, {
      offer: weeklyOfferSelectionToValidationOffer(dayClassPicker),
      previousWeeks: publicationProgressionWeeks,
      allowFestivo: false,
      allowedHolidayDays: authorizedHolidayDays,
    })
  }, [authorizedHolidayDays, weekData, dayClassPicker, publicationProgressionWeeks])

  // Nº de días con contenido real generado (para habilitar «Evaluar semana»).
  const generatedDaysCount = useMemo(() => {
    if (!Array.isArray(weekData?.dias)) return 0
    return weekData.dias.filter((dia) =>
      EVO_SESSION_CLASS_DEFS.some(({ key }) => {
        const t = String(dia?.[key] || '').trim()
        return t && !/no programada esta semana/i.test(t) && !/^FESTIVO\b/i.test(t)
      }),
    ).length
  }, [weekData])

  const pendingOfferedDays = useMemo(() => {
    if (!Array.isArray(weekData?.dias)) return []
    return EXCEL_DAY_ORDER.filter((day) => {
      const classKeys = getSelectedClassKeysForDay(dayClassPicker, day)
      if (!classKeys.length) return false
      const row = weekData.dias.find(
        (candidate) => String(candidate?.nombre || '').trim().toUpperCase() === day,
      )
      return classKeys.some((key) => {
        const text = String(row?.[key] || '').trim()
        if (/^FESTIVO$/i.test(text) && authorizedHolidayDays.has(day)) return false
        return !text || /no programada esta semana/i.test(text) || /^FESTIVO$/i.test(text)
      })
    })
  }, [authorizedHolidayDays, weekData, dayClassPicker])

  const publicationContextFingerprint = useMemo(
    () =>
      hashPublicationValue({
        briefingInputFingerprint: briefingInputFingerprint || currentPlanningInputFingerprint,
        briefingContextPack: String(briefingContextPack || ''),
        proposal: {
          title: proposalTitle,
          narrative: proposalNarrative,
          suggestedFocus: proposalSuggestedFocus,
          accepted: proposalAccepted,
        },
      }),
    [
      briefingContextPack,
      briefingInputFingerprint,
      currentPlanningInputFingerprint,
      proposalAccepted,
      proposalNarrative,
      proposalSuggestedFocus,
      proposalTitle,
    ],
  )

  function preparePublicationCandidate(sourceData = weekData) {
    if (!sourceData || typeof sourceData !== 'object') return null
    let data = { ...sourceData }
    data.titulo = String(editTitle || data.titulo || '').trim() || data.titulo
    data = attachEvoMethodMetadata(data)
    return normalizeWeekDataForEditor(
      {
        ...data,
        mesociclo: weekState.mesocycle,
        semana: Number(weekState.week),
        cycle_id: data.cycle_id || targetCycleId || null,
        cycle_start_date: data.cycle_start_date || targetCycleStartDate || null,
        week_start_date: data.week_start_date || targetWeekStartDate || null,
        phase: data.phase || weekState.phase || null,
        publication_context: {
          version: 1,
          fingerprint: publicationContextFingerprint,
          mode: briefingContextSelectionRef.current?.mode || null,
          context_snapshot_at:
            briefingContextSelectionRef.current?.snapshotAt || null,
          progression_week_ids:
            briefingContextSelectionRef.current?.progressionWeekIds || [],
          historical_week_ids:
            briefingContextSelectionRef.current?.historicalWeekIds || [],
          selected_week_ids:
            briefingContextSelectionRef.current?.selectedWeekIds || [],
        },
      },
      {
        semana: Number(weekState.week),
        mesociclo: weekState.mesocycle,
      },
    )
  }

  const currentPublicationCandidate = useMemo(() => {
    try {
      const source = editingJson ? JSON.parse(rawJson) : weekData
      return preparePublicationCandidate(source)
    } catch {
      return null
    }
  }, [
    dayClassPicker,
    editTitle,
    editingJson,
    publicationContextFingerprint,
    rawJson,
    targetCycleId,
    targetCycleStartDate,
    targetWeekStartDate,
    weekData,
    weekState.mesocycle,
    weekState.phase,
    weekState.week,
  ])

  const currentPublicationFingerprint = useMemo(
    () =>
      currentPublicationCandidate
        ? buildPublicationTargetFingerprint({
            weekData: currentPublicationCandidate,
            mesocycle: weekState.mesocycle,
            week: weekState.week,
            phase: weekState.phase || '',
            offer: serializeWeeklyOfferSelection(dayClassPicker),
            contextFingerprint: publicationContextFingerprint,
          })
        : '',
    [
      currentPublicationCandidate,
      dayClassPicker,
      publicationContextFingerprint,
      weekState.mesocycle,
      weekState.phase,
      weekState.week,
    ],
  )

  const currentPublicationGate = useMemo(() => {
    const gateMethodReview = currentPublicationCandidate
      ? validateEvoWeek(currentPublicationCandidate, {
          offer: weeklyOfferSelectionToValidationOffer(dayClassPicker),
          previousWeeks: publicationProgressionWeeks,
          allowFestivo: false,
          allowedHolidayDays:
            currentPublicationCandidate?.authorized_holiday_days || [],
        })
      : { errors: [] }
    const methodErrors = [
      ...(gateMethodReview?.errors || []),
      ...(gateMethodReview?.warnings || []),
    ].map((entry) => {
      const day = currentPublicationCandidate?.dias?.[entry.dayIndex]?.nombre || `Día ${Number(entry.dayIndex) + 1}`
      const classLabel =
        EVO_SESSION_CLASS_DEFS.find((item) => item.key === entry.classKey)?.label || entry.classKey
      return `${day} · ${classLabel}: ${entry.message}`
    })
    return buildPublicationQualityGate({
      evaluation: evalResult,
      evaluationFingerprint: evalFingerprint,
      targetFingerprint: currentPublicationFingerprint,
      methodErrors,
      offerPendingDays: pendingOfferedDays,
      staleFeedbackKeys: [...staleFeedbackKeys],
      contextReady:
        briefingStatus === 'ready' &&
        !briefingIsStale &&
        !!briefingContextPack &&
        proposalAccepted &&
        publicationContextVerified &&
        !!targetCycleStartDate,
    })
  }, [
    briefingContextPack,
    briefingIsStale,
    briefingStatus,
    currentPublicationCandidate,
    currentPublicationFingerprint,
    evalFingerprint,
    evalResult,
    pendingOfferedDays,
    proposalAccepted,
    publicationContextVerified,
    publicationProgressionWeeks,
    staleFeedbackKeys,
    targetCycleStartDate,
  ])

  const publicationReady = publicationGateIsApproved(currentPublicationGate)
  const evaluationIsCurrent =
    !!evalFingerprint &&
    !!currentPublicationFingerprint &&
    evalFingerprint === currentPublicationFingerprint

  useEffect(() => {
    currentPublicationFingerprintRef.current = currentPublicationFingerprint
  }, [currentPublicationFingerprint])

  useEffect(() => {
    editorTargetIdentityRef.current = hashPublicationValue({
      mesocycle: weekState.mesocycle,
      week: Number(weekState.week),
      cycleId: targetCycleId,
      cycleStartDate: targetCycleStartDate,
      rowId: editingPublishedRowId,
    })
  }, [
    editingPublishedRowId,
    targetCycleId,
    targetCycleStartDate,
    weekState.mesocycle,
    weekState.week,
  ])

  useEffect(() => {
    if (addendumStorageKeyRef.current !== addendumStorageKey) {
      addendumStorageKeyRef.current = addendumStorageKey
      setAddendum(readStoredWeekInstructions(weekState))
      return
    }
    try {
      localStorage.setItem(addendumStorageKey, addendum || '')
    } catch {
      /* localStorage no disponible: no es crítico */
    }
  }, [addendum, addendumStorageKey, weekState.mesocycle, weekState.week])

  useEffect(() => {
    if (status !== 'previewing') return
    const meso = weekData?.mesociclo || weekState.mesocycle || null
    const semana = Number(weekData?.semana || weekState.week || 0) || null
    if (!meso || semana == null) return
    refreshMissingVideosPanel(meso, semana)
  }, [status, weekData?.mesociclo, weekData?.semana, weekState.mesocycle, weekState.week])

  // Cargar historial del mesociclo al abrir
  useEffect(() => {
    if (weekState.mesocycle) {
      setHistory(readExactLocalHistory())
    }
  }, [readExactLocalHistory, weekState.mesocycle])

  useEffect(() => {
    const offer = buildCurrentWeeklyOfferSelection()
    setDayClassPicker(offer)
    setGenerationDayPicker(buildGenerationDaySelectionFromOffer(offer))
    setBriefingStatus('idle')
    setBriefingErrorMsg('')
    setBriefingErrorCode('')
    setBriefingPhase('idle')
    setBriefingAdminSecretInput('')
    setBriefingAuthBusy(false)
    setBriefingContextPack('')
    setBriefingApiMessages([])
    setBriefingInputFingerprint('')
    briefingContextSelectionRef.current = null
    setPublicationProgressionWeeks([])
    setPublicationContextVerified(false)
    setProposalAccepted(false)
    setProposalStep('review')
    setRefineDraft('')
    setRefineBusy(false)
    setProposalTitle('')
    setProposalNarrative('')
    setProposalSuggestedFocus('')
    briefingRunRef.current += 1
    dayEditRunRef.current += 1
    feedbackRunRef.current += 1
    weekEditRevisionRef.current += 1
    setDayEditAiBusy(false)
    setRegeneratingFeedbackKey(null)
    scoringRunRef.current += 1
    setEvaluating(false)
    setEvalResult(null)
    setEvalFingerprint('')
    setEvalError('')
  }, [
    weekState.cycleId,
    weekState.cycleStartDate,
    weekState.mesocycle,
    weekState.phase,
    weekState.week,
  ])

  async function prepareBriefing() {
    setBriefingErrorCode('')
    if (!weekState?.mesocycle || weekState.week == null) {
      setBriefingStatus('error')
      setBriefingErrorMsg('Selecciona mesociclo y semana en el panel izquierdo.')
      return
    }
    if (!targetCycleStartDate) {
      setBriefingStatus('error')
      setBriefingErrorMsg(
        'Indica la fecha real de inicio del ciclo en el panel izquierdo para cargar el histórico correcto.',
      )
      return
    }
    if (selectedGenerationDayCount === 0) {
      setBriefingStatus('error')
      setBriefingErrorMsg('Selecciona al menos un día para diseñar.')
      return
    }
    const adminSecret = publicationAdminSecret()
    if (!adminSecret) {
      setBriefingStatus('error')
      setBriefingErrorCode('missing_admin_secret')
      setBriefingErrorMsg(
        'Falta activar la sesión de administración para cargar el contexto interno.',
      )
      return
    }

    const inputFingerprint = currentPlanningInputFingerprint
    const briefingRunId = briefingRunRef.current + 1
    briefingRunRef.current = briefingRunId
    currentPlanningFingerprintRef.current = inputFingerprint
    const instructionsSnapshot = String(addendum || '').trim().slice(0, ADDENDUM_MAX_CHARS)
    const daysSnapshot = [...selectedGenerationDays]
    const offerSnapshot = serializeWeeklyOfferSelection(dayClassPicker)

    setBriefingStatus('loading')
    setBriefingPhase('context')
    setBriefingErrorMsg('')
    setBriefingErrorCode('')
    setProposalAccepted(false)
    setProposalStep('review')
    setRefineDraft('')
    setProposalTitle('')
    setProposalNarrative('')
    setProposalSuggestedFocus('')
    try {
      const baseBriefingPayload = {
        secret: adminSecret,
        mesociclo: weekState.mesocycle,
        semana: Number(weekState.week),
        phase: weekState.phase || '',
        totalWeeks: weekState.totalWeeks ?? null,
        cycleId: targetCycleId || null,
        cycleStartDate: targetCycleStartDate || null,
        targetWeekStartDate: targetWeekStartDate || null,
        generationDays: daysSnapshot,
        weeklyOffer: offerSnapshot,
      }
      const {
        res: contextRes,
        json: contextJson,
        errorMessage: contextErrorMessage,
      } = await postJsonWithRetry(
        '/api/programming-week-briefing',
        {
          ...baseBriefingPayload,
          action: 'context',
        },
        0,
        {
          timeoutMs: 45_000,
          timeoutMessage:
            'El histórico ha tardado demasiado en cargar. La petición se ha cerrado; pulsa «Reintentar».',
        },
      )
      if (
        briefingRunRef.current !== briefingRunId ||
        currentPlanningFingerprintRef.current !== inputFingerprint
      ) {
        return
      }
      if (!contextRes.ok) {
        if (Number(contextRes.status) === 401) {
          setBriefingErrorCode('invalid_admin_secret')
          throw new Error('La clave de administración ya no es válida para esta preview.')
        }
        throw new Error(contextErrorMessage || `Error ${contextRes.status}`)
      }
      const preparedContextPack = String(contextJson.contextPack || '')
      const preparedContextSelection =
        contextJson.contextSelection && typeof contextJson.contextSelection === 'object'
          ? contextJson.contextSelection
          : null
      if (!preparedContextPack || !preparedContextSelection) {
        throw new Error('Supabase no devolvió un contexto verificable para esta semana.')
      }
      setBriefingContextPack(preparedContextPack)
      briefingContextSelectionRef.current = preparedContextSelection

      setBriefingPhase('proposal')
      const { res, json, errorMessage } = await postJsonWithRetry(
        '/api/programming-week-briefing',
        {
          ...baseBriefingPayload,
          action: 'proposal',
          contextPack: preparedContextPack,
          contextSelection: preparedContextSelection,
          userInstructions: instructionsSnapshot,
        },
        0,
        {
          timeoutMessage:
            'La IA ha tardado demasiado en preparar la propuesta. La petición se ha cerrado para que la pantalla no se quede bloqueada; pulsa «Reintentar».',
        },
      )
      if (
        briefingRunRef.current !== briefingRunId ||
        currentPlanningFingerprintRef.current !== inputFingerprint
      ) {
        return
      }
      if (!res.ok) {
        if (Number(res.status) === 401) {
          setBriefingErrorCode('invalid_admin_secret')
          throw new Error('La clave de administración ya no es válida para esta preview.')
        }
        throw new Error(errorMessage || `Error ${res.status}`)
      }
      setBriefingContextPack(String(json.contextPack || preparedContextPack))
      const contextSelection =
        json.contextSelection && typeof json.contextSelection === 'object'
          ? json.contextSelection
          : preparedContextSelection
      briefingContextSelectionRef.current = contextSelection
      let exactProgression = []
      let exactContextReady = false
      setBriefingPhase('verify')
      if (
        contextSelection?.mode === 'exact-cycle-date' &&
        targetCycleStartDate
      ) {
        try {
          const expectedIds = new Set(contextSelection.progressionWeekIds || [])
          const versions = expectedIds.size
            ? await withTimeout(
                getPublishedWeekVersionsByIds([...expectedIds]),
                BRIEFING_CONTEXT_TIMEOUT_MS,
                'Las semanas anteriores tardaron demasiado en cargar.',
              )
            : []
          exactProgression = versions
            .filter((row) => expectedIds.has(row.id))
            .sort((a, b) => Number(a?.semana || 0) - Number(b?.semana || 0))
            .map((row) => row?.data)
            .filter(Boolean)
          exactContextReady = exactProgression.length === expectedIds.size
        } catch {
          exactProgression = []
          exactContextReady = false
        }
      }
      if (
        briefingRunRef.current !== briefingRunId ||
        currentPlanningFingerprintRef.current !== inputFingerprint
      ) {
        return
      }
      setPublicationProgressionWeeks(exactProgression)
      setPublicationContextVerified(exactContextReady)
      setProposalTitle(String(json.proposal?.title || '').trim())
      setProposalNarrative(String(json.proposal?.narrative || '').trim())
      setProposalSuggestedFocus(String(json.proposal?.suggestedFocus || '').trim())
      setBriefingApiMessages(Array.isArray(json.initialMessages) ? json.initialMessages : [])
      setBriefingInputFingerprint(inputFingerprint)
      setBriefingStatus('ready')
      setBriefingPhase('idle')
    } catch (e) {
      if (briefingRunRef.current !== briefingRunId) return
      setBriefingStatus('error')
      setBriefingPhase('idle')
      setBriefingErrorMsg(humanizeNetworkLikeError(e, 'No se pudo generar la propuesta.'))
    }
  }

  async function activateBriefingAdminSession() {
    const secret = String(briefingAdminSecretInput || '').trim()
    if (!secret) {
      setBriefingErrorCode('missing_admin_secret')
      setBriefingErrorMsg('Introduce la clave de administración para continuar.')
      return
    }
    setBriefingAuthBusy(true)
    setBriefingErrorMsg('')
    setBriefingErrorCode('')
    try {
      const { res, errorMessage } = await postJsonWithRetry(
        '/api/programming-reference-context',
        { action: 'get', secret },
        0,
        {
          timeoutMs: 20_000,
          timeoutMessage:
            'La validación de acceso ha tardado demasiado. Recarga la página y vuelve a intentarlo.',
        },
      )
      if (!res.ok) {
        if (Number(res.status) === 401) {
          setBriefingErrorCode('invalid_admin_secret')
          setBriefingErrorMsg('La clave no coincide. No es el código de acceso de los coaches.')
          return
        }
        throw new Error(errorMessage || `Error ${res.status}`)
      }
      try {
        sessionStorage.setItem('evo_coach_guide_admin_secret', secret)
      } catch {
        throw new Error('El navegador no permite guardar la sesión de administración.')
      }
      setBriefingAdminSecretInput('')
      setBriefingErrorCode('')
      await prepareBriefing()
    } catch (e) {
      setBriefingStatus('error')
      setBriefingErrorMsg(humanizeNetworkLikeError(e, 'No se pudo validar la clave.'))
    } finally {
      setBriefingAuthBusy(false)
    }
  }

  /** Cambiar mesociclo/semana limpia la rejilla; una semana publicada solo se abre por acción explícita. */
  useEffect(() => {
    if (!weekState.mesocycle || weekState.week == null) return
    setWeekData(null)
    setRawJson('')
    setEditingPublishedRowId(null)
    setEditingDraftRevision(null)
    setEditingPublishedSourceId(null)
    setEditingPublishedIsActive(false)
    setSavedPublishedEdit(false)
    setPublished(false)
    setStatus('idle')
    setEditTitle('')
    setEditSheetName(`S${weekState.week || 1}`)
    lastPersistedDraftRef.current = ''
  }, [
    weekState.cycleId,
    weekState.cycleStartDate,
    weekState.mesocycle,
    weekState.week,
  ])

  /**
   * Una apertura de otra S/ciclo espera a que App confirme el nuevo objetivo.
   * Este efecto corre después del reset anterior, de modo que la hidratación no
   * puede ser borrada por el mismo cambio de weekState que la hizo necesaria.
   */
  useEffect(() => {
    const pending = pendingEditorOpenRef.current
    const transition = resolvePendingEditorOpen(pending, weekState)
    if (transition.action === 'none') return
    if (transition.action === 'discard') {
      // Si el objetivo cambió a otro distinto mientras esperábamos, la apertura quedó obsoleta.
      pendingEditorOpenRef.current = null
      return
    }
    pendingEditorOpenRef.current = null
    applyEditorOpenPayload(transition.payload)
  }, [
    weekState.cycleId,
    weekState.cycleStartDate,
    weekState.mesocycle,
    weekState.phase,
    weekState.week,
  ])

  /** Tras cargar el briefing, alinear historial local con semanas ya publicadas en Supabase (p. ej. S6 en Hub pero no en localStorage). */
  useEffect(() => {
    if (briefingStatus !== 'ready' || !weekState.mesocycle || !targetCycleId) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listPublishedWeeksForMesocycle(
          weekState.mesocycle,
          targetCycleId,
        )
        if (cancelled) return
        const existingHistory = readExactLocalHistory()
        const existingBySemana = new Set(existingHistory.map((e) => Number(e?.semana || 0)))
        for (const row of rows) {
          if (!row?.data) continue
          // No pisar borradores locales ya guardados en este dispositivo.
          if (existingBySemana.has(Number(row.semana))) continue
          const data = normalizeWeekDataForEditor(row.data, {
            semana: Number(row.semana),
            mesociclo: weekState.mesocycle,
          })
          data.semana = Number(row.semana)
          data.titulo = row.titulo || data.titulo
          data.mesociclo = weekState.mesocycle
          if (!weekHasMeaningfulSessionContent(data)) continue
          saveWeekToHistory(
            weekState.mesocycle,
            Number(row.semana),
            attachExactCycleIdentity(data, Number(row.semana)),
          )
        }
        setHistory(readExactLocalHistory())
      } catch (e) {
        console.warn('[ExcelGeneratorModal] sync historial desde Supabase:', e?.message || e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    attachExactCycleIdentity,
    briefingStatus,
    readExactLocalHistory,
    targetCycleId,
    weekState.mesocycle,
  ])

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
    data = attachExactCycleIdentity(data, weekState.week)
    const sig = JSON.stringify(data)
    if (!force && sig === lastPersistedDraftRef.current) return false
    saveWeekToHistory(weekState.mesocycle, weekState.week, data)
    setHistory(readExactLocalHistory())
    lastPersistedDraftRef.current = sig
    return true
  }, [
    attachExactCycleIdentity,
    editTitle,
    editingJson,
    rawJson,
    readExactLocalHistory,
    weekData,
    weekState.mesocycle,
    weekState.week,
  ])

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
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Espera a que termine la operación en curso antes de abrir otra semana.')
      return
    }
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
      let row = null
      try {
        if (weekState.mesocycle && weekState.week != null) {
          row =
            (await getPublishedWeekDraftByMesocycleAndWeek(
              weekState.mesocycle,
              Number(weekState.week),
              targetCycleId,
            )) ||
            (await getPublishedWeekByMesocycleAndWeek(
              weekState.mesocycle,
              Number(weekState.week),
              targetCycleId,
            ))
        }
      } catch {
        row = null
      }
      if (!row?.data) {
        row = (await refreshActivePublishedWeek()) || activePublishedWeek
      }
      if (!row?.data) {
        setErrorMsg(
          'No hay semana del Hub editable para este mesociclo/semana ni semana activa global. Si acabas de publicar, cierra y abre el modal para refrescar o revisa permisos de lectura.',
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

      const hasHistoryEntry = readExactLocalHistory().some(
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
          Number(active.semana) === Number(weekState.week) &&
          String(active.cycle_id || active.data?.cycle_id || '') === targetCycleId
        if (!cancelled) setIsEditingExistingWeek(!!matchesActive)
      } catch {
        if (!cancelled) setIsEditingExistingWeek(false)
      }
    }

    detectExistingWeekMode()
    return () => {
      cancelled = true
    }
  }, [readExactLocalHistory, targetCycleId, weekState.mesocycle, weekState.week])

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
    const adminSecret = publicationAdminSecret()
    if (!adminSecret) {
      setErrorMsg(
        'Vuelve a introducir la clave de administración antes de refinar la propuesta.',
      )
      return
    }
    const briefingRunId = briefingRunRef.current + 1
    briefingRunRef.current = briefingRunId
    const planningFingerprint = currentPlanningInputFingerprint
    currentPlanningFingerprintRef.current = planningFingerprint
    setRefineBusy(true)
    setErrorMsg('')
    try {
      const nextMessages = [...briefingApiMessages, { role: 'user', content: line }]
      const { res, json, errorMessage } = await postJsonWithRetry(
        '/api/programming-week-briefing',
        {
          secret: adminSecret,
          messages: nextMessages,
          contextPack: briefingContextPack,
          mesociclo: weekState.mesocycle,
          semana: Number(weekState.week),
          phase: weekState.phase || '',
          totalWeeks: weekState.totalWeeks ?? null,
          cycleId: targetCycleId || null,
          cycleStartDate: targetCycleStartDate || null,
          targetWeekStartDate: targetWeekStartDate || null,
          generationDays: [...selectedGenerationDays],
          weeklyOffer: serializeWeeklyOfferSelection(dayClassPicker),
        },
        0,
        {
          timeoutMessage:
            'La IA ha tardado demasiado en actualizar la propuesta. La petición se ha cerrado; vuelve a intentarlo.',
        },
      )
      if (
        briefingRunRef.current !== briefingRunId ||
        currentPlanningFingerprintRef.current !== planningFingerprint
      ) {
        return
      }
      if (!res.ok) throw new Error(errorMessage || `Error ${res.status}`)
      const assistantText = JSON.stringify(json.proposal || {})
      setProposalTitle(String(json.proposal?.title || '').trim())
      setProposalNarrative(String(json.proposal?.narrative || '').trim())
      setProposalSuggestedFocus(String(json.proposal?.suggestedFocus || '').trim())
      setBriefingContextPack(String(json.contextPack || briefingContextPack))
      setBriefingApiMessages([...nextMessages, { role: 'assistant', content: assistantText }])
      setRefineDraft('')
      setProposalStep('review')
    } catch (e) {
      if (briefingRunRef.current !== briefingRunId) return
      setErrorMsg(humanizeNetworkLikeError(e, 'No se pudo actualizar la propuesta.'))
    } finally {
      if (briefingRunRef.current === briefingRunId) setRefineBusy(false)
    }
  }

  /**
   * Una llamada API = un POST. La semana se parte en tramos de 1 día (varias llamadas)
   * para evitar timeouts con briefing + system largos en serverless.
   * @param {{ model?: string, maxTokens?: number, generationCallIndex?: number }} [apiOpts]
   */
  async function callApi(
    userMessage,
    systemFull = SYSTEM_PROMPT_EXCEL,
    weekContext = '',
    retries = 5,
    apiOpts = {},
  ) {
    const generationCallIndex = Number(apiOpts.generationCallIndex) || 0
    const model = apiOpts.model || PROGRAMMING_MODEL
    const maxTokens =
      apiOpts.maxTokens ??
      Math.min(AI_CONFIG.maxTokens, EXCEL_GENERATION_MAX_TOKENS_PER_CALL)
    let retryingMalformedOutput = false

    for (let attempt = 0; attempt <= retries; attempt++) {
      // Tras error de red, apretar más el prompt (evita repetir el fallo por petición gigante).
      const effectiveGenIdx =
        attempt === 0 ? generationCallIndex : Math.max(generationCallIndex, attempt)
      const body = {
        model,
        // Si una salida estructurada se corta por tokens, Anthropic recomienda
        // reintentar con un techo mayor. El coste solo aumenta si se usa.
        max_tokens: Math.min(8000, maxTokens + attempt * 500),
        system: buildExcelSystemForGenerationCall(systemFull, effectiveGenIdx, attempt),
        weekContext: trimWeekContextForAnthropicRetry(
          buildWeekContextForGenerationCall(weekContext, effectiveGenIdx),
          attempt,
        ),
        messages: [
          {
            role: 'user',
            content: retryingMalformedOutput
              ? `${userMessage}\n\nREINTENTO TÉCNICO: devuelve únicamente el objeto solicitado. No incluyas razonamiento, introducciones, comentarios ni texto fuera de los campos JSON.`
              : userMessage,
          },
        ],
        responseFormat: EVO_WEEK_RESPONSE_FORMAT,
      }
      console.log('API Request (Proxy):', { model: body.model, attempt })

      const fetchAbort = generationFetchAbortRef.current
      const requestAbort = new AbortController()
      let didTimeout = false
      const abortFromGeneration = () => requestAbort.abort()
      if (fetchAbort?.signal?.aborted) {
        throw new StaleGenerationResponseError()
      }
      fetchAbort?.signal?.addEventListener('abort', abortFromGeneration, { once: true })
      const requestTimeoutId = setTimeout(() => {
        didTimeout = true
        requestAbort.abort()
      }, EXCEL_GENERATION_FETCH_TIMEOUT_MS)
      let response
      let responseText
      try {
        // Modelo: sonnet — generación JSON semanal (SYSTEM_PROMPT_EXCEL); núcleo del producto.
        response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: requestAbort.signal,
        })
        // El proxy envía cabeceras y latidos antes de terminar. El límite debe
        // cubrir también el cuerpo; proteger solo fetch() dejaba la UI colgada.
        responseText = await response.text()
      } catch (e) {
        if (fetchAbort?.signal?.aborted) {
          throw new StaleGenerationResponseError()
        }
        const networkMsg = didTimeout
          ? 'Tiempo de espera agotado esperando la respuesta completa de la IA (más de 5 min). La petición se canceló para que la pantalla no se quede bloqueada.'
          : explainAnthropicFetchFailure(e)
        if (attempt < retries) {
          const wait = Math.min(12, 4 + attempt * 3)
          setGenStep(
            `${
              didTimeout ? 'La IA tardó demasiado' : 'Conexión inestable con la IA'
            } — reintentando en ${wait}s…`,
          )
          await new Promise((r) => setTimeout(r, wait * 1000))
          continue
        }
        throw new Error(networkMsg)
      } finally {
        clearTimeout(requestTimeoutId)
        fetchAbort?.signal?.removeEventListener('abort', abortFromGeneration)
      }

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
              'Las URLs de preview también deben añadirse de forma explícita para evitar que otro dominio reutilice la API.',
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

      if (data?.stop_reason === 'max_tokens') {
        if (attempt < retries) {
          retryingMalformedOutput = true
          setGenStep('La respuesta se quedó incompleta — reintentando con más espacio…')
          await new Promise((r) => setTimeout(r, 1200))
          continue
        }
        throw new Error('La IA no pudo completar el día dentro del límite de respuesta.')
      }
      if (data?.stop_reason === 'refusal') {
        throw new Error('La IA rechazó esta petición de generación. Revisa el contexto añadido y vuelve a intentarlo.')
      }

      const text = extractAnthropicTextBlocks(data)
      try {
        return parseAssistantWeekJson(text)
      } catch (e) {
        if (attempt < retries) {
          retryingMalformedOutput = true
          setGenStep('La IA devolvió un formato incompleto — reparando y reintentando…')
          await new Promise((r) => setTimeout(r, 1200))
          continue
        }
        throw new Error(
          `No se pudo recuperar el formato de la respuesta tras varios intentos: ${e.message}`,
        )
      }
    }
    throw new Error('API saturada después de varios intentos. Inténtalo de nuevo en unos minutos.')
  }

  async function handleGenerate(opts) {
    const correctionNote =
      opts && typeof opts.correctionNote === 'string' ? opts.correctionNote.trim() : ''
    if (!weekState.mesocycle) {
      setErrorMsg('Primero selecciona el tipo de Mesociclo y la Semana en el panel de la izquierda (aparece como "Configuración pendiente").')
      setStatus('error')
      return
    }

    setErrorMsg('')

    const pack = String(briefingContextPack || '').trim()
    if (!targetCycleStartDate) {
      setErrorMsg(
        'Indica la fecha real de inicio del ciclo antes de generar; sin ella no se puede separar esta progresión de ciclos antiguos.',
      )
      setStatus('error')
      return
    }
    if (briefingStatus === 'loading') {
      setErrorMsg('Espera a que termine el análisis automático de la IA.')
      setStatus('error')
      return
    }
    if (briefingStatus !== 'ready' || !pack || !publicationContextVerified) {
      setErrorMsg(
        'Actualiza primero la propuesta: la generación necesita el contexto exacto del ciclo y su histórico verificado.',
      )
      setStatus('error')
      return
    }
    if (!proposalAccepted) {
      setErrorMsg('Pulsa «Me parece bien» y luego «Generar semana» (o ajusta el enfoque con la IA).')
      setStatus('error')
      return
    }
    if (briefingIsStale) {
      setErrorMsg('Has cambiado los días, las clases o el contexto. Actualiza la propuesta antes de generar.')
      setStatus('error')
      return
    }

    const capturedGenerationFingerprint = currentGenerationRequestFingerprint
    const generationRunId = generationRunRef.current + 1
    generationRunRef.current = generationRunId
    currentGenerationFingerprintRef.current = capturedGenerationFingerprint
    const assertGenerationIsCurrent = () => {
      if (generationRunRef.current !== generationRunId) {
        throw new StaleGenerationResponseError()
      }
      return assertGenerationRequestStillCurrent(
        capturedGenerationFingerprint,
        currentGenerationFingerprintRef.current,
      )
    }

    generationActiveRef.current = true
    generationFetchAbortRef.current?.abort()
    generationFetchAbortRef.current = new AbortController()
    flushSync(() => {
      setStatus('generating')
      setGenStep('Cargando biblioteca EVO…')
    })

    let systemExcelFull = SYSTEM_PROMPT_EXCEL
    let generationLibraryBlock = ''
    let synthesisLibraryRows = []
    let generationCheckpoint = null
    try {
      synthesisLibraryRows = await withTimeout(
        getCoachExerciseLibrary(),
        EXCEL_GENERATION_PREP_TIMEOUT_MS,
        'La biblioteca EVO tardó demasiado en cargar. Comprueba la conexión y recarga la página.',
      )
      if (!Array.isArray(synthesisLibraryRows) || synthesisLibraryRows.length === 0) {
        throw new Error('La Biblioteca EVO oficial no devolvió ejercicios.')
      }
      // Sin resolución YouTube en caliente: hasta 12× oembed ralentizaban minutos la UI en «Iniciando…».
      const block = buildGeneratorLibraryBlock(synthesisLibraryRows, null, {
        maxExercises: EXCEL_LIBRARY_MAX_EXERCISES_IN_PROMPT,
      })
      if (!block) throw new Error('No se pudo construir el contexto de la Biblioteca EVO.')
      generationLibraryBlock = block
    } catch (libraryError) {
      setErrorMsg(
        `La generación se ha detenido porque no está disponible la Biblioteca EVO oficial: ${
          libraryError?.message || libraryError
        }. Recarga la biblioteca y vuelve a intentarlo.`,
      )
      setStatus('error')
      setGenStep('')
      generationActiveRef.current = false
      return
    }
    assertGenerationIsCurrent()

    let synthesisPreviousWeeks = []
    let synthesisCoachFeedback = []
    let synthesisSelectedWeekIds = []
    let lastYearReferenceBlock = ''
    setGenStep('Cargando semanas anteriores del mesociclo…')
    try {
      const ctxSel = briefingContextSelectionRef.current
      const progressionIds = Array.isArray(ctxSel?.progressionWeekIds)
        ? ctxSel.progressionWeekIds.filter(Boolean)
        : []
      let progressionRows = []

      if (
        progressionIds.length &&
        publicationProgressionWeeks.length === progressionIds.length
      ) {
        progressionRows = progressionIds.map((id, index) => ({
          id,
          semana: publicationProgressionWeeks[index]?.semana,
          mesociclo: weekState.mesocycle,
          data: publicationProgressionWeeks[index],
        }))
      } else if (progressionIds.length) {
        progressionRows = await withTimeout(
          getPublishedWeekVersionsByIds(progressionIds),
          EXCEL_GENERATION_PREP_TIMEOUT_MS,
          'Las semanas anteriores tardaron demasiado en cargar.',
        )
      } else {
        const published = await withTimeout(
          listPublishedWeekVersionsForMesocycle(weekState.mesocycle, { limit: 24 }),
          EXCEL_GENERATION_PREP_TIMEOUT_MS,
          'Las semanas anteriores tardaron demasiado en cargar.',
        )
        const exactSelection = selectProgrammingContextWeeks(
          published,
          {
            mesociclo: weekState.mesocycle,
            semana: Number(weekState.week),
            cycle_id: targetCycleId,
            cycle_start_date: targetCycleStartDate,
            week_start_date: targetWeekStartDate,
          },
          { progressionLimit: 6, historicalLimit: 0 },
        )
        progressionRows = exactSelection.progressionWeeks
      }

      const selectedProgressionIds = new Set(
        briefingContextSelectionRef.current?.progressionWeekIds || [],
      )
      if (!progressionRows.length && selectedProgressionIds.size) {
        progressionRows = await withTimeout(
          getPublishedWeekVersionsByIds([...selectedProgressionIds]),
          EXCEL_GENERATION_PREP_TIMEOUT_MS,
          'Las semanas anteriores tardaron demasiado en cargar.',
        )
      }
      synthesisPreviousWeeks = progressionRows
        .slice(-6)
        .map((r) => ({
          id: r.id,
          semana: r.semana,
          mesociclo: weekState.mesocycle,
          dias: Array.isArray(r.data?.dias) ? r.data.dias : [],
        }))
      synthesisSelectedWeekIds = [
        ...new Set(
          briefingContextSelectionRef.current?.selectedWeekIds?.length
            ? briefingContextSelectionRef.current.selectedWeekIds
            : synthesisPreviousWeeks.map((row) => row.id).filter(Boolean),
        ),
      ]
    } catch {
      /* síntesis sin semanas previas */
    }
    assertGenerationIsCurrent()
    setGenStep('Recopilando feedback de coaches…')
    try {
      if (synthesisSelectedWeekIds.length) {
        const feedbackQuery = supabase
          .from('coach_session_feedback')
          .select('class_label, notes_next_week, created_at, week_id')
          .in('week_id', synthesisSelectedWeekIds)
          .not('notes_next_week', 'is', null)
          .order('created_at', { ascending: false })
          .limit(40)
        const { data } = await withTimeout(
          feedbackQuery,
          12_000,
          'Feedback de coaches omitido por tiempo de espera.',
        )
        synthesisCoachFeedback = Array.isArray(data) ? data : []
      }
    } catch {
      /* síntesis sin feedback */
    }
    assertGenerationIsCurrent()
    // No consultar tabla `weeks` en generación: en prod puede colgar (RLS/red) y bloquea minutos
    // la UI; el briefing ya incluye histórico del ciclo.
    lastYearReferenceBlock = ''
    const promptPrepStartedAt = Date.now()
    const assertPromptPrepNotStale = () => {
      if (Date.now() - promptPrepStartedAt > EXCEL_GENERATION_PROMPT_PREP_TIMEOUT_MS) {
        throw new Error(
          'Montar el prompt tardó demasiado en este navegador. Recarga la página (el briefing guardado es normal) e intenta generar solo 1 día.',
        )
      }
    }

    flushSync(() => setGenStep('Montando prompt (1/3)…'))
    await yieldToUi()
    assertGenerationIsCurrent()
    assertPromptPrepNotStale()

    const methodBlock = buildMethodPromptAppendix()
    if (methodBlock) {
      systemExcelFull += `\n\n${methodBlock}`
    }
    flushSync(() => setGenStep('Montando prompt (2/3)…'))
    await yieldToUi()
    assertGenerationIsCurrent()
    assertPromptPrepNotStale()

    const mesoProgrammingBlock = buildMesocycleProgrammingBlock({
      mesocycle: weekState.mesocycle,
      week: weekState.week,
      totalWeeks: weekState.totalWeeks,
      phase: weekState.phase,
    })
    if (mesoProgrammingBlock) {
      systemExcelFull += `\n\n${mesoProgrammingBlock}`
    }

    // La biblioteca va al final a propósito: las llamadas tardías pueden recortarla sin
    // eliminar también el Método EVO ni el bloque del mesociclo.
    if (generationLibraryBlock) {
      systemExcelFull += `\n\n${generationLibraryBlock}`
    }

    // Ejemplos Drive y contexto de referencia omitidos aquí: el briefing + propuesta aprobada
    // ya orientan la semana; meterlos en system duplicaba ~20k y provocaba timeouts / Failed to fetch.

    systemExcelFull = buildLeanSystemExcelForGeneration(systemExcelFull)
    flushSync(() => setGenStep('Montando prompt (3/3)…'))
    await yieldToUi()
    assertGenerationIsCurrent()
    assertPromptPrepNotStale()

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
            String(proposalNarrative || '').slice(0, EXCEL_GENERATION_NARRATIVE_MAX_CHARS),
            '',
            `Enfoque sugerido: ${proposalSuggestedFocus}`,
          ]
            .filter(Boolean)
            .join('\n')

    // Instrucciones libres de la semana: máxima prioridad, se aplican a TODOS los días generados
    // (incluso al regenerar sin propuesta aprobada).
    const weekInstructionsBlock = addendumClean
      ? `INSTRUCCIONES ESPECÍFICAS PARA ESTA SEMANA (prioridad sobre preferencias genéricas):\n${addendumClean}\n———`
      : ''

    // Correcciones del scoring (al pulsar «Regenerar con estas correcciones»): máxima prioridad.
    const correctionBlock = correctionNote
      ? `EL SCORING DETECTÓ ESTOS PROBLEMAS — corrígelos en la nueva versión:\n${correctionNote}\n———`
      : ''

    const packForGeneration =
      pack.length > EXCEL_GENERATION_PACK_MAX_CHARS
        ? `${pack.slice(0, EXCEL_GENERATION_PACK_MAX_CHARS).trimEnd()}\n\n[…Paquete truncado por límite técnico (${pack.length} caracteres en origen). Prioriza coherencia con el texto visible.]`
        : pack

    const briefingUserBlock = pack
      ? `PAQUETE BRIEFING (Supabase — check-ins, handoffs, reglas, feedback; lee antes de programar):\n${packForGeneration}`
      : ''

    const baseContextCore = [correctionBlock, weekInstructionsBlock, mesoInfo, approvedBlock]
      .filter(Boolean)
      .join('\n\n')

    await yieldToUi()
    assertPromptPrepNotStale()

    const planSourceText = [
      String(proposalNarrative || '').slice(0, EXCEL_GENERATION_NARRATIVE_MAX_CHARS),
      addendumClean,
    ]
      .filter(Boolean)
      .join('\n\n')
    const selectedCanon = new Set(selectedGenerationDays)
    const { daysToGenerate, daysPreserved: textPreservedDays } = resolveDaysToGenerateFromSelection(
      selectedCanon,
      planSourceText,
    )
    const explicitHolidayDays = resolveExplicitHolidayDays(addendumClean)
    const holidayMergeOptions = {
      allowHolidayCreation: explicitHolidayDays.size > 0,
      allowedHolidayDays: explicitHolidayDays,
    }
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
        'No hay días para generar: marca al menos un día en el selector de arriba.',
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
    const expectedDatesByDay = targetWeekStartDate
      ? Object.fromEntries(
          EXCEL_DAY_ORDER.map((day, index) => [
            day,
            addProgrammingDays(targetWeekStartDate, index),
          ]),
        )
      : {}
    if (selectedClassKeys.size === 0) {
      setErrorMsg('Marca al menos una clase en algún día seleccionado para generar.')
      setStatus('error')
      generationActiveRef.current = false
      return
    }

    try {
      assertPromptPrepNotStale()
      // Briefing obligatorio: no llamar buildWeekContext (consultas pesadas a published_weeks).
      const weekContextText = ''
      let overlay = null
      if (weekData && Array.isArray(weekData.dias)) {
        overlay = weekData
      }
      // Sin getActiveWeek() aquí: `select *` sobre published_weeks colgaba la generación en prod.

      flushSync(() => setGenStep('Iniciando generación por días…'))
      await yieldToUi()

      const acc = buildWeekSkeleton(weekState.week, weekState.mesocycle)

      function rememberGenerationProgress() {
        const snapshot = JSON.parse(JSON.stringify(acc))
        generationCheckpoint = attachEvoMethodMetadata(
          {
            ...snapshot,
            titulo:
              snapshot.titulo?.trim() ||
              `S${weekState.week} – MESOCICLO ${(weekState.mesocycle || '').toUpperCase()}`,
            semana: weekState.week,
            mesociclo: weekState.mesocycle,
            cycle_id: targetCycleId || null,
            cycle_start_date: targetCycleStartDate || null,
            week_start_date: targetWeekStartDate || null,
            oferta_semanal: serializeWeeklyOfferSelection(dayClassPicker),
          },
          { previousWeeks: synthesisPreviousWeeks },
        )
      }
      const daysPreserved = new Set(textPreservedDays)
      if (Array.isArray(overlay?.dias)) {
        for (const day of EXCEL_DAY_ORDER) {
          if (daysToGenerate.has(day)) continue
          const existingDay = overlay.dias.find(
            (row) => String(row?.nombre || '').trim().toUpperCase() === day,
          )
          if (existingDay) daysPreserved.add(day)
        }
      }
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
- Los días no elegidos quedan pendientes o se conservan si ya tenían contenido. No inventes sesiones para ellos. En tu respuesta parcial puedes dejarlos con cadenas vacías o «(no programada esta semana)»; el cliente no fusionará esos días. Festivo real del gimnasio (solo si el usuario lo indica): ver system prompt (FESTIVO).`


      function buildChunkMessage(chunkDays, coherenceBlock, { isFirstApiCall = false } = {}) {
        const list = [...chunkDays].join(', ')
        const architectureBlock = extractWeeklyArchitectureBlock(pack)
        const briefingPart = isFirstApiCall
          ? briefingUserBlock
          : briefingUserBlock
            ? [
                'Briefing Supabase: ya enviado en la primera petición de esta generación (no se repite).',
                architectureBlock,
              ].filter(Boolean).join('\n\n')
            : ''
        const lastYearPart =
          isFirstApiCall && lastYearReferenceBlock ? lastYearReferenceBlock : ''
        const baseContext = [baseContextCore, briefingPart, lastYearPart].filter(Boolean).join('\n\n')
        const heavyRules = isFirstApiCall
          ? `\n\n${EXCEL_GENERATION_FIRST_PASS_PUBLISHABLE}\n\n${EXCEL_GENERATION_ANTI_REPETITION_USER_BLOCK}`
          : '\n\n(Mismas reglas de calidad y anti-repetición que en la primera petición de esta generación; no repitas lift/formato/WOD entre días.)'
        const core = `${baseContext}\n\n${planSummary}${heavyRules}\n\nGENERACIÓN DE DÍAS EN ESTA PETICIÓN: ${list}.

Devuelve JSON con titulo, semana, mesociclo, resumen y dias. Como esta petición genera un solo día, el array dias debe contener EXACTAMENTE 1 objeto para ${list}, con "nombre" en MAYÚSCULAS.

Antes de redactar, haz internamente una mini-matriz de semana (no la imprimas) con: patrón dominante del día, formato de fuerza, formato WOD, complejidad logística/material. Úsala para evitar repetición entre días consecutivos.

Solo rellena contenido completo (sesiones y feedbacks) para: ${list}, respetando exactamente las columnas por día listadas en PLAN DE DÍAS Y COLUMNAS; en otras columnas de esos mismos días deja «(no programada esta semana)» y feedback vacío. En esos días wodbuster = "".
Para el resto de días no inventes sesiones: el cliente conservará lo ya hecho o los dejará pendientes. Festivo real solo si el usuario lo pide (FESTIVO).

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

      function buildCoherenceBlockFromAccumulator(targetDayKey) {
        const jsonBlock = `CONTEXTO YA GENERADO EN ESTA SEMANA (sesiones ya cerradas o preservadas; al escribir los días nuevos de ESTA petición NO repitas el mismo lift principal, ni formatos de fuerza/WOD consecutivos, ni el mismo patrón muscular consecutivo en EvoFuncional respecto a estos días; mantén en tu salida vacíos los días que no te tocan):\n${buildCompactAccumulatorCoherence(acc)}`
        const synthesisBlock = buildExcelDayContextSynthesis({
          acc,
          targetDay: targetDayKey,
          exerciseLibraryRows: synthesisLibraryRows,
          previousWeeks: synthesisPreviousWeeks,
          coachFeedback: synthesisCoachFeedback,
        })
        const resumenFoco = (acc.resumen && acc.resumen.foco) || ''
        const heuristic = formatReviewHintsForGenerationPrompt(
          acc.dias,
          [...selectedClassKeys],
          resumenFoco,
        )
        const trackerBlock = buildUsedExercisesTrackerBlock(acc)
        const targetCanonDay = EXCEL_DAY_ORDER.find(
          (day) => excelCanonDayToTargetDay(day) === targetDayKey,
        )
        const basicsRotationBlock = classesByDay[targetCanonDay]?.has('evobasics')
          ? buildEvoBasicsRotationContext({
              previousWeeks: synthesisPreviousWeeks,
              currentWeek: acc,
              targetDay: targetCanonDay,
            })
          : ''
        const heuristicBlock = `CHEQUEO HEURÍSTICO (misma lógica que el panel del programador: rojo/naranja/amarillo; corrige en los días que generas EN ESTA petición, no asumas revisión manual después):\n${heuristic}`
        const middle = [synthesisBlock, basicsRotationBlock, trackerBlock].filter(Boolean).join('\n\n')
        if (middle) {
          return `${jsonBlock}\n\n${middle}\n\n${heuristicBlock}`
        }
        return `${jsonBlock}\n\n${heuristicBlock}`
      }

      let generationApiCallIndex = 0

      async function generateChunkWithFallback(chunk, ci, total) {
        assertGenerationIsCurrent()
        const chunkDaysText = [...chunk].join(' · ')
        const callIdx = generationApiCallIndex
        const isFirstApiCall = callIdx === 0
        setGenStep(
          total > 1
            ? `Generando ${chunkDaysText}… (${ci + 1}/${total}) · puede tardar 2–5 min${callIdx > 0 ? ' · modo ligero' : ''}`
            : `Generando ${chunkDaysText}… · puede tardar 2–5 min`,
        )
        await Promise.resolve()
        const targetDayKey = excelCanonDayToTargetDay([...chunk][0])
        const coherenceBlock = buildCoherenceBlockFromAccumulator(targetDayKey)
        const userMessageForApi = buildChunkMessage(chunk, coherenceBlock, { isFirstApiCall })
        console.log('[ProgramingEvo][Excel → IA] petición', ci + 1, '/', total, {
          diasEnEstePOST: [...chunk],
          juevesEnEstePOST: chunk.has('JUEVES'),
          generationCallIndex: callIdx,
        })
        try {
          const part = await callApi(userMessageForApi, systemExcelFull, weekContextText, 1, {
            generationCallIndex: callIdx,
          })
          assertGenerationIsCurrent()
          generationApiCallIndex += 1
          mergeGeneratedDaysIntoAccumulator(
            acc,
            part,
            chunk,
            expectedDatesByDay,
            holidayMergeOptions,
          )
          rememberGenerationProgress()
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

      if (dayChunks.length) {
        const firstDay = [...dayChunks[0]][0]
        setGenStep(
          dayChunks.length > 1
            ? `Generando ${firstDay}… (1/${dayChunks.length}) · puede tardar 2–5 min`
            : `Generando ${firstDay}… · puede tardar 2–5 min`,
        )
        await Promise.resolve()
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
          const forceCoherence = buildCoherenceBlockFromAccumulator(excelCanonDayToTargetDay(d))
          const forceMsg =
            buildChunkMessage(new Set([d]), forceCoherence) +
            `\n\nREINTENTO FORZADO (${d}): este día estaba marcado para generar por el selector del cliente. ` +
            `Devuelve contenido REAL para ${d} en las columnas seleccionadas; no uses «(no programada esta semana)» en esas columnas.`
          setGenStep(`Reintentando ${d} (faltaba contenido)…`)
          const part = await callApi(forceMsg, systemExcelFull, weekContextText, 1, {
            model: SUPPORT_MODEL,
            maxTokens: 5000,
            generationCallIndex: generationApiCallIndex,
          })
          assertGenerationIsCurrent()
          generationApiCallIndex += 1
          mergeGeneratedDaysIntoAccumulator(
            acc,
            part,
            new Set([d]),
            expectedDatesByDay,
            holidayMergeOptions,
          )
          rememberGenerationProgress()
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
          const forceCoherence = buildCoherenceBlockFromAccumulator(excelCanonDayToTargetDay(d))
          const forceMsg =
            buildChunkMessage(new Set([d]), forceCoherence) +
            `\n\nAUTO-CORRECCIÓN DE CALIDAD (${d}) — pasada ${qaPass}/${QA_AUTO_FIX_MAX_PASSES}: reescribe este día para eliminar avisos rojos/naranjas y no toques otros días.` +
            `\nPrioridad: variar lift/formato dominante, quitar repeticiones cercanas y mantener logística viable.` +
            `\nSi aparece una sección visible de bienvenida, movilidad, calentamiento, preparación, transición o cierre, elimínala y empieza directamente en A/B/C o PARTE ÚNICA.` +
            `\nObjetivo global: subir score semanal hacia ${QA_TARGET_SCORE}/10 o más.` +
            `\n- ${dayHints || 'Evitar repetición dominante y mejorar coherencia de ese día.'}`
          const part = await callApi(forceMsg, systemExcelFull, weekContextText, 1, {
            model: SUPPORT_MODEL,
            maxTokens: 5000,
            generationCallIndex: generationApiCallIndex,
          })
          assertGenerationIsCurrent()
          generationApiCallIndex += 1
          mergeGeneratedDaysIntoAccumulator(
            acc,
            part,
            new Set([d]),
            expectedDatesByDay,
            holidayMergeOptions,
          )
          rememberGenerationProgress()
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

      const combined = attachEvoMethodMetadata(
        {
          ...acc,
          titulo:
            acc.titulo?.trim() ||
            `S${weekState.week} – MESOCICLO ${(weekState.mesocycle || '').toUpperCase()}`,
          semana: weekState.week,
          mesociclo: weekState.mesocycle,
          cycle_id: targetCycleId || null,
          cycle_start_date: targetCycleStartDate || null,
          week_start_date: targetWeekStartDate || null,
          oferta_semanal: serializeWeeklyOfferSelection(dayClassPicker),
          authorized_holiday_days: [...explicitHolidayDays],
        },
        { previousWeeks: synthesisPreviousWeeks },
      )

      assertGenerationIsCurrent()
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
      // PASO 2 — Scoring automático tras generar (sin intervención de la usuaria).
      runScoring(combined)
    } catch (err) {
      if (
        err instanceof StaleGenerationResponseError ||
        generationRunRef.current !== generationRunId
      ) {
        generationActiveRef.current = false
        setGenStep('')
        setStatus((current) => (current === 'generating' ? 'idle' : current))
        setErrorMsg(
          'La generación se detuvo (cambió la configuración o llevaba demasiado tiempo). Pulsa «Generar semana» otra vez.',
        )
        return
      }
      setGenStep('')
      if (generationCheckpoint && weekHasMeaningfulSessionContent(generationCheckpoint)) {
        const completedDays = (generationCheckpoint.dias || []).filter((dia) =>
          EVO_SESSION_CLASS_DEFS.some(({ key }) => {
            const text = String(dia?.[key] || '').trim()
            return text && !/no programada esta semana/i.test(text) && !/^FESTIVO\b/i.test(text)
          }),
        ).length
        setWeekData(generationCheckpoint)
        setRawJson(JSON.stringify(generationCheckpoint, null, 2))
        setEditTitle(generationCheckpoint.titulo || '')
        setEditSheetName(`S${weekState.week || 1}`)
        lastPersistedDraftRef.current = JSON.stringify(generationCheckpoint)
        saveWeekToHistory(
          weekState.mesocycle,
          weekState.week,
          attachExactCycleIdentity(generationCheckpoint, weekState.week),
        )
        setHistory(readExactLocalHistory())
        setErrorMsg(
          `${humanizeNetworkLikeError(err, 'La generación se interrumpió.')} Se han conservado ${completedDays} ${completedDays === 1 ? 'día ya creado' : 'días ya creados'}; pulsa «Elegir días / continuar» para completar solo lo pendiente.`,
        )
        setStatus('previewing')
      } else {
        setErrorMsg(humanizeNetworkLikeError(err, 'No se pudo generar la semana.'))
        setStatus('error')
      }
    } finally {
      generationActiveRef.current = false
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
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Espera a que termine la operación de publicación o guardado antes de cerrar.')
      return
    }
    if (status === 'generating') {
      generationRunRef.current += 1
      generationFetchAbortRef.current?.abort()
      generationActiveRef.current = false
      setGenStep('')
      setStatus('idle')
      setErrorMsg('Generación cancelada.')
      return
    }
    if (status === 'previewing' && weekState.mesocycle && weekData != null) {
      persistDraftToLocalHistory()
    }
    onClose()
  }

  /** Contrato visible canónico: cualquier sección de preparación publicada bloquea. */
  const warmupPublishBlockPrefixes = ['Sección visible no permitida', 'Calentamiento genérico detectado']

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

  function claimPublicationMutation(setBusy) {
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Ya hay una operación de guardado, importación o publicación en curso.')
      return false
    }
    publicationMutationLockRef.current = true
    setBusy(true)
    return true
  }

  function releasePublicationMutation(setBusy) {
    publicationMutationLockRef.current = false
    setBusy(false)
  }

  function capturePublicationMutationSnapshot(fingerprint) {
    return {
      capturedRevision: weekEditRevisionRef.current,
      capturedTargetIdentity: editorTargetIdentityRef.current,
      capturedFingerprint: fingerprint,
    }
  }

  function publicationMutationIsStillCurrent(snapshot) {
    return publicationMutationSnapshotIsCurrent({
      ...snapshot,
      currentRevision: weekEditRevisionRef.current,
      currentTargetIdentity: editorTargetIdentityRef.current,
      currentFingerprint: currentPublicationFingerprintRef.current,
    })
  }

  function publicationMutationTargetStillCurrent(snapshot) {
    return publicationMutationTargetIsCurrent({
      ...snapshot,
      currentTargetIdentity: editorTargetIdentityRef.current,
    })
  }

  async function handlePublish() {
    if (!claimPublicationMutation(setPublishing)) return
    try {
      setErrorMsg('')
      if (!weekState.mesocycle || weekState.week == null) {
        throw new Error('Falta mesociclo o número de semana en el panel izquierdo.')
      }
      const source = editingJson ? JSON.parse(rawJson) : weekData
      const normalized = preparePublicationCandidate(source)
      if (!normalized) throw new Error('No hay una semana válida que publicar.')
      const savedOfferSelection = parseWeeklyOfferSelection(normalized?.oferta_semanal)
      const methodValidation = validateEvoWeek(
        normalized,
        savedOfferSelection
          ? {
              offer: weeklyOfferSelectionToValidationOffer(savedOfferSelection),
              previousWeeks: publicationProgressionWeeks,
              allowFestivo: false,
              allowedHolidayDays: normalized?.authorized_holiday_days || [],
            }
          : {
              offer: weeklyOfferSelectionToValidationOffer(dayClassPicker),
              previousWeeks: publicationProgressionWeeks,
              allowFestivo: false,
              allowedHolidayDays: normalized?.authorized_holiday_days || [],
            },
      )
      const methodErrors = [
        ...(methodValidation.errors || []),
        ...(methodValidation.warnings || []),
      ].map((entry) => {
        const day = normalized?.dias?.[entry.dayIndex]?.nombre || `Día ${Number(entry.dayIndex) + 1}`
        const classLabel =
          EVO_SESSION_CLASS_DEFS.find((item) => item.key === entry.classKey)?.label || entry.classKey
        return `${day} · ${classLabel}: ${entry.message}`
      })
      const warmupIssues = getWarmupBlockingIssuesForPublish(normalized?.dias || [])
      const fingerprint = buildPublicationTargetFingerprint({
        weekData: normalized,
        mesocycle: weekState.mesocycle,
        week: weekState.week,
        phase: weekState.phase || '',
        offer: serializeWeeklyOfferSelection(dayClassPicker),
        contextFingerprint: publicationContextFingerprint,
      })
      const qualityGate = buildPublicationQualityGate({
        evaluation: evalResult,
        evaluationFingerprint: evalFingerprint,
        targetFingerprint: fingerprint,
        methodErrors,
        offerPendingDays: pendingOfferedDays,
        staleFeedbackKeys: [...staleFeedbackKeys],
        warmupIssues: warmupIssues.map((x) => `${x.dayLabel} · ${x.classLabel}: ${x.hint}`),
        contextReady:
          briefingStatus === 'ready' &&
          !briefingIsStale &&
          !!briefingContextPack &&
          proposalAccepted &&
          publicationContextVerified &&
          !!targetCycleStartDate,
      })
      assertPublicationGateApproved(qualityGate)
      const mutationSnapshot = capturePublicationMutationSnapshot(fingerprint)
      const r = await upsertPublishedWeekBySlot(normalized, weekState.mesocycle, Number(weekState.week), {
        activateForHub: true,
        contentFingerprint: fingerprint,
        qualityGate,
        sourceWeekId: editingPublishedSourceId,
        draftId: hasEditingDraftVersion ? editingPublishedRowId : null,
        expectedRevision: hasEditingDraftVersion ? Number(editingDraftRevision) : 0,
      })
      const mutationIsCurrent = publicationMutationIsStillCurrent(mutationSnapshot)
      if (r?.id && publicationMutationTargetStillCurrent(mutationSnapshot)) {
        setEditingPublishedRowId(r.id)
        setEditingDraftRevision(null)
        setEditingPublishedSourceId(r.id)
        setEditingPublishedIsActive(true)
      }
      if (mutationIsCurrent) {
        setPublished(true)
      } else {
        setPublished(false)
        setSavedPublishedEdit(false)
        setDraftNotice(
          'La versión enviada sí se publicó, pero conservamos tus cambios posteriores en el editor. Guárdalos como un borrador nuevo antes de volver a publicar.',
        )
        window.setTimeout(() => setDraftNotice(''), 9000)
      }
      try {
        window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'publish' } }))
      } catch {
        /* noop */
      }
    } catch (err) {
      setErrorMsg('Error publicando: ' + formatClientError(err))
    } finally {
      releasePublicationMutation(setPublishing)
    }
  }

  async function handleSaveHubDraft() {
    if (!claimPublicationMutation(setSavingHubDraft)) return
    if (!weekState.mesocycle || weekState.week == null) {
      setErrorMsg('Falta mesociclo o número de semana en el panel izquierdo.')
      releasePublicationMutation(setSavingHubDraft)
      return
    }
    try {
      setErrorMsg('')
      const source = editingJson ? JSON.parse(rawJson) : weekData
      const normalized = preparePublicationCandidate(source)
      if (!normalized) throw new Error('No hay una semana válida que guardar.')
      const fingerprint = buildPublicationTargetFingerprint({
        weekData: normalized,
        mesocycle: weekState.mesocycle,
        week: weekState.week,
        phase: weekState.phase || '',
        offer: serializeWeeklyOfferSelection(dayClassPicker),
        contextFingerprint: publicationContextFingerprint,
      })
      const mutationSnapshot = capturePublicationMutationSnapshot(fingerprint)
      const r = await upsertPublishedWeekBySlot(normalized, weekState.mesocycle, Number(weekState.week), {
        activateForHub: false,
        contentFingerprint: fingerprint,
        qualityGate:
          evalFingerprint === fingerprint
            ? currentPublicationGate
            : buildPublicationQualityGate({
                evaluation: null,
                evaluationFingerprint: '',
                targetFingerprint: fingerprint,
                contextReady: false,
              }),
        sourceWeekId: editingPublishedSourceId,
        draftId: hasEditingDraftVersion ? editingPublishedRowId : null,
        expectedRevision: hasEditingDraftVersion ? Number(editingDraftRevision) : 0,
      })
      const mutationIsCurrent = publicationMutationIsStillCurrent(mutationSnapshot)
      if (r?.id && publicationMutationTargetStillCurrent(mutationSnapshot)) {
        setEditingPublishedRowId(r.id)
        setEditingDraftRevision(Number(r.revision))
        setEditingPublishedIsActive(false)
      }
      saveWeekToHistory(weekState.mesocycle, weekState.week, normalized)
      setHistory(readExactLocalHistory())
      if (mutationIsCurrent) {
        lastPersistedDraftRef.current = JSON.stringify(normalized)
        setWeekData(normalized)
        setRawJson(JSON.stringify(normalized, null, 2))
        setDraftNotice('Borrador guardado en Supabase (la semana visible para coaches no cambia).')
      } else {
        setSavedPublishedEdit(false)
        setDraftNotice(
          'Se guardó la versión enviada, pero tus cambios posteriores siguen en el editor y todavía no están guardados.',
        )
      }
      setTimeout(() => setDraftNotice(''), 4200)
      try {
        window.dispatchEvent(new CustomEvent('evo-active-week-updated', { detail: { source: 'excel-modal-hub-draft' } }))
      } catch {
        /* noop */
      }
    } catch (err) {
      setErrorMsg('Error guardando borrador en Supabase: ' + formatClientError(err))
    } finally {
      releasePublicationMutation(setSavingHubDraft)
    }
  }

  function loadWeekDataIntoEditor(data, semana, fallbackTitle = '') {
    dayEditRunRef.current += 1
    feedbackRunRef.current += 1
    weekEditRevisionRef.current += 1
    scoringRunRef.current += 1
    setEvaluating(false)
    setEvalResult(null)
    setEvalFingerprint('')
    setEvalError('')
    sessionFingerprintsRef.current = buildSessionFingerprintMap(data)
    setStaleFeedbackKeys(new Set())
    setDayClassPicker(weeklyOfferSelectionFromWeekData(data))
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

  function applyEditorOpenPayload(payload) {
    const {
      sourceData,
      semana,
      fallbackTitle = '',
      rowId = null,
      draftRevision = null,
      sourceWeekId = null,
      isActive = false,
    } = payload || {}
    if (!sourceData || !semana) return
    setEditingPublishedRowId(rowId)
    setEditingDraftRevision(draftRevision)
    setEditingPublishedSourceId(sourceWeekId)
    setEditingPublishedIsActive(!!isActive)
    loadWeekDataIntoEditor(sourceData, semana, fallbackTitle)
  }

  function requestEditorOpen(payload) {
    if (!payload?.target || !payload?.sourceData) return false
    if (!editorOpenTargetMatchesWeekState(payload.target, weekState)) {
      pendingEditorOpenRef.current = payload
      onSyncWeekFromHistory?.(
        payload.target.week,
        payload.target.mesocycle,
        payload.target.phase ?? '',
        payload.target.cycleStartDate,
      )
      return false
    }
    pendingEditorOpenRef.current = null
    applyEditorOpenPayload(payload)
    return true
  }

  function buildEditorOpenTarget(row, sourceData, fallbackSemana, fallbackMeso) {
    const target = resolveEditorOpenTarget({
      row,
      data: sourceData,
      fallbackSemana,
      fallbackMeso,
    })
    // App conserva la fase actual cuando recibe null; reflejarlo también en la comparación.
    if (!target.phase && target.mesocycle === weekState.mesocycle) {
      target.phase = weekState.phase || null
    }
    return target
  }

  async function handleSavePublishedEdit() {
    if (!editingPublishedRowId || !weekData) return
    if (!claimPublicationMutation(setSavingPublishedEdit)) return
    try {
      setErrorMsg('')
      const source = editingJson ? JSON.parse(rawJson) : weekData
      const data = preparePublicationCandidate(source)
      if (!data) throw new Error('No hay una semana válida que guardar.')
      const fingerprint = buildPublicationTargetFingerprint({
        weekData: data,
        mesocycle: weekState.mesocycle,
        week: weekState.week,
        phase: weekState.phase || '',
        offer: serializeWeeklyOfferSelection(dayClassPicker),
        contextFingerprint: publicationContextFingerprint,
      })
      const mutationSnapshot = capturePublicationMutationSnapshot(fingerprint)
      const r = await upsertPublishedWeekBySlot(data, weekState.mesocycle, Number(weekState.week), {
        activateForHub: false,
        contentFingerprint: fingerprint,
        qualityGate:
          evalFingerprint === fingerprint
            ? currentPublicationGate
            : buildPublicationQualityGate({
                evaluation: null,
                evaluationFingerprint: '',
                targetFingerprint: fingerprint,
                contextReady: false,
              }),
        sourceWeekId: editingPublishedSourceId,
        draftId: hasEditingDraftVersion ? editingPublishedRowId : null,
        expectedRevision: hasEditingDraftVersion ? Number(editingDraftRevision) : 0,
      })
      const mutationIsCurrent = publicationMutationIsStillCurrent(mutationSnapshot)
      if (r?.id && publicationMutationTargetStillCurrent(mutationSnapshot)) {
        setEditingPublishedRowId(r.id)
        setEditingDraftRevision(Number(r.revision))
      }
      setEditingPublishedIsActive(false)
      saveWeekToHistory(weekState.mesocycle, weekState.week, data)
      setHistory(readExactLocalHistory())
      if (mutationIsCurrent) {
        lastPersistedDraftRef.current = JSON.stringify(data)
        setWeekData(data)
        setRawJson(JSON.stringify(data, null, 2))
        setSavedPublishedEdit(true)
        setDraftNotice('Cambios guardados como borrador nuevo. La versión visible para coaches no se ha modificado.')
      } else {
        setSavedPublishedEdit(false)
        setDraftNotice(
          'Se guardó la versión enviada, pero tus cambios posteriores siguen en el editor y todavía no están guardados.',
        )
      }
      setTimeout(() => setDraftNotice(''), 5200)
    } catch (err) {
      setErrorMsg('Error guardando la nueva versión borrador: ' + formatClientError(err))
    } finally {
      releasePublicationMutation(setSavingPublishedEdit)
    }
  }

  function openPublishedRowForEdit(row, fallbackSemana = null, fallbackMeso = null) {
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Espera a que termine la operación en curso antes de abrir otra semana.')
      return
    }
    if (!row?.data) {
      setErrorMsg('La semana publicada no tiene JSON editable válido en Supabase.')
      setStatus((s) => (s === 'previewing' ? 'previewing' : 'error'))
      return
    }
    const semana = Number(row.semana) || Number(fallbackSemana) || 1
    const mesociclo = row.mesociclo || fallbackMeso || weekState.mesocycle || null
    const sourceData = normalizeWeekDataForEditor(row.data, { semana, mesociclo })
    sourceData.semana = semana
    sourceData.mesociclo = mesociclo || sourceData.mesociclo
    const target = buildEditorOpenTarget(row, sourceData, semana, mesociclo)
    sourceData.cycle_id = target.cycleId
    sourceData.cycle_start_date = target.cycleStartDate
    sourceData.week_start_date = target.weekStartDate
    requestEditorOpen({
      target,
      sourceData,
      semana,
      fallbackTitle: row.titulo || sourceData.titulo || '',
      rowId: row.id || null,
      draftRevision:
        row.publication_status === 'draft' && Number.isInteger(Number(row.revision))
          ? Number(row.revision)
          : null,
      sourceWeekId:
        row.publication_status === 'draft' ? row.source_week_id || null : row.id || null,
      isActive: !!row.is_active,
    })
  }

  function updateWeekData(updater) {
    setWeekData((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      weekEditRevisionRef.current += 1
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
    const feedbackRunId = feedbackRunRef.current + 1
    feedbackRunRef.current = feedbackRunId
    const capturedRevision = weekEditRevisionRef.current
    const capturedTargetIdentity = editorTargetIdentityRef.current
    setRegeneratingFeedbackKey(sk)
    setErrorMsg('')
    try {
      const userMsg = [
        `Clase: ${classLabel}. Día: ${dayName || '—'}.`,
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
      const feedback = sanitizeCoachFeedbackText(stripCodeFences(raw))
      if (!feedback.trim()) throw new Error('La API no devolvió texto de feedback.')
      if (
        feedbackRunRef.current !== feedbackRunId ||
        weekEditRevisionRef.current !== capturedRevision ||
        editorTargetIdentityRef.current !== capturedTargetIdentity
      ) {
        throw new StaleGenerationResponseError(
          'El feedback pertenece a una versión anterior de la semana.',
        )
      }

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
      if (err instanceof StaleGenerationResponseError) return
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo regenerar el feedback.')
    } finally {
      if (feedbackRunRef.current === feedbackRunId) setRegeneratingFeedbackKey(null)
    }
  }

  async function handleApplyDayAiEdit(diaIdx, dia) {
    const instr = sanitizePromptTextForLLM(dayAiDraftByIdx[diaIdx] || '').trim()
    if (!instr) {
      setErrorMsg('Escribe qué quieres cambiar o revisar en este día antes de usar la IA.')
      return
    }
    if (!weekData?.dias?.[diaIdx]) return

    const dayEditRunId = dayEditRunRef.current + 1
    dayEditRunRef.current = dayEditRunId
    const capturedRevision = weekEditRevisionRef.current
    const capturedTargetIdentity = editorTargetIdentityRef.current
    const assertDayEditIsCurrent = () => {
      if (
        dayEditRunRef.current !== dayEditRunId ||
        weekEditRevisionRef.current !== capturedRevision ||
        editorTargetIdentityRef.current !== capturedTargetIdentity
      ) {
        throw new StaleGenerationResponseError(
          'La edición pertenece a una versión anterior de la semana.',
        )
      }
    }

    setDayEditAiBusy(true)
    setErrorMsg('')
    try {
      let systemFull = SYSTEM_PROMPT_DAY_EDIT
      try {
        const libRows = await getCoachExerciseLibrary()
        const autoMap = await fetchLibraryAutoVideoMap(libRows, { maxResolve: 28 })
        const block = buildGeneratorLibraryBlock(libRows, autoMap)
        if (block) systemFull += `\n\n${block}`
      } catch {
        /* sin biblioteca */
      }
      assertDayEditIsCurrent()
      const refDay = buildReferenceMesocycleSystemAppendix(getReferenceMesocycleContextForLLM())
      if (refDay) {
        systemFull += refDay
      }
      // El método queda después de biblioteca y referencias para que ninguna capa histórica
      // pueda ganar por posición en el prompt.
      const methodBlock = buildMethodPromptAppendix()
      if (methodBlock) {
        systemFull += `\n\n${methodBlock}`
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
        assertDayEditIsCurrent()
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
        const fallbackSystem = `Eres ProgramingEvo. Debes reescribir SOLO una clase de un día aplicando ${METHOD_EVO_V1_LABEL}.
Devuelve SOLO texto plano de sesión (sin JSON, sin markdown, sin explicaciones). La sesión empieza directamente en A), B), C) o PARTE ÚNICA, con duración dentro del título. No muestres bienvenida, movilidad, calentamiento, preparación, transición, cierre, TIEMPO EFECTIVO ni cronograma 0'-60'.
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
        assertDayEditIsCurrent()
        if (
          forcedText &&
          forcedText !== focusedPrev &&
          (!/^FESTIVO$/i.test(forcedText) || /^FESTIVO$/i.test(focusedPrev))
        ) {
          merged[editFocusClassKey] = forcedText
          focusedChanged = true
          changedSessions = listSessionFieldsChanged(prevDia, merged)
        }
      }

      assertDayEditIsCurrent()
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
      if (err instanceof StaleGenerationResponseError) return
      console.error(err)
      setErrorMsg(err?.message || 'No se pudo aplicar la edición con IA.')
    } finally {
      if (dayEditRunRef.current === dayEditRunId) setDayEditAiBusy(false)
    }
  }

  function switchPreviewTab(id) {
    if (previewTab === 'json' && id !== 'json') {
      try {
        const parsed = JSON.parse(rawJson)
        if (!parsed || !Array.isArray(parsed.dias)) throw new Error('Falta el array "dias"')
        const nextStale = new Set(staleFeedbackKeys)
        for (let diaIdx = 0; diaIdx < parsed.dias.length; diaIdx += 1) {
          const previousDay = weekData?.dias?.[diaIdx] || {}
          const nextDay = parsed.dias[diaIdx] || {}
          for (const { key, feedbackKey } of EVO_SESSION_CLASS_DEFS) {
            const sessionKey = sessionFingerprintKey(diaIdx, key)
            const staleKey = feedbackStaleKey(diaIdx, feedbackKey)
            const previousFeedback = String(previousDay?.[feedbackKey] || '')
            const nextFeedback = String(nextDay?.[feedbackKey] || '')
            const nextSession = String(nextDay?.[key] || '')
            if (nextFeedback !== previousFeedback) {
              sessionFingerprintsRef.current.set(sessionKey, nextSession)
              nextStale.delete(staleKey)
              continue
            }
            const alignedSession = String(sessionFingerprintsRef.current.get(sessionKey) || '')
            if (nextSession !== alignedSession) nextStale.add(staleKey)
            else nextStale.delete(staleKey)
          }
        }
        weekEditRevisionRef.current += 1
        setStaleFeedbackKeys(nextStale)
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
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Espera a que termine la operación en curso antes de abrir el historial.')
      return
    }
    setErrorMsg('')
    const entryTarget = resolveEditorOpenTarget({
      data: {
        ...(entry?.weekDataFull || {}),
        mesociclo:
          entry?.mesociclo ||
          entry?.weekDataFull?.mesociclo ||
          weekState.mesocycle,
        semana: entry?.semana,
        cycle_id: entry?.cycleId || entry?.weekDataFull?.cycle_id,
        cycle_start_date:
          entry?.cycleStartDate || entry?.weekDataFull?.cycle_start_date,
        week_start_date:
          entry?.weekStartDate || entry?.weekDataFull?.week_start_date,
      },
      fallbackSemana: entry?.semana,
      fallbackMeso: weekState.mesocycle,
    })
    const mesociclo = entryTarget.mesocycle
    const entryCycleId = entryTarget.cycleId
    if (!mesociclo || !entryCycleId) {
      setErrorMsg(
        'Esta referencia antigua no tiene ciclo exacto y no puede cargarse automáticamente en el editor actual.',
      )
      return
    }
    let publishedRow = null
    try {
      if (mesociclo && entryCycleId) {
        publishedRow =
          (await getPublishedWeekDraftByMesocycleAndWeek(
            mesociclo,
            entry?.semana,
            entryCycleId,
          )) ||
          (await getPublishedWeekByMesocycleAndWeek(
            mesociclo,
            entry?.semana,
            entryCycleId,
          ))
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
          Number(active.semana) === Number(entry?.semana) &&
          String(active.cycle_id || active.data?.cycle_id || '') === entryCycleId
        ) {
          publishedRow = active
        }
      } catch {
        /* noop */
      }
    }

    let sourceData = null
    if (entry?.weekDataFull) {
      sourceData = normalizeWeekDataForEditor(entry.weekDataFull, {
        semana: Number(entry.semana),
        mesociclo: mesociclo || entry.weekDataFull?.mesociclo || '',
      })
    } else if (publishedRow?.data) {
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
    const target = buildEditorOpenTarget(
      publishedRow,
      sourceData,
      entry.semana,
      mesociclo,
    )
    sourceData.cycle_id = target.cycleId
    sourceData.cycle_start_date = target.cycleStartDate
    sourceData.week_start_date = target.weekStartDate
    requestEditorOpen({
      target,
      sourceData,
      semana: Number(entry.semana),
      fallbackTitle: entry.titulo || publishedRow?.titulo || '',
      rowId: publishedRow?.id || null,
      draftRevision:
        publishedRow?.publication_status === 'draft' &&
        Number.isInteger(Number(publishedRow?.revision))
          ? Number(publishedRow.revision)
          : null,
      sourceWeekId:
        publishedRow?.publication_status === 'draft'
          ? publishedRow?.source_week_id || null
          : publishedRow?.id || null,
      isActive: !!publishedRow?.is_active,
    })
  }

  async function recoverLatestLocalDraft() {
    if (publicationMutationLockRef.current || publicationMutationBusy) {
      setErrorMsg('Espera a que termine la operación en curso antes de recuperar otro borrador.')
      return
    }
    setErrorMsg('')
    const entries = readExactLocalHistory()
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
      data = attachExactCycleIdentity(data, weekState.week)
      saveWeekToHistory(weekState.mesocycle, weekState.week, data)
      lastPersistedDraftRef.current = JSON.stringify(data)
      setHistory(readExactLocalHistory())
      setStatus('previewing')
    } catch (err) {
      setErrorMsg('Error generando Excel: ' + err.message)
      setStatus('error')
    }
  }

  function uint8ToBase64(bytes) {
    let binary = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
    }
    return btoa(binary)
  }

  /**
   * Evalúa una semana con /api/analyze-weekly-program (scoring real del servidor).
   * El análisis SOLO acepta un .xlsx, así que construimos el archivo en memoria
   * desde los datos pasados (sin descargar ni subir nada). Devuelve el JSON o null.
   */
  async function runScoring(weekDataForScore) {
    if (!weekDataForScore) return null
    const runId = scoringRunRef.current + 1
    scoringRunRef.current = runId
    const capturedRevision = weekEditRevisionRef.current
    const capturedTargetIdentity = editorTargetIdentityRef.current
    setEvaluating(true)
    setEvalError('')
    setShowFullAnalysis(false)
    try {
      const candidate = preparePublicationCandidate(weekDataForScore)
      if (!candidate) throw new Error('No hay una semana válida que evaluar.')
      const scoringFingerprint = buildPublicationTargetFingerprint({
        weekData: candidate,
        mesocycle: weekState.mesocycle,
        week: weekState.week,
        phase: weekState.phase || '',
        offer: serializeWeeklyOfferSelection(dayClassPicker),
        contextFingerprint: publicationContextFingerprint,
      })
      const data = { ...candidate }
      data.sheetName = editSheetName || `S${weekState.week || 1}`

      const realDays = Array.isArray(data.dias)
        ? data.dias.filter((dia) =>
            EVO_SESSION_CLASS_DEFS.some(({ key }) => {
              const t = String(dia?.[key] || '').trim()
              return t && !/no programada esta semana/i.test(t) && !/^FESTIVO\b/i.test(t)
            }),
          ).length
        : 0

      let libRows = []
      try {
        libRows = await getCoachExerciseLibrary()
      } catch {
        /* sin biblioteca: evaluación igual */
      }

      const { bytes } = await buildWeekExcelBuffer(data, isExcelFile ? existingBuffer : null, libRows)
      const fileBase64 = uint8ToBase64(bytes)

      const res = await fetch('/api/analyze-weekly-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64,
          mesocycle: weekState.mesocycle,
          week: weekState.week,
          phase: weekState.phase || '',
          previousWeekData: publicationProgressionWeeks.at(-1) || null,
          historicalWeeksData: publicationProgressionWeeks,
          scope: {
            experienciaEvo: true,
            draftMode: true,
            partialWeek: realDays < 6,
            allowedHolidayDays: Array.isArray(candidate?.authorized_holiday_days)
              ? candidate.authorized_holiday_days
              : [],
          },
        }),
      })
      const text = await res.text()
      let json
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error('La respuesta del análisis no es JSON válido.')
      }
      if (!res.ok || json?.error) {
        throw new Error(json?.error || `Error ${res.status} al evaluar la semana.`)
      }
      if (
        scoringRunRef.current !== runId ||
        weekEditRevisionRef.current !== capturedRevision ||
        editorTargetIdentityRef.current !== capturedTargetIdentity
      ) {
        return null
      }
      setEvalResult(json)
      setEvalFingerprint(scoringFingerprint)
      return json
    } catch (err) {
      if (
        scoringRunRef.current !== runId ||
        weekEditRevisionRef.current !== capturedRevision ||
        editorTargetIdentityRef.current !== capturedTargetIdentity
      ) {
        return null
      }
      setEvalError(`No se pudo evaluar la semana: ${err?.message || err}`)
      setEvalResult(null)
      setEvalFingerprint('')
      return null
    } finally {
      if (scoringRunRef.current === runId) setEvaluating(false)
    }
  }

  /** Botón manual «Re-evaluar»: puntúa la semana actual del estado del modal. */
  function handleEvaluateWeek() {
    if (evaluating) return
    let data
    try {
      data = editingJson ? JSON.parse(rawJson) : weekData
    } catch {
      setEvalError('El JSON en modo edición no es válido; corrígelo antes de evaluar.')
      return
    }
    runScoring(data)
  }

  /** Regenera toda la semana añadiendo las correcciones del scoring y vuelve a puntuar (una vez). */
  function handleRegenerateWithCorrections() {
    const reasons = Array.isArray(evalResult?.blockingReasons) ? evalResult.blockingReasons : []
    const correctionNote = reasons.map((r) => `- ${r}`).join('\n')
    handleGenerate({ correctionNote })
  }

  async function refreshMissingVideosPanel(mesociclo, semana) {
    try {
      const rows = await listMissingExerciseVideos({
        mesociclo,
        semana,
        onlyUnresolved: true,
        limit: 250,
      })
      setMissingVideoRows(rows || [])
    } catch {
      setMissingVideoRows([])
    }
  }

  async function handleSaveMissingVideoUrl(rowId, suggestedUrl) {
    if (!rowId) return
    try {
      setMissingVideoBusyId(rowId)
      await updateMissingExerciseVideo(rowId, {
        suggested_url: String(suggestedUrl || '').trim() || null,
        resolved: /^https?:\/\//i.test(String(suggestedUrl || '').trim()),
      })
      setMissingVideoRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                suggested_url: String(suggestedUrl || '').trim(),
                resolved: /^https?:\/\//i.test(String(suggestedUrl || '').trim()),
              }
            : r,
        ),
      )
    } catch (e) {
      setErrorMsg(`No se pudo guardar URL para ejercicio sin vídeo: ${formatClientError(e)}`)
    } finally {
      setMissingVideoBusyId(null)
    }
  }

  async function handleImportExcelChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!claimPublicationMutation(setImportingExcel)) return
    if (!weekState.mesocycle || weekState.week == null) {
      setErrorMsg('Selecciona mesociclo y semana en el panel antes de importar el Excel.')
      releasePublicationMutation(setImportingExcel)
      return
    }
    if (!/\.xlsx$/i.test(file.name)) {
      setErrorMsg('Sube un .xlsx exportado desde este modal (Descargar Excel).')
      releasePublicationMutation(setImportingExcel)
      return
    }
    const initialSnapshot = capturePublicationMutationSnapshot(
      currentPublicationFingerprintRef.current,
    )
    let importedMutationSnapshot = null
    try {
      setErrorMsg('')
      const buf = await file.arrayBuffer()
      let base
      try {
        if (weekData) {
          base = editingJson ? JSON.parse(rawJson) : { ...weekData }
        } else {
          base = buildWeekSkeleton(Number(weekState.week), weekState.mesocycle)
        }
      } catch {
        setErrorMsg('El JSON en modo edición no es válido; desactiva «Editar JSON» o corrígelo antes de importar.')
        return
      }
      base.titulo = String(editTitle || base.titulo || '').trim() || base.titulo
      const imported = await importProgramingEvoWeekFromXlsxBuffer(buf, base)
      if (!publicationMutationIsStillCurrent(initialSnapshot)) {
        throw new Error(
          'La semana cambió mientras se leía el Excel. No se ha aplicado ni guardado la importación.',
        )
      }
      const warnings = imported.warnings || []
      const importReport = imported.importReport
      const data = attachExactCycleIdentity(imported.data, weekState.week)
      loadWeekDataIntoEditor(data, weekState.week, data.titulo || editTitle || '')
      setLastImportReport(importReport || null)

      const targetMeso = data?.mesociclo || weekState.mesocycle || null
      const targetSemana = Number(data?.semana || weekState.week || 0) || null

      // Persistencia en Supabase por mesociclo+semana (borrador: no activa el Hub al crear fila nueva).
      try {
        const normalized = normalizeWeekDataForEditor(
          attachExactCycleIdentity(
            { ...data, mesociclo: targetMeso, semana: targetSemana },
            targetSemana,
          ),
          { semana: targetSemana, mesociclo: targetMeso },
        )
        if (targetMeso && targetSemana != null) {
          const sourceWeekId = editingPublishedSourceId || null
          const fingerprint = buildPublicationTargetFingerprint({
            weekData: normalized,
            mesocycle: targetMeso,
            week: targetSemana,
            phase: weekState.phase || '',
            offer: normalized?.oferta_semanal || serializeWeeklyOfferSelection(dayClassPicker),
            contextFingerprint: publicationContextFingerprint,
          })
          currentPublicationFingerprintRef.current = fingerprint
          importedMutationSnapshot = capturePublicationMutationSnapshot(fingerprint)
          const r = await upsertPublishedWeekBySlot(normalized, targetMeso, targetSemana, {
            activateForHub: false,
            contentFingerprint: fingerprint,
            qualityGate: buildPublicationQualityGate({
              evaluation: null,
              evaluationFingerprint: '',
              targetFingerprint: fingerprint,
              contextReady: false,
            }),
            sourceWeekId,
            draftId: hasEditingDraftVersion ? editingPublishedRowId : null,
            expectedRevision: hasEditingDraftVersion ? Number(editingDraftRevision) : 0,
          })
          if (
            r?.id &&
            publicationMutationTargetStillCurrent(importedMutationSnapshot)
          ) {
            setEditingPublishedRowId(r.id)
            setEditingDraftRevision(Number(r.revision))
            setEditingPublishedIsActive(false)
          }
        }
      } catch (syncErr) {
        warnings.push(`No se pudo sincronizar automático a Supabase: ${formatClientError(syncErr)}`)
      }

      if (importReport?.missingExercises?.length && targetMeso && targetSemana != null) {
        try {
          await upsertMissingExerciseVideos(
            importReport.missingExercises.map((m) => ({
              mesociclo: targetMeso,
              semana: targetSemana,
              day_key: m.day_key || '',
              day_name: m.day_name || null,
              class_label: m.class_label,
              exercise_name: m.exercise_name,
              exercise_norm: m.exercise_norm,
              resolved: false,
            })),
          )
          await refreshMissingVideosPanel(targetMeso, targetSemana)
        } catch (upErr) {
          warnings.push(`No se pudo guardar lista de ejercicios sin vídeo: ${formatClientError(upErr)}`)
        }
      } else if (targetMeso && targetSemana != null) {
        await refreshMissingVideosPanel(targetMeso, targetSemana)
      }

      const importedMutationIsCurrent =
        !importedMutationSnapshot ||
        publicationMutationIsStillCurrent(importedMutationSnapshot)
      if (warnings.length) {
        setDraftNotice(
          importedMutationIsCurrent
            ? `Excel importado y sincronizado. Avisos: ${warnings.join(' · ')}`
            : `La importación enviada se guardó, pero conservamos tus cambios posteriores en el editor. Avisos: ${warnings.join(' · ')}`,
        )
        window.setTimeout(() => setDraftNotice(''), 9000)
      } else {
        setDraftNotice(
          importedMutationIsCurrent
            ? 'Excel importado y guardado en Supabase como borrador (coaches siguen con la semana activa).'
            : 'La importación enviada se guardó, pero tus cambios posteriores siguen en el editor y aún no están guardados.',
        )
        window.setTimeout(() => setDraftNotice(''), 5500)
      }
    } catch (err) {
      setErrorMsg(String(err?.message || err) || 'No se pudo importar el Excel.')
    } finally {
      releasePublicationMutation(setImportingExcel)
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
                  disabled={publicationMutationBusy}
                  className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 transition-all"
                >
                  Recuperar ultimo borrador local
                </button>
                <button
                  type="button"
                  onClick={handleOpenActivePublishedWeekForEdit}
                  disabled={openingActiveEdit || publicationMutationBusy}
                  className="text-[9px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-xl border border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 transition-all disabled:opacity-50"
                >
                  {openingActiveEdit ? 'Abriendo semana activa…' : 'Editar semana activa del Hub'}
                </button>
              </div>
            </div>
            {status === 'previewing' && weekData && (
              <p className="text-[9px] text-neutral-500 font-medium mt-2 max-w-xl leading-relaxed">
                Borrador local: se guarda en este navegador (historial del mesociclo) al pulsar «Guardar borrador», al bajar el
                Excel, al cerrar el modal o unos segundos después de editar. «Guardar borrador en Hub» sube el JSON a Supabase para este
                meso/S <span className="font-semibold">sin</span> cambiar la semana que los coaches ven. «Publicar Hub» activa esta semana
                en la app. Si editaste el Excel descargado desde aquí, usa «Importar Excel» en vista previa para volcar sesiones y feedbacks al JSON.
                {editingPublishedRowId ? (
                  <span className="block text-indigo-700/90 mt-0.5">
                    {editingPublishedIsActive
                      ? 'Esta fila es la semana activa en el Hub: «Guardar cambios» actualiza lo que ven los coaches.'
                      : 'Esta fila está en Supabase como borrador: «Guardar cambios» o «Guardar borrador en Hub» actualizan datos; «Publicar Hub» la hace visible para coaches.'}
                  </span>
                ) : null}
              </p>
            )}
            {draftNotice ? (
              <p className="text-[9px] text-emerald-700 font-semibold mt-1.5" role="status">
                {draftNotice}
              </p>
            ) : null}
            {lastImportReport ? (
              <div className="mt-2 rounded-xl border border-indigo-200 bg-indigo-50/60 px-3 py-2 space-y-1">
                <p className="text-[10px] font-bold text-indigo-900 uppercase tracking-widest">
                  Importación automática aplicada
                </p>
                <p className="text-[10px] text-indigo-900/90">
                  {lastImportReport.sessionsImported || 0} sesiones importadas · {lastImportReport.videosLinked || 0} vídeos enlazados ·{' '}
                  {lastImportReport.missingCount || 0} ejercicios sin vídeo
                </p>
              </div>
            ) : null}
          </div>
          <button onClick={handleCloseModal} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-neutral-600 hover:text-red-500 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-4 space-y-4">
          {status === 'previewing' && missingVideoRows.length > 0 ? (
            <section className="rounded-2xl border border-amber-300/70 bg-amber-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                  Ejercicios sin vídeo ({missingVideoRows.length})
                </p>
                <p className="text-[10px] text-amber-900/80">
                  Editables aquí (Marian): añade URL y guarda.
                </p>
              </div>
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {missingVideoRows.map((r) => (
                  <div key={r.id} className="rounded-lg border border-amber-300/70 bg-white/80 px-3 py-2">
                    <p className="text-[11px] font-bold text-[#1A0A1A]">
                      {r.exercise_name}{' '}
                      <span className="font-medium text-neutral-600">
                        · {r.day_name || r.day_key || '—'} · {r.class_label || '—'}
                      </span>
                    </p>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        type="url"
                        value={r.suggested_url || ''}
                        onChange={(e) =>
                          setMissingVideoRows((prev) =>
                            prev.map((x) => (x.id === r.id ? { ...x, suggested_url: e.target.value } : x)),
                          )
                        }
                        placeholder="https://..."
                        className="flex-1 h-9 rounded-lg border border-amber-300 px-2.5 text-[11px] text-[#1A0A1A] bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveMissingVideoUrl(r.id, r.suggested_url)}
                        disabled={missingVideoBusyId === r.id}
                        className="h-9 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wider"
                      >
                        {missingVideoBusyId === r.id ? 'Guardando…' : 'Guardar URL'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* IDLE / INPUT */}
          {(status === 'idle' || status === 'error') && (
            <>
              <section className="rounded-2xl border border-evo-accent/25 bg-white p-5 shadow-sm space-y-4">
                <div>
                  <p className="text-[10px] font-bold text-evo-accent uppercase tracking-widest">
                    1 · Decide qué quieres diseñar
                  </p>
                  <h3 className="mt-1 text-base font-bold text-[#1A0A1A]">
                    Días y contexto antes de generar
                  </h3>
                  <p className="mt-1 text-[10px] text-neutral-600 leading-relaxed">
                    Puedes crear toda la semana o solo algunos días. Lo que no selecciones queda pendiente y no se borra.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-[#1A0A1A]">
                      Días que quieres generar ahora
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={briefingStatus === 'loading'}
                        onClick={() =>
                          setGenerationDayPicker(buildGenerationDaySelectionFromOffer(dayClassPicker))
                        }
                        className="text-[9px] font-bold uppercase text-evo-accent px-2 py-1 rounded-lg border border-evo-accent/20 hover:bg-evo-accent/10 disabled:opacity-40"
                      >
                        Toda la semana
                      </button>
                      <button
                        type="button"
                        disabled={briefingStatus === 'loading'}
                        onClick={() =>
                          setGenerationDayPicker(
                            Object.fromEntries(EXCEL_DAY_ORDER.map((day) => [day, false])),
                          )
                        }
                        className="text-[9px] font-bold uppercase text-neutral-600 px-2 py-1 rounded-lg border border-black/10 hover:bg-gray-100 disabled:opacity-40"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {EXCEL_DAY_ORDER.map((day) => {
                      const offeredCount = getSelectedClassKeysForDay(dayClassPicker, day).length
                      const checked = !!generationDayPicker?.[day] && offeredCount > 0
                      return (
                        <label
                          key={`generation-${day}`}
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                            checked
                              ? 'border-evo-accent/40 bg-evo-accent/[0.06] text-evo-accent'
                              : offeredCount
                                ? 'border-black/10 bg-neutral-50 text-[#1A0A1A] cursor-pointer'
                                : 'border-black/5 bg-neutral-100 text-neutral-400 cursor-not-allowed'
                          }`}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-wide">{day}</span>
                          <span className="flex items-center gap-2">
                            <span className="text-[8px] font-semibold normal-case">
                              {offeredCount ? `${offeredCount} clases` : 'sin oferta'}
                            </span>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!offeredCount || briefingStatus === 'loading'}
                              onChange={() =>
                                setGenerationDayPicker((prev) => ({ ...prev, [day]: !checked }))
                              }
                              className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                            />
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-[9px] font-semibold text-neutral-600">
                    Seleccionados: {selectedGenerationDayCount} {selectedGenerationDayCount === 1 ? 'día' : 'días'}.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#1A0A1A]">
                    Contexto e instrucciones para esta creación
                  </label>
                  <textarea
                    value={addendum}
                    disabled={briefingStatus === 'loading'}
                    onChange={(e) => setAddendum(e.target.value.slice(0, ADDENDUM_MAX_CHARS))}
                    rows={4}
                    maxLength={ADDENDUM_MAX_CHARS}
                    placeholder="Ej.: quiero probar una Semana 5 desde cero; el miércoles evita tren inferior, el viernes quiero una dinámica por parejas y utiliza landmine durante toda la sesión si se monta."
                    className="w-full bg-neutral-50 border border-black/10 rounded-xl px-3 py-2.5 text-sm !text-[#1A0A1A] disabled:opacity-60"
                  />
                  <p className="text-[9px] text-neutral-500 leading-snug">
                    Este texto se usa tanto para preparar el enfoque como para generar los entrenamientos.
                  </p>
                </div>

                <details className="rounded-xl border border-black/10 bg-neutral-50/70 px-3 py-2.5">
                  <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-wider text-[#1A0A1A]">
                    Revisar o cambiar las clases de cada día
                  </summary>
                  <div className="mt-3 space-y-2">
                    {EXCEL_DAY_ORDER.map((day) => (
                      <div key={`offer-${day}`} className="rounded-lg border border-black/10 bg-white p-2.5">
                        <p className="mb-2 text-[9px] font-bold uppercase tracking-wide text-[#1A0A1A]">{day}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {EVO_SESSION_CLASS_DEFS.map(({ key, label, color }) => {
                            const checked = !!dayClassPicker?.[day]?.[key]
                            return (
                              <label
                                key={`${day}-${key}`}
                                style={checked ? { borderColor: color, color } : undefined}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-bold select-none transition-colors ${
                                  checked
                                    ? 'bg-white shadow-sm'
                                    : 'border-black/10 bg-gray-50 text-neutral-500'
                                } ${briefingStatus === 'loading' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={briefingStatus === 'loading'}
                                  onChange={() => {
                                    const nextChecked = !checked
                                    setDayClassPicker((prev) => ({
                                      ...prev,
                                      [day]: { ...(prev[day] || {}), [key]: nextChecked },
                                    }))
                                    if (nextChecked) {
                                      setGenerationDayPicker((prev) => ({ ...prev, [day]: true }))
                                    }
                                  }}
                                  className="rounded border-black/20 text-evo-accent focus:ring-evo-accent/30"
                                />
                                {label}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    <button
                      type="button"
                      disabled={briefingStatus === 'loading'}
                      onClick={() => {
                        const offer = buildCurrentWeeklyOfferSelection()
                        setDayClassPicker(offer)
                        setGenerationDayPicker(buildGenerationDaySelectionFromOffer(offer))
                      }}
                      className="text-[9px] font-bold uppercase text-evo-accent px-2 py-1 rounded-lg border border-evo-accent/20 hover:bg-evo-accent/10 disabled:opacity-40"
                    >
                      Recuperar oferta actual
                    </button>
                  </div>
                </details>

                {briefingIsStale ? (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-900">
                    Has cambiado días, clases o contexto. Actualiza la propuesta para que tenga en cuenta los cambios.
                  </p>
                ) : null}

                {(briefingStatus === 'idle' || briefingStatus === 'error' || briefingIsStale) && (
                  <button
                    type="button"
                    onClick={prepareBriefing}
                    disabled={selectedGenerationDayCount === 0}
                    className="w-full px-5 py-3 rounded-xl bg-evo-accent text-white text-[11px] font-bold uppercase tracking-wide shadow-sm hover:bg-evo-accent-hover disabled:opacity-45"
                  >
                    {briefingIsStale ? 'Actualizar propuesta con estos cambios' : 'Preparar propuesta con estos datos'}
                  </button>
                )}
              </section>

              {briefingStatus === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 px-4 space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-evo-accent/30 border-t-evo-accent animate-spin" />
                  <p className="text-sm font-bold text-[#1A0A1A] text-center">
                    {briefingPhase === 'context'
                      ? 'Cargando las semanas útiles…'
                      : briefingPhase === 'verify'
                        ? 'Verificando el histórico exacto…'
                        : 'Contexto listo. Diseñando el enfoque con IA…'}
                  </p>
                  <p className="text-[11px] text-neutral-700 text-center max-w-lg leading-relaxed">
                    {briefingPhase === 'context'
                      ? 'Se seleccionan solo las semanas anteriores que sirven para la progresión y unas pocas referencias de variedad, junto con los cambios y notas recientes.'
                      : briefingPhase === 'verify'
                        ? 'Comprobando que las semanas elegidas pertenecen al ciclo y a las fechas correctas antes de permitir la generación.'
                        : 'La IA está convirtiendo ese contexto, tus instrucciones, los días y la oferta real de clases en una arquitectura semanal. Esta suele ser la parte más lenta.'}
                  </p>
                  <p className="text-[10px] font-semibold text-neutral-500">
                    {briefingElapsedSec > 0
                      ? `Tiempo transcurrido: ${formatGenElapsed(briefingElapsedSec)}`
                      : 'Iniciando…'}
                  </p>
                </div>
              )}

              {briefingStatus === 'error' && (
                <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 space-y-3">
                  <p className="text-sm font-bold text-red-900">No se pudo preparar la propuesta</p>
                  <p className="text-xs text-red-800/90">{briefingErrorMsg}</p>
                  {briefingErrorCode === 'missing_admin_secret' ||
                  briefingErrorCode === 'invalid_admin_secret' ? (
                    <div className="space-y-2 rounded-xl border border-red-200 bg-white/80 p-3">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-red-950">
                        Clave de administración
                      </label>
                      <input
                        type="password"
                        autoComplete="off"
                        value={briefingAdminSecretInput}
                        disabled={briefingAuthBusy}
                        onChange={(e) => {
                          setBriefingAdminSecretInput(e.target.value)
                          setBriefingErrorMsg('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            activateBriefingAdminSession()
                          }
                        }}
                        placeholder="No es el código EVO19"
                        className="w-full rounded-xl border border-red-200 bg-white px-3 py-2 text-sm !text-[#1A0A1A] focus:border-red-400 focus:outline-none disabled:opacity-60"
                      />
                      <p className="text-[9px] leading-relaxed text-red-900/75">
                        Se valida sin modificar el histórico y queda activa solo en esta pestaña.
                      </p>
                      <button
                        type="button"
                        onClick={activateBriefingAdminSession}
                        disabled={briefingAuthBusy || !briefingAdminSecretInput.trim()}
                        className="text-[11px] font-bold uppercase px-4 py-2 rounded-xl bg-red-900 text-white hover:bg-red-950 disabled:opacity-45"
                      >
                        {briefingAuthBusy ? 'Validando…' : 'Validar y preparar propuesta'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={prepareBriefing}
                      className="text-[11px] font-bold uppercase px-4 py-2 rounded-xl bg-white border border-red-300 text-red-900 hover:bg-red-100"
                    >
                      Reintentar con estos datos
                    </button>
                  )}
                </div>
              )}

              {briefingStatus === 'error' &&
                briefingErrorCode !== 'missing_admin_secret' &&
                briefingErrorCode !== 'invalid_admin_secret' && (
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
                    <p className="pt-2 border-t border-black/10 text-[10px] font-semibold text-emerald-700">
                      Propuesta aprobada. Revisa arriba los días y el contexto antes de generar.
                    </p>
                  )}
                </div>
              )}

              {((briefingStatus === 'ready' && proposalStep === 'addons') ||
                (briefingStatus === 'error' && proposalAccepted && proposalStep === 'addons')) && (
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={selectedGenerationDayCount === 0 || briefingIsStale}
                  className="w-full px-6 py-3.5 rounded-xl bg-evo-accent text-white text-[12px] font-bold uppercase tracking-wide shadow-md hover:bg-evo-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {briefingIsStale
                    ? 'Actualiza la propuesta antes de generar'
                    : selectedGenerationDayCount
                      ? `Generar ${selectedGenerationDayCount} ${selectedGenerationDayCount === 1 ? 'día' : 'días'}`
                      : 'Selecciona al menos un día'}
                </button>
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
                                disabled={publicationMutationBusy}
                                className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 disabled:opacity-50 px-2 py-1 rounded-lg transition-all border border-evo-accent/20"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  deleteWeekFromHistory(weekState.mesocycle, entry.semana, entry.entryId || null)
                                  setHistory(readExactLocalHistory())
                                }}
                                disabled={publicationMutationBusy}
                                className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 disabled:opacity-50 px-2 py-1 rounded-lg transition-all"
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
                  Generaremos únicamente los días y clases que hayas marcado. ~1–5 min (una llamada por día; desde el
                  día 2 la IA recibe un prompt más ligero para gastar menos). En Vercel hace falta plan Pro para tiempos
                  largos.
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
                <p className="text-[11px] text-neutral-600 text-center font-bold uppercase tracking-widest">
                  Memoria AI activa · Coherencia EVO
                  {genElapsedSec > 0 ? ` · ${formatGenElapsed(genElapsedSec)}` : ''}
                  {!genStep.includes('Generando') && genStep ? ' · preparando' : ''}
                </p>
                <p className="text-[10px] text-neutral-500 text-center max-w-md">
                  Build {EVO_BUILD_ID}
                  {!genStep.includes('Generando') && genElapsedSec >= 30
                    ? ' · si sigue en preparación, cancela y recarga; el briefing guardado reaparece (es normal, no es caché vieja)'
                    : ''}
                </p>
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
              {/* Scoring automático — resultado encima de la tabla */}
              {(evaluating || evalError || evalResult) && (
                <div className="space-y-2">
                  {evaluating && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      <p className="text-[12px] font-bold text-amber-800 uppercase tracking-wide">Evaluando calidad…</p>
                    </div>
                  )}
                  {evalError && !evaluating && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-[11px] font-medium text-red-700">{evalError}</p>
                      <button
                        type="button"
                        onClick={handleEvaluateWeek}
                        className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-red-700 text-[10px] font-bold uppercase tracking-wide hover:bg-red-100"
                      >
                        Reintentar evaluación
                      </button>
                    </div>
                  )}
                  {evalResult && !evaluating && typeof evalResult.scoreDisplay === 'number' && (
                    <div
                      className={`rounded-xl border px-4 py-3 space-y-2 ${
                        publicationReady
                          ? 'bg-emerald-50 border-emerald-200'
                          : evaluationIsCurrent && evalResult.scoreDisplay >= 60
                            ? 'bg-amber-50 border-amber-200'
                            : 'bg-red-50 border-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span
                          className={`px-3 py-1.5 rounded-lg text-[12px] font-bold uppercase tracking-wide ${
                            publicationReady
                              ? 'bg-emerald-600 text-white'
                              : evaluationIsCurrent && evalResult.scoreDisplay >= 60
                                ? 'bg-amber-500 text-white'
                                : 'bg-red-600 text-white'
                          }`}
                        >
                          {publicationReady
                            ? `Semana aprobada · ${evalResult.scoreDisplay}/100`
                            : !evaluationIsCurrent
                              ? `Evaluación caducada · ${evalResult.scoreDisplay}/100`
                              : `Revisión necesaria · ${evalResult.scoreDisplay}/100`}
                        </span>
                        {String(evalResult.reportText || '').trim() && (
                          <button
                            type="button"
                            onClick={() => setShowFullAnalysis((v) => !v)}
                            className="text-[10px] font-bold uppercase tracking-wide text-evo-accent hover:underline"
                          >
                            {showFullAnalysis ? 'Ocultar análisis' : 'Ver análisis completo'}
                          </button>
                        )}
                      </div>

                      {!publicationReady && (
                        <ul className="list-disc pl-5 space-y-0.5">
                          {[...(currentPublicationGate.blockers || []), ...(currentPublicationGate.pending || [])]
                            .slice(0, 8)
                            .map((reason, i) => (
                              <li key={`gate-${i}`} className="text-[11px] text-red-900 leading-snug">
                                {reason}
                              </li>
                            ))}
                        </ul>
                      )}

                      {/* Amarillo (60-79): alerts */}
                      {evalResult.scoreDisplay >= 60 &&
                        evalResult.scoreDisplay < 80 &&
                        Array.isArray(evalResult.alerts) &&
                        evalResult.alerts.length > 0 && (
                          <ul className="list-disc pl-5 space-y-0.5">
                            {evalResult.alerts.slice(0, 8).map((a, i) => (
                              <li key={i} className="text-[11px] text-amber-900 leading-snug">{a}</li>
                            ))}
                          </ul>
                        )}

                      {/* Rojo (<60): blockingReasons + regenerar con correcciones */}
                      {evalResult.scoreDisplay < 60 && (
                        <>
                          {Array.isArray(evalResult.blockingReasons) && evalResult.blockingReasons.length > 0 && (
                            <ul className="list-disc pl-5 space-y-0.5">
                              {evalResult.blockingReasons.slice(0, 10).map((b, i) => (
                                <li key={i} className="text-[11px] text-red-900 leading-snug">{b}</li>
                              ))}
                            </ul>
                          )}
                          <button
                            type="button"
                            onClick={handleRegenerateWithCorrections}
                            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold uppercase tracking-wide shadow-sm"
                          >
                            Regenerar con estas correcciones
                          </button>
                        </>
                      )}

                      {showFullAnalysis && String(evalResult.reportText || '').trim() && (
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 border border-black/10 p-3 text-[10px] leading-relaxed text-neutral-800">
                          {evalResult.reportText}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )}
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
                <div className={`flex items-center gap-2 px-3 py-1.5 border rounded-xl ${
                  methodReview?.valid
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${methodReview?.valid ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${
                    methodReview?.valid ? 'text-emerald-600' : 'text-red-700'
                  }`}>
                    {methodReview?.valid ? 'Método EVO listo' : 'Revisar Método EVO'}
                  </p>
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
              {methodReview && (methodReview.errors.length > 0 || methodReview.warnings.length > 0) && (
                <details className={`rounded-xl border px-3 py-2 ${
                  methodReview.errors.length
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <summary className={`text-[10px] font-bold uppercase cursor-pointer ${
                    methodReview.errors.length ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    {METHOD_EVO_V1_LABEL} · {methodReview.errors.length} errores · {methodReview.warnings.length} avisos
                  </summary>
                  <ul className="mt-2 list-disc pl-5 space-y-1">
                    {[...methodReview.errors, ...methodReview.warnings].slice(0, 10).map((entry, index) => {
                      const day = weekData?.dias?.[entry.dayIndex]?.nombre
                      return (
                        <li key={`${entry.code}-${entry.dayIndex ?? 'week'}-${index}`} className="text-[10px] leading-snug text-neutral-800">
                          {day ? `${day} · ` : ''}{entry.message}
                        </li>
                      )
                    })}
                  </ul>
                </details>
              )}
              {pendingOfferedDays.length > 0 && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] text-sky-900">
                  <span className="font-bold uppercase tracking-wide">Semana todavía parcial · </span>
                  quedan clases por diseñar en {pendingOfferedDays.join(', ')}. Usa «Elegir días / continuar»; la app conservará lo ya creado.
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
                    {editingPublishedIsActive ? 'Editando semana activa en Hub' : 'Editando borrador en Hub (no visible aún)'}
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
                            disabled={publicationMutationBusy}
                            className="text-[9px] text-evo-accent font-bold uppercase hover:bg-evo-accent/10 disabled:opacity-50 px-2 py-1 rounded border border-evo-accent/20"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              deleteWeekFromHistory(weekState.mesocycle, entry.semana, entry.entryId || null)
                              setHistory(readExactLocalHistory())
                            }}
                            disabled={publicationMutationBusy}
                            className="text-[9px] text-red-500 font-bold uppercase hover:bg-red-50 disabled:opacity-50 px-2 py-1 rounded"
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
                                    rows={5}
                                    value={dia[feedbackKey] || ''}
                                    onChange={(e) =>
                                      handleFeedbackFieldChange(
                                        diaIdx,
                                        sessionKey,
                                        feedbackKey,
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Asistente Marian: 3–5 bullets cortos (-): intención · dónde rompe · quiero/no · si falla→qué haces · sensación/ritmo. Sin resumir el entreno. ~25–70 palabras."
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
          <button
            onClick={handleCloseModal}
            disabled={publicationMutationBusy}
            className="text-[10px] text-neutral-600 font-bold uppercase tracking-widest hover:text-[#1A0A1A] disabled:opacity-50 transition-all"
          >
            Cancelar
          </button>
          <div className="flex flex-wrap justify-end items-center gap-3">
            {/* Input oculto para Importar Excel (acción secundaria del menú «Más opciones»). */}
            <input
              ref={excelImportInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              disabled={publicationMutationBusy}
              onChange={handleImportExcelChange}
            />
            {status === 'previewing' && (
              <button
                disabled={publicationMutationBusy}
                onClick={() => {
                  const nextDays = pendingOfferedDays.length
                    ? new Set(pendingOfferedDays)
                    : new Set(selectedGenerationDays)
                  setGenerationDayPicker(
                    Object.fromEntries(EXCEL_DAY_ORDER.map((day) => [day, nextDays.has(day)])),
                  )
                  setStatus('idle')
                  setBriefingStatus('idle')
                  setBriefingErrorMsg('')
                  setBriefingInputFingerprint('')
                  setProposalAccepted(false)
                  setProposalStep('review')
                  setProposalTitle('')
                  setProposalNarrative('')
                  setProposalSuggestedFocus('')
                }}
                className="px-5 py-2.5 rounded-xl border border-black/10 bg-white text-neutral-600 hover:text-[#1A0A1A] hover:bg-gray-50 disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
              >
                Elegir días / continuar
              </button>
            )}
            {status === 'previewing' && weekData && generatedDaysCount >= 3 && (
              <button
                type="button"
                onClick={handleEvaluateWeek}
                disabled={evaluating}
                className="px-5 py-2.5 rounded-xl border border-amber-200 bg-amber-50/90 text-amber-900 hover:bg-amber-100 disabled:opacity-50 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                title="Analiza la calidad de la semana con el scoring automático del servidor."
              >
                {evaluating ? 'Evaluando…' : evalResult ? 'Re-evaluar' : 'Evaluar semana'}
              </button>
            )}
            {status === 'previewing' && (
              <>
                <button
                  onClick={handlePublish}
                  disabled={
                    publicationMutationBusy ||
                    published ||
                    !publicationReady
                  }
                  className="flex items-center gap-2 px-8 py-3 rounded-xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-50 text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-evo-accent/20 active:scale-95"
                  title={
                    pendingOfferedDays.length > 0
                      ? `Completa antes las clases pendientes de: ${pendingOfferedDays.join(', ')}`
                      : !publicationReady
                        ? currentPublicationGate.blockers?.[0] ||
                          currentPublicationGate.pending?.[0] ||
                          'Evalúa y aprueba esta versión exacta antes de publicar.'
                        : 'Publica esta versión validada de forma atómica y la hace visible para coaches.'
                  }
                >
                  {published ? '✓ Publicado' : publishing ? 'Publicando...' : 'Publicar Hub'}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Descargar Excel
                </button>

                {/* Más opciones (acciones secundarias) — el menú se abre hacia arriba */}
                {weekData && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setMoreMenuOpen((o) => !o)}
                      className="px-4 py-2.5 rounded-xl border border-black/10 bg-white text-neutral-600 hover:text-[#1A0A1A] hover:bg-gray-50 text-[13px] font-bold tracking-widest transition-all shadow-sm leading-none"
                      title="Más opciones"
                      aria-haspopup="menu"
                      aria-expanded={moreMenuOpen}
                    >
                      ···
                    </button>
                    {moreMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMoreMenuOpen(false)} />
                        <div className="absolute right-0 bottom-full mb-2 z-20 w-60 rounded-xl border border-black/10 bg-white shadow-xl p-1.5 flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => { setMoreMenuOpen(false); handleSaveDraft() }}
                            className="text-left px-3 py-2 rounded-lg hover:bg-emerald-50 text-emerald-900 text-[11px] font-bold uppercase tracking-wide"
                          >
                            Guardar borrador
                          </button>
                          <button
                            type="button"
                            onClick={() => { setMoreMenuOpen(false); handleSaveHubDraft() }}
                            disabled={publicationMutationBusy || !weekState.mesocycle || weekState.week == null}
                            className="text-left px-3 py-2 rounded-lg hover:bg-sky-50 disabled:opacity-50 text-sky-900 text-[11px] font-bold uppercase tracking-wide"
                            title="Guarda en Supabase para este mesociclo y semana sin cambiar la semana activa para coaches."
                          >
                            {savingHubDraft ? 'Guardando en Hub…' : 'Guardar borrador en Hub'}
                          </button>
                          {editingPublishedRowId && (
                            <button
                              type="button"
                              onClick={() => { setMoreMenuOpen(false); handleSavePublishedEdit() }}
                              disabled={publicationMutationBusy}
                              className="text-left px-3 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-50 text-indigo-700 text-[11px] font-bold uppercase tracking-wide"
                            >
                              {savedPublishedEdit ? '✓ Cambios guardados' : savingPublishedEdit ? 'Guardando...' : 'Guardar cambios'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setMoreMenuOpen(false); excelImportInputRef.current?.click() }}
                            disabled={publicationMutationBusy || !weekState.mesocycle || weekState.week == null}
                            className="text-left px-3 py-2 rounded-lg hover:bg-violet-50 disabled:opacity-50 text-violet-900 text-[11px] font-bold uppercase tracking-wide"
                            title="Solo el Excel descargado desde aquí (mismo orden de columnas). Recupera ediciones hechas en Excel al JSON del modal."
                          >
                            {importingExcel ? 'Importando…' : 'Importar Excel'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
