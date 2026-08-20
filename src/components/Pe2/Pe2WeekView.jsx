import { useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { getPe2WeekById, getPe2WeekGridData } from '../../lib/pe2Supabase.js'
import { formatPe2SlotLabel, PE2_STATUS_LABELS } from './pe2Slot.js'
import Pe2AiPlanningPanel from './Pe2AiPlanningPanel.jsx'
import Pe2CoachPreview from './Pe2CoachPreview.jsx'
import WeekGrid from './WeekGrid.jsx'

export default function Pe2WeekView({ slot, draftId }) {
  const [week, setWeek] = useState(null)
  const [grid, setGrid] = useState({ classTypes: [], sessions: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!draftId) {
      setWeek(null)
      setGrid({ classTypes: [], sessions: [] })
      return undefined
    }

    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([getPe2WeekById(draftId), getPe2WeekGridData(draftId)])
      .then(([weekRow, gridData]) => {
        if (cancelled) return
        setWeek(weekRow)
        setGrid(gridData)
      })
      .catch((e) => {
        if (!cancelled) {
          setWeek(null)
          setGrid({ classTypes: [], sessions: [] })
          setError(e.message || 'Error al cargar la semana')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [draftId])

  return (
    <div className="flex h-full min-h-0 max-w-6xl flex-col">
      <header className="mb-6">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.muted }}>
          Semana completa · {slot ? formatPe2SlotLabel(slot) : '—'}
        </p>
        <h1 className="font-evo-display text-2xl font-bold sm:text-3xl" style={{ color: evoBrand.text }}>
          {week?.titulo || 'Semana'}
        </h1>
        {week ? (
          <p className="mt-2 text-sm" style={{ color: evoBrand.muted }}>
            {PE2_STATUS_LABELS[week.status] || week.status}
            {week.is_primary ? ' · borrador principal' : ''}
            {' · '}
            {grid.sessions.length} clase(s) estructurada(s) en esta semana
          </p>
        ) : (
          <p className="mt-2 text-sm" style={{ color: evoBrand.muted }}>
            {draftId
              ? loading
                ? 'Cargando borrador…'
                : 'Borrador no encontrado'
              : 'Elige o crea un borrador en Inicio.'}
          </p>
        )}
      </header>

      {error ? (
        <div
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}
        >
          {error}
        </div>
      ) : null}

      <WeekGrid classTypes={grid.classTypes} sessions={grid.sessions} loading={loading && Boolean(draftId)} />

      {week ? (
        <div className="mt-6 grid gap-6">
          <Pe2AiPlanningPanel week={week} onSaved={setWeek} />
          <Pe2CoachPreview sessions={grid.sessions} />
        </div>
      ) : null}

      <p className="mt-6 text-xs" style={{ color: evoBrand.muted }}>
        Las clases se organizan por separado para poder revisarlas, pero todas pertenecen a esta misma semana y comparten su ciclo y contexto. Nada se publica automáticamente.
      </p>
    </div>
  )
}
