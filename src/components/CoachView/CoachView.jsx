import { useState, useEffect, useRef } from 'react'
import {
  getActiveWeek,
  createCoachSession,
  saveMessage,
  updateSessionActivity,
  getCoachGuideSettings,
  getCoachExerciseLibrary,
} from '../../lib/supabase.js'
import { AI_CONFIG } from '../../constants/config.js'
import { COACH_SUPPORT_SYSTEM_PROMPT } from '../../constants/systemPromptCoachSupport.js'
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

const NAV_ITEMS = [
  { id: 'semana', label: 'Semana', Icon: IconSemana },
  { id: 'ejercicios', label: 'Ejercicios', Icon: IconEjercicios },
  { id: 'centro', label: 'Centro', Icon: IconCentro },
  { id: 'clases', label: 'Clases', Icon: IconClases },
  { id: 'mesociclos', label: 'Ciclos', Icon: IconCiclos },
  { id: 'uso', label: 'Uso app', Icon: IconUso },
  { id: 'material', label: 'Material', Icon: IconMaterial },
  { id: 'feedback', label: 'Feedback', Icon: IconFeedback },
  { id: 'soporte', label: 'Soporte', Icon: IconSoporte },
]

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [supportSessionContext, setSupportSessionContext] = useState(null)
  const supportSessionContextRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping, mainTab])

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
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      if (mq.matches) setMobileMenuOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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
    setMobileMenuOpen(false)
    if (typeof prefill === 'string') setInput(prefill)
    const normalized = context || null
    supportSessionContextRef.current = normalized
    setSupportSessionContext(normalized)
    // DEBUG TEMPORAL: comprobar que el contexto de sesión se setea al abrir soporte desde clase.
    console.log('CoachSupport openSupport context:', normalized)
  }

  function selectNav(id) {
    setMainTab(id)
    setMobileMenuOpen(false)
    if (id === 'soporte') {
      supportSessionContextRef.current = null
      setSupportSessionContext(null)
    }
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
    setIsTyping(true)
    setError('')

    try {
      await saveMessage(sessionId, 'user', userMsg)
      await updateSessionActivity(sessionId)
    } catch {
      setMessages((prev) => prev.slice(0, -1))
      setInput(userMsg)
      setIsTyping(false)
      setError('No se pudo guardar el mensaje. Inténtalo de nuevo.')
      return
    }

    const usedAfter = incrementSupportMessagesUsed()
    setSupportUsedToday(usedAfter)

    try {
      const history = [...messages, { role: 'user', content: userMsg }]
      const inferredContext = inferSupportContextFromMessage(userMsg, weekData)
      const activeSupportContext = supportSessionContextRef.current || supportSessionContext || inferredContext
      // DEBUG TEMPORAL: confirmar contexto disponible justo antes del primer envío a IA.
      console.log('CoachSupport handleSend context snapshot:', {
        hasContext: !!activeSupportContext,
        ref: supportSessionContextRef.current,
        state: supportSessionContext,
        inferred: inferredContext,
      })
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
      const systemPrompt = supportContextBlock
        ? `${supportContextBlock}\n\n${COACH_SUPPORT_SYSTEM_PROMPT}`
        : COACH_SUPPORT_SYSTEM_PROMPT
      console.log('CoachSupport system prompt check:', {
        hasContextBlock: !!supportContextBlock,
        systemLength: systemPrompt.length,
        contextPreview: supportContextBlock ? supportContextBlock.slice(0, 180) : null,
      })
      let response
      try {
        response = await fetch('/api/anthropic', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: AI_CONFIG.supportModel,
            max_tokens: AI_CONFIG.coachMaxTokens,
            system: systemPrompt,
            messages: history.map((m) => ({ role: m.role, content: m.content })),
          }),
        })
      } catch (e) {
        setError(explainAnthropicFetchFailure(e))
        return
      }

      const data = await response.json()
      if (!response.ok) {
        setError(data?.error?.message || `Error ${response.status}`)
        return
      }
      const reply = data.content?.[0]?.text || 'Sin respuesta'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      await saveMessage(sessionId, 'assistant', reply)
    } catch {
      setError('Error al contactar con el asistente')
    } finally {
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
      {mobileMenuOpen && (
        <button
          type="button"
          className={`fixed inset-0 z-40 ${coachBg.overlay} md:hidden`}
          aria-label="Cerrar menú"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside
          className={`
            fixed z-50 top-0 bottom-0 left-0 w-[200px] flex flex-col shrink-0
            ${coachBg.sidebar} border-r ${coachBorder}
            transition-transform duration-200 ease-out
            md:relative md:translate-x-0 md:z-0
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
          aria-label="Navegación principal"
        >
          <div className={`p-4 border-b ${coachBorder} flex items-center justify-between md:hidden`}>
            <span className={`text-sm font-bold ${coachText.onSidebar}`}>Menú</span>
            <button
              type="button"
              className={`p-2 rounded-lg ${coachBg.sidebarHover} ${coachText.onSidebar}`}
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
            {NAV_ITEMS.map(({ id, label, Icon }) => {
              const active = mainTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => selectNav(id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-[14px] font-semibold transition-colors ${
                    active ? coachNav.active : coachNav.idle
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : ''}`} />
                  <span className="truncate">{label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex flex-col flex-1 min-w-0 min-h-0">
          <header
            className={`flex items-center gap-3 px-4 py-3 border-b ${coachBorder} ${coachBg.app} flex-shrink-0 z-30 safe-area-pt`}
          >
            <button
              type="button"
              className="md:hidden p-2.5 rounded-xl hover:bg-[#A729AD]/10 text-[#1A0A1A] border border-transparent hover:border-[#A729AD]/30"
              onClick={() => setMobileMenuOpen(true)}
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menú de navegación"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
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
              className="flex-shrink-0 px-4 py-3 border-b border-amber-300/60 bg-amber-50 text-amber-950 text-sm font-semibold text-center font-evo-body leading-snug"
            >
              {guideSettings.active_notice.trim()}
            </div>
          ) : null}

          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`}>
            {mainTab === 'soporte' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div
                  className={`flex-shrink-0 max-h-[min(34vh,300px)] overflow-y-auto overscroll-contain border-b ${coachBorder} ${coachBg.sidebar}`}
                >
                  <CoachGuideSoporteProtocol guideSettings={guideSettings} variant="compact" />
                </div>
                <p className={`px-6 pt-4 text-sm font-bold text-center uppercase tracking-wide font-evo-body ${coachText.primary}`}>
                  <span className={coachUi.supportHighlight}>{supportRemaining}</span> de {SUPPORT_DAILY_LIMIT} consultas
                  disponibles hoy
                </p>
                <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 ${coachBg.app}`}>
                  {messages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <p className={`text-lg font-bold uppercase tracking-tight ${coachText.primary}`}>Chat de soporte</p>
                      <p className={`text-sm font-bold uppercase tracking-widest max-w-sm mx-auto leading-relaxed ${coachText.muted}`}>
                        Dudas sobre programación, material o la app. Respuestas cortas.
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center mt-4">
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
                            className={`text-xs px-4 py-2.5 rounded-xl border ${coachBorder} ${coachBg.card} font-bold uppercase tracking-wide ${coachText.muted} hover:border-[#A729AD]/50 hover:text-[#A729AD] disabled:opacity-40 disabled:pointer-events-none`}
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                      <div
                        className={`max-w-[90%] px-5 py-4 rounded-2xl text-base font-medium leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-[#6A1F6D] text-white rounded-br-md'
                            : `rounded-bl-md border ${coachBorder} ${coachBg.card} ${coachText.primary}`
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className={`border ${coachBorder} ${coachBg.card} px-5 py-4 rounded-2xl rounded-bl-md flex gap-1.5`}>
                        {[0, 150, 300].map((d) => (
                          <div
                            key={d}
                            className="w-2 h-2 rounded-full bg-[#A729AD]/50 animate-pulse"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-center">
                      <p className="text-xs text-red-700 font-bold uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className={`px-5 py-4 border-t ${coachBorder} ${coachBg.sidebar} flex-shrink-0 safe-area-pb space-y-3`}>
                  {supportAtLimit && (
                    <p className="text-sm text-amber-900 font-semibold text-center leading-relaxed px-3 bg-amber-100 border border-amber-300/80 rounded-xl py-3">
                      {SUPPORT_LIMIT_MESSAGE}
                    </p>
                  )}
                  <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={supportAtLimit ? 'Límite diario alcanzado' : 'Escribe tu duda...'}
                      disabled={isTyping || supportAtLimit}
                      className={`flex-1 rounded-xl px-5 py-3.5 text-base min-w-0 ${coachBg.card} border ${coachBorder} !text-[#1A0A1A] placeholder-[#6B5A6B] focus:outline-none focus:border-[#A729AD]/50 disabled:opacity-50`}
                    />
                    <button
                      type="submit"
                      disabled={!input.trim() || isTyping || supportAtLimit}
                      className="w-14 h-14 shrink-0 rounded-xl bg-[#6A1F6D] hover:bg-[#7d2582] disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-purple-900/30 active:scale-95"
                      aria-label="Enviar"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
                    exerciseLibrary={exerciseLibrary}
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
                  />
                )}
              </main>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
