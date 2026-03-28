import { useState, useEffect, useRef } from 'react'
import { getActiveWeek, createCoachSession, saveMessage, updateSessionActivity } from '../../lib/supabase.js'
import { AI_CONFIG } from '../../constants/config.js'
import { buildCoachPrompt } from '../../constants/systemPromptCoach.js'
import { findVideosForPublishedDay } from '../../constants/exerciseVideos.js'

const COACH_NAME_KEY    = 'evo_coach_name'
const COACH_SESSION_KEY = 'evo_coach_session'
const COACH_AUTH_KEY    = 'evo_coach_auth'
export const COACH_CODE_KEY = 'programingevo_coach_code'
const DEFAULT_CODE = 'EVO2025'

/** Misma lógica que systemPromptCoach / Excel: todas las sesiones del JSON publicado. */
const SESSION_BLOCKS = [
  { key: 'evofuncional',  label: 'EvoFuncional',  color: '#2F7BBE' },
  { key: 'evobasics',     label: 'EvoBasics',     color: '#E07B39' },
  { key: 'evofit',        label: 'EvoFit',        color: '#2FBE7B' },
  { key: 'evohybrix',     label: 'EvoHybrix',     color: '#BE2F2F' },
  { key: 'evofuerza',     label: 'EvoFuerza',     color: '#BE2F2F' },
  { key: 'evogimnastica', label: 'EvoGimnástica', color: '#D93F8E' },
]

const FEEDBACK_BLOCKS = [
  { key: 'feedback_funcional',   label: 'Feedback · Funcional' },
  { key: 'feedback_basics',      label: 'Feedback · Basics' },
  { key: 'feedback_fit',         label: 'Feedback · Fit' },
  { key: 'feedback_hybrix',      label: 'Feedback · Hybrix' },
  { key: 'feedback_fuerza',      label: 'Feedback · Fuerza' },
  { key: 'feedback_gimnastica',  label: 'Feedback · Gimnástica' },
]

function sessionText(val) {
  if (val == null) return ''
  const s = String(val).trim()
  return s
}

function findDia(dias, name) {
  if (!name || name === 'show') return null
  return dias.find(
    (d) =>
      d.nombre === name ||
      (d.nombre && name && String(d.nombre).trim().toUpperCase() === String(name).trim().toUpperCase()),
  )
}

/** Primeras líneas para resumen (sin el texto entero). */
function previewText(text, maxLines = 4, maxChars = 320) {
  const t = sessionText(text)
  if (!t) return ''
  const lines = t.split('\n').filter((l) => l.trim())
  const chunk = lines.slice(0, maxLines).join('\n')
  return chunk.length > maxChars ? `${chunk.slice(0, maxChars)}…` : chunk
}

function buildDayQuickSummary(dia) {
  if (!dia) return { labels: [], preview: '' }
  const labels = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key])).map(({ label }) => label)
  const firstBlock = SESSION_BLOCKS.map(({ key }) => dia[key]).find((v) => sessionText(v))
  const preview = previewText(firstBlock || dia.wodbuster || '', 5, 400)
  return { labels, preview }
}

