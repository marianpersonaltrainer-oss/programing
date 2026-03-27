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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#111] border border-white/8 rounded-t-2xl max-h-[85vh] flex flex-col animate-fade-in">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-display text-sm font-semibold text-white">Editar sesión</h3>
            <p className="text-[10px] text-evo-muted mt-0.5">Modifica el contenido antes de confirmar</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-evo-muted hover:text-white transition-colors text-sm"
          >
            ×
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-white/5 flex items-center gap-4 flex-shrink-0 flex-wrap">
          {/* Day selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-evo-muted uppercase tracking-wider">Día</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-[#1A1A1A] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50"
            >
              <option value="">Seleccionar...</option>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>{DAYS_ES[d]}</option>
              ))}
            </select>
          </div>

          {/* Class badges */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-evo-muted uppercase tracking-wider">Clases</span>
            {allClasses.map((cls) => {
              const color = CLASS_COLORS[cls]
              const active = classes.includes(cls)
              return (
                <button
                  key={cls}
                  onClick={() => toggleClass(cls)}
                  className="text-[10px] px-2 py-1 rounded-lg border transition-all"
                  style={{
                    backgroundColor: active ? `${color.bg}22` : 'transparent',
                    color: active ? color.bg : '#555',
                    borderColor: active ? `${color.bg}55` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  {cls}
                </button>
              )
            })}
          </div>
        </div>

        {/* Text editor */}
        <div className="flex-1 overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full bg-transparent px-5 py-4 text-[12px] font-mono text-gray-200 focus:outline-none leading-relaxed resize-none"
            spellCheck={false}
            placeholder="Contenido de la sesión..."
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/5 flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] text-evo-muted">
            {content.length} caracteres
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 text-evo-muted hover:text-white hover:border-white/20 text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedDay || !content.trim()}
              className="px-5 py-2 rounded-lg bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
            >
              Confirmar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
