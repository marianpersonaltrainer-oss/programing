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
      <div className="px-5 py-4 max-h-80 overflow-y-auto bg-white/50">
        <div className="space-y-4">
          <pre className="session-content text-[11px] text-evo-text/80 whitespace-pre-wrap font-medium">
            {content}
          </pre>
          
          {/* Video Detection & Rendering */}
          {(content.match(/https?:\/\/[^\s]+|[a-zA-Z0-9_-]{11}(?=\s|$)/g) || []).map((link, idx) => {
            const isYoutube = link.includes('youtube.com') || link.includes('youtu.be') || link.length === 11
            const url = link.length === 11 ? `https://youtube.com/watch?v=${link}` : link
            
            return (
              <a 
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-evo-accent/[0.03] border border-evo-accent/10 hover:bg-evo-accent/10 hover:border-evo-accent/30 transition-all group w-full shadow-sm"
              >
                <div className="w-8 h-8 rounded-xl bg-evo-accent/10 flex items-center justify-center text-evo-accent group-hover:scale-110 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-evo-text uppercase tracking-widest">Vídeo de la técnica</span>
                  <span className="text-[9px] text-evo-muted font-bold truncate max-w-[200px]">{link}</span>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-evo-accent"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </div>
              </a>
            )
          })}
        </div>
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
