import { useState } from 'react'
import CopyButton from './CopyButton.jsx'
import { DAYS_ES, DAYS_ORDER, CLASS_COLORS } from '../../constants/evoColors.js'
import { evoBrand } from '../../constants/evoBrand.js'
import { formatSessionForExport } from '../../utils/formatSession.js'
import { coachBg, coachBorder, coachText } from '../CoachView/coachTheme.js'

export default function ExportPanel({ weekState, onEditSession }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const confirmedSessions = DAYS_ORDER.filter((d) => weekState.sessions[d]?.confirmed)
  const allContent = formatSessionForExport(weekState.sessions)

  if (confirmedSessions.length === 0) return null

  return (
    <div className={`border-t ${coachBorder} ${coachBg.card} flex-shrink-0 relative z-10`}>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className={`w-full px-8 py-4 flex items-center justify-between hover:bg-[#241224] transition-all border-b ${coachBorder}`}
      >
        <div className="flex items-center gap-4">
          <span className="font-evo-display text-[11px] font-bold text-[#FFFF4C] uppercase tracking-widest">
            Sesiones Listas
          </span>
          <div className="flex gap-1.5">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#A729AD'
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
          <span className={`w-8 h-8 flex items-center justify-center rounded-xl ${coachBg.app} ${coachText.muted} text-xs border ${coachBorder}`}>
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className={`px-8 pb-6 ${coachBg.app} max-h-80 overflow-y-auto pt-4 animate-fade-in border-t ${coachBorder}`}>
          <div className="space-y-4">
            {confirmedSessions.map((day) => {
              const session = weekState.sessions[day]
              const primaryClass = session?.classes?.[0] || 'EvoFuncional'
              const color = CLASS_COLORS[primaryClass]?.bg || '#A729AD'

              return (
                <div
                  key={day}
                  className={`rounded-2xl overflow-hidden border ${coachBorder} ${coachBg.card} transition-all group`}
                  style={{ borderLeftColor: color, borderLeftWidth: 4 }}
                >
                  <div className={`px-5 py-3 ${coachBg.card} border-b ${coachBorder} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] font-bold ${coachText.primary} uppercase tracking-widest`}>
                        {DAYS_ES[day]}
                      </span>
                      <div className="flex gap-1.5">
                        {session.classes?.map((cls) => (
                          <span
                            key={cls}
                            className="text-[8px] px-2 py-0.5 rounded-lg font-bold border"
                            style={{
                              backgroundColor: `${CLASS_COLORS[cls]?.bg || '#A729AD'}22`,
                              color: CLASS_COLORS[cls]?.text || CLASS_COLORS[cls]?.bg || evoBrand.text,
                              borderColor: `${CLASS_COLORS[cls]?.bg || '#A729AD'}44`,
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
                        type="button"
                        onClick={() => onEditSession(day)}
                        className={`text-[10px] ${coachText.muted} font-bold uppercase tracking-widest hover:text-[#A729AD] transition-all`}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                  <div className={`px-5 py-4 ${coachBg.app} max-h-40 overflow-y-auto`}>
                    <pre className={`session-content text-[11px] ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed`}>
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
