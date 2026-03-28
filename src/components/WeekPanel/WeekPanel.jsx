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
    <div className="flex flex-col h-full min-h-0 bg-[#0A0808]">
      <div className="px-4 py-4 border-b border-[#3D1A3D]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-evo-display text-sm font-bold text-[#FFFF4C] tracking-tight uppercase">
              Semana
            </h1>
            <p className="text-[10px] text-[#9B80A0] font-medium mt-0.5">ProgramingEvo</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="text-[10px] text-[#9B80A0] hover:text-red-400 transition-all px-2.5 py-1.5 rounded-lg border border-[#3D1A3D] hover:border-red-500/40 bg-[#160D16]"
            title="Nueva semana"
          >
            Nueva
          </button>
        </div>

        {/* Mesocycle badge / form toggle */}
        {weekState.mesocycle && !showMesoForm ? (
          <button
            onClick={() => setShowMesoForm(true)}
            className="w-full text-left group"
          >
            <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#6A1F6D]/25 border border-[#3D1A3D] group-hover:border-[#A729AD]/40 transition-all">
              <div>
                <span className="text-[10px] text-[#FFFF4C] font-bold uppercase tracking-wider">
                  {weekState.mesocycle} · S{weekState.week}/{weekState.totalWeeks}
                  {weekState.phase ? ` · ${weekState.phase}` : ''}
                </span>
                <div className="text-[10px] text-[#9B80A0] mt-0.5">{confirmedCount}/6 días</div>
              </div>
              <span className="text-[#9B80A0] text-xs group-hover:text-[#E8EAF0] transition-colors">✎</span>
            </div>
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-2xl bg-[#160D16] border border-[#3D1A3D] animate-fade-in">
            <p className="text-[10px] text-[#9B80A0] font-bold uppercase tracking-widest mb-1">
              Configurar mesociclo
            </p>
            {/* Mesocycle select */}
            <div>
              <label className="text-[9px] text-[#9B80A0] font-bold uppercase tracking-widest ml-1 mb-1 block">Tipo de Ciclo</label>
              <select
                value={mesoVal}
                onChange={(e) => {
                  setMesoVal(e.target.value)
                  setWeekVal(1)
                  setPhaseVal('')
                }}
                className="w-full bg-[#0C0B0C] border border-[#3D1A3D] rounded-xl px-4 py-2.5 text-xs text-[#E8EAF0] font-medium focus:outline-none focus:border-[#A729AD]/50"
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
                <label className="text-[9px] text-[#9B80A0] font-bold uppercase tracking-widest ml-1 mb-1 block">Semana</label>
                <input
                  type="number"
                  min={1}
                  max={selectedMeso?.weeks || 6}
                  value={weekVal}
                  onChange={(e) => setWeekVal(parseInt(e.target.value) || 1)}
                  className="w-full bg-[#0C0B0C] border border-[#3D1A3D] rounded-xl px-4 py-2.5 text-xs text-[#E8EAF0] font-medium focus:outline-none focus:border-[#A729AD]/50"
                />
              </div>
              {mesoVal === 'autocarga' && (
                <div className="flex-2">
                  <label className="text-[9px] text-[#9B80A0] font-bold uppercase tracking-widest ml-1 mb-1 block">Fase</label>
                  <select
                    value={phaseVal}
                    onChange={(e) => setPhaseVal(e.target.value)}
                    className="w-full bg-[#0C0B0C] border border-[#3D1A3D] rounded-xl px-4 py-2.5 text-xs text-[#E8EAF0] font-medium focus:outline-none focus:border-[#A729AD]/50"
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
              type="button"
              onClick={handleApplyMeso}
              className="w-full py-3 mt-2 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white text-[11px] font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95"
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
      <div className="px-5 py-4 border-t border-[#3D1A3D] bg-[#0C0B0C]">
        <div className="flex justify-between text-[10px] text-[#9B80A0] font-bold tracking-tight">
          <span>{confirmedCount} LISTAS</span>
          <span>{6 - confirmedCount} PEND.</span>
        </div>
        <div className="mt-2.5 h-1.5 bg-[#160D16] rounded-full overflow-hidden border border-[#3D1A3D]">
          <div
            className="h-full bg-[#A729AD] rounded-full transition-all duration-700 ease-out"
            style={{ width: `${(confirmedCount / 6) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
