import { useState, useEffect } from 'react'
import { getAllSessions, getSessionMessages } from '../../lib/supabase.js'

export default function CoachReview({ onClose }) {
  const [sessions, setSessions]       = useState([])
  const [selected, setSelected]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await getAllSessions()
        setSessions(data)
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSelectSession(session) {
    setSelected(session)
    setLoadingMsgs(true)
    try {
      const msgs = await getSessionMessages(session.id)
      setMessages(msgs)
    } catch {
      setMessages([])
    } finally {
      setLoadingMsgs(false)
    }
  }

  const totalMsgs = sessions.reduce((acc, s) => acc + (s.coach_messages?.[0]?.count || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-[#111] border border-white/8 rounded-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Conversaciones de entrenadores</h2>
            <p className="text-[10px] text-evo-muted mt-0.5">
              {sessions.length} sesión{sessions.length !== 1 ? 'es' : ''} · {totalMsgs} preguntas en total
            </p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-evo-muted hover:text-white transition-colors">
            ×
          </button>
        </div>

        <div className="flex flex-1 min-h-0">

          {/* Lista sesiones */}
          <div className="w-64 flex-shrink-0 border-r border-white/5 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : sessions.length === 0 ? (
              <p className="text-evo-muted text-xs text-center py-12 px-4">Aún no hay conversaciones</p>
            ) : (
              sessions.map((session) => {
                const msgCount = session.coach_messages?.[0]?.count || 0
                const isSelected = selected?.id === session.id
                return (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                      isSelected ? 'bg-[#7B2FBE]/15' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-xs font-medium text-white truncate">{session.coach_name || 'Entrenador'}</p>
                      <span className="text-[9px] text-evo-muted flex-shrink-0 ml-2">{Math.floor(msgCount / 2)} preg.</span>
                    </div>
                    <p className="text-[9px] text-evo-muted truncate">
                      {session.published_weeks?.titulo || `S${session.published_weeks?.semana}`}
                    </p>
                    <p className="text-[9px] text-white/20 mt-0.5">
                      {new Date(session.last_activity).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </button>
                )
              })
            )}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selected ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-evo-muted text-sm">Selecciona una sesión</p>
              </div>
            ) : loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-evo-muted border-b border-white/5 pb-2 mb-3">
                  {selected.coach_name} · {new Date(selected.started_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#7B2FBE]/30 text-white border border-[#7B2FBE]/20'
                        : 'bg-[#1A1A1A] text-gray-300 border border-white/5'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
