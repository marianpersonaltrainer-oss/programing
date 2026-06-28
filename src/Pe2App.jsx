import { useMemo, useState } from 'react'
import Pe2Sidebar from './components/Pe2/Pe2Sidebar.jsx'
import Pe2HomeView from './components/Pe2/Pe2HomeView.jsx'
import Pe2WeekPlaceholder from './components/Pe2/Pe2WeekPlaceholder.jsx'
import { readPe2SlotFromV1 } from './components/Pe2/pe2Slot.js'
import { evoBrand } from './constants/evoBrand.js'

export default function Pe2App() {
  const [view, setView] = useState('home')
  const [selectedDraftId, setSelectedDraftId] = useState(null)
  const slot = useMemo(() => readPe2SlotFromV1(), [])

  return (
    <div
      className="h-screen flex flex-col overflow-hidden font-evo-body selection:bg-[#A729AD]/30"
      style={{ backgroundColor: evoBrand.app, color: evoBrand.text }}
    >
      <div className="flex flex-1 min-h-0">
        <Pe2Sidebar activeView={view} onNavigate={setView} />
        <main className="flex-1 min-w-0 overflow-y-auto p-6 sm:p-8 lg:p-10">
          {view === 'week' ? (
            <Pe2WeekPlaceholder slot={slot} draftId={selectedDraftId} />
          ) : (
            <Pe2HomeView
              slot={slot}
              selectedDraftId={selectedDraftId}
              onSelectDraft={setSelectedDraftId}
              onOpenWeek={() => setView('week')}
            />
          )}
        </main>
      </div>
    </div>
  )
}
