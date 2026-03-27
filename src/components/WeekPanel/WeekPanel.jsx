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
    <aside className="flex flex-col h-full bg-[#0D0D0D] border-r border-white/5">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-display text-sm font-bold text-white tracking-tight">
              PROGRAMINGEVO
            </h1>
            <p className="text-[10px] text-evo-muted mt-0.5">Evolution Boutique Fitness</p>
          </div>
          <button
            onClick={onReset}
            className="text-[10px] text-evo-muted hover:text-red-400 transition-colors px-2 py-1 rounded border border-white/5 hover:border-red-500/30"
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
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#7B2FBE]/10 border border-[#7B2FBE]/20 hover:border-[#7B2FBE]/40 transition-colors">
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
          <div className="space-y-2 p-3 rounded-lg bg-[#1A1A1A] border border-white/5">
            <p className="text-[10px] text-evo-muted font-medium uppercase tracking-wider mb-2">
              Configurar mesociclo
            </p>
            {/* Mesocycle select */}
            <select
              value={mesoVal}
              onChange={(e) => {
                setMesoVal(e.target.value)
                setWeekVal(1)
                setPhaseVal('')
              }}
              className="w-full bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50"
            >
              {MESOCYCLES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label} ({m.weeks} sem)
                </option>
              ))}
            </select>
            {/* Week number */}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-evo-muted">Semana</label>
                <input
                  type="number"
                  min={1}
                  max={selectedMeso?.weeks || 6}
                  value={weekVal}
                  onChange={(e) => setWeekVal(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50 mt-0.5"
                />
              </div>
              {mesoVal === 'autocarga' && (
                <div className="flex-1">
                  <label className="text-[10px] text-evo-muted">Fase</label>
                  <select
                    value={phaseVal}
                    onChange={(e) => setPhaseVal(e.target.value)}
                    className="w-full bg-[#111] border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-[#7B2FBE]/50 mt-0.5"
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
              className="w-full py-1.5 rounded-lg bg-[#7B2FBE] hover:bg-[#9B4FDE] text-white text-xs font-medium transition-colors"
            >
              Aplicar
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
      <div className="px-4 py-3 border-t border-white/5">
        <div className="flex justify-between text-[10px] text-evo-muted">
          <span>{confirmedCount} sesiones confirmadas</span>
          <span>{6 - confirmedCount} restantes</span>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7B2FBE] rounded-full transition-all duration-500"
            style={{ width: `${(confirmedCount / 6) * 100}%` }}
          />
        </div>
      </div>
    </aside>
  )
}
