import { evoBrand } from '../../constants/evoBrand.js'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Pe2WeekPlaceholder() {
  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: evoBrand.muted }}>
          Vista semana
        </p>
        <h1 className="font-evo-display text-2xl sm:text-3xl font-bold" style={{ color: evoBrand.text }}>
          Semana actual
        </h1>
        <p className="text-sm mt-2" style={{ color: evoBrand.muted }}>
          Placeholder del futuro lienzo (tabla día × clase). Sin datos todavía.
        </p>
      </header>

      <div
        className="flex-1 min-h-[280px] rounded-2xl border border-dashed p-6 flex flex-col"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}55` }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: evoBrand.purple }}>
          Lienzo (próximamente)
        </p>
        <div className="grid grid-cols-6 gap-2 flex-1 min-h-[180px]">
          {DAYS.map((day) => (
            <div
              key={day}
              className="rounded-xl border flex flex-col items-center justify-center text-center p-3"
              style={{ borderColor: `${evoBrand.purple}33`, backgroundColor: evoBrand.cardAlt }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: evoBrand.muted }}>
                {day}
              </span>
              <span className="text-[11px] mt-2 opacity-60" style={{ color: evoBrand.text }}>
                —
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
