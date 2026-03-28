import { useState, useEffect } from 'react'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { ALL_CLASS_LABELS } from '../../constants/evoClasses.js'

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

  const allClasses = ALL_CLASS_LABELS

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-4xl bg-[#160D16] border border-[#3D1A3D] rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up shadow-2xl overflow-hidden">
        <div className="px-8 py-5 border-b border-[#3D1A3D] flex items-center justify-between flex-shrink-0 bg-[#0C0B0C]">
          <div>
            <h3 className="font-evo-display text-base font-bold text-[#FFFF4C] uppercase tracking-tight">Editar Sesión</h3>
            <p className="text-[10px] text-[#9B80A0] font-bold mt-1 uppercase tracking-widest">Ajustar contenido y clasificación</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-[#160D16] hover:bg-red-950/50 flex items-center justify-center text-[#9B80A0] hover:text-red-400 transition-all border border-[#3D1A3D]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-8 py-4 border-b border-[#3D1A3D] flex items-center gap-6 flex-shrink-0 flex-wrap bg-[#160D16]">
          <div className="flex items-center gap-3">
            <label className="text-[11px] font-bold text-[#9B80A0] uppercase tracking-widest">Día</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="bg-[#0C0B0C] border border-[#3D1A3D] rounded-xl px-4 py-2 text-xs text-[#E8EAF0] font-medium focus:outline-none focus:border-[#A729AD]/50"
            >
              <option value="">Seleccionar día...</option>
              {DAYS_ORDER.map((d) => (
                <option key={d} value={d}>{DAYS_ES[d]}</option>
              ))}
            </select>
          </div>

          {/* Class badges */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold text-[#9B80A0] uppercase tracking-widest">Clases</span>
            <div className="flex gap-2 flex-wrap">
              {allClasses.map((cls) => {
                const color = CLASS_COLORS[cls]
                const active = classes.includes(cls)
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => toggleClass(cls)}
                    className="text-[10px] px-4 py-1.5 rounded-xl border font-bold transition-all"
                    style={{
                      backgroundColor: active ? `${color.bg}28` : '#0C0B0C',
                      color: active ? color.text || color.bg : '#9B80A0',
                      borderColor: active ? `${color.bg}55` : '#3D1A3D',
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
        <div className="flex-1 overflow-hidden bg-[#0C0B0C] min-h-[200px]">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-full min-h-[200px] bg-transparent px-8 py-6 text-[13px] font-medium text-[#E8EAF0] focus:outline-none leading-relaxed resize-none font-mono placeholder-[#9B80A0]"
            spellCheck={false}
            placeholder="Escribe el contenido de la sesión aquí..."
          />
        </div>

        <div className="px-8 py-5 border-t border-[#3D1A3D] flex items-center justify-between flex-shrink-0 bg-[#160D16]">
          <div className="text-[10px] text-[#9B80A0] font-bold uppercase tracking-widest">{content.length} CARACTERES</div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-[#3D1A3D] bg-[#0C0B0C] text-[#9B80A0] hover:text-[#E8EAF0] text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!selectedDay || !content.trim()}
              className="px-8 py-3 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-30 text-white text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95"
            >
              Confirmar Cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
