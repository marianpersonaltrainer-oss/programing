import { useState, useEffect, useRef } from 'react'
import {
  getActiveWeek,
  createCoachSession,
  saveMessage,
  updateSessionActivity,
  getCoachGuideSettings,
  getCoachExerciseLibrary,
  listCoachSessionFeedbackForWeek,
} from '../../lib/supabase.js'
import { AI_CONFIG, SUPPORT_MODEL } from '../../constants/config.js'
import { buildCoachSupportSystemPrompt } from '../../constants/systemPromptCoachSupport.js'
import { buildSupportCacheKey, getSupportCachedReply, setSupportCachedReply, supportSlug } from '../../utils/coachSupportCache.js'
import { matchCoachSupportFaq } from '../../utils/matchCoachSupportFaq.js'
import CoachWeekProgrammingPanel from './CoachWeekProgrammingPanel.jsx'
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
import { COACH_CODE_KEY, getExpectedCoachCode, coachCodesMatch } from '../../constants/coachAccess.js'
import { explainAnthropicFetchFailure } from '../../utils/explainAnthropicFetchFailure.js'
import { coachFeedbackRowIndicatesChange } from '../../utils/coachSessionFeedback.js'
import { mergeServerFeedbackIntoLog } from '../../utils/coachFeedbackLocalLog.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'

const COACH_NAME_KEY = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY = 'evo_coach_auth'

