import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getActiveWeek,
  createCoachSession,
  saveMessage,
  updateSessionActivity,
  getCoachGuideSettings,
  getCoachExerciseLibrary,
  listCoachSessionFeedbackForWeek,
  coachHasReadHandoverForWeek,
  recordCoachHandoverRead,
  listTodayHandoffs,
  createWeeklyCheckin,
  getAssistantWeekContext,
  insertAssistantQuestionHistory,
  verifyCoachAccessCode,
} from '../../lib/supabase.js'
import { AI_CONFIG, COACH_ASSISTANT_MODEL } from '../../constants/config.js'
import { buildCoachSupportSystemPrompt } from '../../constants/systemPromptCoachSupport.js'
import { buildSupportCacheKey, getSupportCachedReply, setSupportCachedReply, supportSlug } from '../../utils/coachSupportCache.js'
import {
  buildCoachSupportLibraryBlock,
  coachSupportContextFingerprint,
  inferCoachSupportSessionContext,
  questionHasExplicitCoachContext,
} from '../../utils/coachSupportContext.js'
import CoachTodayScreen from './CoachTodayScreen.jsx'
import CoachWeekOverviewPanel from './CoachWeekOverviewPanel.jsx'
import CoachProfilePanel from './CoachProfilePanel.jsx'
import CoachExerciseLibraryPanel from './CoachExerciseLibraryPanel.jsx'
import CoachSessionFeedbackForm from './CoachSessionFeedbackForm.jsx'
import {
  CoachGuideCentro,
  CoachGuideClases,
  CoachGuideMesociclos,
  CoachGuideUsoApp,
  CoachGuideMaterial,
  CoachGuideSoporteProtocol,
} from './CoachGuideViews.jsx'
import { coachBg, coachBorder, coachText, coachNav, coachUi, coachFieldAuth } from './coachTheme.js'
import EvoLogo from '../EvoLogo.jsx'
import {
  COACH_CODE_KEY,
  isCoachIndividualAuthEnabled,
  isCoachSharedCodeFallbackEnabled,
} from '../../constants/coachAccess.js'
import { explainAnthropicFetchFailure } from '../../utils/explainAnthropicFetchFailure.js'
import {
  parseAnthropicProxyBody,
  isAnthropicProxyFailure,
  getAnthropicProxyErrorMessage,
} from '../../utils/parseAnthropicProxyBody.js'
import { extractAnthropicTextBlocks } from '../../utils/extractAnthropicTextBlocks.js'
import { coachFeedbackRowIndicatesChange } from '../../utils/coachSessionFeedback.js'
import { mergeServerFeedbackIntoLog } from '../../utils/coachFeedbackLocalLog.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { DAYS_ES } from '../../constants/evoColors.js'
import { buildCoachNewWeekToastBody } from '../../utils/coachSessionPrep.js'
import CoachToastStack, { useCoachToastQueue } from './CoachToastStack.jsx'
import WeeklyCheckinModal from './WeeklyCheckinModal.jsx'
import { isoWeekString, madridCheckinGateParts, madridDateParts, defaultActiveDayNameFromWeek } from '../../utils/coachTime.js'
import { normalizePublishedWeekForConsumers } from '../../utils/normalizeWeekDataForEditor.js'
import { hasIndividualCoachAccess } from '../../lib/coachIdentityAccess.js'
import { resolveCoachAccessMode } from '../../lib/coachAccessMode.js'

const COACH_NAME_KEY = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY = 'evo_coach_auth'
const COACH_LAST_SEEN_WEEK_KEY = 'evo_coach_last_seen_week_id'
const COACH_NOTICE_READ_KEY = 'evo_coach_notice_read_v1'
const COACH_NOTICE_READ_MAX = 20

export { COACH_CODE_KEY }

