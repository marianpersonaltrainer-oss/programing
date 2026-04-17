import { useMemo, useState } from 'react'
import Papa from 'papaparse'
import { listDailyHandoffsHistory } from '../../lib/supabase.js'

export default function AdminHandoffHistory() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [coachName, setCoachName] = useState('')
  const [classType, setClassType] = useState('')
  const [onlyIncident, setOnlyIncident] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listDailyHandoffsHistory({ fromDate, toDate, coachName, classType, onlyIncident, limit: 200 })
      setRows(data)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar el historial')
    } finally {
      setLoading(false)
    }
  }

  const coaches = useMemo(() => Array.from(new Set(rows.map((r) => r.coach_name).filter(Boolean))).sort(), [rows])
  const classes = useMemo(() => Array.from(new Set(rows.map((r) => r.class_type).filter(Boolean))).sort(), [rows])

  function exportCsv() {
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'handoffs-history.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-[#F6E8F9CC]">Historial de pases (25 por página recomendado).</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]" />
        <select value={coachName} onChange={(e) => setCoachName(e.target.value)} className="h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]">
          <option value="">Coach</option>
          {coaches.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={classType} onChange={(e) => setClassType(e.target.value)} className="h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]">
          <option value="">Clase</option>
          {classes.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="h-11 inline-flex items-center gap-2 text-[#F6E8F9CC]"><input type="checkbox" checked={onlyIncident} onChange={(e) => setOnlyIncident(e.target.checked)} /> Solo incidencia</label>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={load} className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase">Cargar</button>
        <button type="button" onClick={exportCsv} className="h-11 px-4 rounded-lg bg-[#A729AD] text-white font-evo-display uppercase">Exportar</button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-[#F6E8F9CC]">Cargando…</p> : null}
      <div className="rounded-lg border border-[#6A1F6D]/30 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#221427] text-[#F6E8F9CC]">
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
