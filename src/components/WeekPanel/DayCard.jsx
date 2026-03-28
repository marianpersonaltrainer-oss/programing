import { CLASS_COLORS, DAYS_ES } from '../../constants/evoColors.js'

export default function DayCard({ day, session, isActive, onClick, onRemove }) {
  const dayLabel = DAYS_ES[day] || day
  const isEmpty = !session
  const isConfirmed = session?.confirmed

  const classes = session?.classes || []
  const primaryClass = classes[0] || 'EvoFuncional'
  const accentColor = CLASS_COLORS[primaryClass]?.bg || '#A729AD'

  return (
    <div
      onClick={onClick}
      className={`
        relative rounded-2xl cursor-pointer transition-all duration-300 select-none border border-[#3D1A3D]
        ${isActive
          ? 'ring-2 ring-[#A729AD]/50 bg-[#1D0F1D] shadow-lg -translate-y-0.5'
          : 'bg-[#160D16] hover:bg-[#1D0F1D] shadow-sm hover:shadow-md'
        }
        ${isEmpty ? 'opacity-80 hover:opacity-100' : ''}
      `}
      style={{
        borderLeft: isConfirmed ? `4px solid ${accentColor}` : '4px solid #3D1A3D',
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-evo-display text-[10px] font-bold text-[#9B80A0] uppercase tracking-widest">
            {dayLabel}
          </span>
          <div className="flex items-center gap-1.5">
            {isConfirmed && (
              <div className="flex items-center gap-1 bg-emerald-950/50 text-emerald-300 px-1.5 py-0.5 rounded-md border border-emerald-800/50">
                <span className="w-1 h-1 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-bold">LISTO</span>
              </div>
            )}
            {isConfirmed && onRemove && (
              <button
                onClick={(e) => { e.stopPropagation(); onRemove() }}
                className="w-5 h-5 flex items-center justify-center rounded-lg bg-[#0C0B0C] hover:bg-red-950/50 text-[#9B80A0] hover:text-red-400 transition-all ml-1 border border-[#3D1A3D]"
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
          <div className="flex items-center gap-2 py-1 text-[#A729AD] font-semibold group">
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
                      backgroundColor: color ? `${color.bg}22` : '#A729AD22',
                      color: color?.text || color?.bg || '#E8EAF0',
                      borderColor: color ? `${color.bg}55` : '#A729AD55',
                    }}
                  >
                    {cls}
                  </span>
                )
              })}
            </div>
            {/* Preview snippet */}
            <p className="text-[11px] text-[#9B80A0] line-clamp-2 leading-relaxed font-medium">
              {session.content?.slice(0, 90)}...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
