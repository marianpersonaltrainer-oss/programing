import { useState } from 'react'
import CopyButton from './CopyButton.jsx'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { formatSessionForExport } from '../../utils/formatSession.js'

export default function ExportPanel({ weekState, onEditSession }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const confirmedSessions = DAYS_ORDER.filter((d) => weekState.sessions[d]?.confirmed)
  const allContent = formatSessionForExport(weekState.sessions)

  if (confirmedSessions.length === 0) return null

  return (
    <div className="border-t border-black/5 bg-white flex-shrink-0 shadow-elevated relative z-10">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-8 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-all border-b border-transparent"
      >
        <div className="flex items-center gap-4">
          <span className="text-display text-[11px] font-bold text-evo-text uppercase tracking-widest">
            Sesiones Listas
          </span>
          <div className="flex gap-1.5">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#7B2FBE'
              return (
                <span
                  key={day}
                  className="text-[9px] px-2 py-0.5 rounded-lg border font-bold shadow-sm"
                  style={{ backgroundColor: `${color}10`, color, borderColor: `${color}20` }}
                  title={DAYS_ES[day]}
                >
                  {DAYS_ES[day].slice(0, 3).toUpperCase()}
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <CopyButton text={allContent} label="Copiar Todo" />
          <span className="w-8 h-8 flex items-center justify-center rounded-xl bg-gray-50 text-evo-muted text-xs shadow-sm border border-black/5">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-8 pb-6 bg-gray-50/30 max-h-80 overflow-y-auto pt-4 animate-fade-in shadow-inner">
          <div className="space-y-4">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#7B2FBE'

              return (
                <div
                  key={day}
                  className="rounded-2xl overflow-hidden border border-black/5 bg-white shadow-soft hover:shadow-md transition-all group"
                  style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                >
                  <div className="px-5 py-3 bg-white border-b border-black/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-evo-text uppercase tracking-widest">
                        {DAYS_ES[day]}
                      </span>
                      <div className="flex gap-1.5">
                        {session.classes?.map((cls) => (
                          <span
                            key={cls}
                            className="text-[8px] px-2 py-0.5 rounded-lg font-bold border shadow-sm"
                            style={{
                              backgroundColor: `${CLASS_COLORS[cls]?.bg || '#7B2FBE'}08`,
                              color: CLASS_COLORS[cls]?.bg || '#7B2FBE',
                              borderColor: `${CLASS_COLORS[cls]?.bg || '#7B2FBE'}15`,
                            }}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <CopyButton text={session.content} label="Copiar" />
                      <button
                        onClick={() => onEditSession(day)}
                        className="text-[10px] text-evo-muted font-bold uppercase tracking-widest hover:text-evo-accent transition-all"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <div className="px-5 py-4 bg-gray-50/30 max-h-40 overflow-y-auto">
                    <pre className="session-content text-[11px] text-gray-500 font-medium whitespace-pre-wrap leading-relaxed">
                      {session.content.slice(0, 500)}
                      {session.content.length > 500 ? '...' : ''}
                    </pre>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
