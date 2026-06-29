import { evoBrand } from '../../constants/evoBrand.js'

export default function RoleGate({ role, children }) {
  if (role === 'programmer') return children

  if (role === 'coach') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
        <div
          className="max-w-lg rounded-2xl border p-8 text-center"
          style={{ backgroundColor: evoBrand.card, borderColor: '#234C9E44' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#234C9E' }}>
            Rol coach · Fase 1
          </p>
          <h1 className="font-evo-display text-2xl font-bold mb-3" style={{ color: evoBrand.text }}>
            Sala Coach
          </h1>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: evoBrand.muted }}>
            La conexión completa con Programación V2 llegará en Fase 2. Mientras tanto, el Coach en producción sigue en{' '}
            <code>?coach</code> (sin cambios).
          </p>
          <a
            href="/?coach"
            className="inline-flex px-6 py-3 rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: '#234C9E' }}
          >
            Ir a Sala Coach (prod)
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
      <div className="max-w-md rounded-2xl border p-6 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
        Tu perfil no tiene rol V2 (<code>programmer</code> o <code>coach</code>). Ejecuta el seed o revisa la tabla{' '}
        <code>profiles</code>.
      </div>
    </div>
  )
}