function CoachVideoChips({ videos, title = 'Vídeos rápidos', subtitle }) {
  if (!videos?.length) {
    return (
      <div className="rounded-2xl p-4 bg-gray-50/90 border border-black/6">
        <p className="text-[9px] font-bold text-evo-muted uppercase tracking-widest mb-1">{title}</p>
        <p className="text-[10px] text-evo-muted leading-relaxed">
          {subtitle ||
            'No hay coincidencias con la biblioteca de ejercicios en este día. Usa el asistente o busca en YouTube el nombre del movimiento.'}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-2xl p-4 bg-gradient-to-br from-red-50 via-white to-amber-50/30 border border-red-100/70 shadow-sm">
      <p className="text-[9px] font-bold text-red-900 uppercase tracking-widest mb-1">{title}</p>
      <p className="text-[10px] text-red-900/65 mb-3 leading-snug">
        Abre YouTube con una búsqueda ya orientada a técnica. Todo dentro de la app; vuelve con el botón atrás del navegador.
      </p>
      <div className="flex flex-wrap gap-2">
        {videos.map(({ name, url }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-3 py-2 rounded-xl bg-[#FF0000] text-white hover:bg-[#cc0000] shadow-md shadow-red-500/20 active:scale-[0.97] transition-transform"
          >
            <span className="text-xs leading-none opacity-95" aria-hidden>
              ▶
            </span>
            <span className="max-w-[10rem] truncate normal-case">{name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

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
  /** null = panel cerrado; 'show' = semana abierta (lista de días); string = detalle de ese día */
  const [activeDay, setActiveDay]   = useState(null)
  /** Dentro del panel overview: días, Excel o vídeos agrupados por día */
  const [weekTab, setWeekTab]       = useState('dias') // 'dias' | 'excel' | 'videos'
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
      const history = [...messages, { role: 'user', content: userMsg }]
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
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
          type="button"
          onClick={() => {
            setActiveDay((d) => {
              if (d) {
                setWeekTab('dias')
                return null
              }
              return 'show'
            })
          }}
          className="text-[10px] text-evo-muted font-bold uppercase tracking-widest border border-black/10 px-4 py-2 rounded-xl transition-all shadow-sm hover:text-evo-text hover:bg-gray-50"
        >
          {activeDay ? 'Cerrar Programación' : 'Ver Semana'}
        </button>
      </div>

      {/* Panel programación: visible siempre que esté abierto (overview o día concreto) */}
      {activeDay != null && (
        <div className="flex-shrink-0 border-b border-black/5 bg-gray-50/50 max-h-[min(62vh,32rem)] min-h-[10rem] overflow-y-auto animate-slide-down relative z-10 overscroll-contain">
          {weekData?.resumen && (
            <div className="px-6 py-4 border-b border-black/5 bg-indigo-50/30">
              <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest mb-1.5">Orientación Semanal</p>
              <p className="text-[11px] text-evo-text font-bold leading-tight uppercase tracking-tight">
                {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
                {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
              </p>
              <p className="text-[10px] text-evo-muted font-medium mt-1 leading-relaxed">{weekData.resumen.nota}</p>
            </div>
          )}

          {activeDay === 'show' && (
            <>
              <div className="flex gap-2 px-6 pt-3 pb-2 border-b border-black/5 bg-white/60">
                <button
                  type="button"
                  onClick={() => setWeekTab('dias')}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all ${
                    weekTab === 'dias' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
                  }`}
                >
                  Por día + resumen
                </button>
                <button
                  type="button"
                  onClick={() => setWeekTab('excel')}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all ${
                    weekTab === 'excel' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
                  }`}
                >
                  Vista completa (tipo Excel)
                </button>
                <button
                  type="button"
                  onClick={() => setWeekTab('videos')}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest transition-all ${
                    weekTab === 'videos' ? 'bg-evo-accent text-white' : 'bg-gray-100 text-evo-muted hover:text-evo-text'
                  }`}
                >
                  Vídeos por día
                </button>
              </div>

              {weekTab === 'dias' && (
                <div className="px-6 py-4 space-y-3">
                  <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">
                    Toca un día: resumen rápido y detalle. Abajo puedes lanzar una pregunta al asistente sobre ese día.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {dias.map((dia) => {
                      const { labels, preview } = buildDayQuickSummary(dia)
                      const videoCount = findVideosForPublishedDay(dia).length
                      return (
                        <button
                          key={dia.nombre}
                          type="button"
                          onClick={() => setActiveDay(dia.nombre)}
                          className="text-left rounded-2xl p-4 bg-white border border-black/8 shadow-sm hover:border-evo-accent/35 hover:shadow-md transition-all active:scale-[0.99]"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-[11px] font-bold text-evo-text uppercase tracking-tight">{dia.nombre}</p>
                            {videoCount > 0 && (
                              <span className="text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-50 border border-red-100 px-2 py-0.5 rounded-lg shrink-0">
                                ▶ {videoCount} vídeo{videoCount === 1 ? '' : 's'}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {labels.length ? (
                              labels.map((lb) => (
                                <span
                                  key={lb}
                                  className="text-[9px] px-2 py-0.5 rounded-md bg-gray-100 text-evo-muted font-bold uppercase tracking-wide"
                                >
                                  {lb}
                                </span>
                              ))
                            ) : (
                              <span className="text-[9px] text-amber-700 font-bold uppercase">Sin bloques de sesión en datos</span>
                            )}
                          </div>
                          {preview ? (
                            <pre className="text-[10px] text-gray-500 font-medium whitespace-pre-wrap leading-relaxed line-clamp-6 font-sans">
                              {preview}
                            </pre>
                          ) : sessionText(dia.wodbuster) ? (
                            <pre className="text-[10px] text-emerald-800/80 font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans">
                              {previewText(dia.wodbuster, 8, 400)}
                            </pre>
                          ) : null}
                          <p className="text-[9px] text-evo-accent font-bold uppercase tracking-widest mt-2">Ver detalle →</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {weekTab === 'videos' && (
                <div className="px-6 py-4 space-y-5 pb-6">
                  <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest leading-relaxed">
                    Ejercicios detectados en la programación publicada (biblioteca EVO). Agrupados por día: un toque y abres YouTube con la búsqueda lista.
                  </p>
                  {dias.map((dia) => {
                    const vids = findVideosForPublishedDay(dia)
                    return (
                      <div key={dia.nombre} className="space-y-2">
                        <div className="flex items-center justify-between gap-2 px-0.5">
                          <p className="text-[11px] font-bold text-evo-text uppercase tracking-widest">{dia.nombre}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setWeekTab('dias')
                              setActiveDay(dia.nombre)
                            }}
                            className="text-[9px] font-bold text-evo-accent uppercase tracking-wide underline decoration-evo-accent/30"
                          >
                            Ver texto del día
                          </button>
                        </div>
                        <CoachVideoChips
                          videos={vids}
                          title={vids.length ? `Vídeos · ${dia.nombre}` : `Sin vídeos detectados · ${dia.nombre}`}
                        />
                      </div>
                    )
                  })}
                </div>
              )}

              {weekTab === 'excel' && (
                <div className="px-6 py-4 space-y-4 pb-6">
                  <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">
                    Misma información que en el Excel publicado: todas las sesiones por día. Desplázate para leer.
                  </p>
                  {dias.map((dia) => {
                    const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                    const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                    const wb = sessionText(dia.wodbuster)
                    return (
                      <div key={dia.nombre} className="rounded-2xl border border-black/8 bg-white shadow-sm overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-900 text-white flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-widest">{dia.nombre}</span>
                          <button
                            type="button"
                            onClick={() => setActiveDay(dia.nombre)}
                            className="text-[9px] font-bold uppercase tracking-widest text-white/90 underline decoration-white/40"
                          >
                            Preguntar este día
                          </button>
                        </div>
                        <div className="p-4 space-y-3">
                          {sessions.map(({ label, color, key }) => (
                            <div key={key} className="rounded-xl p-3 bg-gray-50/80 border border-black/5">
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color }}>{label}</p>
                              <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                            </div>
                          ))}
                          {feedbacks.map(({ label, key }) => (
                            <div key={key} className="rounded-xl p-3 bg-indigo-50/50 border border-indigo-100/60">
                              <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest mb-1.5">{label}</p>
                              <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                            </div>
                          ))}
                          {wb && (
                            <div className="rounded-xl p-3 bg-emerald-50/40 border border-emerald-100">
                              <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-1.5">WodBuster / alumno</p>
                              <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia.wodbuster}</pre>
                            </div>
                          )}
                          {!sessions.length && !feedbacks.length && !wb && (
                            <p className="text-[11px] text-evo-muted">Sin contenido para este día.</p>
                          )}
                          <div className="pt-2 border-t border-black/5">
                            <CoachVideoChips
                              videos={findVideosForPublishedDay(dia)}
                              title={`▶ Vídeos · ${dia.nombre}`}
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {activeDay !== 'show' && (
            <div className="border-t border-black/5">
              <div className="px-6 py-3 flex flex-wrap items-center gap-2 bg-white/70 sticky top-0 z-[1] border-b border-black/5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveDay('show')
                    setWeekTab('dias')
                  }}
                  className="text-[10px] font-bold uppercase tracking-widest text-evo-accent border border-evo-accent/30 px-3 py-1.5 rounded-lg hover:bg-evo-accent/5"
                >
                  ← Volver a días
                </button>
                <span className="text-[11px] font-bold text-evo-text uppercase tracking-tight">{activeDay}</span>
              </div>
              {(() => {
                const dia = findDia(dias, activeDay)
                if (!dia) {
                  return (
                    <div className="px-6 py-5">
                      <p className="text-[11px] text-evo-muted font-medium">No hay datos para este día en la semana publicada.</p>
                    </div>
                  )
                }
                const { labels, preview } = buildDayQuickSummary(dia)
                const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const wb = sessionText(dia.wodbuster)
                const hasAny = sessions.length > 0 || feedbacks.length > 0 || wb
                const dayName = dia.nombre

                const ask = (text) => {
                  setInput(text)
                  setActiveDay(null)
                  setWeekTab('dias')
                }

                const dayVideos = findVideosForPublishedDay(dia)

                return (
                  <div className="px-6 pb-5 pt-3 space-y-4">
                    <CoachVideoChips
                      videos={dayVideos}
                      title={`Vídeos del ${dayName}`}
                      subtitle={`Nada en biblioteca para el ${dayName}. Pregunta al asistente: «¿cómo es la técnica de…?»`}
                    />

                    <div className="rounded-2xl p-4 bg-gradient-to-br from-evo-accent/8 to-purple-50/40 border border-evo-accent/15">
                      <p className="text-[9px] font-bold text-evo-accent uppercase tracking-widest mb-2">Resumen rápido</p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {labels.map((lb) => (
                          <span key={lb} className="text-[9px] px-2 py-0.5 rounded-md bg-white/80 border border-black/5 font-bold text-evo-text uppercase">
                            {lb}
                          </span>
                        ))}
                      </div>
                      {preview ? (
                        <pre className="text-[11px] text-gray-700 font-medium whitespace-pre-wrap leading-relaxed font-sans">{preview}</pre>
                      ) : (
                        <p className="text-[11px] text-evo-muted">Sin extracto: baja a la vista detallada o usa los botones para preguntar.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          ask(`Tengo una duda sobre la programación del ${dayName}: ¿puedes orientarme con tiempos y escalado?`)
                        }
                        className="text-[10px] px-3 py-2 rounded-xl bg-evo-accent text-white font-bold uppercase tracking-widest shadow-sm hover:bg-evo-accent-hover active:scale-[0.98]"
                      >
                        Preguntar por {dayName}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ask(`Sobre el ${dayName}: ¿qué harías si tengo poco tiempo o falta material en sala?`)
                        }
                        className="text-[10px] px-3 py-2 rounded-xl bg-white border border-black/10 text-evo-text font-bold uppercase tracking-widest hover:bg-gray-50"
                      >
                        Plan B / poco tiempo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          ask(`En el ${dayName}, ¿cómo escalarías el WOD para nivel principiante manteniendo el estímulo?`)
                        }
                        className="text-[10px] px-3 py-2 rounded-xl bg-white border border-black/10 text-evo-text font-bold uppercase tracking-widest hover:bg-gray-50"
                      >
                        Escalado principiantes
                      </button>
                    </div>

                    <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Detalle completo (como en Excel)</p>
                    <div className="space-y-3">
                      {sessions.map(({ label, color, key }) => (
                        <div key={key} className="rounded-2xl p-4 bg-white border border-black/5 shadow-soft">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color }}>{label}</p>
                            <button
                              type="button"
                              onClick={() =>
                                ask(`Sobre ${dayName} · ${label}: tengo una duda concreta: `)
                              }
                              className="text-[9px] font-bold text-evo-accent uppercase tracking-wide shrink-0 underline decoration-evo-accent/30"
                            >
                              Preguntar esta clase
                            </button>
                          </div>
                          <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                        </div>
                      ))}
                      {feedbacks.map(({ label, key }) => (
                        <div key={key} className="rounded-2xl p-4 bg-indigo-50/40 border border-indigo-100/80 shadow-soft">
                          <p className="text-[10px] font-bold text-indigo-700 uppercase tracking-widest mb-2">{label}</p>
                          <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia[key]}</pre>
                        </div>
                      ))}
                      {!hasAny && (
                        <p className="text-[11px] text-evo-muted font-medium leading-relaxed">
                          Este día no tiene bloques de sesión en los datos publicados. Pide al programador que vuelva a publicar la semana o revisa el JSON.
                        </p>
                      )}
                      {wb && (
                        <div className="rounded-2xl p-4 bg-emerald-50/30 border border-emerald-100/80 shadow-soft">
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-2">Vista alumno (WodBuster)</p>
                          <pre className="text-[11px] text-gray-600 font-medium whitespace-pre-wrap leading-relaxed font-sans">{dia.wodbuster}</pre>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
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
