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
import ExerciseLibrary from './components/ExerciseLibrary/ExerciseLibrary.jsx'
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
  const [showLibrary, setShowLibrary]         = useState(false)
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
    <div className="h-screen flex flex-col bg-evo-bg studio-bg overflow-hidden font-body selection:bg-evo-accent/10">
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
        <div className="fixed bottom-24 left-6 z-40 bg-white border border-black/10 rounded-2xl p-6 shadow-elevated w-80 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-md bg-evo-accent/10 flex items-center justify-center text-evo-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <p className="text-[11px] font-bold text-evo-text uppercase tracking-tight">Acceso Coach</p>
          </div>
          <p className="text-[10px] text-evo-muted font-bold mb-4 uppercase tracking-widest leading-relaxed">Configura la contraseña para la vista de entrenadores.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codeValue}
              onChange={(e) => { setCodeValue(e.target.value.toUpperCase()); setCodeSaved(false) }}
              className="flex-1 bg-gray-50 border border-black/5 rounded-xl px-4 py-3 text-sm text-evo-text font-mono tracking-[0.2em] focus:outline-none focus:border-evo-accent/30 shadow-inner"
              placeholder="EVO2025"
            />
            <button
              onClick={() => {
                localStorage.setItem(COACH_CODE_KEY, codeValue)
                setCodeSaved(true)
                setTimeout(() => { setCodeSaved(false); setShowCodeConfig(false) }, 1500)
              }}
              className={`px-4 py-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                codeSaved ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-evo-accent text-white hover:bg-evo-accent-hover shadow-purple-500/10'
              }`}
            >
              {codeSaved ? '✓' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="px-6 py-3 border-t border-black/5 bg-white/80 backdrop-blur-md flex justify-between items-center flex-shrink-0 shadow-soft">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMethodPanel(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-black/5 text-evo-muted hover:text-evo-text text-xs font-semibold transition-all shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
            Tu Método
          </button>
          <button
            onClick={() => setShowCodeConfig((v) => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-black/5 text-evo-muted hover:text-evo-text text-xs font-semibold transition-all shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Código coach
          </button>
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-50 hover:bg-gray-100 border border-black/5 text-evo-muted hover:text-evo-text text-xs font-semibold transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            Biblioteca
          </button>
          <button
            onClick={() => setShowCoachReview(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-evo-accent/5 hover:bg-evo-accent/10 border border-evo-accent/10 text-evo-accent text-xs font-semibold transition-all shadow-sm"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            Conversaciones
          </button>
        </div>
        <button
          onClick={() => setShowExcelModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold transition-all shadow-lg shadow-emerald-500/20"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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

      {/* Exercise Library */}
      {showLibrary && (
        <ExerciseLibrary onClose={() => setShowLibrary(false)} />
      )}
    </div>
  )
}
