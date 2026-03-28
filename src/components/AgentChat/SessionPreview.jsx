import { useState } from 'react'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { ALL_CLASS_LABELS } from '../../constants/evoClasses.js'
import { detectClassesInContent } from '../../utils/formatSession.js'

export default function SessionPreview({ content, onConfirm, onEdit }) {
  const [selectedDay, setSelectedDay] = useState('')
  const [classes, setClasses] = useState(() => detectClassesInContent(content))

  const allClasses = ALL_CLASS_LABELS

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
    <div className="bg-[#160D16] border border-[#3D1A3D] rounded-2xl overflow-hidden">
      <div className="px-5 py-3.5 bg-[#0C0B0C] border-b border-[#3D1A3D] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#A729AD] animate-pulse" />
          <span className="text-[10px] font-bold text-[#FFFF4C] uppercase tracking-widest font-evo-display">Sesión Propuesta</span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="text-[10px] text-[#A729AD] font-bold uppercase hover:underline underline-offset-4"
        >
          Editar Programación →
        </button>
      </div>

      <div className="px-5 py-4 max-h-80 overflow-y-auto bg-[#0C0B0C]">
        <div className="space-y-4">
          <pre className="session-content text-[11px] text-[#9B80A0] whitespace-pre-wrap font-medium">
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
                className="inline-flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#6A1F6D]/20 border border-[#3D1A3D] hover:border-[#A729AD]/50 transition-all group w-full"
              >
                <div className="w-8 h-8 rounded-xl bg-[#A729AD]/20 flex items-center justify-center text-[#A729AD] group-hover:scale-110 transition-transform">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-[#E8EAF0] uppercase tracking-widest">Vídeo de la técnica</span>
                  <span className="text-[9px] text-[#9B80A0] font-bold truncate max-w-[200px]">{link}</span>
                </div>
                <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-[#A729AD]"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </div>
              </a>
            )
          })}
        </div>
      </div>

      {/* Confirm controls */}
      <div className="px-5 py-5 bg-[#160D16] border-t border-[#3D1A3D] space-y-4">
        <div>
          <p className="text-[9px] text-[#9B80A0] mb-2.5 font-bold uppercase tracking-widest">Clases incluidas</p>
          <div className="flex flex-wrap gap-2">
            {allClasses.map((cls) => {
              const color = CLASS_COLORS[cls]
              const active = classes.includes(cls)
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => toggleClass(cls)}
                  className="text-[10px] px-3 py-1.5 rounded-xl border font-bold transition-all"
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

        <div className="flex gap-3 pt-1">
          <select
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="flex-1 bg-[#0C0B0C] border border-[#3D1A3D] rounded-xl px-4 py-2.5 text-xs text-[#E8EAF0] font-medium focus:outline-none focus:border-[#A729AD]/50"
          >
            <option value="">Programar para el...</option>
            {DAYS_ORDER.map((d) => (
              <option key={d} value={d}>{DAYS_ES[d]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedDay}
            className="px-6 py-2.5 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-30 text-white text-xs font-bold transition-all active:scale-95"
          >
            Confirmar Sesión
          </button>
        </div>
      </div>
    </div>
  )
}
