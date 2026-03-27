import { useState, useEffect, useRef } from 'react'
import { getActiveWeek, createCoachSession, saveMessage, updateSessionActivity } from '../../lib/supabase.js'
import { buildCoachPrompt } from '../../constants/systemPromptCoach.js'

const COACH_NAME_KEY    = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY    = 'evo_coach_auth'
export const COACH_CODE_KEY = 'programingevo_coach_code'
const DEFAULT_CODE = 'EVO2025'

export function getCoachCode() {
  try { return localStorage.getItem(COACH_CODE_KEY) || DEFAULT_CODE } catch { return DEFAULT_CODE }
}

export default function CoachView() {
  const [step, setStep]             = useState('loading') // loading | code | name | chat | noweek
  const [codeInput, setCodeInput]   = useState('')
  const [codeError, setCodeError]   = useState(false)
  const [coachName, setCoachName]   = useState('')
  const [nameInput, setNameInput]   = useState('')
  const [weekData, setWeekData]     = useState(null)
  const [sessionId, setSessionId]   = useState(null)
  const [messages, setMessages]     = useState([])
  const [input, setInput]           = useState('')
  const [isTyping, setIsTyping]     = useState(false)
  const [error, setError]           = useState('')
  const [activeDay, setActiveDay]   = useState(null)
  const messagesEndRef              = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

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
    return () => { mounted = false; clearTimeout(timeout) }
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
      // Reusar sesión del mismo día si existe
      const savedSession = localStorage.getItem(COACH_SESSION_KEY)
      if (savedSession) {
        const { id, date } = JSON.parse(savedSession)
        const today = new Date().toDateString()
        if (date === today) {
          console.log('CoachView: Reusing session:', id)
          setSessionId(id)
          setStep('chat')
          return
        }
      }
      console.log('CoachView: Creating new Supabase session...')
      const session = await createCoachSession(week.id, name)
      console.log('CoachView: Session created:', session.id)
      localStorage.setItem(COACH_SESSION_KEY, JSON.stringify({ id: session.id, date: new Date().toDateString() }))
      setSessionId(session.id)
      setStep('chat')
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

  async function handleSend(e) {
    e.preventDefault()
    if (!input.trim() || isTyping || !sessionId) return

    const userMsg = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMsg }])
    setIsTyping(true)
    setError('')

    await saveMessage(sessionId, 'user', userMsg)
    await updateSessionActivity(sessionId)

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      const history = [...messages, { role: 'user', content: userMsg }]
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20240620',
          max_tokens: 1024,
          system: buildCoachPrompt(weekData),
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Sin respuesta'
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      await saveMessage(sessionId, 'assistant', reply)
    } catch {
      setError('Error al contactar con el asistente')
    } finally {
      setIsTyping(false)
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <div className="h-screen bg-white flex items-center justify-center">
        <div className="flex gap-2.5">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2.5 h-2.5 rounded-full bg-evo-accent animate-pulse" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── SIN SEMANA ────────────────────────────────────────────────────────────
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

  // ── CÓDIGO DE ACCESO ─────────────────────────────────────────────────────
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
              <p className="text-red-500 text-[10px] font-bold text-center uppercase tracking-widest animate-shake">Error de autenticación</p>
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

  // ── NOMBRE ────────────────────────────────────────────────────────────────
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

  // ── CHAT ──────────────────────────────────────────────────────────────────
  const dias = weekData?.dias || []

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-6 py-4 border-b border-black/5 bg-white flex items-center justify-between flex-shrink-0 shadow-sm relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-evo-bg border border-black/5 flex items-center justify-center shadow-sm">
            <span className="text-display text-base font-black text-evo-accent">E</span>
          </div>
          <div>
            <p className="text-evo-text text-xs font-bold uppercase tracking-tight">EvoCoach Support · {coachName}</p>
            <p className="text-evo-muted text-[9px] font-bold uppercase tracking-widest">{weekData?.titulo || 'Semana Activa'}</p>
          </div>
        </div>
        <button
          onClick={() => setActiveDay((d) => d ? null : 'show')}
          className="text-[10px] text-evo-muted font-bold uppercase tracking-widest border border-black/10 px-4 py-2 rounded-xl transition-all shadow-sm hover:text-evo-text hover:bg-gray-50"
        >
          {activeDay ? 'Cerrar Programación' : 'Ver Semana'}
        </button>
      </div>

      {/* Week Preview Overlay */}
      {activeDay === 'show' && (
        <div className="flex-shrink-0 border-b border-black/5 bg-gray-50/50 max-h-72 overflow-y-auto animate-slide-down relative z-10">
          {/* Summary Banner */}
          {weekData?.resumen && (
            <div className="px-6 py-4 border-b border-black/5 bg-indigo-50/30">
              <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Orientación Semanal</p>
              <p className="text-[11px] text-evo-text font-bold leading-tight uppercase tracking-tight">
                {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
              </p>
              <p className="text-[10px] text-evo-muted font-medium mt-1 leading-relaxed">{weekData.resumen.nota}</p>
            </div>
          )}
          {/* Day Tags */}
          <div className="flex gap-2 px-6 py-3 flex-wrap">
            {dias.map((dia) => (
              <button
                key={dia.nombre}
                onClick={() => setActiveDay((d) => d === dia.nombre ? 'show' : dia.nombre)}
                className={`text-[10px] px-4 py-1.5 rounded-xl border font-bold uppercase tracking-widest transition-all shadow-sm ${
                  activeDay === dia.nombre
                    ? 'bg-evo-accent border-evo-accent text-white'
                    : 'bg-white border-black/5 text-evo-muted hover:text-evo-text'
                }`}
              >
                {dia.nombre}
              </button>
            ))}
          </div>
          {/* Day Content */}
          {activeDay && activeDay !== 'show' && (() => {
            const dia = dias.find((d) => d.nombre === activeDay)
            if (!dia) return null
            const clases = [
              { label: 'Funcional', color: '#2F7BBE', key: 'evofuncional'  },
              { label: 'Basics',    color: '#E07B39', key: 'evobasics'     },
              { label: 'Fit',       color: '#2FBE7B', key: 'evofit'        },
              { label: 'Hybrix',    color: '#BE2F2F', key: 'evohybrix'     },
            ].filter(({ key }) => dia[key])
            return (
              <div className="px-6 pb-5 space-y-3">
                {clases.map(({ label, color, key }) => (
                  <div key={key} className="rounded-2xl p-4 bg-white border border-black/5 shadow-soft">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color }}>{label}</p>
                    <pre className="text-[11px] text-gray-500 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-elegant bg-gray-50/20">
        {messages.length === 0 && (
          <div className="text-center py-16 space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-evo-accent/5 border border-evo-accent/10 flex items-center justify-center mx-auto text-xl shadow-soft">
              👋
            </div>
            <div className="space-y-1">
              <p className="text-evo-text font-bold text-lg uppercase tracking-tight">Hola, Coach {coachName}</p>
              <p className="text-evo-muted text-[10px] font-bold uppercase tracking-widest max-w-xs mx-auto px-4">Estoy aquí para ayudarte con adaptaciones, timings y cualquier duda de la programación.</p>
            </div>
            <div className="flex flex-wrap gap-2.5 justify-center mt-6 px-4">
              {[
                '¿Cómo escalo el ejercicio de hoy?',
                'Tengo poco material, dame plan B',
                'El WOD va largo, ¿qué quito?',
                'Dudas con el landmine',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-[10px] px-4 py-2.5 rounded-xl bg-white border border-black/5 text-evo-muted font-bold uppercase tracking-widest hover:text-evo-accent hover:border-evo-accent/20 transition-all shadow-sm active:scale-95 text-left"
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
              className={`max-w-[88%] px-5 py-4 rounded-3xl text-[13px] font-medium leading-relaxed whitespace-pre-wrap shadow-soft ${
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
            <div className="bg-white border border-black/5 px-6 py-4 rounded-3xl rounded-bl-sm flex gap-1.5 shadow-soft">
              {[0, 150, 300].map((d) => (
                <div key={d} className="w-2 h-2 rounded-full bg-evo-accent/30 animate-pulse" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-2 bg-red-50 border border-red-100 rounded-xl text-center">
             <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-5 border-t border-black/5 bg-white flex-shrink-0 pb-8 relative z-20 shadow-elevated">
        <form onSubmit={handleSend} className="flex gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe tu duda al asistente..."
            disabled={isTyping}
            className="flex-1 bg-gray-50 border border-black/10 rounded-2xl px-6 py-4 text-sm text-evo-text placeholder-gray-400 focus:outline-none focus:border-evo-accent/30 focus:bg-white disabled:opacity-50 shadow-inner transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="w-14 h-14 rounded-2xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-40 disabled:grayscale text-white flex items-center justify-center transition-all shadow-lg shadow-purple-500/20 active:scale-90"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
