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

const COACH_NAME_KEY = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY = 'evo_coach_auth'
export const COACH_CODE_KEY = 'programingevo_coach_code'
const DEFAULT_CODE = 'EVO2025'

const MAIN_TABS = [
  { id: 'semana', label: 'Semana' },
  { id: 'centro', label: 'Centro' },
  { id: 'clases', label: 'Clases' },
  { id: 'mesociclos', label: 'Ciclos' },
  { id: 'uso', label: 'Uso app' },
  { id: 'material', label: 'Material' },
  { id: 'soporte', label: 'Soporte' },
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

/** Incrementa tras guardar el mensaje de usuario; devuelve el nuevo total usado hoy. */
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

        console.log('CoachView: Active week result:', week ? 'Found' : 'Not found')
        if (!week) {
          setStep('noweek')
          return
        }
        setWeekData(week.data)

        const authed = localStorage.getItem(COACH_AUTH_KEY)
        const currentCode = getCoachCode()
        console.log('CoachView: Auth check:', { authed, currentCode })

        if (authed !== currentCode) {
          setStep('code')
          return
        }

        const savedName = localStorage.getItem(COACH_NAME_KEY)
        if (savedName) {
          console.log('CoachView: Resuming session for:', savedName)
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
    console.log('CoachView: Starting session for:', name)
    try {
      const savedSession = localStorage.getItem(COACH_SESSION_KEY)
      if (savedSession) {
        const { id, date } = JSON.parse(savedSession)
        const today = new Date().toDateString()
        if (date === today) {
          console.log('CoachView: Reusing session:', id)
          setSessionId(id)
          setStep('chat')
          setActiveDay('show')
          return
        }
      }
      console.log('CoachView: Creating new Supabase session...')
      const session = await createCoachSession(week.id, name)
      console.log('CoachView: Session created:', session.id)
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
    if (typeof prefill === 'string') setInput(prefill)
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
      // Modelo: haiku — soporte conversacional (?coach, pestaña Soporte). System: COACH_SUPPORT_SYSTEM_PROMPT.
      // Máx. 10 envíos/día por dispositivo (localStorage); ver Tarea 3 / soporte en este archivo.
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
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="flex gap-2.5">
          {[0, 150, 300].map((d) => (
            <div
              key={d}
              className="w-2.5 h-2.5 rounded-full bg-evo-accent animate-pulse"
              style={{ animationDelay: `${d}ms` }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (step === 'noweek') {
    return (
      <div className="h-screen bg-white flex items-center justify-center p-8">
        <div className="text-center space-y-4 max-w-xs">
          <div className="w-16 h-16 rounded-2xl bg-evo-accent/5 border border-evo-accent/10 flex items-center justify-center mx-auto shadow-sm">
            <span className="text-2xl opacity-60">📋</span>
          </div>
          <p className="text-evo-text font-bold text-lg uppercase tracking-tight">No hay semana activa</p>
          <p className="text-evo-muted text-xs font-medium leading-relaxed uppercase tracking-widest">
            {error || 'El programador jefe aún no ha publicado la programación de esta semana.'}
          </p>
        </div>
      </div>
    )
  }

  if (step === 'code') {
    return (
      <div className="h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-evo-bg flex items-center justify-center mx-auto shadow-elevated border border-black/5 animate-fade-in">
              <span className="text-display text-3xl font-black text-evo-accent">E</span>
            </div>
            <h1 className="text-evo-text font-bold text-xl uppercase tracking-tighter">Soporte EVO</h1>
            <p className="text-evo-muted text-[10px] font-bold uppercase tracking-widest">Introduce tu contraseña de acceso</p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="CÓDIGO"
              className={`w-full bg-gray-50/50 border rounded-2xl px-6 py-4 text-evo-text text-sm text-center tracking-[0.5em] font-mono focus:outline-none placeholder-gray-300 transition-all shadow-inner ${
                codeError
                  ? 'border-red-500 bg-red-50/50'
                  : 'border-black/5 focus:border-evo-accent/30 focus:bg-white'
              }`}
            />
            {codeError && (
              <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-widest animate-shake">
                Error de autenticación
              </p>
            )}
            <button
              type="submit"
              disabled={!codeInput.trim()}
              className="w-full py-4 rounded-2xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-30 disabled:grayscale text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              Verificar
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div className="h-screen bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-evo-bg flex items-center justify-center mx-auto shadow-elevated border border-black/5">
              <span className="text-display text-3xl font-black text-evo-accent">E</span>
            </div>
            <h1 className="text-evo-text font-bold text-xl uppercase tracking-tighter">Identificación</h1>
            <p className="text-evo-muted text-[10px] font-bold uppercase tracking-widest">¿Cómo te llamas, Coach?</p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Escribe tu nombre..."
              className="w-full bg-gray-50/50 border border-black/5 rounded-2xl px-6 py-4 text-evo-text text-sm focus:outline-none focus:border-evo-accent/30 focus:bg-white transition-all shadow-inner placeholder-gray-300"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full py-4 rounded-2xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-30 disabled:grayscale text-white font-bold text-xs uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              Comenzar Turno
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[100dvh] bg-white flex flex-col overflow-hidden">
      <header className="px-4 py-3 border-b border-black/5 bg-white flex items-center justify-between flex-shrink-0 shadow-sm z-20 safe-area-pt">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-evo-bg border border-black/5 flex items-center justify-center shadow-sm shrink-0">
            <span className="text-display text-sm font-black text-evo-accent">E</span>
          </div>
          <div className="min-w-0">
            <p className="text-evo-text text-[11px] font-bold uppercase tracking-tight truncate">Coach · {coachName}</p>
            <p className="text-evo-muted text-[8px] font-bold uppercase tracking-widest truncate">{weekData?.titulo || 'Semana activa'}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
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
            <div className="flex-shrink-0 max-h-[min(34vh,280px)] overflow-y-auto overscroll-contain border-b border-black/5 bg-gray-50/40">
              <CoachGuideSoporteProtocol guideSettings={guideSettings} variant="compact" />
            </div>
            <p className="px-5 pt-3 text-[11px] font-bold text-evo-text text-center uppercase tracking-wide">
              {supportRemaining} de {SUPPORT_DAILY_LIMIT} consultas disponibles hoy
            </p>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 scrollbar-elegant bg-gray-50/20">
              {messages.length === 0 && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-evo-text font-bold text-sm uppercase tracking-tight">Chat de soporte</p>
                  <p className="text-evo-muted text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto leading-relaxed">
                    Dudas sobre programación, material o la app. Respuestas cortas.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
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
                        className="text-[9px] px-3 py-2 rounded-xl bg-white border border-black/5 text-evo-muted font-bold uppercase tracking-wide hover:text-evo-accent hover:border-evo-accent/20 shadow-sm disabled:opacity-40 disabled:pointer-events-none"
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
                    className={`max-w-[90%] px-4 py-3 rounded-2xl text-[13px] font-medium leading-relaxed whitespace-pre-wrap shadow-soft ${
                      msg.role === 'user'
                        ? 'bg-evo-accent text-white rounded-br-sm'
                        : 'bg-white text-evo-text rounded-bl-sm border border-black/5 text-gray-700'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-black/5 px-5 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 shadow-soft">
                    {[0, 150, 300].map((d) => (
                      <div
                        key={d}
                        className="w-2 h-2 rounded-full bg-evo-accent/30 animate-pulse"
                        style={{ animationDelay: `${d}ms` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-100 rounded-xl text-center">
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-black/5 bg-white flex-shrink-0 safe-area-pb space-y-2">
              {supportAtLimit && (
                <p className="text-[11px] text-amber-900 font-semibold text-center leading-relaxed px-1 bg-amber-50 border border-amber-100 rounded-xl py-2.5">
                  {SUPPORT_LIMIT_MESSAGE}
                </p>
              )}
              <form onSubmit={handleSend} className="flex gap-2 max-w-4xl mx-auto">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={supportAtLimit ? 'Límite diario alcanzado' : 'Escribe tu duda...'}
                  disabled={isTyping || supportAtLimit}
                  className="flex-1 bg-gray-50 border border-black/10 rounded-xl px-4 py-3 text-sm text-evo-text placeholder-gray-400 focus:outline-none focus:border-evo-accent/30 focus:bg-white disabled:opacity-50 shadow-inner min-w-0"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping || supportAtLimit}
                  className="w-12 h-12 shrink-0 rounded-xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-40 disabled:grayscale text-white flex items-center justify-center shadow-lg shadow-purple-500/20 active:scale-90"
                  aria-label="Enviar"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      <nav
        className="flex-shrink-0 border-t border-black/8 bg-white/95 backdrop-blur-md flex overflow-x-auto safe-area-pb shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
        aria-label="Secciones coach"
      >
        {MAIN_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMainTab(t.id)}
            className={`flex-1 min-w-[4.25rem] py-2.5 px-1 text-[9px] font-bold uppercase tracking-wide transition-colors border-t-2 ${
              mainTab === t.id
                ? 'text-evo-accent border-evo-accent bg-evo-accent/5'
                : 'text-evo-muted border-transparent hover:text-evo-text hover:bg-gray-50/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
