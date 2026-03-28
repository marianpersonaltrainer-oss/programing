import { useState } from 'react'
import WeekPanel from './components/WeekPanel/WeekPanel.jsx'
import AgentChat from './components/AgentChat/AgentChat.jsx'
import ExportPanel from './components/ExportPanel/ExportPanel.jsx'
import EditModal from './components/EditModal/EditModal.jsx'
import ExcelGeneratorModal from './components/ExcelGeneratorModal/ExcelGeneratorModal.jsx'
import CoachView from './components/CoachView/CoachView.jsx'
import CoachReview from './components/CoachReview/CoachReview.jsx'
import MethodPanel from './components/MethodPanel/MethodPanel.jsx'
import { COACH_CODE_KEY, getCoachCodeFieldInitialValue } from './constants/coachAccess.js'
import ExerciseLibrary from './components/ExerciseLibrary/ExerciseLibrary.jsx'
import EvoLogo from './components/EvoLogo.jsx'
import CoachGuideContentPanel from './components/CoachGuideContentPanel/CoachGuideContentPanel.jsx'
import { coachBg, coachBorder, coachText } from './components/CoachView/coachTheme.js'
import { useWeekState } from './hooks/useWeekState.js'
import { useAgent } from './hooks/useAgent.js'

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
  const [showLibrary, setShowLibrary] = useState(false)
  const [showCodeConfig, setShowCodeConfig] = useState(false)
  const [showCoachContentPanel, setShowCoachContentPanel] = useState(false)
  const [codeValue, setCodeValue] = useState(() => getCoachCodeFieldInitialValue())
  const [codeSaved, setCodeSaved] = useState(false)

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

  const navBtn = `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[12px] font-semibold border border-transparent transition-colors text-[#D4B8D4] ${coachBg.sidebarHover} hover:text-[#F0ECF0] hover:border-[#6A1F6D]`

  return (
    <div className={`h-screen flex flex-col ${coachBg.app} ${coachText.primary} overflow-hidden font-evo-body selection:bg-[#A729AD]/30`}>
      <header className={`h-[4.25rem] flex-shrink-0 ${coachBg.app} border-b ${coachBorder} flex items-center px-5 justify-between z-50 safe-area-pt`}>
        <div className="flex items-center gap-4 min-w-0">
          <EvoLogo />
          <div className="min-w-0 hidden sm:block">
            <p className="font-evo-display text-lg sm:text-xl font-bold uppercase tracking-[0.12em] text-[#FFFF4C] leading-tight truncate">
              Evolution
            </p>
            <p className={`font-evo-display text-[10px] font-semibold uppercase tracking-[0.2em] ${coachText.muted} truncate`}>
              Boutique Fitness Granada
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`hidden md:inline text-[10px] font-bold uppercase tracking-wider ${coachText.muted}`}>Programador</span>
          <div className={`w-9 h-9 rounded-xl ${coachBg.card} border ${coachBorder} flex items-center justify-center text-[#A729AD]`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div className={`w-[280px] flex-shrink-0 flex flex-col border-r ${coachBorder} ${coachBg.sidebar} min-h-0`}>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <WeekPanel
              weekState={weekState}
              activeDay={activeDay}
              onDayClick={handleDayClick}
              onRemoveSession={removeSession}
              onSetMesocycle={setMesocycle}
              onReset={handleReset}
            />
          </div>
          <nav className={`flex-shrink-0 border-t ${coachBorder} p-3 space-y-1 ${coachBg.sidebar}`}>
            <button type="button" onClick={() => setShowMethodPanel(true)} className={navBtn}>
              <span aria-hidden>✏️</span>
              Tu método
            </button>
            <button type="button" onClick={() => setShowCodeConfig((v) => !v)} className={navBtn}>
              <span aria-hidden>🔐</span>
              Código coach
            </button>
            <button type="button" onClick={() => setShowLibrary(true)} className={navBtn}>
              <span aria-hidden>📚</span>
              Biblioteca
            </button>
            <button type="button" onClick={() => setShowCoachReview(true)} className={navBtn}>
              <span aria-hidden>💬</span>
              Conversaciones
            </button>
            <button
              type="button"
              onClick={() => setShowCoachContentPanel(true)}
              className={`${navBtn} text-[#FFFF4C]/90 hover:text-[#FFFF4C]`}
            >
              <span aria-hidden>✏️</span>
              Contenido Coach
            </button>
          </nav>
        </div>

        <div className={`flex-1 flex flex-col min-w-0 ${coachBg.app} min-h-0`}>
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

      <div className={`px-5 py-3 border-t ${coachBorder} ${coachBg.sidebar} flex justify-end items-center flex-shrink-0 gap-3`}>
        <button
          type="button"
          onClick={() => setShowExcelModal(true)}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white text-xs font-bold uppercase tracking-wide transition-colors shadow-lg shadow-purple-950/40"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Generar semana completa → Excel
        </button>
      </div>

      <ExportPanel weekState={weekState} onEditSession={handleEditSession} />

      {showCodeConfig && (
        <div className={`fixed bottom-24 left-[300px] z-40 ${coachBg.card} border ${coachBorder} rounded-2xl p-6 shadow-elevated w-80 animate-fade-in`}>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-[11px] font-bold text-[#FFFF4C] uppercase tracking-tight font-evo-display">Acceso Coach</p>
          </div>
          <p className={`text-[10px] ${coachText.muted} font-bold mb-4 uppercase tracking-widest leading-relaxed`}>
            Contraseña para la vista ?coach
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={codeValue}
              onChange={(e) => {
                setCodeValue(e.target.value.toUpperCase())
                setCodeSaved(false)
              }}
              className={`flex-1 ${coachBg.app} border ${coachBorder} rounded-xl px-4 py-3 text-sm ${coachText.primary} font-mono tracking-[0.2em] focus:outline-none focus:border-[#A729AD]/50`}
              placeholder="EVO19"
            />
            <button
              type="button"
              onClick={() => {
                localStorage.setItem(COACH_CODE_KEY, codeValue)
                setCodeSaved(true)
                setTimeout(() => {
                  setCodeSaved(false)
                  setShowCodeConfig(false)
                }, 1500)
              }}
              className={`px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                codeSaved ? 'bg-emerald-600 text-white' : 'bg-[#A729AD] hover:bg-[#6A1F6D] text-white'
              }`}
            >
              {codeSaved ? '✓' : 'OK'}
            </button>
          </div>
        </div>
      )}

      {editModal && (
        <EditModal
          day={editModal.day}
          session={editModal.session}
          onSave={handleSaveEdit}
          onClose={() => setEditModal(null)}
        />
      )}

      {showExcelModal && <ExcelGeneratorModal weekState={weekState} onClose={() => setShowExcelModal(false)} />}

      {showCoachReview && <CoachReview onClose={() => setShowCoachReview(false)} />}

      {showMethodPanel && <MethodPanel onClose={() => setShowMethodPanel(false)} />}

      {showLibrary && <ExerciseLibrary onClose={() => setShowLibrary(false)} />}

      {showCoachContentPanel && <CoachGuideContentPanel onClose={() => setShowCoachContentPanel(false)} />}
    </div>
  )
}
