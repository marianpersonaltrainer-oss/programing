import { useState } from 'react'
import WeekPanel from './components/WeekPanel/WeekPanel.jsx'
import AgentChat from './components/AgentChat/AgentChat.jsx'
import ExportPanel from './components/ExportPanel/ExportPanel.jsx'
import EditModal from './components/EditModal/EditModal.jsx'
import ExcelGeneratorModal from './components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'
import CoachView from './components/CoachView/CoachView.jsx'
import CoachReview from './components/CoachReview/CoachReview.jsx'
import MethodPanel from './components/MethodPanel/MethodPanel.jsx'
import { COACH_CODE_KEY } from './components/CoachView/CoachView.jsx'
import { useWeekState } from './hooks/useWeekState.js'
import { useAgent } from './hooks/useAgent.js'

// Routing simple por query param
const isCoachMode = new URLSearchParams(window.location.search).has('coach')

export default function App() {
  if (isCoachMode) return <CoachView />

  const {
    weekState,
    setMesocycle,
    confirmSession,
    removeSession,
    resetWeek,
  } = useWeekState()

  const {
    messages,
    isGenerating,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
  } = useAgent(weekState)

  const [activeDay, setActiveDay] = useState(null)
  const [editModal, setEditModal] = useState(null)
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [showCoachReview, setShowCoachReview] = useState(false)
  const [showMethodPanel, setShowMethodPanel] = useState(false)
  const [showCodeConfig, setShowCodeConfig]   = useState(false)
  const [codeValue, setCodeValue]             = useState(() => localStorage.getItem(COACH_CODE_KEY) || 'EVO2025')
  const [codeSaved, setCodeSaved]             = useState(false)

  function handleDayClick(day) {
    setActiveDay((prev) => (prev === day ? null : day))
  }

  function handleConfirmSession(day, content, classes) {
    confirmSession(day, content, classes)
    setActiveDay(day)
  }

  function handleEditSession(day) {
    setEditModal({ day, session: weekState.sessions[day] })
  }

  function handleSaveEdit(day, content, classes) {
    confirmSession(day, content, classes)
    setEditModal(null)
  }

  function handleReset() {
    if (window.confirm('¿Seguro que quieres empezar una nueva semana? Se perderán las sesiones actuales.')) {
      resetWeek()
      clearMessages()
      setActiveDay(null)
      setEditModal(null)
    }
  }

  return (
    <div className="h-screen flex flex-col bg-[#0A0A0A] overflow-hidden">
      {/* Main layout: Week panel + Chat */}
      <div className="flex flex-1 min-h-0">
        {/* Week Panel — left sidebar */}
        <div className="w-64 flex-shrink-0 flex flex-col">
          <WeekPanel
            weekState={weekState}
            activeDay={activeDay}
            onDayClick={handleDayClick}
            onRemoveSession={removeSession}
            onSetMesocycle={setMesocycle}
            onReset={handleReset}
          />
        </div>

        {/* Agent Chat — main area */}
        <div className="flex-1 flex flex-col min-w-0">
          <AgentChat
            messages={messages}
            isGenerating={isGenerating}
            error={error}
            activeDay={activeDay}
            weekState={weekState}
            onSendMessage={sendMessage}
            onStopGeneration={stopGeneration}
            onConfirmSession={handleConfirmSession}
            onClearMessages={clearMessages}
          />
        </div>
      </div>

      {/* Código coach popover */}
      {showCodeConfig && (
        <div className="fixed bottom-14 left-4 z-40 bg-[#1A1A1A] border border-white/10 rounded-xl p-4 shadow-xl w-72">
          <p className="text-xs font-medium text-white mb-1">Código de acceso para entrenadores</p>
          <p className="text-[10px] text-evo-muted mb-3">Los entrenadores lo introducen al entrar en la vista coach.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codeValue}
              onChange={(e) => { setCodeValue(e.target.value.toUpperCase()); setCodeSaved(false) }}
              className="flex-1 bg-[#0D0D0D] border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono tracking-widest focus:outline-none focus:border-[#7B2FBE]/50"
              placeholder="EVO2025"
            />
            <button
              onClick={() => {
                localStorage.setItem(COACH_CODE_KEY, codeValue)
                setCodeSaved(true)
                setTimeout(() => { setCodeSaved(false); setShowCodeConfig(false) }, 1500)
              }}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                codeSaved ? 'bg-[#2FBE7B]/20 text-[#2FBE7B]' : 'bg-[#7B2FBE] text-white hover:bg-[#9B4FDE]'
              }`}
            >
              {codeSaved ? '✓' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="px-4 py-2 border-t border-white/5 bg-[#0D0D0D] flex justify-between items-center flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMethodPanel(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-evo-muted hover:text-white text-xs font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Tu Método
          </button>
          <button
            onClick={() => setShowCodeConfig((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-evo-muted hover:text-white text-xs font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Código coach
          </button>
          <button
            onClick={() => setShowCoachReview(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#7B2FBE]/10 hover:bg-[#7B2FBE]/20 border border-[#7B2FBE]/20 text-[#A855F7] text-xs font-medium transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Conversaciones
          </button>
        </div>
        <button
          onClick={() => setShowExcelModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#2FBE7B]/20 hover:bg-[#2FBE7B]/30 border border-[#2FBE7B]/30 text-[#2FBE7B] text-xs font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Generar semana completa → Excel
        </button>
      </div>

      {/* Export Panel — bottom bar */}
      <ExportPanel
        weekState={weekState}
        onEditSession={handleEditSession}
      />

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          day={editModal.day}
          session={editModal.session}
          onSave={handleSaveEdit}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Excel Generator Modal */}
      {showExcelModal && (
        <ExcelGeneratorModal
          weekState={weekState}
          onClose={() => setShowExcelModal(false)}
        />
      )}

      {/* Coach Review Modal */}
      {showCoachReview && (
        <CoachReview onClose={() => setShowCoachReview(false)} />
      )}

      {/* Method Panel */}
      {showMethodPanel && (
        <MethodPanel onClose={() => setShowMethodPanel(false)} />
      )}
    </div>
  )
}
