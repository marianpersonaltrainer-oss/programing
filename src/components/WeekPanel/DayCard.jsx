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
        relative rounded-2xl cursor-pointer transition-all duration-300 select-none border border-black/5
        ${isActive
          ? 'ring-2 ring-evo-accent/20 bg-white shadow-elevated -translate-y-0.5'
          : 'bg-white hover:bg-gray-50 shadow-soft hover:shadow-md'
        }
        ${isEmpty ? 'opacity-70 hover:opacity-100' : ''}
      `}
      style={{
        borderLeft: isConfirmed ? `4px solid ${accentColor}` : '4px solid #E5E7EB',
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-display text-[10px] font-bold text-evo-muted uppercase tracking-widest">
            {dayLabel}
          </span>
          <div className="flex items-center gap-1.5">
            {isConfirmed && (
              <div className="flex items-center gap-1 bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md border border-emerald-100">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold">LISTO</span>
              </div>
            )}
            {isConfirmed && onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className="w-5 h-5 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all ml-1 shadow-sm"
                title="Eliminar sesión"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        {isEmpty ? (
          <div className="flex items-center gap-2 py-1 text-evo-accent font-semibold group">
            <span className="text-lg transition-transform group-hover:scale-125">+</span>
            <span className="text-[11px] tracking-tight">Programar día</span>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Class badges */}
            <div className="flex flex-wrap gap-1.5">
              {classes.map((cls) => {
                const color = CLASS_COLORS[cls]
                return (
                  <span
                    key={cls}
                    className="text-[9px] font-bold px-2 py-0.5 rounded-lg border shadow-sm"
                    style={{
                      backgroundColor: color ? `${color.bg}10` : '#7B2FBE10',
                      color: color?.bg || '#7B2FBE',
                      borderColor: color ? `${color.bg}20` : '#7B2FBE20',
                    }}
                  >
                    {cls}
                  </span>
                )
              })}
            </div>
            {/* Preview snippet */}
            <p className="text-[11px] text-evo-text/70 line-clamp-2 leading-relaxed font-medium">
              {session.content?.slice(0, 90)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
