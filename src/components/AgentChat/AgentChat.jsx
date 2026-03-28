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
    <div className="flex flex-col h-full min-h-0 bg-[#0C0B0C]">
      <div className="px-6 py-4 border-b border-[#3D1A3D] bg-[#0C0B0C] flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="font-evo-display text-sm font-bold text-[#FFFF4C] uppercase tracking-tight">
            Asistente EVO
          </h2>
          <p className="text-[10px] text-[#9B80A0] font-medium mt-0.5 uppercase tracking-widest">
            {weekState.mesocycle
              ? `${weekState.mesocycle} · S${weekState.week}/${weekState.totalWeeks}${weekState.phase ? ` · ${weekState.phase}` : ''}`
              : 'Configuración pendiente'
            }
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClearMessages}
            className="text-[10px] text-[#9B80A0] hover:text-red-400 font-bold uppercase transition-all"
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
            <div className="w-16 h-16 rounded-2xl bg-[#160D16] flex items-center justify-center mb-6 border border-[#3D1A3D]">
              <span className="font-evo-display text-2xl font-black text-[#FFFF4C]">E</span>
            </div>
            <h3 className="font-evo-display text-base font-bold text-[#E8EAF0] mb-2">
              ¿Qué programamos hoy?
            </h3>
            <p className="text-xs text-[#9B80A0] max-w-xs leading-relaxed mb-8 font-medium">
              Describe el día y las clases que quieres programar. Generaré la sesión con ejercicios, tiempos y feedback oficial de EVO.
            </p>
            <div className="w-full max-w-sm space-y-2">
              <p className="text-[9px] text-[#9B80A0] font-bold uppercase tracking-widest mb-3">Accesos rápidos</p>
              <div className="grid grid-cols-2 gap-3">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setInput(p)}
                    className="w-full text-left px-4 py-2.5 rounded-xl bg-[#160D16] border border-[#3D1A3D] hover:border-[#A729AD]/60 transition-all text-xs text-[#E8EAF0] font-medium"
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
                  <div className="bg-[#160D16] border border-[#3D1A3D] rounded-2xl overflow-hidden animate-fade-in text-[#E8EAF0]">
                    <div className="px-4 py-2.5 bg-[#0C0B0C] border-b border-[#3D1A3D] flex justify-between items-center">
                      <span className="text-[10px] text-[#9B80A0] font-bold uppercase tracking-widest">Editar Programación</span>
                      <button
                        type="button"
                        onClick={() => setEditingContent(null)}
                        className="text-[10px] text-[#A729AD] font-bold uppercase hover:underline"
                      >
                        ← Volver
                      </button>
                    </div>
                    <textarea
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="w-full bg-[#0C0B0C] px-5 py-4 text-[11px] font-mono text-[#E8EAF0] focus:outline-none min-h-[350px] leading-relaxed"
                      spellCheck={false}
                    />
                    <div className="px-5 py-4 bg-[#0C0B0C] border-t border-[#3D1A3D]">
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
            <div className="w-8 h-8 rounded-full bg-[#6A1F6D] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
              E
            </div>
            <div className="flex items-center gap-2 px-5 py-3.5 bg-[#160D16] rounded-2xl rounded-tl-sm border border-[#3D1A3D]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#A729AD] animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#A729AD] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#A729AD] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <button
              type="button"
              onClick={onStopGeneration}
              className="text-[10px] text-[#9B80A0] hover:text-red-400 font-bold uppercase transition-all"
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
      <div className="px-6 py-5 border-t border-[#3D1A3D] bg-[#0A0808] flex-shrink-0">
        {activeDayLabel && (
          <div className="mb-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A729AD] animate-pulse" />
            <span className="text-[10px] text-[#9B80A0] font-bold tracking-tight uppercase">
              Programando: <span className="text-[#E8EAF0]">{activeDayLabel}</span>
            </span>
          </div>
        )}
        <div className="flex gap-3 items-end">
          <div className="flex-1 bg-[#160D16] border border-[#3D1A3D] rounded-2xl overflow-hidden focus-within:border-[#A729AD]/50 focus-within:ring-1 focus-within:ring-[#A729AD]/20 transition-all">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe el día o las clases específicas..."
              rows={2}
              className="w-full bg-transparent px-5 py-4 text-sm text-[#E8EAF0] placeholder-[#9B80A0] focus:outline-none leading-relaxed font-medium"
              disabled={isGenerating}
            />
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className="w-12 h-12 rounded-2xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-30 flex items-center justify-center transition-all flex-shrink-0 active:scale-90"
            title="Enviar (Enter)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
        <div className="flex justify-between items-center mt-3">
          <p className="text-[10px] text-[#9B80A0] font-medium">Shift + Enter para nueva línea</p>
          <div className="flex items-center gap-1 text-[9px] text-[#9B80A0] font-bold tracking-widest uppercase">Claude</div>
        </div>
      </div>
    </div>
  )
}
