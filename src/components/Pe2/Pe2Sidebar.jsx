import EvoLogo from '../EvoLogo.jsx'
import { evoBrand } from '../../constants/evoBrand.js'

const PROGRAMMER_NAV_ITEMS = [
  { id: 'home', label: 'Inicio', mobileLabel: 'Inicio' },
  { id: 'week', label: 'Semana', mobileLabel: 'Semana' },
  { id: 'direction-shifts', label: 'Control de turnos', mobileLabel: 'Control' },
  { id: 'resources', label: 'Recursos EVO', mobileLabel: 'Recursos' },
]

const COACH_NAV_ITEMS = [
  { id: 'shift', label: 'Mi turno', mobileLabel: 'Mi turno' },
  { id: 'resources', label: 'Recursos EVO', mobileLabel: 'Recursos' },
]

export default function Pe2Sidebar({ activeView, onNavigate, profile, onSignOut }) {
  const navItems = profile?.role === 'programmer' ? PROGRAMMER_NAV_ITEMS : COACH_NAV_ITEMS

  return (
    <>
      <aside
        className="hidden md:flex w-[260px] flex-shrink-0 flex-col border-r min-h-0"
        style={{ backgroundColor: evoBrand.sidebar, borderColor: `${evoBrand.purple}55` }}
      >
        <div className="px-4 py-5 border-b" style={{ borderColor: `${evoBrand.purple}44` }}>
          <div className="flex items-center gap-3">
            <EvoLogo />
            <div className="min-w-0">
              <p className="font-evo-display text-sm font-bold uppercase tracking-wide text-white truncate">
                Programming EVO
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C4A8C4]">
                {profile?.role === 'programmer' ? 'Dirección' : 'Entrenador'}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label }) => {
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
          {profile?.role === 'programmer' ? (
            <a
              href="/"
              className="block w-full text-center px-3 py-2 rounded-xl text-[11px] font-semibold text-[#C4A8C4] hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            >
              ← Programador V1
            </a>
          ) : null}
        </div>
      </aside>

      <header
        className="md:hidden fixed inset-x-0 top-0 z-40 h-16 px-4 flex items-center justify-between border-b"
        style={{ backgroundColor: evoBrand.sidebar, borderColor: `${evoBrand.purple}55` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <EvoLogo />
          <div className="min-w-0">
            <p className="font-evo-display text-xs font-bold uppercase tracking-wide text-white">Programming EVO</p>
            <p className="text-[10px] text-[#C4A8C4] truncate">{profile?.full_name || 'Equipo EVO'}</p>
          </div>
        </div>
        <button type="button" onClick={onSignOut} className="text-[11px] font-semibold text-[#C4A8C4]">
          Salir
        </button>
      </header>

      <nav
        aria-label="Navegación principal"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 min-h-16 px-2 py-2 grid border-t"
        style={{
          backgroundColor: evoBrand.sidebar,
          borderColor: `${evoBrand.purple}55`,
          gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))`,
        }}
      >
        {navItems.map(({ id, mobileLabel }) => {
          const active = activeView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`rounded-xl px-1 py-2 text-[10px] font-bold leading-tight ${active ? 'bg-[#A729AD]/30 text-white' : 'text-[#C4A8C4]'}`}
            >
              {mobileLabel}
            </button>
          )
        })}
      </nav>
    </>
  )
}
