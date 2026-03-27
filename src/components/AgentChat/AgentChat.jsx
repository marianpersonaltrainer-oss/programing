import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble.jsx'
import SessionPreview from './SessionPreview.jsx'
import { DAYS_ES } from '../../constants/evoColors.js'

const QUICK_PROMPTS = [
  'Lunes · EvoFuncional + EvoBasics',
  'Martes · EvoFit + EvoBasics',
  'Miércoles · EvoFuncional',
  'Jueves · EvoBasics + EvoFit',
  'Viernes · EvoFuncional + EvoBasics + EvoFit',
  'Sábado · HYBRIX / sesión especial',
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
    <div className="flex flex-col h-full bg-[#0A0A0A]">
      {/* Chat header */}
      <div className="px-5 py-3.5 border-b border-white/5 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-display text-sm font-semibold text-white">
            Agente ProgramingEvo
          </h2>
          <p className="text-[10px] text-evo-muted mt-0.5">
            {weekState.mesocycle
              ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
              : 'Configura el mesociclo en el panel izquierdo'
            }
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClearMessages}
            className="text-[10px] text-evo-muted hover:text-white transition-colors"
          >
            Limpiar chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            {/* Logo mark */}
            <div className="w-14 h-14 rounded-2xl gradient-evo flex items-center justify-center mb-5 shadow-lg shadow-[#7B2FBE]/20">
              <span className="text-display text-xl font-bold text-white">E</span>
            </div>
            <h3 className="text-display text-base font-semibold text-white mb-2">
              ¿Qué programamos hoy?
            </h3>
            <p className="text-xs text-evo-muted max-w-xs leading-relaxed mb-6">
              Describe el día y las clases que quieres programar. El agente generará la sesión completa con tiempos, ejercicios y feedback.
            </p>
            {/* Quick prompts */}
            <div className="w-full max-w-sm space-y-1.5">
              <p className="text-[10px] text-evo-muted uppercase tracking-wider mb-2">Accesos rápidos</p>
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => setInput(p)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-[#111] border border-white/5 hover:border-[#7B2FBE]/30 hover:bg-[#1A1A1A] transition-all text-xs text-evo-muted hover:text-white"
                >
                  {p}
                </button>
              ))}
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
              <div className="mt-3 ml-8">
                {editingContent !== null ? (
                  <div className="bg-[#111] border border-white/8 rounded-xl overflow-hidden">
                    <div className="px-4 py-2 bg-[#1A1A1A] border-b border-white/5 flex justify-between items-center">
                      <span className="text-xs text-evo-muted">Editar sesión</span>
                      <button
                        onClick={() => setEditingContent(null)}
                        className="text-xs text-evo-muted hover:text-white"
                      >
                        ← Volver
                      </button>
                    </div>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-transparent px-4 py-3 text-[11px] font-mono text-gray-200 focus:outline-none min-h-[300px]"
                      spellCheck={false}
                    />
                    <div className="px-4 py-3 bg-[#0F0F0F] border-t border-white/5">
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
          <div className="flex items-center gap-3 ml-2 animate-fade-in">
            <div className="w-6 h-6 rounded-full bg-[#7B2FBE] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              E
            </div>
            <div className="flex items-center gap-1.5 px-4 py-3 bg-[#1A1A1A] rounded-2xl rounded-tl-sm border border-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#7B2FBE] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <button
              onClick={onStopGeneration}
              className="text-[10px] text-evo-muted hover:text-red-400 transition-colors"
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
      <div className="px-4 py-4 border-t border-white/5 flex-shrink-0">
        {activeDayLabel && (
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-[10px] text-[#7B2FBE]">●</span>
            <span className="text-[10px] text-evo-muted">Día activo: <span className="text-white">{activeDayLabel}</span></span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <div className="flex-1 bg-[#111] border border-white/8 rounded-xl overflow-hidden focus-within:border-[#7B2FBE]/40 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe el día: clase, contexto, restricciones..."
              rows={2}
              className="w-full bg-transparent px-4 py-3 text-sm text-white placeholder-evo-muted focus:outline-none leading-relaxed"
              disabled={isGenerating}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="w-10 h-10 rounded-xl bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0"
            title="Enviar (Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <p className="text-[10px] text-evo-muted mt-1.5 text-center">
          Enter para enviar · Shift+Enter nueva línea
        </p>
      </div>
    </div>
  )
}
