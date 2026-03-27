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
    <div className="border-t border-white/5 bg-[#0D0D0D] flex-shrink-0">
      {/* Toggle header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/2 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-display text-xs font-semibold text-white">
            Semana completa
          </span>
          <div className="flex gap-1">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#7B2FBE'
              return (
                <span
                  key={day}
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${color}22`, color }}
                  title={DAYS_ES[day]}
                >
                  {DAYS_ES[day].slice(0, 3).toUpperCase()}
                </span>
              )
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CopyButton text={allContent} label="Copiar todo" />
          <span className="text-evo-muted text-xs">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded view */}
      {isExpanded && (
        <div className="px-5 pb-4 max-h-72 overflow-y-auto">
          <div className="space-y-3">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#7B2FBE'

              return (
                <div
                  key={day}
                  className="rounded-xl overflow-hidden border border-white/5"
                  style={{ borderLeftColor: color, borderLeftWidth: 3 }}
                >
                  <div className="px-4 py-2 bg-[#1A1A1A] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white">
                        {DAYS_ES[day]}
                      </span>
                      <div className="flex gap-1">
                        {session.classes?.map((cls) => (
                          <span
                            key={cls}
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{
                              backgroundColor: `${CLASS_COLORS[cls]?.bg || '#7B2FBE'}22`,
                              color: CLASS_COLORS[cls]?.bg || '#7B2FBE',
                            }}
                          >
                            {cls}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <CopyButton text={session.content} label="Copiar" />
                      <button
                        onClick={() => onEditSession(day)}
                        className="text-[10px] text-evo-muted hover:text-white transition-colors"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <div className="px-4 py-3 max-h-32 overflow-y-auto">
                    <pre className="session-content text-[10px] text-gray-400 whitespace-pre-wrap">
                      {session.content.slice(0, 400)}
                      {session.content.length > 400 ? '...' : ''}
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
