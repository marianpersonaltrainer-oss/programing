import { useMemo, useState, useEffect } from 'react'
import { DAYS_ES } from '../../constants/evoColors.js'
import { listCoachSessionFeedback } from '../../lib/supabase.js'
import { coachAdminUi, coachField, coachText } from '../CoachView/coachTheme.js'

function weekKey(r) {
  return r.week_id || `${r.mesociclo ?? ''}_${r.semana ?? ''}`
}

function weekLabel(r) {
  const m = r.mesociclo != null ? String(r.mesociclo) : '—'
  const s = r.semana != null ? `S${r.semana}` : '—'
  return `${m} · ${s}`
}

const HOW_LABEL = {
  muy_bien: 'Muy bien',
  bien: 'Bien',
  regular: 'Regular',
  mal: 'Mal',
}

const TIME_LABEL = {
  si: 'Sí',
  no: 'No',
  justo: 'Justo',
}

function buildExportText(rows) {
  const lines = ['=== FEEDBACK COACHES (resumen para programar) ===', '']
  for (const r of rows) {
    const day = DAYS_ES[r.day_key] || r.day_key
    lines.push(`— ${r.coach_name} · ${weekLabel(r)} · ${day} · ${r.class_label}`)
    lines.push(`  Sesión: ${HOW_LABEL[r.session_how] || r.session_how}`)
    lines.push(`  Tiempo explicación: ${TIME_LABEL[r.time_for_explanation] || r.time_for_explanation}`)
    lines.push(`  Cambió algo: ${r.changed_something ? 'Sí' : 'No'}${r.changed_details ? ` — ${r.changed_details}` : ''}`)
    if (r.group_feelings) lines.push(`  Grupo: ${r.group_feelings}`)
    if (r.notes_next_week) lines.push(`  Próxima semana: ${r.notes_next_week}`)
    lines.push('')
  }
  return lines.join('\n')
}

export default function CoachSessionFeedbackAdmin() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [coachFilter, setCoachFilter] = useState('')
  const [weekFilter, setWeekFilter] = useState('')
  const [exportMsg, setExportMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await listCoachSessionFeedback()
        if (!cancelled) setRows(data)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar los feedbacks')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const coachOptions = useMemo(() => {
    const s = new Set(rows.map((r) => r.coach_name).filter(Boolean))
    return Array.from(s).sort()
  }, [rows])

  const weekOptions = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      const k = weekKey(r)
      if (!m.has(k)) m.set(k, weekLabel(r))
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [rows])

  const alertKeys = useMemo(() => {
    const counts = {}
    for (const r of rows) {
      if (r.session_how !== 'regular' && r.session_how !== 'mal') continue
      const k = `${r.coach_name}::${weekKey(r)}`
      counts[k] = (counts[k] || 0) + 1
    }
    return new Set(Object.entries(counts).filter(([, n]) => n >= 2).map(([k]) => k))
  }, [rows])

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (coachFilter && r.coach_name !== coachFilter) return false
      if (weekFilter && weekKey(r) !== weekFilter) return false
      return true
    })
  }, [rows, coachFilter, weekFilter])

  function rowAlert(r) {
    return alertKeys.has(`${r.coach_name}::${weekKey(r)}`)
  }

  async function copyExport() {
    const text = buildExportText(filtered)
    try {
      await navigator.clipboard.writeText(text)
      setExportMsg('Copiado al portapapeles.')
      setTimeout(() => setExportMsg(''), 2500)
    } catch {
      setExportMsg('No se pudo copiar. Selecciona el texto manualmente.')
    }
  }

  return (
    <div className={`${coachAdminUi.form} max-h-[min(70vh,520px)] overflow-y-auto`}>
      <p className={`text-sm ${coachText.muted} mb-4`}>
        Filtra por coach y semana. La alerta marca combinaciones con 2 o más feedbacks «Regular» o «Mal» en la misma semana.
      </p>

      {loading && <p className={coachText.muted}>Cargando feedbacks…</p>}
      {error && <p className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {!loading && !error && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className={coachAdminUi.label}>Coach</label>
              <select
                value={coachFilter}
                onChange={(e) => setCoachFilter(e.target.value)}
                className={coachField}
              >
                <option value="">Todos</option>
                {coachOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={coachAdminUi.label}>Semana (mesociclo · S#)</label>
              <select
                value={weekFilter}
                onChange={(e) => setWeekFilter(e.target.value)}
                className={coachField}
              >
                <option value="">Todas</option>
                {weekOptions.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            <button
              type="button"
              onClick={copyExport}
              className="px-6 py-3 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white text-sm font-bold uppercase tracking-wide transition-colors"
            >
              Exportar resumen para programar
            </button>
            {exportMsg && <span className={`text-sm self-center ${coachText.muted}`}>{exportMsg}</span>}
          </div>

          <ul className="space-y-3">
            {filtered.length === 0 && <li className={`text-sm ${coachText.muted}`}>No hay entradas con estos filtros.</li>}
            {filtered.map((r) => (
              <li
                key={r.id}
                className={`rounded-xl border px-4 py-3 text-sm ${
                  rowAlert(r)
                    ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400/60'
                    : 'border-[#6A1F6D]/25 bg-white'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 font-bold text-[#1A0A1A]">
                  <span>{r.coach_name}</span>
                  <span className="text-[#6A1F6D] font-normal">· {weekLabel(r)}</span>
                  <span className="text-[#5C4D5C] font-normal">
                    · {DAYS_ES[r.day_key] || r.day_key} · {r.class_label}
                  </span>
                  {rowAlert(r) && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-md font-black">
                      2+ regular/mal
                    </span>
                  )}
                </div>
                <p className="mt-2 text-[#1A0A1A]">
                  <span className="text-[#5C4D5C]">Sesión:</span> {HOW_LABEL[r.session_how] || r.session_how} ·{' '}
                  <span className="text-[#5C4D5C]">Tiempo:</span> {TIME_LABEL[r.time_for_explanation] || r.time_for_explanation} ·{' '}
                  <span className="text-[#5C4D5C]">Cambió:</span> {r.changed_something ? 'Sí' : 'No'}
                </p>
                {r.changed_details && <p className="mt-1 text-[#5C4D5C]">Detalle cambio: {r.changed_details}</p>}
                {r.group_feelings && <p className="mt-1">Grupo: {r.group_feelings}</p>}
                {r.notes_next_week && <p className="mt-1 text-[#6A1F6D] font-medium">Próx. semana: {r.notes_next_week}</p>}
                <p className="mt-2 text-[10px] text-[#5C4D5C]">
                  {r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : ''}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
