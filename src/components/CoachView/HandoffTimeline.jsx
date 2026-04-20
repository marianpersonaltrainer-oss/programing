import { useMemo, useState } from 'react'

const CLASS_TIMES = ['09:00', '11:00', '13:00', '18:30', '20:00']
const CLASS_TYPES = ['EvoFuncional', 'EvoBasics', 'EvoFit']

function EnergyDots({ value }) {
  const n = Math.max(1, Math.min(5, Number(value || 1)))
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, idx) => (
        <span
          key={idx}
          className={`h-2.5 w-2.5 rounded-full ${idx < n ? 'bg-[#A729AD]' : 'bg-[#221427] border border-[#6A1F6D]/30'}`}
        />
      ))}
    </div>
  )
}

function HandoffForm({ coachName, onSubmit, onClose }) {
  const [classTime, setClassTime] = useState(CLASS_TIMES[0])
  const [classType, setClassType] = useState(CLASS_TYPES[0])
  const [energyLevel, setEnergyLevel] = useState(3)
  const [hadIncident, setHadIncident] = useState(false)
  const [note, setNote] = useState('')

  async function submit(e) {
    e.preventDefault()
    await onSubmit({
      coach_name: String(coachName || '').trim() || 'Coach',
      class_time: classTime,
      class_type: classType,
      energy_level: Number(energyLevel),
      had_incident: !!hadIncident,
      note: String(note || '').slice(0, 200),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[140] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl bg-[#1a0f1b] border border-[#6A1F6D]/40 px-4 py-4 space-y-3"
      >
        <p className="text-sm font-evo-display uppercase tracking-wide text-[#FFFF4C]">Nuevo pase</p>
        <label className="block text-xs text-[#F6E8F9CC]">
          Hora de clase
          <select value={classTime} onChange={(e) => setClassTime(e.target.value)} className="mt-1 w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]">
            {CLASS_TIMES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-[#F6E8F9CC]">
          Tipo de clase
          <select value={classType} onChange={(e) => setClassType(e.target.value)} className="mt-1 w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]">
            {CLASS_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <div>
          <p className="text-xs text-[#F6E8F9CC] mb-1">Energía del grupo</p>
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, idx) => {
              const v = idx + 1
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setEnergyLevel(v)}
                  className={`h-11 w-11 rounded-full border ${energyLevel >= v ? 'bg-[#A729AD] border-[#FFFF4C]' : 'bg-[#221427] border-[#6A1F6D]/40'}`}
                />
              )
            })}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#F6E8F9]">
          <input type="checkbox" checked={hadIncident} onChange={(e) => setHadIncident(e.target.checked)} />
          ¿Hubo incidencia?
        </label>
        <label className="block text-xs text-[#F6E8F9CC]">
          Nota
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            maxLength={200}
            placeholder="¿Algo que el siguiente coach deba saber?"
            className="mt-1 w-full min-h-[90px] rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 py-2 text-[#F6E8F9]"
          />
        </label>
        <button type="submit" className="w-full h-11 rounded-lg bg-[#6A1F6D] hover:bg-[#A729AD] text-[#FFFF4C] font-evo-display uppercase tracking-wide">
          Dejar pase
        </button>
      </form>
    </div>
  )
}

export default function HandoffTimeline({ entries = [], coachName = '', onCreate }) {
  const [openForm, setOpenForm] = useState(false)
  const sorted = useMemo(
    () => [...entries].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    [entries],
  )

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-evo-display uppercase tracking-wide text-[#FFFF4C]">Feedback de hoy</p>
        <button type="button" onClick={() => setOpenForm(true)} className="h-11 px-4 rounded-lg bg-[#6A1F6D] hover:bg-[#A729AD] text-[#FFFF4C] text-xs font-evo-display uppercase">
          Nuevo feedback
        </button>
      </div>

      {!sorted.length ? (
        <div className="rounded-lg border border-[#6A1F6D]/30 bg-[#1a0f1b] px-4 py-5 text-sm text-[#F6E8F966]">
          Sé el primero en dejar feedback hoy
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((r, idx) => (
            <li key={r.id || idx} className="relative rounded-lg border border-[#6A1F6D]/30 bg-[#1a0f1b] px-4 py-3">
              {idx < sorted.length - 1 ? <span className="absolute left-5 top-full h-3 w-px bg-[#6A1F6D33]" /> : null}
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-evo-display text-[#FFFF4C]">{r.coach_name}</p>
                {r.had_incident ? <span className="rounded-md bg-[#FF4C4C] px-2 py-0.5 text-[10px] uppercase font-bold text-white">Incidencia</span> : null}
              </div>
              <p className="text-xs text-[#F6E8F9CC]">{r.class_time} · {r.class_type}</p>
              <div className="mt-2"><EnergyDots value={r.energy_level} /></div>
              {r.note ? <p className="mt-2 text-sm text-[#F6E8F9]">{r.note}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {openForm ? (
        <HandoffForm
          coachName={coachName}
          onSubmit={onCreate}
          onClose={() => setOpenForm(false)}
        />
      ) : null}
    </section>
  )
}
