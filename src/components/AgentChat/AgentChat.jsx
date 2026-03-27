import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble.jsx'
import SessionPreview from './SessionPreview.jsx'
import { DAYS_ES } from '../../constants/evoColors.js'

const QUICK_PROMPTS = [
  'Programar sesión de FUERZA',
  'Programar sesión de GIMNÁSTICOS',
  'Programar sesión de HYBRIX',
  'Programar sesión de EVOPARTNER',
  'Programar sesión de EVOTEAMS',
  'Programar sesión de TODOS LOS NIVELES',
]

export default function AgentChat({
  messages,
  isGenerating,
  error,
  activeDay,
  weekState,
  onSendMessage,
  onStopGeneration,
  onConfirmSession,
  onClearMessages,
}) {
  const [input, setInput] = useState('')
  const [editingContent, setEditingContent] = useState(null)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isGenerating])

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant')

  function handleSend() {
    const text = input.trim()
    if (!text || isGenerating) return
    setInput('')
    setEditingContent(null)
    onSendMessage(text)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleConfirmSession(day, content, classes) {
    onConfirmSession(day, content, classes)
    setEditingContent(null)
  }

  function handleEditSession(content) {
    setEditingContent(content)
  }

  const activeDayLabel = activeDay ? DAYS_ES[activeDay] : null

  return (
    <div className="flex flex-col h-full bg-gray-50/50 backdrop-blur-sm">
      {/* Chat header */}
      <div className="px-6 py-4 border-b border-black/5 bg-white flex items-center justify-between flex-shrink-0 shadow-sm">
        <div>
          <h2 className="text-display text-sm font-bold text-evo-text uppercase tracking-tight">
            Asistente EVO
          </h2>
          <p className="text-[10px] text-evo-muted font-medium mt-0.5 uppercase tracking-widest">
            {weekState.mesocycle
              ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
              : 'Configuración pendiente'
            }
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClearMessages}
            className="text-[10px] text-evo-muted hover:text-red-500 font-bold uppercase transition-all"
          >
            Limpiar Chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-12 animate-fade-in">
            {/* Logo mark */}
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mb-6 shadow-elevated border border-black/5">
              <span className="text-display text-2xl font-black text-evo-accent">E</span>
            </div>
            <h3 className="text-display text-base font-bold text-evo-text mb-2">
              ¿Qué programamos hoy?
            </h3>
            <p className="text-xs text-evo-muted max-w-xs leading-relaxed mb-8 font-medium">
              Describe el día y las clases que quieres programar. Generaré la sesión con ejercicios, tiempos y feedback oficial de EVO.
            </p>
            {/* Quick prompts */}
            <div className="w-full max-w-sm space-y-2">
              <p className="text-[9px] text-evo-muted font-bold uppercase tracking-widest mb-3">Accesos rápidos</p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput(p)}
                    className="w-full text-left px-4 py-2.5 rounded-xl bg-white border border-black/5 hover:border-evo-accent/30 hover:bg-evo-accent/[0.02] transition-all text-xs text-evo-muted hover:text-evo-accent font-medium shadow-soft"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <MessageBubble
              message={msg}
              isLast={i === messages.length - 1}
            />
            {/* Show session preview after last assistant message */}
            {msg.role === 'assistant' && i === messages.length - 1 && !isGenerating && (
              <div className="mt-4 ml-10">
                {editingContent !== null ? (
                  <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-elevated animate-fade-in text-evo-text">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-black/5 flex justify-between items-center">
                      <span className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">Editar Programación</span>
                      <button
                        onClick={() => setEditingContent(null)}
                        className="text-[10px] text-evo-accent font-bold uppercase hover:underline"
                      >
                        ← Volver
                      </button>
                    </div>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-transparent px-5 py-4 text-[11px] font-mono text-gray-700 focus:outline-none min-h-[350px] leading-relaxed"
                      spellCheck={false}
                    />
                    <div className="px-5 py-4 bg-gray-50/50 border-t border-black/5">
                      <SessionPreview
                        content={editingContent}
                        onConfirm={handleConfirmSession}
                        onEdit={() => {}}
                      />
                    </div>
                  </div>
                ) : (
                  <SessionPreview
                    content={msg.content}
                    onConfirm={handleConfirmSession}
                    onEdit={() => handleEditSession(msg.content)}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-3 ml-4 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-evo-accent flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 shadow-lg shadow-purple-500/20">
              E
            </div>
            <div className="flex items-center gap-2 px-5 py-3.5 bg-white rounded-2xl rounded-tl-sm border border-black/5 shadow-soft">
              <div className="w-1.5 h-1.5 rounded-full bg-evo-accent animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-evo-accent animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-evo-accent animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <button
              onClick={onStopGeneration}
              className="text-[10px] text-evo-muted hover:text-red-500 font-bold uppercase transition-all"
            >
              Detener
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mx-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-fade-in">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="px-6 py-5 border-t border-black/5 bg-white/50 backdrop-blur-md flex-shrink-0 shadow-inner">
        {activeDayLabel && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-evo-accent animate-pulse" />
            <span className="text-[10px] text-evo-muted font-bold tracking-tight uppercase">Programando: <span className="text-evo-text">{activeDayLabel}</span></span>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <div className="flex-1 bg-white border border-black/10 rounded-2xl overflow-hidden focus-within:border-evo-accent/40 focus-within:ring-2 focus-within:ring-evo-accent/10 transition-all shadow-soft">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe el día o las clases específicas..."
              rows={2}
              className="w-full bg-transparent px-5 py-4 text-sm text-evo-text placeholder-evo-muted focus:outline-none leading-relaxed font-medium"
              disabled={isGenerating}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="w-12 h-12 rounded-2xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-30 disabled:grayscale flex items-center justify-center transition-all flex-shrink-0 shadow-lg shadow-purple-500/20 active:scale-90"
            title="Enviar (Enter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-[10px] text-evo-muted font-medium">
            Shift + Enter para nueva línea
          </p>
          <div className="flex items-center gap-1 text-[9px] text-evo-muted font-bold tracking-widest uppercase">
            POWERED BY CLAUDE 3.5
          </div>
        </div>
      </div>
    </div>
  )
}
