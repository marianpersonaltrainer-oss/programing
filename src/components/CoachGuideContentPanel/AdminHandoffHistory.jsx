import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { listDailyHandoffsHistory } from '../../lib/supabase.js'

function toIsoDateLocal(d) {
  if (!(d instanceof Date)) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AdminHandoffHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return toIsoDateLocal(d)
  })
  const [toDate, setToDate] = useState(() => toIsoDateLocal(new Date()))
  const [coachName, setCoachName] = useState('')
  const [classType, setClassType] = useState('')
  const [onlyIncident, setOnlyIncident] = useState(false)
  const [error, setError] = useState('')
  const [loadedOnce, setLoadedOnce] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listDailyHandoffsHistory({ fromDate, toDate, coachName, classType, onlyIncident, limit: 200 })
      setRows(data)
      setLoadedOnce(true)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const coaches = useMemo(() => Array.from(new Set(rows.map((r) => r.coach_name).filter(Boolean))).sort(), [rows])
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.class_type).filter(Boolean))).sort(), [rows])
  const incidentCount = useMemo(() => rows.filter((r) => r.had_incident).length, [rows])
  const lowEnergyCount = useMemo(() => rows.filter((r) => Number(r.energy_level) <= 2).length, [rows])
  const avgEnergy = useMemo(() => {
    const vals = rows.map((r) => Number(r.energy_level)).filter((n) => Number.isFinite(n))
    if (!vals.length) return null
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
  }, [rows])

  function exportCsv() {
    if (!rows.length) return
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'handoffs-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const missingTableError = error.includes('daily_handoffs')

  return (
    <section className="space-y-4">
      <p className="text-sm text-[#F6E8F9CC]">
        Historial de pases entre coaches. Carga inicial: últimos 7 días (máx. 200 filas).
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="rounded-lg border border-[#6A1F6D]/40 bg-[#221427] px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-[#F6E8F999]">Registros</p>
          <p className="text-xl font-extrabold text-white">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-[#6A1F6D]/40 bg-[#221427] px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-[#F6E8F999]">Con incidencia</p>
          <p className="text-xl font-extrabold text-[#FFB4B4]">{incidentCount}</p>
        </div>
        <div className="rounded-lg border border-[#6A1F6D]/40 bg-[#221427] px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-[#F6E8F999]">Energía ≤ 2</p>
          <p className="text-xl font-extrabold text-[#FFFF4C]">{lowEnergyCount}</p>
        </div>
        <div className="rounded-lg border border-[#6A1F6D]/40 bg-[#221427] px-3 py-2">
          <p className="text-[10px] uppercase tracking-widest text-[#F6E8F999]">Energía media</p>
          <p className="text-xl font-extrabold text-[#F6E8F9]">{avgEnergy ?? '—'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9B3]">Desde</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-11 w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9B3]">Hasta</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-11 w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9B3]">Coach</span>
          <select
            value={coachName}
            onChange={(e) => setCoachName(e.target.value)}
            className="h-11 w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            <option value="">Todos</option>
            {coaches.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9B3]">Clase</span>
          <select
            value={classType}
            onChange={(e) => setClassType(e.target.value)}
            className="h-11 w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            <option value="">Todas</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="h-11 inline-flex items-center gap-2 text-[#F6E8F9CC] mt-6">
          <input type="checkbox" checked={onlyIncident} onChange={(e) => setOnlyIncident(e.target.checked)} /> Solo incidencia
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={load} className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase">Cargar</button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!rows.length}
          className="h-11 px-4 rounded-lg bg-[#A729AD] text-white font-evo-display uppercase disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-400/50 bg-red-950/30 px-3 py-2">
          <p className="text-sm text-red-200">{error}</p>
          {missingTableError ? (
            <p className="mt-2 text-xs text-red-100/90">
              Este entorno no tiene disponible el historial. Verifica el despliegue de staging; las migraciones se aplican desde el repositorio y nunca desde el navegador.
            </p>
          ) : null}
        </div>
      ) : null}
      {loading ? <p className="text-sm text-[#F6E8F9CC]">Cargando…</p> : null}

      {!loading && loadedOnce && !error && rows.length === 0 ? (
        <p className="text-sm text-[#F6E8F9CC] rounded-lg border border-[#6A1F6D]/30 px-3 py-2 bg-[#221427]/80">
          No hay pases para estos filtros.
        </p>
      ) : null}

      <div className="rounded-lg border border-[#6A1F6D]/30 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#221427] text-[#F6E8F9CC] sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left">Fecha</th><th className="px-3 py-2 text-left">Coach</th><th className="px-3 py-2 text-left">Hora</th><th className="px-3 py-2 text-left">Clase</th><th className="px-3 py-2 text-left">Energía</th><th className="px-3 py-2 text-left">Incidencia</th><th className="px-3 py-2 text-left">Nota</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`${Number(r.energy_level) <= 2 ? 'bg-[#FF4C4C11]' : 'bg-[#1a0f1b]'} border-t border-[#6A1F6D]/20`}>
                <td className="px-3 py-2 text-[#F6E8F9CC]">{r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : ''}</td>
                <td className="px-3 py-2 text-[#F6E8F9]">{r.coach_name}</td>
                <td className="px-3 py-2 text-[#F6E8F9CC]">{r.class_time}</td>
                <td className="px-3 py-2 text-[#F6E8F9CC]">{r.class_type}</td>
                <td className="px-3 py-2 text-[#FFFF4C]">{r.energy_level}</td>
                <td className="px-3 py-2">{r.had_incident ? <span className="px-2 py-0.5 rounded bg-[#FF4C4C] text-white text-xs">Incidencia</span> : '—'}</td>
                <td className="px-3 py-2 text-[#F6E8F9CC]">{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
