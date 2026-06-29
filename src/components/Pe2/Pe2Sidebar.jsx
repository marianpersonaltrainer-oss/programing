import EvoLogo from '../EvoLogo.jsx'
import { evoBrand } from '../../constants/evoBrand.js'

const NAV_ITEMS = [
  { id: 'home', label: 'Inicio' },
  { id: 'week', label: 'Semana' },
]

export default function Pe2Sidebar({ activeView, onNavigate, profile, onSignOut }) {
  return (
    <aside
      className="w-[260px] flex-shrink-0 flex flex-col border-r min-h-0"
      style={{ backgroundColor: evoBrand.sidebar, borderColor: `${evoBrand.purple}55` }}
    >
      <div className="px-4 py-5 border-b" style={{ borderColor: `${evoBrand.purple}44` }}>
        <div className="flex items-center gap-3">
          <EvoLogo />
          <div className="min-w-0">
            <p className="font-evo-display text-sm font-bold uppercase tracking-wide text-white truncate">
              Programación V2
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C4A8C4]">
              {profile?.role || 'programmer'}
            </p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-[12px] font-semibold border transition-colors ${
                active
                  ? 'bg-[#A729AD]/30 border-[#A729AD]/60 text-white'
                  : 'border-transparent text-[#C4A8C4] hover:border-white/20 hover:bg-white/5'
              }`}
            >
              {label}
            </button>
          )
        })}
      </nav>

      <div className="p-3 border-t space-y-2" style={{ borderColor: `${evoBrand.purple}44` }}>
        {profile?.full_name ? (
          <p className="text-[11px] text-[#C4A8C4] truncate px-1">{profile.full_name}</p>
        ) : null}
        <button
          type="button"
          onClick={onSignOut}
          className="block w-full text-center px-3 py-2 rounded-xl text-[11px] font-semibold text-[#C4A8C4] hover:text-white border border-white/15 hover:border-white/30 transition-colors"
        >
          Cerrar sesión
        </button>
        <a
          href="/"
          className="block w-full text-center px-3 py-2 rounded-xl text-[11px] font-semibold text-[#C4A8C4] hover:text-white border border-white/15 hover:border-white/30 transition-colors"
        >
          ← Programador V1
        </a>
      </div>
    </aside>
  )
}