function readCoachNoticeMap() {
  try {
    const raw = localStorage.getItem(COACH_NOTICE_READ_KEY)
    const parsed = JSON.parse(raw || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function markCoachNoticeSeen(fingerprint) {
  if (!fingerprint) return
  try {
    const prev = readCoachNoticeMap()
    const next = { ...prev, [fingerprint]: Date.now() }
    const entries = Object.entries(next).sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    const trimmed = Object.fromEntries(entries.slice(0, COACH_NOTICE_READ_MAX))
    localStorage.setItem(COACH_NOTICE_READ_KEY, JSON.stringify(trimmed))
  } catch {
    /* noop */
  }
}

function coachNoticeWasSeen(fingerprint) {
  if (!fingerprint) return false
  const map = readCoachNoticeMap()
  return Object.prototype.hasOwnProperty.call(map, fingerprint)
}

function stableSmallHash(text) {
  let h = 0
  const s = String(text || '')
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h.toString(16)
}

function buildCoachNoticeFingerprint(settings) {
  const msg = String(settings?.active_notice || '').trim()
  if (!msg) return ''
  const updated = String(settings?.updated_at || '').trim()
  if (updated) return `coach_notice:${updated}`
  const title = 'Aviso del centro'
  return `coach_notice_hash:${stableSmallHash(`${title}::${msg}`)}`
}

function normalizeSupportToken(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function dayNameToDayKey(dayName) {
  const n = normalizeSupportToken(dayName)
  if (n.includes('lunes')) return 'monday'
  if (n.includes('martes')) return 'tuesday'
  if (n.includes('miercoles')) return 'wednesday'
  if (n.includes('jueves')) return 'thursday'
  if (n.includes('viernes')) return 'friday'
  if (n.includes('sabado')) return 'saturday'
  return null
}

function extractAssistantWeeklyContextBlock(userMsg, weekCtx) {
  if (!weekCtx) return ''
  const msg = normalizeSupportToken(userMsg)
  const msgTokens = new Set(msg.split(/\W+/).filter((t) => t.length >= 4))
  const lines = []
  const global = String(weekCtx?.global_notes || '').trim()
  if (global) {
    lines.push('CONTEXTO SEMANAL (MARIAN):', global, '')
  }

  const qaRows = Array.isArray(weekCtx?.qa_pairs) ? weekCtx.qa_pairs : []
  const qaMatches = qaRows.filter((r) => {
    const q = normalizeSupportToken(r?.question || '')
    if (!q) return false
    const qTokens = q.split(/\W+/).filter((t) => t.length >= 4)
    return qTokens.some((t) => msgTokens.has(t)) || msg.includes(q.slice(0, 30))
  })
  if (qaMatches.length) {
    lines.push('Q&A DE ESTA SEMANA (RELACIONADO CON LA PREGUNTA):')
    for (const r of qaMatches.slice(0, 4)) {
      lines.push(`- P: ${String(r?.question || '').trim()}`)
      lines.push(`  R: ${String(r?.answer || '').trim()}`)
    }
    lines.push('')
  }

  const triggerAdapt =
    /\b(no puede|lesion|dolor|sin barra|sin material|adaptacion|adaptar|molestia)\b/i.test(msg)
  const adRows = Array.isArray(weekCtx?.adaptations) ? weekCtx.adaptations : []
  const adMatches = adRows.filter((r) => {
    const kw = String(r?.keywords || '')
      .split(',')
      .map((x) => normalizeSupportToken(x).trim())
      .filter(Boolean)
    if (kw.some((k) => msg.includes(k))) return true
    if (!triggerAdapt) return false
    const title = normalizeSupportToken(r?.title || '')
    return !!title && msg.includes(title)
  })
  if (adMatches.length) {
    lines.push('ADAPTACIONES FRECUENTES DE ESTA SEMANA:')
    for (const r of adMatches.slice(0, 4)) {
      lines.push(`- ${String(r?.title || 'Adaptación').trim()}: ${String(r?.response || '').trim()}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

function IconSemana(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}
function IconCentro(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}
function IconClases(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6.5 5.5h3v13h-3zM14.5 5.5h3v13h-3z" />
      <path d="M6.5 9.5h11M6.5 14.5h11" />
    </svg>
  )
}
function IconCiclos(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 6-7" />
    </svg>
  )
}
function IconUso(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  )
}
function IconMaterial(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  )
}
function IconSoporte(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconFeedback(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  )
}
function IconEjercicios(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 12h5" />
    </svg>
  )
}
function IconHoy(props) {
  return (
    <svg className={props.className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

const NAV_DEFS = {
  hoy: { id: 'hoy', label: 'Mi turno', Icon: IconHoy },
  semana: { id: 'semana', label: 'Semana', Icon: IconSemana },
  pase: { id: 'pase', label: 'Feedback', Icon: IconFeedback },
  perfil: { id: 'perfil', label: 'Perfil', Icon: IconMaterial },
  soporte: { id: 'soporte', label: 'Asistente', Icon: IconSoporte },
  ejercicios: { id: 'ejercicios', label: 'Ejercicios', Icon: IconEjercicios },
  mesociclos: { id: 'mesociclos', label: 'Mesociclos', Icon: IconCiclos },
  material: { id: 'material', label: 'Material', Icon: IconMaterial },
  centro: { id: 'centro', label: 'Centro', Icon: IconCentro },
  clases: { id: 'clases', label: 'Clases', Icon: IconClases },
  uso: { id: 'uso', label: 'Uso app', Icon: IconUso },
}
const SECTION_TITLE_BY_TAB = Object.fromEntries(Object.values(NAV_DEFS).map((d) => [d.id, d.label]))

/** Desktop: 4 pestañas principales + guía en acordeón */
const PRIMARY_NAV_IDS = ['hoy', 'semana', 'pase', 'perfil']
const GUIDE_CENTRE_IDS = ['centro', 'clases', 'uso']
const BOTTOM_NAV_IDS = ['hoy', 'semana', 'pase', 'perfil']

const SUPPORT_DAILY_LIMIT = 10
const SUPPORT_LIMIT_MESSAGE =
  'Has alcanzado el límite de 10 consultas diarias. El contador se reinicia cada día a las 00:00.'

function localDateYMD() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function supportQuotaStorageKey() {
  return `coach_support_messages_${localDateYMD()}`
}

function getSupportMessagesUsedToday() {
  try {
    const raw = localStorage.getItem(supportQuotaStorageKey())
    const n = parseInt(raw, 10)
    if (!Number.isFinite(n) || n < 0) return 0
    return Math.min(n, SUPPORT_DAILY_LIMIT)
  } catch {
    return 0
  }
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

function incrementSupportMessagesUsed() {
  try {
    const key = supportQuotaStorageKey()
    const used = getSupportMessagesUsedToday()
    const next = Math.min(used + 1, SUPPORT_DAILY_LIMIT)
    localStorage.setItem(key, String(next))
    return next
  } catch {
    return SUPPORT_DAILY_LIMIT
  }
}

const coachAuthShell = `min-h-[100dvh] ${coachBg.app} ${coachText.primary} flex flex-col items-center justify-center p-8`
const coachInput = coachFieldAuth
const coachBtnPrimary =
  'w-full py-4 rounded-2xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-30 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-purple-950/40 active:scale-[0.99] font-evo-body'

export default function CoachView() {
  const [step, setStep] = useState('loading')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [coachName, setCoachName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [weekData, setWeekData] = useState(null)
  /** Fila `published_weeks` mínima para feedback (id, mesociclo, semana). */
  const [activeWeekRow, setActiveWeekRow] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState('')
  const [activeDay, setActiveDay] = useState(null)
  const [mainTab, setMainTab] = useState('hoy')
  const [guideSettings, setGuideSettings] = useState(null)
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(true)
  const [exerciseLibraryError, setExerciseLibraryError] = useState('')
  const [supportUsedToday, setSupportUsedToday] = useState(0)
  const [guideCentreOpen, setGuideCentreOpen] = useState(false)
  /** null = comprobando en Supabase; false = pendiente de «Leído»; true = ya registrado para esta semana */
  const [handoverReadForWeek, setHandoverReadForWeek] = useState(null)
  const [supportSessionContext, setSupportSessionContext] = useState(null)
  const supportSessionContextRef = useRef(null)
  const supportInFlightAbortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const supportTextareaRef = useRef(null)
  /** Feedback guardado por coaches esta semana (pase de turno mañana ↔ tarde). */
  const [peerFeedbackWeek, setPeerFeedbackWeek] = useState([])
  /** Desde Semana → Feedback: { token, dayKey, classLabel } */
  const [feedbackPrefill, setFeedbackPrefill] = useState(null)
  const [assistantWeekContext, setAssistantWeekContext] = useState(null)
  /** Evita flash de datos antiguos mientras cambia la semana activa. */
  const [isWeekSwitching, setIsWeekSwitching] = useState(false)
  const [todayHandoffs, setTodayHandoffs] = useState([])
  const [showWeeklyCheckin, setShowWeeklyCheckin] = useState(false)
  const [weeklyCheckinForm, setWeeklyCheckinForm] = useState({
    moodScore: 0,
    highlights: '',
    improvements: '',
    feedbackText: '',
  })
  const [weeklyCheckinSubmitError, setWeeklyCheckinSubmitError] = useState('')

  const { items: coachToasts, push: pushCoachToast, dismiss: dismissCoachToast } = useCoachToastQueue()
  const centroToastKeyRef = useRef('')
  const handoverToastFiredRef = useRef(false)
  const newWeekToastQueuedRef = useRef(null)
  /** Sincronizado con `activeWeekRow.id` para comparar sin closures obsoletos al refrescar en foco. */
  const activeWeekIdRef = useRef(null)
  /** Evita ignorar actualizaciones cuando el id no cambia pero `data` sí (Guardar cambios en Supabase). */
  const activeWeekDataSigRef = useRef('')

  useEffect(() => {
    activeWeekIdRef.current = activeWeekRow?.id ?? null
  }, [activeWeekRow?.id])

  const resetWeekDerivedState = useCallback(() => {
    setPeerFeedbackWeek([])
    setFeedbackPrefill(null)
    setHandoverReadForWeek(null)
    setSupportSessionContext(null)
    supportSessionContextRef.current = null
    setMessages([])
    setInput('')
    handoverToastFiredRef.current = false
    centroToastKeyRef.current = ''
    newWeekToastQueuedRef.current = null
    dismissCoachToast('coach-handover')
  }, [dismissCoachToast])

  const refreshActiveWeekOnFocus = useCallback(async () => {
    if (step === 'loading') return
    try {
      const week = await getActiveWeek()
      const prevId = activeWeekIdRef.current
      if (!week) {
        if (prevId != null) {
          setWeekData(null)
          setActiveWeekRow(null)
          activeWeekDataSigRef.current = ''
          if (step === 'chat') setStep('noweek')
        }
        return
      }
      const normalized = normalizePublishedWeekForConsumers(week.data, week)
      const dataSig = JSON.stringify(normalized ?? null)
      if (week.id === prevId && dataSig === activeWeekDataSigRef.current) {
        return
      }
      activeWeekDataSigRef.current = dataSig

      if (week.id !== prevId) {
        setIsWeekSwitching(true)
        resetWeekDerivedState()
        setActiveWeekRow({ id: week.id, mesociclo: week.mesociclo, semana: week.semana })
        setWeekData(normalized)
        setActiveDay(defaultActiveDayNameFromWeek(normalized))
        setIsWeekSwitching(false)
        return
      }

      // Misma fila activa: JSON actualizado en remoto (p. ej. programador → «Guardar cambios»).
      setWeekData(normalized)
    } catch {
      setIsWeekSwitching(false)
    }
  }, [step, resetWeekDerivedState])

  /**
   * Check-in semanal: doble condición (todo en Europe/Madrid vía coachTime.madridCheckinGateParts):
   * 1) viernes y hora >= 16 en Madrid
   * 2) localStorage evo_checkin_week !== semana ISO actual (si coincide, ya completado → no mostrar)
   */
  const refreshWeeklyCheckinModal = useCallback(() => {
    if (step !== 'chat') {
      setShowWeeklyCheckin(false)
      return
    }

    const { dayOfWeekIso, hour, weekIso, weekdayLabel } = madridCheckinGateParts(new Date())
    let evoCheckinWeekStored = ''
    try {
      evoCheckinWeekStored = localStorage.getItem('evo_checkin_week') ?? ''
    } catch {
      evoCheckinWeekStored = '(error lectura localStorage)'
    }

    const viernesTardeOk = dayOfWeekIso === 5 && hour >= 16
    const yaCompletadoEstaSemana = String(evoCheckinWeekStored).trim() === weekIso
    const mostrar = viernesTardeOk && !yaCompletadoEstaSemana

    setShowWeeklyCheckin(mostrar)
  }, [step])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void refreshActiveWeekOnFocus()
        refreshWeeklyCheckinModal()
      }
    }
    const onWinFocus = () => {
      void refreshActiveWeekOnFocus()
      refreshWeeklyCheckinModal()
    }
    const onProgrammingHubWrite = () => {
      void refreshActiveWeekOnFocus()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onWinFocus)
    window.addEventListener('evo-active-week-updated', onProgrammingHubWrite)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onWinFocus)
      window.removeEventListener('evo-active-week-updated', onProgrammingHubWrite)
    }
  }, [refreshActiveWeekOnFocus, refreshWeeklyCheckinModal])

  useEffect(() => {
    refreshWeeklyCheckinModal()
  }, [refreshWeeklyCheckinModal])

  useEffect(() => {
    handoverToastFiredRef.current = false
  }, [activeWeekRow?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, mainTab])

  useEffect(() => {
    if (mainTab !== 'soporte') {
      supportInFlightAbortRef.current?.abort()
      return
    }
    const el = supportTextareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`
  }, [input, mainTab])

  useEffect(() => {
    if (step === 'chat' && mainTab === 'hoy' && activeDay == null && weekData?.dias?.length) {
      setActiveDay(defaultActiveDayNameFromWeek(weekData))
    }
  }, [step, mainTab, activeDay, weekData])

  useEffect(() => {
    if (step !== 'chat') return
    let cancelled = false
    getCoachGuideSettings().then((data) => {
      if (!cancelled) setGuideSettings(data)
    })
    return () => {
      cancelled = true
    }
  }, [step])

  useEffect(() => {
    if (step !== 'chat') return
    let cancelled = false
    setExerciseLibraryLoading(true)
    setExerciseLibraryError('')
    getCoachExerciseLibrary()
      .then((rows) => {
        if (!cancelled) setExerciseLibrary(rows || [])
      })
      .catch((e) => {
        if (!cancelled) setExerciseLibraryError(e?.message || 'No se pudo cargar la biblioteca')
      })
      .finally(() => {
        if (!cancelled) setExerciseLibraryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [step])

  useEffect(() => {
    if (step !== 'chat') return
    setSupportUsedToday(getSupportMessagesUsedToday())
  }, [step, mainTab])

  useEffect(() => {
    if (step !== 'chat') return
    let cancelled = false
    listTodayHandoffs()
      .then((rows) => {
        if (!cancelled) setTodayHandoffs(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setTodayHandoffs([])
      })
    return () => {
      cancelled = true
    }
  }, [step, mainTab])

  useEffect(() => {
    if (showWeeklyCheckin) setWeeklyCheckinSubmitError('')
  }, [showWeeklyCheckin])

  async function handleSubmitWeeklyCheckin() {
    const weekIso = isoWeekString(new Date())
    const mood = Number(weeklyCheckinForm.moodScore || 0)
    if (mood < 1 || mood > 5) {
      setWeeklyCheckinSubmitError('Elige cómo ha ido la semana (1–5) antes de enviar.')
      return
    }
    setWeeklyCheckinSubmitError('')
    let coachAccessCode = ''
    try {
      coachAccessCode = localStorage.getItem(COACH_AUTH_KEY) || ''
    } catch {
      /* noop */
    }
    try {
      await createWeeklyCheckin(
        {
          coach_name: coachName || 'Coach',
          week_iso: weekIso,
          mood_score: mood,
          feedback_text: weeklyCheckinForm.feedbackText || null,
          highlights: weeklyCheckinForm.highlights || null,
          improvements: weeklyCheckinForm.improvements || null,
        },
        { accessCode: coachAccessCode },
      )
      try {
        localStorage.setItem('evo_checkin_week', weekIso)
      } catch {
        /* noop */
      }
      setShowWeeklyCheckin(false)
    } catch (e) {
      const msg = e?.message || 'No se pudo guardar el check-in semanal'
      setWeeklyCheckinSubmitError(msg)
      setError(msg)
    }
  }

  useEffect(() => {
    if (step !== 'chat' || !activeWeekRow?.id) {
      setPeerFeedbackWeek([])
      return
    }
    let cancelled = false
    listCoachSessionFeedbackForWeek(activeWeekRow.id)
      .then((rows) => {
        if (!cancelled) setPeerFeedbackWeek(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setPeerFeedbackWeek([])
      })
    return () => {
      cancelled = true
    }
  }, [step, activeWeekRow?.id, mainTab])

  useEffect(() => {
    if (step !== 'chat' || !activeWeekRow?.mesociclo || activeWeekRow?.semana == null) {
      setAssistantWeekContext(null)
      return
    }
    let cancelled = false
    getAssistantWeekContext(activeWeekRow.mesociclo, Number(activeWeekRow.semana))
      .then((ctx) => {
        if (!cancelled) setAssistantWeekContext(ctx || null)
      })
      .catch(() => {
        if (!cancelled) setAssistantWeekContext(null)
      })
    return () => {
      cancelled = true
    }
  }, [step, activeWeekRow?.mesociclo, activeWeekRow?.semana])

  useEffect(() => {
    if (!activeWeekRow?.id) return
    mergeServerFeedbackIntoLog(
      peerFeedbackWeek,
      activeWeekRow.id,
      activeWeekRow.mesociclo,
      activeWeekRow.semana,
    )
  }, [activeWeekRow?.id, activeWeekRow?.mesociclo, activeWeekRow?.semana, peerFeedbackWeek])

  useEffect(() => {
    if (step !== 'chat' || !activeWeekRow?.id || !coachName?.trim()) {
      setHandoverReadForWeek(null)
      return
    }
    let cancelled = false
    setHandoverReadForWeek(null)
    coachHasReadHandoverForWeek(activeWeekRow.id, coachName.trim())
      .then((read) => {
        if (!cancelled) setHandoverReadForWeek(!!read)
      })
      .catch(() => {
        if (!cancelled) setHandoverReadForWeek(false)
      })
    return () => {
      cancelled = true
    }
  }, [step, activeWeekRow?.id, coachName])

  useEffect(() => {
    if (step !== 'chat') return
    const msg = guideSettings?.active_notice?.trim()
    if (!msg) return
    const fingerprint = buildCoachNoticeFingerprint(guideSettings)
    if (!fingerprint) return
    if (centroToastKeyRef.current === fingerprint) return
    if (coachNoticeWasSeen(fingerprint)) {
      centroToastKeyRef.current = fingerprint
      return
    }
    centroToastKeyRef.current = fingerprint
    pushCoachToast({
      id: `coach-centro-${fingerprint}`,
      title: 'Aviso del centro',
      body: msg,
      onDismiss: () => {
        markCoachNoticeSeen(fingerprint)
      },
    })
  }, [step, guideSettings?.active_notice, guideSettings?.updated_at, pushCoachToast])

  useEffect(() => {
    if (step !== 'chat' || handoverReadForWeek !== false) return
    if (handoverToastFiredRef.current) return
    const alerts = peerFeedbackWeek.filter((r) => coachFeedbackRowIndicatesChange(r))
    if (!alerts.length) return
    handoverToastFiredRef.current = true
    const parts = alerts.slice(0, 8).map((r) => {
      const d = DAYS_ES[r.day_key] || r.day_key || ''
      return [d, r.class_label || 'Clase'].filter(Boolean).join(' ')
    })
    const n = alerts.length
    const body = `${n} ${n === 1 ? 'cambio' : 'cambios'} esta semana — ${parts.join(' · ')}`
    const wid = activeWeekRow?.id
    const name = coachName?.trim()
    pushCoachToast({
      id: 'coach-handover',
      variant: 'handover',
      title: 'Feedback — acción requerida',
      body,
      onConfirmRead: async () => {
        if (wid == null || !name) throw new Error('Falta semana o nombre')
        await recordCoachHandoverRead(wid, name)
        setHandoverReadForWeek(true)
      },
      onDismiss: () => {},
    })
  }, [step, handoverReadForWeek, peerFeedbackWeek, pushCoachToast, activeWeekRow?.id, coachName])

  useEffect(() => {
    if (handoverReadForWeek === true) dismissCoachToast('coach-handover')
  }, [handoverReadForWeek, dismissCoachToast])

  useEffect(() => {
    if (step !== 'chat' || !activeWeekRow?.id) return
    const wid = String(activeWeekRow.id)
    let last = ''
    try {
      last = localStorage.getItem(COACH_LAST_SEEN_WEEK_KEY) || ''
    } catch {
      /* noop */
    }
    if (last === wid) {
      newWeekToastQueuedRef.current = wid
      return
    }
    if (newWeekToastQueuedRef.current === wid) return
    newWeekToastQueuedRef.current = wid
    const body = buildCoachNewWeekToastBody(weekData, activeWeekRow)
    pushCoachToast({
      id: `coach-new-week-${wid}`,
      title: 'Nueva semana publicada',
      body,
      actionLabel: 'Ver',
      onAction: () => {
        setMainTab('hoy')
        if (weekData?.dias?.length) setActiveDay(defaultActiveDayNameFromWeek(weekData))
      },
      onDismiss: () => {
        try {
          localStorage.setItem(COACH_LAST_SEEN_WEEK_KEY, wid)
        } catch {
          /* noop */
        }
      },
    })
  }, [step, activeWeekRow?.id, activeWeekRow?.mesociclo, activeWeekRow?.semana, weekData, pushCoachToast])

  useEffect(() => {
    let mounted = true
    const timeout = setTimeout(() => {
      if (mounted && step === 'loading') {
        console.error('CoachView: Init timeout reached (8s)')
        setError('La conexión está tardando demasiado. Prueba a recargar.')
        setStep('noweek')
      }
    }, 8000)

    async function init() {
      try {
        const individualAuthEnabled = isCoachIndividualAuthEnabled()
        const [week, individualCoachAccess] = await Promise.all([
          getActiveWeek(),
          individualAuthEnabled
            ? hasIndividualCoachAccess().catch(() => false)
            : Promise.resolve(false),
        ])
        if (!mounted) return

        if (!week) {
          setStep('noweek')
          return
        }
        const normalizedInit = normalizePublishedWeekForConsumers(week.data, week)
        setWeekData(normalizedInit)
        setActiveWeekRow({ id: week.id, mesociclo: week.mesociclo, semana: week.semana })
        activeWeekDataSigRef.current = JSON.stringify(normalizedInit ?? null)

        const accessMode = resolveCoachAccessMode({
          individualAuthEnabled,
          sharedCodeFallbackEnabled: isCoachSharedCodeFallbackEnabled(),
          hasIndividualAccess: individualCoachAccess,
        })

        if (accessMode !== 'individual') {
          if (accessMode === 'denied') {
            setError('Tu sesión no tiene acceso individual a EVO Coach.')
            setStep('noweek')
            return
          }
          const savedCode = String(localStorage.getItem(COACH_AUTH_KEY) || '').trim()
          if (!savedCode || !(await verifyCoachAccessCode(savedCode))) {
            localStorage.removeItem(COACH_AUTH_KEY)
            setStep('code')
            return
          }
        }

        const savedName = localStorage.getItem(COACH_NAME_KEY)
        if (savedName) {
          setCoachName(savedName)
          await startSession(week, savedName)
        } else {
          setStep('name')
        }
      } catch {
        setError('Error conectando con la base de datos')
        setStep('noweek')
      } finally {
        if (mounted) clearTimeout(timeout)
      }
    }
    init()
    return () => {
      mounted = false
      clearTimeout(timeout)
    }
  }, [])

  async function refreshPeerFeedbackWeek() {
    if (!activeWeekRow?.id) return
    try {
      const rows = await listCoachSessionFeedbackForWeek(activeWeekRow.id)
      setPeerFeedbackWeek(Array.isArray(rows) ? rows : [])
    } catch {
      /* noop */
    }
  }

  const handoverAlerts = peerFeedbackWeek.filter((r) => coachFeedbackRowIndicatesChange(r))
  const handoverBadgeCount =
    handoverReadForWeek === false && handoverAlerts.length > 0 ? handoverAlerts.length : 0

  async function handleCodeSubmit(e) {
    e.preventDefault()
    const submittedCode = String(codeInput || '').trim()
    if (submittedCode && await verifyCoachAccessCode(submittedCode)) {
      localStorage.setItem(COACH_AUTH_KEY, submittedCode)
      const savedName = localStorage.getItem(COACH_NAME_KEY)
      if (savedName) {
        setCoachName(savedName)
        const week = await getActiveWeek()
        await startSession(week, savedName)
      } else {
        setStep('name')
      }
    } else {
      setCodeError(true)
      setCodeInput('')
      setTimeout(() => setCodeError(false), 2000)
    }
  }

  async function startSession(week, name) {
    if (week?.id) {
      setActiveWeekRow({ id: week.id, mesociclo: week.mesociclo, semana: week.semana })
    }
    const normalizedSession =
      week?.data != null ? normalizePublishedWeekForConsumers(week.data, week) : null
    if (normalizedSession != null) {
      setWeekData(normalizedSession)
      activeWeekDataSigRef.current = JSON.stringify(normalizedSession)
    }
    try {
      const savedSession = localStorage.getItem(COACH_SESSION_KEY)
      if (savedSession) {
        const { id, date } = JSON.parse(savedSession)
        const today = new Date().toDateString()
        if (date === today) {
          setSessionId(id)
          setStep('chat')
          setActiveDay(defaultActiveDayNameFromWeek(normalizedSession))
          return
        }
      }
      const session = await createCoachSession(week.id, name)
      localStorage.setItem(COACH_SESSION_KEY, JSON.stringify({ id: session.id, date: new Date().toDateString() }))
      setSessionId(session.id)
      setStep('chat')
      setActiveDay(defaultActiveDayNameFromWeek(normalizedSession))
    } catch {
      setError('Error iniciando sesión')
      setStep('noweek')
    }
  }

  async function handleNameSubmit(e) {
    e.preventDefault()
    if (!nameInput.trim()) return
    const name = nameInput.trim()
    localStorage.setItem(COACH_NAME_KEY, name)
    setCoachName(name)
    const week = await getActiveWeek()
    await startSession(week, name)
  }

  function openSupport(prefill, context = null) {
    setMainTab('soporte')
    if (typeof prefill === 'string') setInput(prefill)
    const normalized = context || null
    supportSessionContextRef.current = normalized
    setSupportSessionContext(normalized)
  }

  function selectNav(id) {
    setMainTab(id)
  }

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || isTyping || !sessionId) return
    if (getSupportMessagesUsedToday() >= SUPPORT_DAILY_LIMIT) {
      setError(SUPPORT_LIMIT_MESSAGE)
      return
    }

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setError('')

    try {
      await saveMessage(sessionId, 'user', userMsg)
      await updateSessionActivity(sessionId)
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setInput(userMsg)
      setError('No se pudo guardar el mensaje. Inténtalo de nuevo.')
      return
    }

    const inferredContext = inferCoachSupportSessionContext(userMsg, weekData, activeDay)
    const selectedContext = supportSessionContextRef.current || supportSessionContext
    const activeSupportContext = questionHasExplicitCoachContext(userMsg)
      ? inferredContext
      : selectedContext || inferredContext
    const daySlug = supportSlug(activeSupportContext?.dayName || '')
    const classSlug = supportSlug(activeSupportContext?.classLabel || '')
    const qNorm = normalizeText(userMsg).replace(/\s+/g, ' ').trim()

    async function persistQuestionHistory(answerText) {
      try {
        await insertAssistantQuestionHistory({
          week_id: activeWeekRow?.id || null,
          mesociclo: activeWeekRow?.mesociclo || null,
          semana: activeWeekRow?.semana != null ? Number(activeWeekRow.semana) : null,
          day_key: dayNameToDayKey(activeSupportContext?.dayName) || null,
          class_label: activeSupportContext?.classLabel || null,
          coach_name: coachName || null,
          question: userMsg,
          answer: answerText,
        })
      } catch {
        /* noop */
      }
    }

    const weekId = String(activeWeekRow?.id ?? 'no-week')
    const cacheKey = buildSupportCacheKey(
      weekId,
      daySlug,
      classSlug,
      qNorm,
      coachSupportContextFingerprint(activeSupportContext),
    )
    const cached = getSupportCachedReply(cacheKey)
    if (cached) {
      setMessages((prev) => [...prev, { role: 'assistant', content: cached }])
      try {
        await saveMessage(sessionId, 'assistant', cached)
        await persistQuestionHistory(cached)
      } catch {
        /* noop */
      }
      return
    }

    setIsTyping(true)

    const briefing = String(activeSupportContext?.sessionFeedbackText || '').trim()
    const supportContextBlock = activeSupportContext
      ? [
          'CONTEXTO DE SESION (AUTOMATICO, NO PEDIR AL COACH QUE LO COPIE):',
          `Dia: ${activeSupportContext.dayName || '—'}`,
          `Clase: ${activeSupportContext.classLabel || '—'}`,
          `Sesion completa:`,
          `${activeSupportContext.sessionText || '(sin texto)'}`,
          ...(briefing
            ? ['', 'Feedback de sesion (publicado, voz Marian / IA programacion):', briefing]
            : []),
          '',
          'REGLA: usa este contexto como verdad de la sesion y no pidas al coach que pegue la sesion.',
        ].join('\n')
      : ''

    const hasSession = Boolean(supportContextBlock)
    const systemCore = buildCoachSupportSystemPrompt(hasSession)
    const weeklyAssistantBlock = extractAssistantWeeklyContextBlock(userMsg, assistantWeekContext)
    const libraryBlock = buildCoachSupportLibraryBlock(
      exerciseLibrary,
      activeSupportContext,
      userMsg,
    )
    const systemPrompt = [systemCore, supportContextBlock, weeklyAssistantBlock, libraryBlock]
      .filter(Boolean)
      .join('\n\n')

    supportInFlightAbortRef.current?.abort()
    const ac = new AbortController()
    supportInFlightAbortRef.current = ac

    try {
      const history = [...messages, { role: 'user', content: userMsg }]
      let response
      try {
        response = await fetch('/api/anthropic', {
          method: 'POST',
          signal: ac.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: COACH_ASSISTANT_MODEL,
            max_tokens: AI_CONFIG.coachMaxTokens,
            system: systemPrompt,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
      } catch (e) {
        if (e?.name === 'AbortError') return
        setError(explainAnthropicFetchFailure(e))
        return
      }

      const responseText = await response.text()
      let data
      try {
        data = parseAnthropicProxyBody(responseText)
      } catch {
        setError('La respuesta del servidor no es JSON válido.')
        return
      }
      if (!response.ok || isAnthropicProxyFailure(data)) {
        setError(getAnthropicProxyErrorMessage(data, responseText, response.status))
        return
      }
      const reply = extractAnthropicTextBlocks(data) || 'Sin respuesta'
      setSupportCachedReply(cacheKey, reply)
      const usedAfter = incrementSupportMessagesUsed()
      setSupportUsedToday(usedAfter)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      await saveMessage(sessionId, 'assistant', reply)
      await persistQuestionHistory(reply)
    } catch (err) {
      if (err?.name === 'AbortError') return
      setError('Error al contactar con el asistente')
    } finally {
      if (supportInFlightAbortRef.current === ac) supportInFlightAbortRef.current = null
      setIsTyping(false)
    }
  }

  const supportRemaining = Math.max(0, SUPPORT_DAILY_LIMIT - supportUsedToday)
  const supportAtLimit = supportUsedToday >= SUPPORT_DAILY_LIMIT
  const activeSectionTitle = SECTION_TITLE_BY_TAB[mainTab] || 'Hoy'
  /** En móvil el asistente no tiene tab propio: el indicador queda en «Hoy». */
  const bottomNavActiveId = mainTab === 'soporte' ? 'hoy' : mainTab

  if (step === 'loading') {
    return (
      <div className={coachAuthShell}>
        <div className="flex gap-2.5">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-3 h-3 rounded-full bg-[#A729AD] animate-pulse"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (step === 'noweek') {
    return (
      <div className={coachAuthShell}>
        <div className="text-center space-y-6 max-w-md">
          <div className={`w-20 h-20 rounded-2xl ${coachBg.card} border ${coachBorder} flex items-center justify-center mx-auto text-3xl`}>
            📋
          </div>
          <p className={`text-xl font-bold uppercase tracking-tight ${coachText.primary}`}>No hay semana activa</p>
          <p className={`text-sm font-medium leading-relaxed uppercase tracking-widest ${coachText.muted}`}>
            {error || 'El programador jefe aún no ha publicado la programación de esta semana.'}
          </p>
        </div>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className={coachAuthShell}>
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-4">
            <div className={`w-20 h-20 rounded-3xl ${coachBg.card} border ${coachBorder} flex items-center justify-center mx-auto`}>
              <span className="text-display text-4xl font-black text-[#A729AD]">E</span>
            </div>
            <h1 className="text-2xl font-evo-display font-bold uppercase tracking-tight text-[#FFFF4C]">EVO · Coaches</h1>
            <p className={`text-xs font-semibold uppercase tracking-widest ${coachText.muted}`}>Introduce el código de acceso del centro</p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              className={`${coachInput} text-center tracking-[0.4em] font-mono ${codeError ? 'border-red-500 ring-1 ring-red-500/30' : ''}`}
            />
            {codeError && (
              <p className="text-red-400 text-xs font-bold text-center uppercase tracking-widest">Error de autenticación</p>
            )}
            <button type="submit" disabled={!codeInput.trim()} className={coachBtnPrimary}>
              Verificar
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className={coachAuthShell}>
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-4">
            <div className={`w-20 h-20 rounded-3xl ${coachBg.card} border ${coachBorder} flex items-center justify-center mx-auto`}>
              <span className="text-display text-4xl font-black text-[#A729AD]">E</span>
            </div>
            <h1 className={`text-2xl font-bold uppercase tracking-tight ${coachText.primary}`}>Identificación</h1>
            <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted}`}>¿Cómo te llamas, Coach?</p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Escribe tu nombre..."
              className={coachInput}
            />
            <button type="submit" disabled={!nameInput.trim()} className={coachBtnPrimary}>
              Comenzar turno
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className={coachUi.shell}>
      <CoachToastStack items={coachToasts} onDismissItem={dismissCoachToast} />

      <div className="flex flex-1 min-h-0 overflow-hidden pb-[max(4.25rem,calc(3.5rem+env(safe-area-inset-bottom,0px)))] md:pb-0">
        <aside
          className={`hidden md:flex w-[200px] flex-col shrink-0 ${coachBg.sidebar} border-r ${coachBorder}`}
          aria-label="Navegación principal"
        >
          <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
            {PRIMARY_NAV_IDS.map((navId) => {
              const { id, label, Icon } = NAV_DEFS[navId]
              const active = mainTab === id || (id === 'hoy' && mainTab === 'soporte')
              const showFbBadge = id === 'pase' && handoverBadgeCount > 0
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectNav(id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] font-semibold transition-colors ${
                    active ? coachNav.active : coachNav.idle
                  }`}
                >
                  <span className="relative shrink-0">
                    <Icon className={`w-5 h-5 ${active ? 'text-white' : ''}`} />
                    {showFbBadge ? (
                      <span className="absolute -top-1.5 -right-2 min-w-[1.125rem] h-[18px] px-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center tabular-nums leading-none border border-white/30">
                        {handoverBadgeCount > 9 ? '9+' : handoverBadgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
            <details
              className="pt-1"
              open={guideCentreOpen}
              onToggle={(e) => setGuideCentreOpen(e.currentTarget.open)}
            >
              <summary
                className={`list-none cursor-pointer w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-[11px] font-bold uppercase tracking-widest ${coachText.mutedOnSidebar} ${coachBg.sidebarHover} hover:text-white [&::-webkit-details-marker]:hidden`}
              >
                <span className="truncate">Guía del centro</span>
                <span className="ml-auto text-[9px] opacity-70 shrink-0" aria-hidden>
                  ▼
                </span>
              </summary>
              <div className="mt-1 ml-1 pl-2 border-l border-white/15 space-y-0.5">
                {GUIDE_CENTRE_IDS.map((navId) => {
                  const { id, label, Icon } = NAV_DEFS[navId]
                  const active = mainTab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectNav(id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-semibold transition-colors ${
                        active ? coachNav.active : coachNav.idle
                      }`}
                    >
                      <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : ''}`} />
                      <span className="truncate">{label}</span>
                    </button>
                  )
                })}
              </div>
            </details>
          </nav>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header
            className={`flex items-center gap-3 px-4 py-3 border-b ${coachBorder} ${coachBg.app} flex-shrink-0 z-30 safe-area-pt`}
          >
            <div className="h-10 shrink-0 flex items-center">
              <EvoLogo imgClassName="h-9 w-auto max-w-[120px] object-contain object-left" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-evo-display font-bold uppercase tracking-wide text-white truncate">{activeSectionTitle}</p>
              <p className={`text-xs font-bold ${coachText.primary} truncate`}>Coach · {coachName}</p>
              <p className={`text-xs font-bold uppercase tracking-widest truncate ${coachText.muted}`}>
                {weekData?.titulo || 'Semana activa'}
              </p>
            </div>
          </header>

          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`}>
            {isWeekSwitching ? (
              <div className="flex-1 min-h-0 flex items-center justify-center px-6">
                <div className={`rounded-2xl border ${coachBorder} ${coachBg.card} px-6 py-5 text-center space-y-2 shadow-sm`}>
                  <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted}`}>Actualizando semana</p>
                  <p className={`text-sm font-semibold ${coachText.primary}`}>
                    Cargando datos nuevos del programador...
                  </p>
                </div>
              </div>
            ) : mainTab === 'soporte' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-[#0C0B0C]">
                <div className="px-4 py-2.5 border-b border-[#6A1F6D]/40 bg-[#0C0B0C] backdrop-blur-sm flex items-center justify-between gap-3 shadow-sm">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold uppercase tracking-widest ${coachText.primary} truncate`}>
                      Asistente
                    </p>
                    {supportRemaining <= 3 ? (
                      <p
                        className={`text-[10px] font-bold uppercase tracking-wide truncate ${
                          supportRemaining === 0 ? 'text-[#FFFF4C]' : 'text-[#FFFF4C]'
                        }`}
                      >
                        {supportRemaining === 0
                          ? 'Límite diario. Se renueva mañana.'
                          : `${supportRemaining} consultas hoy`}
                      </p>
                    ) : null}
                  </div>
                  {supportRemaining <= 3 ? (
                    <span
                      className="shrink-0 text-[11px] font-black tabular-nums px-2.5 py-1 rounded-full border bg-[#FFFF4C] text-[#0C0B0C] border-[#FFFF4C]"
                    >
                      {supportRemaining}/{SUPPORT_DAILY_LIMIT}
                    </span>
                  ) : null}
                </div>
                <details className="mx-3 mt-2 rounded-2xl border border-[#6A1F6D]/40 bg-[#1a0f1b] shadow-sm overflow-hidden">
                  <summary className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest cursor-pointer text-[#F6E8F9]/75 list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <span>Protocolo y cómo preguntar</span>
                    <span className="text-[9px] opacity-70">▼</span>
                  </summary>
                  <div className="max-h-[min(26vh,240px)] overflow-y-auto overscroll-contain border-t border-[#6A1F6D]/35 bg-[#1a0f1b]">
                    <CoachGuideSoporteProtocol guideSettings={guideSettings} variant="embedded" />
                  </div>
                </details>
                <div
                  className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {messages.length === 0 && (
                    <div className="rounded-2xl border border-[#6A1F6D]/40 bg-[#1a0f1b] shadow-sm p-4 space-y-3 mx-auto max-w-lg">
                      <p className="text-sm font-bold text-[#FFFFFF]">Chatea con el asistente</p>
                      <p className="text-xs font-medium text-[#F6E8F9]/85 leading-relaxed">
                        Te ayuda a adaptar la sesión real sin perder lo que buscamos ese día. Si vienes desde una clase, ya conoce sus bloques, tiempos y material.
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F9]/75">Sugerencias</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          '¿Cómo adapto este ejercicio sin cambiar el estímulo?',
                          'No tengo este material, ¿qué alternativa encaja?',
                          'Este alumno tiene molestias, ¿cómo ajusto la parte?',
                          'El bloque va largo, ¿qué recorto?',
                        ].map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={supportAtLimit || isTyping}
                            onClick={() => {
                              if (!supportAtLimit) setInput(q)
                            }}
                            className="snap-start shrink-0 text-[11px] px-3.5 py-2 rounded-2xl border border-[#6A1F6D]/40 bg-[#1a0f1b] font-semibold text-[#F6E8F9] shadow-sm hover:border-[#A729AD]/60 hover:bg-[#A729AD]/10 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in px-0.5`}>
                      <div
                        className={`max-w-[88%] px-3.5 py-2.5 rounded-[18px] text-[15px] leading-snug whitespace-pre-wrap shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                          msg.role === 'user'
                            ? 'bg-[#6A1F6D] text-white rounded-br-[4px]'
                            : 'bg-[#1a0f1b] text-[#F6E8F9] rounded-bl-[4px] border border-[#6A1F6D]/40'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start px-0.5">
                      <div className="bg-[#1a0f1b] border border-[#6A1F6D]/40 px-3.5 py-2.5 rounded-[18px] rounded-bl-[4px] flex gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                        {[0, 150, 300].map((d) => (
                          <div
                            key={d}
                            className="w-2 h-2 rounded-full bg-[#FFFF4C] animate-pulse"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="px-3 py-2.5 bg-red-50 border border-red-200/90 rounded-2xl mx-0.5">
                      <p className="text-xs text-red-800 font-semibold leading-snug">{error}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="px-3 pt-2 pb-3 border-t border-[#6A1F6D]/40 bg-[#0C0B0C] flex-shrink-0 safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
                  {supportAtLimit && (
                    <p className="text-xs text-amber-950 font-semibold text-center leading-snug px-3 py-2 mb-2 bg-amber-100 border border-amber-300/80 rounded-2xl">
                      {SUPPORT_LIMIT_MESSAGE}
                    </p>
                  )}
                  <form onSubmit={handleSend} className="flex gap-2 items-end max-w-4xl mx-auto w-full">
                    <textarea
                      ref={supportTextareaRef}
                      rows={3}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        supportAtLimit ? 'Límite alcanzado hoy' : 'Escribe aquí (varias líneas). Envía con el botón.'
                      }
                      disabled={isTyping || supportAtLimit}
                      className="flex-1 rounded-2xl px-4 py-3 text-[15px] min-h-[5.5rem] max-h-[240px] min-w-0 w-full bg-[#1a0f1b] border border-[#6A1F6D] !text-[#FFFFFF] placeholder:text-[#F6E8F9]/50 shadow-inner resize-none overflow-y-auto break-words whitespace-pre-wrap [overflow-wrap:anywhere] focus:outline-none focus:ring-2 focus:ring-[#A729AD]/25 focus:border-[#A729AD]/70 disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isTyping || supportAtLimit}
                      className="w-11 h-11 shrink-0 rounded-full bg-[#5a185c] hover:bg-[#6A1F6D] disabled:opacity-35 text-white flex items-center justify-center shadow-md active:scale-95"
                      aria-label="Enviar"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            ) : (
              <main
                className={`flex-1 min-h-0 min-w-0 overscroll-y-contain ${coachBg.app} ${
                  mainTab === 'hoy' ? 'flex flex-col overflow-hidden' : 'overflow-y-auto overflow-x-hidden'
                }`}
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {mainTab === 'hoy' &&
                  (weekData?.dias?.length ? (
                    <CoachTodayScreen
                      weekData={weekData}
                      activeWeekRow={activeWeekRow}
                      activeDay={activeDay}
                      setActiveDay={setActiveDay}
                      exerciseLibrary={exerciseLibrary}
                      todayHandoffs={todayHandoffs}
                      onOpenFeedback={() => setMainTab('pase')}
                      onConsultAssistant={(ctx) => openSupport('', ctx)}
                    />
                  ) : (
                    <div className="p-6 text-center text-sm text-[#F6E8F966]">Sin programación para mostrar.</div>
                  ))}
                {mainTab === 'semana' && (
                  <CoachWeekOverviewPanel
                    weekData={weekData}
                    weekRow={activeWeekRow}
                    coachName={coachName}
                    onSelectDay={(dayName) => {
                      setActiveDay(dayName)
                      setMainTab('hoy')
                    }}
                  />
                )}
                {mainTab === 'pase' && (
                  <CoachSessionFeedbackForm
                    coachName={coachName}
                    sessionId={sessionId}
                    weekRow={activeWeekRow}
                    weekData={weekData}
                    peerEntries={peerFeedbackWeek}
                    onAfterSave={refreshPeerFeedbackWeek}
                    prefill={feedbackPrefill}
                  />
                )}
                {mainTab === 'perfil' && (
                  <CoachProfilePanel
                    coachName={coachName}
                    onOpenWeeklyCheckin={() => setShowWeeklyCheckin(true)}
                    onNavigateLibrary={() => selectNav('ejercicios')}
                    onNavigateMesociclos={() => selectNav('mesociclos')}
                    onNavigateMaterial={() => selectNav('material')}
                    onNavigateCentro={() => selectNav('centro')}
                  />
                )}
                {mainTab === 'ejercicios' && (
                  <CoachExerciseLibraryPanel
                    exercises={exerciseLibrary}
                    loading={exerciseLibraryLoading}
                    error={exerciseLibraryError}
                  />
                )}
                {mainTab === 'centro' && <CoachGuideCentro />}
                {mainTab === 'clases' && <CoachGuideClases />}
                {mainTab === 'mesociclos' && <CoachGuideMesociclos />}
                {mainTab === 'uso' && <CoachGuideUsoApp />}
                {mainTab === 'material' && <CoachGuideMaterial guideSettings={guideSettings} />}
              </main>
            )}
          </div>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[110] md:hidden flex items-stretch justify-around bg-[#0C0B0C] border-t border-[#6A1F6D] pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-0.5 shadow-[0_-6px_28px_rgba(0,0,0,0.18)]"
        aria-label="Navegación inferior"
      >
        {BOTTOM_NAV_IDS.map((navId) => {
          const { id, label, Icon } = NAV_DEFS[navId]
          const active = bottomNavActiveId === id
          const showFbBadge = id === 'pase' && handoverBadgeCount > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectNav(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 rounded-xl transition-colors ${
                active ? 'text-[#FFFF4C] bg-[#6A1F6D]/20' : 'text-[#F6E8F9]/50 hover:text-[#F6E8F9]'
              }`}
            >
              <span className="relative">
                <Icon className="w-6 h-6" />
                {showFbBadge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[1.125rem] h-[18px] px-0.5 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center tabular-nums leading-none border border-[#1A0D1A]">
                    {handoverBadgeCount > 9 ? '9+' : handoverBadgeCount}
                  </span>
                ) : null}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide truncate max-w-full px-0.5">{label}</span>
            </button>
          )
        })}
      </nav>

      {showWeeklyCheckin ? (
        <WeeklyCheckinModal
          weekLabel={isoWeekString(new Date())}
          moodScore={weeklyCheckinForm.moodScore}
          highlights={weeklyCheckinForm.highlights}
          improvements={weeklyCheckinForm.improvements}
          feedbackText={weeklyCheckinForm.feedbackText}
          submitError={weeklyCheckinSubmitError}
          onChange={(field, value) => setWeeklyCheckinForm((prev) => ({ ...prev, [field]: value }))}
          onSubmit={handleSubmitWeeklyCheckin}
        />
      ) : null}
    </div>
  )
}
