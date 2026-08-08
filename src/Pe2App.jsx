import { useEffect, useState } from 'react'
import Pe2Sidebar from './components/Pe2/Pe2Sidebar.jsx'
import Pe2HomeView from './components/Pe2/Pe2HomeView.jsx'
import Pe2WeekView from './components/Pe2/Pe2WeekView.jsx'
import Pe2Login from './components/Pe2/Pe2Login.jsx'
import RoleGate from './components/Pe2/RoleGate.jsx'
import Pe2ShiftView from './components/Pe2/Pe2ShiftView.jsx'
import Pe2ResourcesView from './components/Pe2/Pe2ResourcesView.jsx'
import Pe2DirectionShiftView from './components/Pe2/Pe2DirectionShiftView.jsx'
import { usePe2Auth } from './hooks/usePe2Auth.js'
import { getPe2ActiveSlot } from './lib/pe2Supabase.js'
import { evoBrand } from './constants/evoBrand.js'

export default function Pe2App() {
  const auth = usePe2Auth()
  const [view, setView] = useState('home')
  const [selectedDraftId, setSelectedDraftId] = useState(null)
  const [slot, setSlot] = useState(null)

  useEffect(() => {
    if (!auth.isAuthenticated || auth.role !== 'programmer') return
    getPe2ActiveSlot()
      .then(setSlot)
      .catch(() => setSlot(null))
  }, [auth.isAuthenticated, auth.role])

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: evoBrand.app, color: evoBrand.muted }}>
        Cargando sesión…
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return (
      <Pe2Login
        loading={auth.loading}
        error={auth.error}
        onSignIn={auth.signIn}
      />
    )
  }

  const coachViews = ['shift', 'resources']
  const activeView = auth.role === 'coach' && !coachViews.includes(view) ? 'shift' : view

  function renderView() {
    if (activeView === 'shift' && auth.role === 'coach') {
      return <Pe2ShiftView profile={auth.profile} />
    }
    if (activeView === 'resources') return <Pe2ResourcesView />
    if (activeView === 'direction-shifts' && auth.role === 'programmer') {
      return <Pe2DirectionShiftView />
    }
    if (activeView === 'week' && auth.role === 'programmer') {
      return <Pe2WeekView slot={slot} draftId={selectedDraftId} />
    }
    if (auth.role === 'programmer') {
      return (
        <Pe2HomeView
          orgId={auth.orgId}
          selectedDraftId={selectedDraftId}
          onSelectDraft={setSelectedDraftId}
          onOpenWeek={() => setView('week')}
          onSlotChange={setSlot}
        />
      )
    }
    return <Pe2ShiftView profile={auth.profile} />
  }

  return (
    <RoleGate role={auth.role}>
      <div
        className="h-screen flex flex-col overflow-hidden font-evo-body selection:bg-[#A729AD]/30"
        style={{ backgroundColor: evoBrand.app, color: evoBrand.text }}
      >
        <div className="flex flex-1 min-h-0">
          <Pe2Sidebar
            activeView={activeView}
            onNavigate={setView}
            profile={auth.profile}
            onSignOut={auth.signOut}
          />
          <main className="flex-1 min-w-0 overflow-y-auto px-4 pt-20 pb-24 sm:px-6 md:p-8 lg:p-10">
            {renderView()}
          </main>
        </div>
      </div>
    </RoleGate>
  )
}
