import { useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { getPe2WeekById, getPe2WeekGridData } from '../../lib/pe2Supabase.js'
import { formatPe2SlotLabel, PE2_STATUS_LABELS } from './pe2Slot.js'
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
    <div className="flex flex-col min-h-0 h-full max-w-6xl">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: evoBrand.muted }}>
          Vista semana · {slot ? formatPe2SlotLabel(slot) : '—'}
        </p>
        <h1 className="font-evo-display text-2xl sm:text-3xl font-bold" style={{ color: evoBrand.text }}>
          {week?.titulo || 'Semana'}
        </h1>
        {week ? (
          <p className="text-sm mt-2" style={{ color: evoBrand.muted }}>
            {PE2_STATUS_LABELS[week.status] || week.status}
            {week.is_primary ? ' · borrador principal' : ''}
            {' · '}
            {grid.sessions.length} sesión(es) estructurada(s)
          </p>
        ) : (
          <p className="text-sm mt-2" style={{ color: evoBrand.muted }}>
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
          className="rounded-xl border px-4 py-3 mb-4 text-sm"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}
        >
          {error}
        </div>
      ) : null}

      <WeekGrid classTypes={grid.classTypes} sessions={grid.sessions} loading={loading && Boolean(draftId)} />

      <p className="mt-4 text-xs" style={{ color: evoBrand.muted }}>
        Fase 1 — solo lectura. Las sesiones vienen de tablas estructuradas (<code>pe2_sessions</code>, bloques e ítems).
      </p>
    </div>
  )
}
