import { evoBrand } from '../../constants/evoBrand.js'

export default function Pe2HomeView({ onOpenWeek }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        ProgramingEvo · V2
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold mb-4" style={{ color: evoBrand.text }}>
        Programación V2
      </h1>

      <div
        className="rounded-2xl border px-5 py-4 mb-6"
        style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}44` }}
      >
        <p className="text-sm font-bold uppercase tracking-wide mb-1" style={{ color: evoBrand.purple }}>
          Modo laboratorio
        </p>
        <p className="text-sm leading-relaxed" style={{ color: evoBrand.text }}>
          Esta vista está en desarrollo paralelo. No escribe en Supabase ni afecta al Coach en producción
          (<code className="text-xs">/?coach</code>) ni al programador actual (<code className="text-xs">/</code>).
        </p>
      </div>

      <button
        type="button"
        onClick={onOpenWeek}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-colors hover:opacity-90"
        style={{ backgroundColor: evoBrand.accent }}
      >
        Semana actual
        <span aria-hidden>→</span>
      </button>

      <p className="mt-8 text-xs leading-relaxed" style={{ color: evoBrand.muted }}>
        Próximo paso: migración <code>pe2_*</code> y lienzo de sesión. Por ahora solo shell de navegación.
      </p>
    </div>
  )
}
