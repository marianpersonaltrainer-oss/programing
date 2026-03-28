import { useState, useEffect, useRef } from 'react'
import {
  getActiveWeek,
  createCoachSession,
  saveMessage,
  updateSessionActivity,
  getCoachGuideSettings,
} from '../../lib/supabase.js'
import { AI_CONFIG } from '../../constants/config.js'
import { COACH_SUPPORT_SYSTEM_PROMPT } from '../../constants/systemPromptCoachSupport.js'
import CoachWeekProgrammingPanel from './CoachWeekProgrammingPanel.jsx'
import {
  CoachGuideCentro,
  CoachGuideClases,
  CoachGuideMesociclos,
  CoachGuideUsoApp,
  CoachGuideMaterial,
  CoachGuideSoporteProtocol,
} from './CoachGuideViews.jsx'
import { coachBg, coachBorder, coachText, coachNav, coachUi } from './coachTheme.js'

const COACH_NAME_KEY = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY = 'evo_coach_auth'
export const COACH_CODE_KEY = 'programingevo_coach_code'
const DEFAULT_CODE = 'EVO2025'

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

const NAV_ITEMS = [
  { id: 'semana', label: 'Semana', Icon: IconSemana },
  { id: 'centro', label: 'Centro', Icon: IconCentro },
  { id: 'clases', label: 'Clases', Icon: IconClases },
  { id: 'mesociclos', label: 'Ciclos', Icon: IconCiclos },
  { id: 'uso', label: 'Uso app', Icon: IconUso },
  { id: 'material', label: 'Material', Icon: IconMaterial },
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

export function getCoachCode() {
  try {
    return localStorage.getItem(COACH_CODE_KEY) || DEFAULT_CODE
  } catch {
    return DEFAULT_CODE
  }
}

const coachAuthShell = `min-h-[100dvh] ${coachBg.app} ${coachText.primary} flex flex-col items-center justify-center p-8`
const coachInput =
  'w-full rounded-2xl px-6 py-4 text-[16px] bg-[#1A1F2E] border border-[#2A3042] text-[#E8EAF0] placeholder-[#6B7280] focus:outline-none focus:border-[#9B3FA0]/50 focus:ring-1 focus:ring-[#9B3FA0]/30'
const coachBtnPrimary =
  'w-full py-4 rounded-2xl bg-[#6A1F6D] hover:bg-[#7d2582] disabled:opacity-30 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-lg shadow-purple-900/30 active:scale-[0.99]'

export default function CoachView() {
  const [step, setStep] = useState('loading')
  const [codeInput, setCodeInput] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [coachName, setCoachName] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [weekData, setWeekData] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [error, setError] = useState('')
  const [activeDay, setActiveDay] = useState(null)
  const [weekTab, setWeekTab] = useState('dias')
  const [mainTab, setMainTab] = useState('semana')
  const [guideSettings, setGuideSettings] = useState(null)
  const [supportUsedToday, setSupportUsedToday] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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

        const authed = localStorage.getItem(COACH_AUTH_KEY)
        const currentCode = getCoachCode()

        if (authed !== currentCode) {
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
    const correct = getCoachCode()
    if (codeInput.trim().toUpperCase() === correct.toUpperCase()) {
      localStorage.setItem(COACH_AUTH_KEY, correct)
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

  function openSupport(prefill) {
    setMainTab('soporte')
    setMobileMenuOpen(false)
    if (typeof prefill === 'string') setInput(prefill)
  }

  function selectNav(id) {
    setMainTab(id)
    setMobileMenuOpen(false)
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
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_CONFIG.supportModel,
          max_tokens: AI_CONFIG.coachMaxTokens,
          system: COACH_SUPPORT_SYSTEM_PROMPT,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

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
              className="w-3 h-3 rounded-full bg-[#9B3FA0] animate-pulse"
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
          <div className="w-20 h-20 rounded-2xl bg-[#1A1F2E] border border-[#2A3042] flex items-center justify-center mx-auto text-3xl">
            📋
          </div>
          <p className="text-xl font-bold uppercase tracking-tight text-[#E8EAF0]">No hay semana activa</p>
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
            <div className="w-20 h-20 rounded-3xl bg-[#1A1F2E] border border-[#2A3042] flex items-center justify-center mx-auto">
              <span className="text-display text-4xl font-black text-[#9B3FA0]">E</span>
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-[#E8EAF0]">Soporte EVO</h1>
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
            <div className="w-20 h-20 rounded-3xl bg-[#1A1F2E] border border-[#2A3042] flex items-center justify-center mx-auto">
              <span className="text-display text-4xl font-black text-[#9B3FA0]">E</span>
            </div>
            <h1 className="text-2xl font-bold uppercase tracking-tight text-[#E8EAF0]">Identificación</h1>
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
            <span className="text-sm font-bold text-[#E8EAF0]">Menú</span>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-[#1E2433] text-[#E8EAF0]"
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
            className={`flex items-center gap-3 px-4 py-3 border-b ${coachBorder} bg-[#111827] flex-shrink-0 z-30 safe-area-pt`}
          >
            <button
              type="button"
              className="md:hidden p-2.5 rounded-xl hover:bg-[#1E2433] text-[#E8EAF0] border border-transparent hover:border-[#2A3042]"
              onClick={() => setMobileMenuOpen(true)}
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menú de navegación"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="w-10 h-10 rounded-xl bg-[#1A1F2E] border border-[#2A3042] flex items-center justify-center shrink-0">
              <span className="text-lg font-black text-[#9B3FA0]">E</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#E8EAF0] truncate">Coach · {coachName}</p>
              <p className={`text-xs font-bold uppercase tracking-widest truncate ${coachText.muted}`}>
                {weekData?.titulo || 'Semana activa'}
              </p>
            </div>
          </header>

          <div className={`flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`}>
            {mainTab === 'semana' && (
              <CoachWeekProgrammingPanel
                weekData={weekData}
                activeDay={activeDay}
                setActiveDay={setActiveDay}
                weekTab={weekTab}
                setWeekTab={setWeekTab}
                onOpenSupport={openSupport}
              />
            )}
            {mainTab === 'centro' && <CoachGuideCentro />}
            {mainTab === 'clases' && <CoachGuideClases />}
            {mainTab === 'mesociclos' && <CoachGuideMesociclos />}
            {mainTab === 'uso' && <CoachGuideUsoApp />}
            {mainTab === 'material' && <CoachGuideMaterial guideSettings={guideSettings} />}

            {mainTab === 'soporte' && (
              <div className="flex-1 flex flex-col min-h-0">
                <div
                  className={`flex-shrink-0 max-h-[min(34vh,300px)] overflow-y-auto overscroll-contain border-b ${coachBorder} bg-[#0F1117]`}
                >
                  <CoachGuideSoporteProtocol guideSettings={guideSettings} variant="compact" />
                </div>
                <p className={`px-6 pt-4 text-sm font-bold text-center uppercase tracking-wide ${coachText.primary}`}>
                  {supportRemaining} de {SUPPORT_DAILY_LIMIT} consultas disponibles hoy
                </p>
                <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5 ${coachBg.app}`}>
                  {messages.length === 0 && (
                    <div className="text-center py-8 space-y-4">
                      <p className="text-lg font-bold uppercase tracking-tight text-[#E8EAF0]">Chat de soporte</p>
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
                            className={`text-xs px-4 py-2.5 rounded-xl border ${coachBorder} bg-[#1A1F2E] font-bold uppercase tracking-wide ${coachText.muted} hover:border-[#9B3FA0]/40 hover:text-[#E8EAF0] disabled:opacity-40 disabled:pointer-events-none`}
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
                        className={`max-w-[90%] px-5 py-4 rounded-2xl text-[15px] font-medium leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-[#6A1F6D] text-white rounded-br-md'
                            : `rounded-bl-md border ${coachBorder} bg-[#1A1F2E] ${coachText.muted}`
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className={`border ${coachBorder} bg-[#1A1F2E] px-5 py-4 rounded-2xl rounded-bl-md flex gap-1.5`}>
                        {[0, 150, 300].map((d) => (
                          <div
                            key={d}
                            className="w-2 h-2 rounded-full bg-[#9B3FA0]/50 animate-pulse"
                            style={{ animationDelay: `${d}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="px-4 py-3 bg-red-950/50 border border-red-900/50 rounded-xl text-center">
                      <p className="text-xs text-red-300 font-bold uppercase tracking-widest">{error}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className={`px-5 py-4 border-t ${coachBorder} bg-[#0F1117] flex-shrink-0 safe-area-pb space-y-3`}>
                  {supportAtLimit && (
                    <p className="text-sm text-amber-200 font-semibold text-center leading-relaxed px-3 bg-amber-950/40 border border-amber-900/50 rounded-xl py-3">
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
                      className={`flex-1 rounded-xl px-5 py-3.5 text-[16px] min-w-0 bg-[#1A1F2E] border ${coachBorder} text-[#E8EAF0] placeholder-[#6B7280] focus:outline-none focus:border-[#9B3FA0]/50 disabled:opacity-50`}
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
