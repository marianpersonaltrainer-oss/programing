import { useCallback, useEffect, useMemo, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { listDirectionProfiles, listDirectionShiftProtocolLogs } from '../../lib/shiftProtocols.js'
import { madridTodayYmd } from '../../utils/shiftProtocolTime.js'
import ShiftProtocolLogList from './ShiftProtocolLogList.jsx'

export default function Pe2DirectionShiftView() {
  const [date, setDate] = useState(() => madridTodayYmd())
  const [coachId, setCoachId] = useState('')
  const [profiles, setProfiles] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const profileNames = useMemo(
    () => Object.fromEntries(profiles.map((profile) => [profile.id, profile.full_name || 'Sin nombre'])),
    [profiles],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextProfiles, nextLogs] = await Promise.all([
        listDirectionProfiles(),
        listDirectionShiftProtocolLogs({ ymd: date, userId: coachId }),
      ])
      setProfiles(nextProfiles)
      setLogs(nextLogs)
    } catch (e) {
      setError(e.message || 'No se han podido cargar los registros del equipo.')
    } finally {
      setLoading(false)
    }
  }, [coachId, date])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="max-w-5xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        Vista de Dirección
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold" style={{ color: evoBrand.text }}>
        Control de turnos
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: evoBrand.muted }}>
        Consulta las aperturas, cierres e incidencias. Las horas y los días se muestran según Granada.
      </p>

      <div className="grid sm:grid-cols-[1fr_1.4fr_auto] gap-3 mt-7 rounded-2xl border p-4" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <label className="block">
          <span className="text-xs font-bold" style={{ color: evoBrand.muted }}>Fecha</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            style={{ borderColor: `${evoBrand.purple}33` }}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold" style={{ color: evoBrand.muted }}>Entrenador</span>
          <select
            value={coachId}
            onChange={(event) => setCoachId(event.target.value)}
            className="mt-1 w-full rounded-xl border px-3 py-2.5 text-sm"
            style={{ borderColor: `${evoBrand.purple}33` }}
          >
            <option value="">Todo el equipo</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.full_name || 'Sin nombre'}{profile.role === 'programmer' ? ' · Dirección' : ''}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="self-end rounded-xl px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          Actualizar
        </button>
      </div>

      {error ? (
        <div role="alert" className="rounded-2xl border px-4 py-3 mt-5 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border overflow-hidden mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="px-4 py-4 sm:px-5 border-b flex items-center justify-between" style={{ borderColor: `${evoBrand.purple}22` }}>
          <h2 className="font-evo-display text-lg font-bold" style={{ color: evoBrand.text }}>Registros</h2>
          <span className="text-xs font-semibold" style={{ color: evoBrand.muted }}>
            {loading ? 'Cargando…' : `${logs.length}`}
          </span>
        </div>
        <ShiftProtocolLogList
          logs={logs}
          loading={loading}
          showCoach
          profileNames={profileNames}
        />
      </section>
    </div>
  )
}
