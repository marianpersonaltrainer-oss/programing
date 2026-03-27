import { useState } from 'react'
import DayCard from './DayCard.jsx'
import { DAYS_ORDER, MESOCYCLES, AUTOCARGA_PHASES } from '../../constants/evoColors.js'

export default function WeekPanel({
  weekState,
  activeDay,
  onDayClick,
  onRemoveSession,
  onSetMesocycle,
  onReset,
}) {
  const [showMesoForm, setShowMesoForm] = useState(!weekState.mesocycle)
  const [mesoVal, setMesoVal] = useState(weekState.mesocycle || 'fuerza')
  const [weekVal, setWeekVal] = useState(weekState.week || 1)
  const [phaseVal, setPhaseVal] = useState(weekState.phase || '')

  const selectedMeso = MESOCYCLES.find((m) => m.value === mesoVal)
  const confirmedCount = Object.values(weekState.sessions).filter((s) => s?.confirmed).length

  function handleApplyMeso() {
    onSetMesocycle(mesoVal, weekVal, phaseVal || null)
    setShowMesoForm(false)
  }

  return (
    <aside className="flex flex-col h-full bg-white border-r border-black/5 shadow-sm">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-display text-sm font-bold text-evo-text tracking-tight uppercase">
              ProgramingEvo
            </h1>
            <p className="text-[10px] text-evo-muted font-medium mt-0.5">Evolution Boutique Fitness</p>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] text-evo-muted hover:text-red-500 transition-all px-2.5 py-1.5 rounded-lg border border-black/5 hover:border-red-500/20 bg-gray-50 hover:bg-red-50"
            title="Nueva semana"
          >
            Nueva semana
          </button>
        </div>

        {/* Mesocycle badge / form toggle */}
        {weekState.mesocycle && !showMesoForm ? (
          <button
            onClick={() => setShowMesoForm(true)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-evo-accent/5 border border-evo-accent/10 group-hover:border-evo-accent/30 transition-all shadow-sm">
              <div>
                <span className="text-[10px] text-[#9B4FDE] font-medium uppercase tracking-wider">
                  {weekState.mesocycle} · S{weekState.week}/{weekState.totalWeeks}
                  {weekState.phase ? ` · ${weekState.phase}` : ''}
                </span>
                <div className="text-[10px] text-evo-muted mt-0.5">
                  {confirmedCount}/6 días programados
                </div>
              </div>
              <span className="text-evo-muted text-xs group-hover:text-white transition-colors">✎</span>
            </div>
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-2xl bg-gray-50/50 border border-black/5 shadow-inner animate-fade-in">
            <p className="text-[10px] text-evo-muted font-bold uppercase tracking-widest mb-1">
              Configurar mesociclo
            </p>
            {/* Mesocycle select */}
            <div>
              <label className="text-[9px] text-evo-muted font-bold uppercase tracking-widest ml-1 mb-1 block">Tipo de Ciclo</label>
              <select
                value={mesoVal}
                onChange={(e) => {
                  setMesoVal(e.target.value)
                  setWeekVal(1)
                  setPhaseVal('')
                }}
                className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs text-evo-text font-medium focus:outline-none focus:border-evo-accent/40 shadow-sm"
              >
                {MESOCYCLES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label} ({m.weeks} sem)
                  </option>
                ))}
              </select>
            </div>
            {/* Week number */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[9px] text-evo-muted font-bold uppercase tracking-widest ml-1 mb-1 block">Semana</label>
                <input
                  type="number"
                  min={1}
                  max={selectedMeso?.weeks || 6}
                  value={weekVal}
                  onChange={(e) => setWeekVal(parseInt(e.target.value) || 1)}
                  className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs text-evo-text font-medium focus:outline-none focus:border-evo-accent/40 shadow-sm"
                />
              </div>
              {mesoVal === 'autocarga' && (
                <div className="flex-2">
                  <label className="text-[9px] text-evo-muted font-bold uppercase tracking-widest ml-1 mb-1 block">Fase</label>
                  <select
                    value={phaseVal}
                    onChange={(e) => setPhaseVal(e.target.value)}
                    className="w-full bg-white border border-black/10 rounded-xl px-4 py-2.5 text-xs text-evo-text font-medium focus:outline-none focus:border-evo-accent/40 shadow-sm"
                  >
                    <option value="">—</option>
                    {AUTOCARGA_PHASES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <button
              onClick={handleApplyMeso}
              className="w-full py-3 mt-2 rounded-xl bg-evo-accent hover:bg-evo-accent-hover text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg shadow-purple-500/20 active:scale-95"
            >
              Aplicar Cambios
            </button>
          </div>
        )}
      </div>

      {/* Day cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {DAYS_ORDER.map((day) => (
          <DayCard
            key={day}
            day={day}
            session={weekState.sessions[day]}
            isActive={activeDay === day}
            onClick={() => onDayClick(day)}
            onRemove={() => onRemoveSession(day)}
          />
        ))}
      </div>

      {/* Footer stats */}
      <div className="px-5 py-4 border-t border-black/5 bg-gray-50/50">
        <div className="flex justify-between text-[10px] text-evo-muted font-bold tracking-tight">
          <span>{confirmedCount} SESIONES LISTAS</span>
          <span>{6 - confirmedCount} PENDIENTES</span>
        </div>
        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-evo-accent rounded-full transition-all duration-700 ease-out"
            style={{ width: `${(confirmedCount / 6) * 100}%` }}
          />
        </div>
      </div>
    </aside>
  )
}
