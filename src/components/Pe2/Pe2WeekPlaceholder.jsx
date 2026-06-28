import { useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { getPe2WeekById } from '../../lib/pe2Supabase.js'
import { formatPe2SlotLabel, PE2_STATUS_LABELS } from './pe2Slot.js'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export default function Pe2WeekPlaceholder({ slot, draftId }) {
  const [row, setRow] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!draftId) {
      setRow(null)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError('')
    getPe2WeekById(draftId)
      .then((data) => {
        if (!cancelled) setRow(data)
      })
      .catch((e) => {
        if (!cancelled) {
          setRow(null)
          setError(e.message || 'Error al cargar borrador')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [draftId])

  const dias = Array.isArray(row?.data?.dias) ? row.data.dias : []

  return (
    <div className="flex flex-col min-h-0 h-full">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: evoBrand.muted }}>
          Vista semana · {formatPe2SlotLabel(slot)}
        </p>
        <h1 className="font-evo-display text-2xl sm:text-3xl font-bold" style={{ color: evoBrand.text }}>
          {row?.titulo || 'Semana actual'}
        </h1>
        {row ? (
          <p className="text-sm mt-2" style={{ color: evoBrand.muted }}>
            {PE2_STATUS_LABELS[row.status] || row.status}
            {row.is_primary ? ' · borrador principal' : ''}
            {' · '}
            {dias.length} día(s) en data
          </p>
        ) : (
          <p className="text-sm mt-2" style={{ color: evoBrand.muted }}>
            {draftId ? (loading ? 'Cargando borrador…' : 'Borrador no encontrado') : 'Elige o crea un borrador en Inicio V2.'}
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

      <div
        className="flex-1 min-h-[280px] rounded-2xl border border-dashed p-6 flex flex-col"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}55` }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: evoBrand.purple }}>
          Lienzo (próximo paso: sesiones día × clase)
        </p>
        <div className="grid grid-cols-6 gap-2 flex-1 min-h-[180px]">
          {DAYS.map((day, i) => {
            const dayData = dias[i]
            const hasContent = dayData && (dayData.evofuncional || dayData.evofit || dayData.evobasics)
            return (
              <div
                key={day}
                className="rounded-xl border flex flex-col items-center justify-center text-center p-3"
                style={{
                  borderColor: hasContent ? `${evoBrand.purple}66` : `${evoBrand.purple}33`,
                  backgroundColor: hasContent ? `${evoBrand.purple}08` : evoBrand.cardAlt,
                }}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: evoBrand.muted }}>
                  {day}
                </span>
                <span className="text-[11px] mt-2" style={{ color: evoBrand.text }}>
                  {hasContent ? 'Con datos' : '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
