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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 evo-light-dialog">
      <div className="w-full max-w-4xl bg-white border border-black/5 rounded-3xl flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white shadow-sm">
          <div>
            <h2 className="text-display text-base font-bold text-evo-text uppercase tracking-tight">Monitor de Conversaciones</h2>
            <p className="text-[10px] text-evo-muted font-bold mt-1 uppercase tracking-widest">
              {sessions.length} SESIONES ACTIVAS · {totalMsgs} PREGUNTAS TOTALES
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-evo-muted hover:text-red-500 transition-all shadow-sm border border-black/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="flex flex-1 min-h-0 bg-gray-50/20">

          {/* Lista sesiones */}
          <div className="w-72 flex-shrink-0 border-r border-black/5 overflow-y-auto bg-white/50">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="flex gap-1.5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2 h-2 rounded-full bg-evo-accent animate-pulse" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-center py-20 px-8 space-y-3 opacity-30">
                <span className="text-3xl">📭</span>
                <p className="text-evo-text font-bold text-[10px] uppercase tracking-widest leading-relaxed">Sin actividad reciente</p>
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {sessions.map((session) => {
                  const msgCount = session.coach_messages?.[0]?.count || 0
                  const isSelected = selected?.id === session.id
                  return (
                    <button
                      key={session.id}
                      onClick={() => handleSelectSession(session)}
                      className={`w-full text-left px-6 py-4 transition-all ${
                        isSelected 
                          ? 'bg-evo-accent/5 border-l-4 border-l-evo-accent' 
                          : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-[11px] font-bold uppercase tracking-tight ${isSelected ? 'text-evo-accent' : 'text-evo-text'}`}>
                          {session.coach_name || 'Coach Anónimo'}
                        </p>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${isSelected ? 'bg-evo-accent/10 border-evo-accent/20 text-evo-accent' : 'bg-gray-50 border-black/5 text-evo-muted'}`}>
                          {Math.floor(msgCount / 2)} PREG.
                        </span>
                      </div>
                      <p className="text-[10px] text-evo-muted font-medium truncate uppercase tracking-widest opacity-60">
                        {session.published_weeks?.titulo || `Semana ${session.published_weeks?.semana}`}
                      </p>
                      <p className="text-[9px] text-gray-400 mt-1 font-bold">
                        {new Date(session.last_activity).toLocaleDateString()} · {new Date(session.last_activity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Mensajes */}
          <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white scrollbar-elegant leading-relaxed">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-30">
                <div className="w-16 h-16 rounded-3xl bg-gray-50 border border-black/5 flex items-center justify-center text-3xl shadow-soft">
                  💬
                </div>
                <p className="text-evo-text font-bold text-[11px] uppercase tracking-widest">Selecciona una sesión para auditar</p>
              </div>
            ) : loadingMsgs ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex gap-2.5">
                  {[0, 150, 300].map((d) => (
                    <div key={d} className="w-2.5 h-2.5 rounded-full bg-evo-accent animate-pulse" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">
                <div className="border-b border-black/5 pb-4 mb-8 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-evo-text uppercase tracking-tight">{selected.coach_name}</p>
                    <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest mt-0.5">
                      {new Date(selected.started_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest">Sesión Iniciada</p>
                    <p className="text-[10px] text-evo-text font-bold uppercase tracking-tight">{new Date(selected.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>

                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}>
                    <span className="text-[9px] font-bold text-evo-muted uppercase tracking-widest ml-1 mr-1">
                      {msg.role === 'user' ? selected.coach_name : 'Asistente EVO'}
                    </span>
                    <div className={`max-w-[90%] px-5 py-3.5 rounded-2xl text-[12px] font-medium leading-relaxed whitespace-pre-wrap shadow-soft ${
                      msg.role === 'user'
                        ? 'bg-evo-accent/5 text-evo-text border border-evo-accent/10 rounded-tr-sm'
                        : 'bg-gray-50 text-gray-600 border border-black/5 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
