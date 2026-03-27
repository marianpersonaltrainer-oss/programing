import { useState } from 'react'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { detectClassesInContent } from '../../utils/formatSession.js'

export default function SessionPreview({ content, onConfirm, onEdit }) {
  const [selectedDay, setSelectedDay] = useState('')
  const [classes, setClasses] = useState(() => detectClassesInContent(content))

  const allClasses = ['EvoFuncional', 'EvoBasics', 'EvoFit']

  function toggleClass(cls) {
    setClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    )
  }

  function handleConfirm() {
    if (!selectedDay) return
    onConfirm(selectedDay, content, classes)
  }

  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-elevated">
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-gray-50 border-b border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-evo-accent animate-pulse" />
          <span className="text-[10px] font-bold text-evo-text uppercase tracking-widest">Sesión Propuesta</span>
        </div>
        <button
          onClick={onEdit}
          className="text-[10px] text-evo-accent font-bold uppercase hover:underline underline-offset-4"
        >
          Editar Programación →
        </button>
      </div>

      {/* Session content preview */}
      <div className="px-5 py-4 max-h-72 overflow-y-auto bg-white/50">
        <pre className="session-content text-[11px] text-evo-text/80 whitespace-pre-wrap font-medium">
          {content}
        </pre>
      </div>

      {/* Confirm controls */}
      <div className="px-5 py-5 bg-gray-50/50 border-t border-black/5 space-y-4">
        {/* Class tags */}
        <div>
          <p className="text-[9px] text-evo-muted mb-2.5 font-bold uppercase tracking-widest">Clases incluidas</p>
          <div className="flex flex-wrap gap-2">
            {allClasses.map((cls) => {
              const color = CLASS_COLORS[cls]
              const active = classes.includes(cls)
              return (
                <button
                  key={cls}
                  onClick={() => toggleClass(cls)}
                  className="text-[10px] px-3 py-1.5 rounded-xl border font-bold transition-all shadow-sm"
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

        {/* Day selector + confirm button */}
        <div className="flex gap-3 pt-1">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="flex-1 bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs text-evo-text font-medium focus:outline-none focus:border-evo-accent/40 shadow-sm"
          >
            <option value="">Programar para el...</option>
            {DAYS_ORDER.map((d) => (
              <option key={d} value={d}>{DAYS_ES[d]}</option>
            ))}
          </select>
          <button
            onClick={handleConfirm}
            disabled={!selectedDay}
            className="px-6 py-2.5 rounded-xl bg-evo-accent hover:bg-evo-accent-hover disabled:opacity-30 disabled:grayscale text-white text-xs font-bold transition-all shadow-lg shadow-purple-500/20 active:scale-95"
          >
            Confirmar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
