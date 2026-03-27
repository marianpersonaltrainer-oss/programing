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
    async function init() {
      try {
        const week = await getActiveWeek()
        if (!week) { setStep('noweek'); return }
        setWeekData(week.data)

        // Verificar si ya está autenticado (mismo dispositivo)
        const authed = localStorage.getItem(COACH_AUTH_KEY)
        if (authed !== getCoachCode()) {
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
      } catch {
        setError('Error conectando con la base de datos')
        setStep('noweek')
      }
    }
    init()
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
      // Reusar sesión del mismo día si existe
      const savedSession = localStorage.getItem(COACH_SESSION_KEY)
      if (savedSession) {
        const { id, date } = JSON.parse(savedSession)
        const today = new Date().toDateString()
        if (date === today) {
          setSessionId(id)
          setStep('chat')
          return
        }
      }
      const session = await createCoachSession(week.id, name)
      localStorage.setItem(COACH_SESSION_KEY, JSON.stringify({ id: session.id, date: new Date().toDateString() }))
      setSessionId(session.id)
      setStep('chat')
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
          model: 'claude-sonnet-4-20250514',
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
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2 h-2 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
      </div>
    )
  }

  // ── SIN SEMANA ────────────────────────────────────────────────────────────
  if (step === 'noweek') {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-[#7B2FBE]/20 flex items-center justify-center mx-auto">
            <span className="text-xl">📋</span>
          </div>
          <p className="text-white font-medium">No hay semana publicada</p>
          <p className="text-evo-muted text-sm">El programador aún no ha publicado la semana en curso.</p>
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>
      </div>
    )
  }

  // ── CÓDIGO DE ACCESO ─────────────────────────────────────────────────────
  if (step === 'code') {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl gradient-evo flex items-center justify-center mx-auto shadow-lg shadow-[#7B2FBE]/30">
              <span className="text-display text-2xl font-bold text-white">E</span>
            </div>
            <h1 className="text-white font-bold text-lg">Soporte EVO</h1>
            <p className="text-evo-muted text-sm">Introduce el código de acceso</p>
          </div>
          <form onSubmit={handleCodeSubmit} className="space-y-3">
            <input
              autoFocus
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="Código de acceso"
              className={`w-full bg-[#1A1A1A] border rounded-xl px-4 py-3 text-white text-sm text-center tracking-widest font-mono focus:outline-none placeholder-evo-muted transition-colors ${
                codeError
                  ? 'border-red-500/50 bg-red-500/5'
                  : 'border-white/10 focus:border-[#7B2FBE]/50'
              }`}
            />
            {codeError && (
              <p className="text-red-400 text-xs text-center">Código incorrecto</p>
            )}
            <button
              type="submit"
              disabled={!codeInput.trim()}
              className="w-full py-3 rounded-xl bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 text-white font-medium text-sm transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── NOMBRE ────────────────────────────────────────────────────────────────
  if (step === 'name') {
    return (
      <div className="h-screen bg-[#0A0A0A] flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl gradient-evo flex items-center justify-center mx-auto shadow-lg shadow-[#7B2FBE]/30">
              <span className="text-display text-2xl font-bold text-white">E</span>
            </div>
            <h1 className="text-white font-bold text-lg">Soporte EVO</h1>
            <p className="text-evo-muted text-sm">¿Cómo te llamas?</p>
          </div>
          <form onSubmit={handleNameSubmit} className="space-y-3">
            <input
              autoFocus
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Tu nombre"
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#7B2FBE]/50 placeholder-evo-muted"
            />
            <button
              type="submit"
              disabled={!nameInput.trim()}
              className="w-full py-3 rounded-xl bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 text-white font-medium text-sm transition-colors"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── CHAT ──────────────────────────────────────────────────────────────────
  const dias = weekData?.dias || []

  return (
    <div className="h-screen bg-[#0A0A0A] flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5 bg-[#0D0D0D] flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg gradient-evo flex items-center justify-center">
            <span className="text-display text-sm font-bold text-white">E</span>
          </div>
          <div>
            <p className="text-white text-xs font-semibold">Soporte EVO · {coachName}</p>
            <p className="text-evo-muted text-[10px]">{weekData?.titulo || 'Semana en curso'}</p>
          </div>
        </div>
        <button
          onClick={() => setActiveDay((d) => d ? null : 'show')}
          className="text-[10px] text-evo-muted hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          Ver semana
        </button>
      </div>

      {/* Panel semana */}
      {activeDay === 'show' && (
        <div className="flex-shrink-0 border-b border-white/5 bg-[#111] max-h-64 overflow-y-auto">
          {/* Resumen */}
          {weekData?.resumen && (
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[9px] font-bold text-[#A855F7] uppercase mb-1">Resumen de semana</p>
              <p className="text-[10px] text-white">{weekData.resumen.estimulo} · {weekData.resumen.intensidad}</p>
              <p className="text-[10px] text-evo-muted mt-0.5">{weekData.resumen.nota}</p>
            </div>
          )}
          {/* Días */}
          <div className="flex gap-1.5 px-4 py-2 flex-wrap">
            {dias.map((dia) => (
              <button
                key={dia.nombre}
                onClick={() => setActiveDay((d) => d === dia.nombre ? 'show' : dia.nombre)}
                className={`text-[10px] px-3 py-1.5 rounded-lg border transition-colors ${
                  activeDay === dia.nombre
                    ? 'bg-[#7B2FBE]/30 border-[#7B2FBE]/50 text-white'
                    : 'bg-white/5 border-white/10 text-evo-muted hover:text-white'
                }`}
              >
                {dia.nombre}
              </button>
            ))}
          </div>
          {/* Contenido día */}
          {activeDay && activeDay !== 'show' && (() => {
            const dia = dias.find((d) => d.nombre === activeDay)
            if (!dia) return null
            const clases = [
              { label: 'EvoFuncional',  color: '#2F7BBE', key: 'evofuncional'  },
              { label: 'EvoBasics',     color: '#E07B39', key: 'evobasics'     },
              { label: 'EvoFit',        color: '#2FBE7B', key: 'evofit'        },
              { label: 'EvoHybrix',     color: '#BE2F2F', key: 'evohybrix'     },
              { label: 'EvoFuerza',     color: '#92400E', key: 'evofuerza'     },
              { label: 'EvoGimnástica', color: '#6D28D9', key: 'evogimnastica' },
            ].filter(({ key }) => dia[key])
            return (
              <div className="px-4 pb-3 space-y-2">
                {clases.map(({ label, color, key }) => (
                  <div key={key} className="rounded-lg p-2.5" style={{ backgroundColor: `${color}11`, border: `1px solid ${color}22` }}>
                    <p className="text-[9px] font-bold mb-1" style={{ color }}>{label}</p>
                    <pre className="text-[9px] text-gray-300 whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12 space-y-3">
            <p className="text-evo-muted text-sm">Hola {coachName} 👋</p>
            <p className="text-evo-muted text-xs max-w-xs mx-auto">Pregúntame lo que necesites sobre la clase de hoy — adaptaciones, tiempos, escalados, plan B...</p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {[
                'El WOD se nos va a ir de tiempo, ¿qué recorto?',
                'Tengo un alumno con dolor de rodilla, alternativa',
                '¿Cómo escalo el ejercicio principal para principiantes?',
                'Dame el vídeo del landmine clean',
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  className="text-[10px] px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-evo-muted hover:text-white hover:border-white/20 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-[#7B2FBE] text-white rounded-br-sm'
                  : 'bg-[#1A1A1A] text-gray-200 rounded-bl-sm border border-white/5'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#1A1A1A] border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
              {[0, 150, 300].map((d) => (
                <div key={d} className="w-1.5 h-1.5 rounded-full bg-evo-muted animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-center text-xs text-red-400">{error}</p>}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5 bg-[#0D0D0D] flex-shrink-0">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pregunta sobre la clase de hoy..."
            disabled={isTyping}
            className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-evo-muted focus:outline-none focus:border-[#7B2FBE]/40 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="px-4 py-3 rounded-xl bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 text-white transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
