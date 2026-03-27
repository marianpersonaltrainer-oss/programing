import { CLASS_COLORS, DAYS_ES } from '../../constants/evoColors.js'

export default function DayCard({ day, session, isActive, onClick, onRemove }) {
  const dayLabel = DAYS_ES[day] || day
  const isEmpty = !session
  const isConfirmed = session?.confirmed

  const classes = session?.classes || []
  const primaryClass = classes[0] || 'EvoFuncional'
  const accentColor = CLASS_COLORS[primaryClass]?.bg || '#7B2FBE'

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-xl cursor-pointer transition-all duration-200 select-none
        ${isActive
          ? 'ring-2 ring-[#7B2FBE] bg-[#1A1A1A]'
          : 'bg-[#111111] hover:bg-[#161616]'
        }
        ${isEmpty ? 'opacity-60 hover:opacity-100' : ''}
      `}
      style={{
        borderLeft: isConfirmed ? `3px solid ${accentColor}` : '3px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-display text-xs font-semibold text-evo-muted uppercase tracking-wider">
            {dayLabel}
          </span>
          <div className="flex items-center gap-1">
            {isConfirmed && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#2FBE7B]" title="Confirmado" />
            )}
            {isConfirmed && onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className="text-evo-muted hover:text-red-400 transition-colors text-xs ml-1"
                title="Eliminar sesión"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isEmpty ? (
          <div className="flex items-center gap-2 text-evo-muted">
            <span className="text-sm">+</span>
            <span className="text-xs">Añadir sesión</span>
          </div>
        ) : (
          <div>
            {/* Class badges */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {classes.map((cls) => {
                const color = CLASS_COLORS[cls]
                return (
                  <span
                    key={cls}
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
                    style={{
                      backgroundColor: color ? `${color.bg}22` : '#7B2FBE22',
                      color: color?.bg || '#7B2FBE',
                      border: `1px solid ${color?.bg || '#7B2FBE'}44`,
                    }}
                  >
                    {cls}
                  </span>
                )
              })}
            </div>
            {/* Preview snippet */}
            <p className="text-[11px] text-evo-muted line-clamp-2 leading-relaxed">
              {session.content?.slice(0, 80)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
