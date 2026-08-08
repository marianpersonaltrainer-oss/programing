import { evoBrand } from '../../constants/evoBrand.js'

export default function RoleGate({ role, children }) {
  if (role === 'programmer' || role === 'coach') return children

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
      <div className="max-w-md rounded-2xl border p-6 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
        Tu perfil no tiene rol V2 (<code>programmer</code> o <code>coach</code>). Ejecuta el seed o revisa la tabla{' '}
        <code>profiles</code>.
      </div>
    </div>
  )
}
