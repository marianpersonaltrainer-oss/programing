import { useState, useEffect } from 'react'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'

export default function EditModal({ day, session, onSave, onClose }) {
  const [content, setContent] = useState(session?.content || '')
  const [selectedDay, setSelectedDay] = useState(day || '')
  const [classes, setClasses] = useState(session?.classes || [])

  useEffect(() => {
    setContent(session?.content || '')
    setSelectedDay(day || '')
    setClasses(session?.classes || [])
  }, [day, session])

  function handleSave() {
    if (!selectedDay || !content.trim()) return
    onSave(selectedDay, content, classes)
  }

  function toggleClass(cls) {
    setClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    )
  }

  const allClasses = ['EvoFuncional', 'EvoBasics', 'EvoFit']

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-white border border-black/5 rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 py-5 border-b border-black/5 flex items-center justify-between flex-shrink-0 bg-white shadow-sm">
          <div>
            <h3 className="text-display text-base font-bold text-evo-text uppercase tracking-tight">Editar Sesión</h3>
            <p className="text-[10px] text-evo-muted font-bold mt-1 uppercase tracking-widest">Ajustar contenido y clasificación</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-gray-50 hover:bg-red-50 flex items-center justify-center text-evo-muted hover:text-red-500 transition-all shadow-sm border border-black/5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-8 py-4 border-b border-black/5 flex items-center gap-6 flex-shrink-0 flex-wrap bg-gray-50/30">
          {/* Day selector */}
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold text-evo-muted uppercase tracking-widest">Día</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-white border border-black/10 rounded-xl px-4 py-2 text-xs text-evo-text font-medium focus:outline-none focus:border-evo-accent shadow-sm"
            >
              <option value="">Seleccionar día...</option>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>{DAYS_ES[d]}</option>
              ))}
            </select>
          </div>

          {/* Class badges */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-evo-muted uppercase tracking-widest">Clases</span>
            <div className="flex gap-2">
              {allClasses.map((cls) => {
                const color = CLASS_COLORS[cls]
                const active = classes.includes(cls)
                return (
                  <button
                    key={cls}
                    onClick={() => toggleClass(cls)}
                    className="text-[10px] px-4 py-1.5 rounded-xl border font-bold transition-all shadow-sm"
                    style={{
                      backgroundColor: active ? `${color.bg}15` : 'white',
                      color: active ? color.bg : '#9CA3AF',
                      borderColor: active ? `${color.bg}40` : '#E5E7EB',
                    }}
                  >
                    {cls}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Text editor */}
        <div className="flex-1 overflow-hidden bg-white">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-transparent px-8 py-6 text-[13px] font-medium text-evo-text focus:outline-none leading-relaxed resize-none font-mono"
            spellCheck={false}
            placeholder="Escribe el contenido de la sesión aquí..."
          />
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-black/5 flex items-center justify-between flex-shrink-0 bg-gray-50/50">
          <div className="text-[10px] text-evo-muted font-bold uppercase tracking-widest">
            {content.length} CARACTERES
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-black/10 bg-white text-evo-muted hover:text-evo-text hover:bg-gray-50 text-[10px] font-bold uppercase tracking-widest transition-all shadow-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedDay || !content.trim()}
              className="px-8 py-3 rounded-xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-30 disabled:grayscale text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              Confirmar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
