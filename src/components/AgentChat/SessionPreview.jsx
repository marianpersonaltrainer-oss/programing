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
    <div className="bg-[#111] border border-white/8 rounded-xl overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 bg-[#1A1A1A] border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#7B2FBE] animate-pulse-soft" />
          <span className="text-xs font-medium text-white">Sesión generada</span>
        </div>
        <button
          onClick={onEdit}
          className="text-[11px] text-evo-muted hover:text-white transition-colors"
        >
          Editar antes de confirmar →
        </button>
      </div>

      {/* Session content preview */}
      <div className="px-4 py-3 max-h-64 overflow-y-auto">
        <pre className="session-content text-[11px] text-gray-300 whitespace-pre-wrap">
          {content}
        </pre>
      </div>

      {/* Confirm controls */}
      <div className="px-4 py-3 bg-[#0F0F0F] border-t border-white/5 space-y-3">
        {/* Class tags */}
        <div>
          <p className="text-[10px] text-evo-muted mb-1.5 uppercase tracking-wider">Clases de esta sesión</p>
          <div className="flex flex-wrap gap-1.5">
            {allClasses.map((cls) => {
              const color = CLASS_COLORS[cls]
              const active = classes.includes(cls)
              return (
                <button
                  key={cls}
                  onClick={() => toggleClass(cls)}
                  className="text-[11px] px-2.5 py-1 rounded-lg border transition-all"
                  style={{
                    backgroundColor: active ? `${color.bg}22` : 'transparent',
                    color: active ? color.bg : '#666',
                    borderColor: active ? `${color.bg}55` : 'rgba(255,255,255,0.1)',
                  }}
                >
                  {cls}
                </button>
              )
            })}
          </div>
        </div>

        {/* Day selector + confirm button */}
        <div className="flex gap-2">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50"
          >
            <option value="">Seleccionar día...</option>
            {DAYS_ORDER.map((d) => (
              <option key={d} value={d}>{DAYS_ES[d]}</option>
            ))}
          </select>
          <button
            onClick={handleConfirm}
            disabled={!selectedDay}
            className="px-4 py-2 rounded-lg bg-[#7B2FBE] hover:bg-[#9B4FDE] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}
