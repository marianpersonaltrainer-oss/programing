import { useEffect, useState } from 'react'
import Pe2Sidebar from './components/Pe2/Pe2Sidebar.jsx'
import Pe2HomeView from './components/Pe2/Pe2HomeView.jsx'
import Pe2WeekView from './components/Pe2/Pe2WeekView.jsx'
import Pe2Login from './components/Pe2/Pe2Login.jsx'
import RoleGate from './components/Pe2/RoleGate.jsx'
import { usePe2Auth } from './hooks/usePe2Auth.js'
import { getPe2ActiveSlot } from './lib/pe2Supabase.js'
import { evoBrand } from './constants/evoBrand.js'

export default function Pe2App() {
  const auth = usePe2Auth()
  const [view, setView] = useState('home')
  const [selectedDraftId, setSelectedDraftId] = useState(null)
  const [slot, setSlot] = useState(null)
  const canManageProgramming = auth.can('programming.manage')
  const canAccessCoachWorkspace = auth.can('coach.workspace.access')
  const accessRole = canManageProgramming
    ? 'programmer'
    : canAccessCoachWorkspace
      ? 'coach'
      : auth.role
  const programmingOrgId = auth.organizationIdFor('programming.manage')
    || auth.orgId

  useEffect(() => {
    if (!auth.isAuthenticated || !canManageProgramming) return
    getPe2ActiveSlot()
      .then(setSlot)
      .catch(() => setSlot(null))
  }, [auth.isAuthenticated, canManageProgramming])

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: evoBrand.app, color: evoBrand.muted }}>
        Cargando sesión…
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
      />
    )
  }

  return (
    <RoleGate role={accessRole}>
      <div
        className="h-screen flex flex-col overflow-hidden font-evo-body selection:bg-[#A729AD]/30"
        style={{ backgroundColor: evoBrand.app, color: evoBrand.text }}
      >
        <div className="flex flex-1 min-h-0">
          <Pe2Sidebar
            activeView={view}
            onNavigate={setView}
            profile={auth.profile}
            onSignOut={auth.signOut}
          />
          <main className="flex-1 min-w-0 overflow-y-auto p-6 sm:p-8 lg:p-10">
            {view === 'week' ? (
              <Pe2WeekView slot={slot} draftId={selectedDraftId} />
            ) : (
              <Pe2HomeView
                orgId={programmingOrgId}
                selectedDraftId={selectedDraftId}
                onSelectDraft={setSelectedDraftId}
                onOpenWeek={() => setView('week')}
                onSlotChange={setSlot}
              />
            )}
          </main>
        </div>
      </div>
    </RoleGate>
  )
}
