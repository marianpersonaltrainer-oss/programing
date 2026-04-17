import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { listWeeklyCheckinsByWeek } from '../../lib/supabase.js'

export default function AdminTeamPulse() {
  const [rows, setRows] = useState([])
  const [weekIso, setWeekIso] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await listWeeklyCheckinsByWeek(weekIso || undefined)
      setRows(data)
    } catch (e) {
      setError(e?.message || 'No se pudo cargar pulso del equipo')
    } finally {
      setLoading(false)
    }
  }

  const grouped = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => {
      const key = r.week_iso || 'N/A'
      const arr = m.get(key) || []
      arr.push(r)
      m.set(key, arr)
    })
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const chartData = useMemo(
    () =>
      grouped.map(([week, items]) => ({
        week,
        mood: items.length ? items.reduce((acc, it) => acc + Number(it.mood_score || 0), 0) / items.length : 0,
      })),
    [grouped],
  )

  const warningMap = useMemo(() => {
    const byCoach = new Map()
    rows.forEach((r) => {
      const arr = byCoach.get(r.coach_name) || []
      arr.push(r)
      byCoach.set(r.coach_name, arr)
    })
    const warn = new Set()
    byCoach.forEach((arr, coach) => {
      const sorted = [...arr].sort((a, b) => String(a.week_iso).localeCompare(String(b.week_iso)))
      for (let i = 1; i < sorted.length; i += 1) {
        if (Number(sorted[i - 1].mood_score) <= 2 && Number(sorted[i].mood_score) <= 2) {
          warn.add(coach)
        }
      }
    })
    return warn
  }, [rows])

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={weekIso} onChange={(e) => setWeekIso(e.target.value)} placeholder="2026-W16" className="h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]" />
        <button type="button" onClick={load} className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase">Cargar semana</button>
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {loading ? <p className="text-sm text-[#F6E8F9CC]">Cargando…</p> : null}
      <div className="rounded-lg border border-[#6A1F6D]/30 bg-[#1a0f1b] p-3">
        <p className="text-sm font-evo-display text-[#FFFF4C] uppercase tracking-wide mb-2">Pulso semanal</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#6A1F6D55" />
              <XAxis dataKey="week" stroke="#F6E8F9AA" />
              <YAxis domain={[1, 5]} stroke="#F6E8F9AA" />
              <Tooltip />
              <Line type="monotone" dataKey="mood" stroke="#FFFF4C" strokeWidth={2} dot={{ fill: '#A729AD' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-2">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-[#6A1F6D]/30 bg-[#1a0f1b] px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-evo-display text-[#FFFF4C]">{r.coach_name}</p>
              {warningMap.has(r.coach_name) ? <span className="px-2 py-0.5 rounded bg-orange-400 text-[#0C0B0C] text-[10px] font-bold uppercase">Atención</span> : null}
            </div>
            <p className="text-xs text-[#F6E8F9CC]">{r.week_iso} · mood {r.mood_score}</p>
            {r.highlights ? <p className="text-sm text-[#F6E8F9] mt-1">Bien: {r.highlights}</p> : null}
            {r.improvements ? <p className="text-sm text-[#F6E8F9CC] mt-1">Mejorar: {r.improvements}</p> : null}
          </div>
        ))}
      </div>
    </section>
  )
}