export { COACH_CODE_KEY }
/** @deprecated usar getExpectedCoachCode; se mantiene por compatibilidad con imports antiguos */
export function getCoachCode() {
  return getExpectedCoachCode()
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
function IconMas(props) {
  return (
    <svg className={props.className} fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  )
}

const NAV_DEFS = {
  semana: { id: 'semana', label: 'Semana', Icon: IconSemana },
  soporte: { id: 'soporte', label: 'Soporte', Icon: IconSoporte },
  feedback: { id: 'feedback', label: 'Feedback', Icon: IconFeedback },
  ejercicios: { id: 'ejercicios', label: 'Ejercicios', Icon: IconEjercicios },
  mesociclos: { id: 'mesociclos', label: 'Ciclos', Icon: IconCiclos },
  material: { id: 'material', label: 'Material', Icon: IconMaterial },
  centro: { id: 'centro', label: 'Centro', Icon: IconCentro },
  clases: { id: 'clases', label: 'Clases', Icon: IconClases },
  uso: { id: 'uso', label: 'Uso app', Icon: IconUso },
}

/** Orden lateral desktop y sección principal del menú «Más» móvil */
const PRIMARY_NAV_IDS = ['semana', 'soporte', 'feedback', 'ejercicios', 'mesociclos', 'material']
const GUIDE_CENTRE_IDS = ['centro', 'clases', 'uso']
const BOTTOM_NAV_IDS = ['semana', 'soporte', 'feedback', 'ejercicios']
const MORE_DRAWER_IDS = ['mesociclos', 'material', ...GUIDE_CENTRE_IDS]

function handoverModalStorageKey(sessionId) {
  return `coach_handover_modal_${sessionId}`
}

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

function inferSupportContextFromMessage(userMsg, weekData) {
  if (!weekData?.dias?.length) return null
  const m = String(userMsg || '').match(
    /\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado)\b[\s·\-–—,:]+(evo[a-záéíóúñ]+)/i,
  )
  if (!m) return null
  const dayNorm = normalizeText(m[1]).toUpperCase()
  const classNorm = normalizeText(m[2])
  const dia = weekData.dias.find((d) => normalizeText(d?.nombre || '').toUpperCase() === dayNorm)
  const classDef = EVO_SESSION_CLASS_DEFS.find((c) => normalizeText(c.label) === classNorm)
  if (!dia || !classDef) return null
  const sessionText = String(dia[classDef.key] || '').trim()
  if (!sessionText) return null
  return { dayName: dia.nombre, classLabel: classDef.label, sessionText }
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
  const [weekTab, setWeekTab] = useState('dias')
  const [mainTab, setMainTab] = useState('semana')
  const [guideSettings, setGuideSettings] = useState(null)
  const [exerciseLibrary, setExerciseLibrary] = useState([])
  const [exerciseLibraryLoading, setExerciseLibraryLoading] = useState(true)
  const [exerciseLibraryError, setExerciseLibraryError] = useState('')
  const [supportUsedToday, setSupportUsedToday] = useState(0)
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false)
  const [guideCentreOpen, setGuideCentreOpen] = useState(false)
  const [handoverDismissed, setHandoverDismissed] = useState(false)
  const [handoverModalOpen, setHandoverModalOpen] = useState(false)
  const [moreGuideOpen, setMoreGuideOpen] = useState(false)
  const [supportSessionContext, setSupportSessionContext] = useState(null)
  const supportSessionContextRef = useRef(null)
  const supportInFlightAbortRef = useRef(null)
  const messagesEndRef = useRef(null)
  const supportTextareaRef = useRef(null)
  /** Feedback guardado por coaches esta semana (pase de turno mañana ↔ tarde). */
  const [peerFeedbackWeek, setPeerFeedbackWeek] = useState([])
  /** Desde Semana → Feedback: { token, dayKey, classLabel } */
  const [feedbackPrefill, setFeedbackPrefill] = useState(null)

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
    if (step === 'chat' && mainTab === 'semana' && activeDay == null) {
      setActiveDay('show')
    }
  }, [step, mainTab, activeDay])

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
    if (!activeWeekRow?.id) return
    mergeServerFeedbackIntoLog(
      peerFeedbackWeek,
      activeWeekRow.id,
      activeWeekRow.mesociclo,
      activeWeekRow.semana,
    )
  }, [activeWeekRow?.id, activeWeekRow?.mesociclo, activeWeekRow?.semana, peerFeedbackWeek])

  useEffect(() => {
    if (!sessionId) {
      setHandoverDismissed(false)
      return
    }
    try {
      setHandoverDismissed(!!localStorage.getItem(handoverModalStorageKey(sessionId)))
    } catch {
      setHandoverDismissed(false)
    }
  }, [sessionId])

  useEffect(() => {
    const alerts = peerFeedbackWeek.filter((r) => coachFeedbackRowIndicatesChange(r))
    if (step !== 'chat' || !sessionId || handoverDismissed || alerts.length === 0) {
      setHandoverModalOpen(false)
      return
    }
    setHandoverModalOpen(true)
  }, [step, sessionId, handoverDismissed, peerFeedbackWeek])

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
      console.log('CoachView: Starting init...')
      try {
        const week = await getActiveWeek()
        if (!mounted) return

        if (!week) {
          setStep('noweek')
          return
        }
        setWeekData(week.data)
        setActiveWeekRow({ id: week.id, mesociclo: week.mesociclo, semana: week.semana })

        const authed = localStorage.getItem(COACH_AUTH_KEY)
        const expected = getExpectedCoachCode()
        const authedNorm = authed?.trim().toUpperCase() ?? ''
        const expectedNorm = expected.trim().toUpperCase()

        if (!authedNorm || authedNorm !== expectedNorm) {
          setStep('code')
          return
        }

        const savedName = localStorage.getItem(COACH_NAME_KEY)
        if (savedName) {
          setCoachName(savedName)
          await startSession(week, savedName)
        } else {
          setStep('name')
        }
      } catch (err) {
        console.error('CoachView: Init crash:', err)
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

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMoreDrawerOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
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
  const handoverSummary = handoverAlerts
    .slice(0, 3)
    .map((r) => {
      const day = String(r?.day_key || '').toUpperCase()
      const cls = r?.class_label || 'Clase'
      const who = r?.coach_name?.trim() || 'Coach'
      return `${day} · ${cls} (${who})`
    })
    .join(' | ')

  const handoverBadgeCount = !handoverDismissed ? handoverAlerts.length : 0

  function dismissHandoverModal() {
    if (sessionId) {
      try {
        localStorage.setItem(handoverModalStorageKey(sessionId), '1')
      } catch {
        /* noop */
      }
      setHandoverDismissed(true)
    }
    setHandoverModalOpen(false)
  }

  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (coachCodesMatch(codeInput)) {
      const canonical = getExpectedCoachCode().trim()
      localStorage.setItem(COACH_AUTH_KEY, canonical)
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
    try {
      const savedSession = localStorage.getItem(COACH_SESSION_KEY)
      if (savedSession) {
        const { id, date } = JSON.parse(savedSession)
        const today = new Date().toDateString()
        if (date === today) {
          setSessionId(id)
          setStep('chat')
          setActiveDay('show')
          return
        }
      }
      const session = await createCoachSession(week.id, name)
      localStorage.setItem(COACH_SESSION_KEY, JSON.stringify({ id: session.id, date: new Date().toDateString() }))
      setSessionId(session.id)
      setStep('chat')
      setActiveDay('show')
    } catch (e) {
      console.error('CoachView: StartSession error:', e)
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
    setMoreDrawerOpen(false)
    if (typeof prefill === 'string') setInput(prefill)
    const normalized = context || null
    supportSessionContextRef.current = normalized
    setSupportSessionContext(normalized)
  }

  function openFeedbackFromClass(dayKey, classLabel) {
    if (!dayKey || !classLabel) return
    setFeedbackPrefill({ token: Date.now(), dayKey, classLabel })
    setMainTab('feedback')
    setMoreDrawerOpen(false)
  }

  function selectNav(id) {
    setMainTab(id)
    setMoreDrawerOpen(false)
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

    const inferredContext = inferSupportContextFromMessage(userMsg, weekData)
    const activeSupportContext = supportSessionContextRef.current || supportSessionContext || inferredContext
    const daySlug = supportSlug(activeSupportContext?.dayName || '')
    const classSlug = supportSlug(activeSupportContext?.classLabel || '')
    const qNorm = normalizeText(userMsg).replace(/\s+/g, ' ').trim()

    const faqHit = matchCoachSupportFaq(qNorm)
    if (faqHit) {
      const reply = `Respuesta estándar · Sin IA\n\n${faqHit.answer}`
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      try {
        await saveMessage(sessionId, 'assistant', reply)
      } catch {
        /* noop */
      }
      return
    }

    const weekId = String(activeWeekRow?.id ?? 'no-week')
    const cacheKey = buildSupportCacheKey(weekId, daySlug, classSlug, qNorm)
    const cached = getSupportCachedReply(cacheKey)
    if (cached) {
      setMessages((prev) => [...prev, { role: 'assistant', content: cached }])
      try {
        await saveMessage(sessionId, 'assistant', cached)
      } catch {
        /* noop */
      }
      return
    }

    setIsTyping(true)

    const supportContextBlock = activeSupportContext
      ? [
          'CONTEXTO DE SESION (AUTOMATICO, NO PEDIR AL COACH QUE LO COPIE):',
          `Dia: ${activeSupportContext.dayName || '—'}`,
          `Clase: ${activeSupportContext.classLabel || '—'}`,
          `Sesion completa:`,
          `${activeSupportContext.sessionText || '(sin texto)'}`,
          '',
          'REGLA: usa este contexto como verdad de la sesion y no pidas al coach que pegue la sesion.',
        ].join('\n')
      : ''

    const hasSession = Boolean(supportContextBlock)
    const systemCore = buildCoachSupportSystemPrompt(hasSession)
    const systemPrompt = supportContextBlock ? `${supportContextBlock}\n\n${systemCore}` : systemCore

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
            model: SUPPORT_MODEL,
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

      const data = await response.json()
      if (!response.ok) {
        setError(data?.error?.message || `Error ${response.status}`)
        return
      }
      const reply = data.content?.[0]?.text || 'Sin respuesta'
      setSupportCachedReply(cacheKey, reply)
      const usedAfter = incrementSupportMessagesUsed()
      setSupportUsedToday(usedAfter)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      await saveMessage(sessionId, 'assistant', reply)
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
            <h1 className={`text-2xl font-bold uppercase tracking-tight ${coachText.primary}`}>Soporte EVO</h1>
            <p className={`text-xs font-bold uppercase tracking-widest ${coachText.muted}`}>Introduce tu contraseña de acceso</p>
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
      {handoverModalOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="handover-modal-title"
        >
          <div
            className={`w-full sm:max-w-lg max-h-[min(92dvh,640px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border ${coachBorder} ${coachBg.card} shadow-2xl p-5 sm:p-6 space-y-4`}
          >
            <h2 id="handover-modal-title" className={`text-lg font-black uppercase tracking-tight ${coachText.title}`}>
              Pase de turno
            </h2>
            <p className={`text-sm font-semibold ${coachText.muted}`}>
              {handoverAlerts.length === 1
                ? 'Hay un aviso con cambios en sesión esta semana.'
                : `${handoverAlerts.length} avisos con cambios en sesión esta semana.`}
            </p>
            <ul className="space-y-3">
              {handoverAlerts.map((r, i) => {
                const day = String(r?.day_key || '').toUpperCase()
                const cls = r?.class_label || 'Clase'
                const who = r?.coach_name?.trim() || 'Coach'
                const det = String(r?.changed_details || '').trim()
                return (
                  <li
                    key={r?.id ?? `${day}-${cls}-${i}`}
                    className={`rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4 space-y-1.5`}
                  >
                    <p className={`text-sm font-black uppercase tracking-wide ${coachText.primary}`}>
                      {day} · {cls}
                    </p>
                    <p className={`text-xs font-bold ${coachText.muted}`}>Coach: {who}</p>
                    {det ? <p className={`text-sm font-medium leading-snug ${coachText.primary}`}>{det}</p> : null}
                  </li>
                )
              })}
            </ul>
            <button
              type="button"
              onClick={dismissHandoverModal}
              className="w-full py-3.5 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white font-bold text-sm uppercase tracking-widest shadow-md"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {moreDrawerOpen ? (
        <button
          type="button"
          className={`fixed inset-0 z-[115] ${coachBg.overlay} md:hidden`}
          aria-label="Cerrar menú Más"
          onClick={() => setMoreDrawerOpen(false)}
        />
      ) : null}

      <div className="flex flex-1 min-h-0 overflow-hidden pb-[max(4.25rem,calc(3.5rem+env(safe-area-inset-bottom,0px)))] md:pb-0">
        <aside
          className={`hidden md:flex w-[200px] flex-col shrink-0 ${coachBg.sidebar} border-r ${coachBorder}`}
          aria-label="Navegación principal"
        >
          <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
            {PRIMARY_NAV_IDS.map((navId) => {
              const { id, label, Icon } = NAV_DEFS[navId]
              const active = mainTab === id
              const showFbBadge = id === 'feedback' && handoverBadgeCount > 0
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
              <p className={`text-sm font-bold ${coachText.primary} truncate`}>Coach · {coachName}</p>
              <p className={`text-xs font-bold uppercase tracking-widest truncate ${coachText.muted}`}>
                {weekData?.titulo || 'Semana activa'}
              </p>
            </div>
          </header>

          {guideSettings?.active_notice?.trim() ? (
            <div
              role="status"
              className="flex-shrink-0 px-4 py-4 border-b border-amber-300/60 bg-amber-50 text-amber-950 text-base font-bold text-center font-evo-body leading-snug"
            >
              {guideSettings.active_notice.trim()}
            </div>
          ) : null}

          {handoverDismissed && handoverAlerts.length > 0 ? (
            <div
              role="status"
              className="flex-shrink-0 px-4 py-4 border-b border-orange-400/50 bg-orange-100/95 text-sm sm:text-base font-bold font-evo-body leading-snug"
            >
              <span className="font-extrabold uppercase tracking-wide">Pase de turno:</span>{' '}
              {handoverAlerts.length === 1
                ? 'Hay un aviso con cambios en sesión esta semana.'
                : `${handoverAlerts.length} avisos con cambios esta semana.`}{' '}
              {handoverSummary ? (
                <span className="font-semibold">
                  {handoverSummary}
                  {handoverAlerts.length > 3 ? ' ...' : ''}.
                </span>
              ) : null}{' '}
              {mainTab === 'feedback' ? (
                <span className="font-normal">Mira la lista «Esta semana» arriba del formulario.</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setMainTab('feedback')}
                  className="ml-1 underline decoration-orange-900/40 font-bold hover:text-orange-900"
                >
                  Ver en Feedback
                </button>
              )}
            </div>
          ) : null}

          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`}>
            {mainTab === 'soporte' ? (
              <div className="flex-1 flex flex-col min-h-0 bg-[#e8ded2]">
                <div className="px-4 py-2.5 border-b border-black/10 bg-white/90 backdrop-blur-sm flex items-center justify-between gap-3 shadow-sm">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold uppercase tracking-widest ${coachText.primary} truncate`}>
                      Soporte
                    </p>
                    <p
                      className={`text-[10px] font-bold uppercase tracking-wide truncate ${
                        supportRemaining === 0 ? 'text-red-800' : supportRemaining <= 3 ? 'text-amber-900' : coachText.muted
                      }`}
                    >
                      {supportRemaining === 0
                        ? 'Límite diario. Se renueva mañana.'
                        : `${supportRemaining} consultas hoy`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[11px] font-black tabular-nums px-2.5 py-1 rounded-full border ${
                      supportRemaining === 0
                        ? 'bg-red-100 text-red-900 border-red-300'
                        : supportRemaining === 1
                          ? 'bg-red-50 text-red-800 border-red-200'
                          : supportRemaining <= 3
                            ? 'bg-amber-100 text-amber-950 border-amber-300'
                            : 'bg-[#A729AD]/15 text-[#6A1F6D] border border-[#A729AD]/20'
                    }`}
                  >
                    {supportRemaining}/{SUPPORT_DAILY_LIMIT}
                  </span>
                </div>
                <details className="mx-3 mt-2 rounded-2xl border border-black/8 bg-white/70 shadow-sm overflow-hidden">
                  <summary className="px-4 py-2.5 text-[11px] font-bold uppercase tracking-widest cursor-pointer text-[#6B5A6B] list-none flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                    <span>Protocolo y cómo preguntar</span>
                    <span className="text-[9px] opacity-70">▼</span>
                  </summary>
                  <div className="max-h-[min(26vh,240px)] overflow-y-auto overscroll-contain border-t border-black/6 bg-white/90">
                    <CoachGuideSoporteProtocol guideSettings={guideSettings} variant="embedded" />
                  </div>
                </details>
                <div
                  className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {messages.length === 0 && (
                    <div className="rounded-2xl border border-black/8 bg-white/95 shadow-sm p-4 space-y-3 mx-auto max-w-lg">
                      <p className="text-sm font-bold text-[#1A0A1A]">Chatea con el asistente</p>
                      <p className="text-xs font-medium text-[#6B5A6B] leading-relaxed">
                        Respuestas cortas y concretas. Si vienes desde un día y clase, el contexto ya va incluido.
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#6B5A6B]">Sugerencias</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {[
                          '¿Cómo escalo el ejercicio de hoy?',
                          'Tengo poco material, plan B',
                          'El WOD va largo, ¿qué quito?',
                          'Dudas con el landmine',
                        ].map((q) => (
                          <button
                            key={q}
                            type="button"
                            disabled={supportAtLimit || isTyping}
                            onClick={() => {
                              if (!supportAtLimit) setInput(q)
                            }}
                            className="snap-start shrink-0 text-[11px] px-3.5 py-2 rounded-2xl border border-black/10 bg-white font-semibold text-[#1A0A1A]/90 shadow-sm hover:border-[#A729AD]/40 hover:bg-[#A729AD]/5 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]"
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
                            ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-[4px]'
                            : 'bg-white text-[#111b21] rounded-bl-[4px] border border-black/[0.06]'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start px-0.5">
                      <div className="bg-white border border-black/[0.06] px-3.5 py-2.5 rounded-[18px] rounded-bl-[4px] flex gap-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
                        {[0, 150, 300].map((d) => (
                          <div
                            key={d}
                            className="w-2 h-2 rounded-full bg-[#A729AD]/45 animate-pulse"
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

                <div className="px-3 pt-2 pb-3 border-t border-black/10 bg-[#f0ebe3] flex-shrink-0 safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
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
                      className="flex-1 rounded-2xl px-4 py-3 text-[15px] min-h-[5.5rem] max-h-[240px] min-w-0 w-full bg-white border border-black/15 !text-[#111b21] placeholder:text-[#667781] shadow-inner resize-none overflow-y-auto break-words whitespace-pre-wrap [overflow-wrap:anywhere] focus:outline-none focus:ring-2 focus:ring-[#A729AD]/25 focus:border-[#A729AD]/40 disabled:opacity-50"
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
                className={`flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain ${coachBg.app}`}
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {mainTab === 'semana' && (
                  <CoachWeekProgrammingPanel
                    weekData={weekData}
                    activeDay={activeDay}
                    setActiveDay={setActiveDay}
                    weekTab={weekTab}
                    setWeekTab={setWeekTab}
                    onOpenSupport={openSupport}
                    onOpenFeedbackFromClass={openFeedbackFromClass}
                    exerciseLibrary={exerciseLibrary}
                    coachName={coachName}
                    weekRow={activeWeekRow}
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
                {mainTab === 'feedback' && (
                  <CoachSessionFeedbackForm
                    coachName={coachName}
                    sessionId={sessionId}
                    weekRow={activeWeekRow}
                    peerEntries={peerFeedbackWeek}
                    onAfterSave={refreshPeerFeedbackWeek}
                    prefill={feedbackPrefill}
                  />
                )}
              </main>
            )}
          </div>
        </div>
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-[110] md:hidden flex items-stretch justify-around bg-[#1A0D1A] border-t border-white/10 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] px-0.5 shadow-[0_-6px_28px_rgba(0,0,0,0.18)]"
        aria-label="Navegación inferior"
      >
        {BOTTOM_NAV_IDS.map((navId) => {
          const { id, label, Icon } = NAV_DEFS[navId]
          const active = mainTab === id
          const showFbBadge = id === 'feedback' && handoverBadgeCount > 0
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectNav(id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 rounded-xl transition-colors ${
                active ? 'text-white bg-white/10' : 'text-[#C4A8C4] hover:text-white/90'
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
        <button
          type="button"
          onClick={() => setMoreDrawerOpen(true)}
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-0 py-1.5 rounded-xl transition-colors ${
            MORE_DRAWER_IDS.includes(mainTab) ? 'text-white bg-white/10' : 'text-[#C4A8C4] hover:text-white/90'
          }`}
        >
          <IconMas className="w-6 h-6" />
          <span className="text-[9px] font-bold uppercase tracking-wide">Más</span>
        </button>
      </nav>

      {moreDrawerOpen ? (
        <div
          className={`fixed bottom-0 left-0 right-0 z-[116] md:hidden max-h-[min(78dvh,560px)] flex flex-col rounded-t-2xl border-t border-x ${coachBorder} ${coachBg.card} shadow-2xl pb-[max(0.5rem,env(safe-area-inset-bottom))]`}
          role="dialog"
          aria-label="Más opciones"
        >
          <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${coachBorder} shrink-0`}>
            <p className={`text-sm font-black uppercase tracking-wide ${coachText.title}`}>Más</p>
            <button
              type="button"
              onClick={() => setMoreDrawerOpen(false)}
              className={`p-2 rounded-xl ${coachText.muted} hover:bg-black/5`}
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-y-auto py-2 px-3 space-y-1 flex-1 min-h-0">
            {['mesociclos', 'material'].map((navId) => {
              const { id, label, Icon } = NAV_DEFS[navId]
              const active = mainTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectNav(id)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left text-[14px] font-semibold border ${coachBorder} ${
                    active ? 'bg-[#A729AD]/12 border-[#A729AD]/35 text-[#6A1F6D]' : `${coachBg.cardAlt} ${coachText.primary}`
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{label}</span>
                </button>
              )
            })}
            <details
              className="rounded-xl border border-[#6A1F6D]/25 overflow-hidden"
              open={moreGuideOpen}
              onToggle={(e) => setMoreGuideOpen(e.currentTarget.open)}
            >
              <summary
                className={`list-none cursor-pointer px-4 py-3.5 text-[12px] font-bold uppercase tracking-widest ${coachText.muted} flex items-center justify-between gap-2 bg-[#F3EAF8] [&::-webkit-details-marker]:hidden`}
              >
                Guía del centro
                <span className="text-[9px] opacity-70" aria-hidden>
                  ▼
                </span>
              </summary>
              <div className="p-2 space-y-1 border-t border-[#6A1F6D]/15">
                {GUIDE_CENTRE_IDS.map((navId) => {
                  const { id, label, Icon } = NAV_DEFS[navId]
                  const active = mainTab === id
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => selectNav(id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] font-semibold ${
                        active ? 'bg-[#A729AD]/12 text-[#6A1F6D]' : coachText.primary
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      <span>{label}</span>
                    </button>
                  )
                })}
              </div>
            </details>
          </div>
        </div>
      ) : null}
    </div>
  )
}
