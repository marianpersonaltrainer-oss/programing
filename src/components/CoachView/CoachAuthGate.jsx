import CoachView from './CoachView.jsx'
import Pe2Login from '../Pe2/Pe2Login.jsx'
import { usePe2Auth } from '../../hooks/usePe2Auth.js'
import {
  isCoachIndividualAuthEnabled,
  isCoachSharedCodeFallbackEnabled,
} from '../../constants/coachAccess.js'
import { evoBrand } from '../../constants/evoBrand.js'

function CoachAccessDenied({ onSignOut }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: evoBrand.app }}>
      <div
        className="w-full max-w-md rounded-2xl border p-8 text-center"
        style={{ backgroundColor: evoBrand.card, borderColor: '#FCA5A5', color: evoBrand.text }}
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: '#991B1B' }}>
          Acceso no autorizado
        </p>
        <h1 className="font-evo-display text-2xl font-bold mb-3">EVO Coach</h1>
        <p className="text-sm mb-6" style={{ color: evoBrand.muted }}>
          Esta cuenta no tiene una membresía activa con acceso al puesto de trabajo Coach.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ backgroundColor: evoBrand.accent }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function CoachIndividualAuthGate() {
  const auth = usePe2Auth()

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: evoBrand.app, color: evoBrand.muted }}>
        Comprobando identidad…
      </div>
    )
  }

  if (!auth.isAuthenticated || auth.recoveryMode) {
    return (
      <Pe2Login
        loading={auth.loading}
        error={auth.error}
        onSignIn={auth.signIn}
        recoveryMode={auth.recoveryMode}
        onRequestPasswordReset={auth.requestPasswordReset}
        onUpdatePassword={auth.updatePassword}
        eyebrow="EVO Coach"
        description="Accede con tu cuenta individual de EVO. El permiso se valida por membresía y capacidad activa."
      />
    )
  }

  if (!auth.can('coach.workspace.access')) {
    return <CoachAccessDenied onSignOut={auth.signOut} />
  }

  return <CoachView />
}

export default function CoachAuthGate() {
  const individualRequired = isCoachIndividualAuthEnabled()
    && !isCoachSharedCodeFallbackEnabled()

  return individualRequired ? <CoachIndividualAuthGate /> : <CoachView />
}
