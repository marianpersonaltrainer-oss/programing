import { useEffect, useMemo, useState } from 'react'
import {
  getActiveWeek,
  getAssistantWeekContext,
  upsertAssistantWeekContext,
  listAssistantQuestionHistory,
} from '../../lib/supabase.js'

function emptyQa() {
  return { question: '', answer: '' }
}

function emptyAdapt() {
  return { title: '', response: '', keywords: '' }
}

function normalizeQaRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      question: String(r?.question || '').trim(),
      answer: String(r?.answer || '').trim(),
    }))
    .filter((r) => r.question || r.answer)
}

function normalizeAdaptRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      title: String(r?.title || '').trim(),
      response: String(r?.response || '').trim(),
      keywords: String(r?.keywords || '').trim(),
    }))
    .filter((r) => r.title || r.response || r.keywords)
}

function formatRange(rows) {
  if (!rows.length) return 'sin fechas'
  const times = rows
    .map((r) => (r.created_at ? new Date(r.created_at).getTime() : 0))
    .filter(Boolean)
    .sort((a, b) => a - b)
  if (!times.length) return 'sin fechas'
  const a = new Date(times[0]).toLocaleDateString('es-ES')
  const b = new Date(times[times.length - 1]).toLocaleDateString('es-ES')
  return `${a} → ${b}`
}

function buildHistoryExportText(rows, week, mesocycle) {
  const head = `DUDAS COACHES – S${week ?? 'X'} – ${formatRange(rows)}`
  const chunks = [head, '']
  for (const r of rows) {
    chunks.push(
      `Coach: ${r.coach_name || 'Coach'} | Clase: ${r.class_label || '—'} | Día: ${r.day_key || '—'}`,
      `Pregunta: ${r.question || ''}`,
      `Respuesta asistente: ${r.answer || ''}`,
      '---',
    )
  }
  if (!rows.length) chunks.push('---')
  return chunks.join('\n')
}

export default function AdminAssistantWeekContext() {
  const [active, setActive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const [globalNotes, setGlobalNotes] = useState('')
  const [qaRows, setQaRows] = useState([emptyQa()])
  const [adaptRows, setAdaptRows] = useState([emptyAdapt()])
  const [historyRows, setHistoryRows] = useState([])

  const week = Number(active?.semana || 0) || null
  const mesocycle = active?.mesociclo || null

  async function refreshHistory(meso, sem) {
    if (!meso || sem == null) {
      setHistoryRows([])
      return
    }
    const rows = await listAssistantQuestionHistory({ mesociclo: meso, semana: sem, limit: 500 })
    setHistoryRows(rows || [])
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const wk = await getActiveWeek()
        if (cancelled) return
        setActive(wk || null)
        if (!wk?.mesociclo || wk?.semana == null) {
          setGlobalNotes('')
          setQaRows([emptyQa()])
          setAdaptRows([emptyAdapt()])
          setHistoryRows([])
          return
        }
        const ctx = await getAssistantWeekContext(wk.mesociclo, Number(wk.semana))
        if (cancelled) return
        setGlobalNotes(String(ctx?.global_notes || ''))
        const q = normalizeQaRows(ctx?.qa_pairs)
        const a = normalizeAdaptRows(ctx?.adaptations)
        setQaRows(q.length ? q : [emptyQa()])
        setAdaptRows(a.length ? a : [emptyAdapt()])
        await refreshHistory(wk.mesociclo, Number(wk.semana))
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudo cargar el contexto del asistente')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const exportText = useMemo(
    () => buildHistoryExportText(historyRows, week, mesocycle),
    [historyRows, week, mesocycle],
  )

  async function save() {
    if (!mesocycle || week == null) {
      setError('No hay semana activa para guardar contexto.')
      return
    }
    setSaving(true)
    setError('')
    setOk('')
    try {
      await upsertAssistantWeekContext({
        mesociclo: mesocycle,
        semana: week,
        global_notes: globalNotes,
        qa_pairs: normalizeQaRows(qaRows),
        adaptations: normalizeAdaptRows(adaptRows),
      })
      setOk('Contexto guardado para la semana activa.')
      setTimeout(() => setOk(''), 2800)
    } catch (e) {
      setError(e?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function copyHistoryExport() {
    try {
      await navigator.clipboard.writeText(exportText)
      setOk('Historial copiado.')
      setTimeout(() => setOk(''), 2000)
    } catch {
      setError('No se pudo copiar el historial.')
      setTimeout(() => setError(''), 2000)
    }
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-sm text-[#F6E8F9CC]">
          Contexto asistente - Semana activa.
          {mesocycle && week != null ? ` ${String(mesocycle).toUpperCase()} · S${week}` : ' Sin semana activa.'}
        </p>
      </div>
      {loading ? <p className="text-sm text-[#F6E8F9CC]">Cargando…</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {ok ? <p className="text-sm text-emerald-300">{ok}</p> : null}

      <div className="rounded-xl border border-[#6A1F6D]/30 bg-[#221427]/80 p-4 space-y-2">
        <p className="text-xs uppercase tracking-widest text-[#F6E8F9AA] font-bold">Sección 1 - Notas globales de la semana</p>
        <textarea
          value={globalNotes}
          onChange={(e) => setGlobalNotes(e.target.value)}
          rows={4}
          className="w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 py-2 text-[#F6E8F9]"
          placeholder="Resumen semanal, progresión de mesociclo y recordatorios para Haiku."
        />
      </div>

      <div className="rounded-xl border border-[#6A1F6D]/30 bg-[#221427]/80 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-[#F6E8F9AA] font-bold">Sección 2 - Q&A de la semana</p>
          <button
            type="button"
            onClick={() => setQaRows((prev) => [...prev, emptyQa()])}
            className="text-xs px-2 py-1 rounded-lg border border-[#6A1F6D] text-[#F6E8F9CC]"
          >
            + Añadir
          </button>
        </div>
        {qaRows.map((row, i) => (
          <div key={`qa-${i}`} className="rounded-lg border border-[#6A1F6D]/25 p-3 space-y-2">
            <input
              value={row.question}
              onChange={(e) => setQaRows((prev) => prev.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
              placeholder="Pregunta probable del coach"
              className="w-full h-10 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
            />
            <textarea
              value={row.answer}
              onChange={(e) => setQaRows((prev) => prev.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              placeholder="Respuesta recomendada"
              rows={3}
              className="w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 py-2 text-[#F6E8F9]"
            />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#6A1F6D]/30 bg-[#221427]/80 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-[#F6E8F9AA] font-bold">Sección 3 - Adaptaciones frecuentes</p>
          <button
            type="button"
            onClick={() => setAdaptRows((prev) => [...prev, emptyAdapt()])}
            className="text-xs px-2 py-1 rounded-lg border border-[#6A1F6D] text-[#F6E8F9CC]"
          >
            + Añadir
          </button>
        </div>
        {adaptRows.map((row, i) => (
          <div key={`ad-${i}`} className="rounded-lg border border-[#6A1F6D]/25 p-3 space-y-2">
            <input
              value={row.title}
              onChange={(e) => setAdaptRows((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
              placeholder="Título breve (lesión hombro, sin barra, etc.)"
              className="w-full h-10 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
            />
            <input
              value={row.keywords}
              onChange={(e) => setAdaptRows((prev) => prev.map((x, j) => (j === i ? { ...x, keywords: e.target.value } : x)))}
              placeholder="Keywords separadas por coma (ej.: no puede, lesion, sin barra)"
              className="w-full h-10 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
            />
            <textarea
              value={row.response}
              onChange={(e) => setAdaptRows((prev) => prev.map((x, j) => (j === i ? { ...x, response: e.target.value } : x)))}
              placeholder="Respuesta/adaptación recomendada"
              rows={3}
              className="w-full rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 py-2 text-[#F6E8F9]"
            />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#6A1F6D]/30 bg-[#221427]/80 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-widest text-[#F6E8F9AA] font-bold">
            Sección 4 - Historial de dudas de coaches (acumulativo)
          </p>
          <button
            type="button"
            onClick={copyHistoryExport}
            className="text-xs px-2 py-1 rounded-lg border border-[#6A1F6D] text-[#F6E8F9CC]"
          >
            Exportar historial
          </button>
        </div>
        <div className="max-h-56 overflow-y-auto space-y-2">
          {historyRows.map((r) => (
            <div key={r.id} className="rounded-lg border border-[#6A1F6D]/25 p-2">
              <p className="text-[11px] text-[#F6E8F9AA]">
                {r.created_at ? new Date(r.created_at).toLocaleString('es-ES') : '—'} · {r.coach_name || 'Coach'} · {r.class_label || '—'} ·{' '}
                {r.day_key || '—'}
              </p>
              <p className="text-xs text-[#F6E8F9] mt-1">
                <span className="font-bold">P:</span> {r.question}
              </p>
              <p className="text-xs text-[#F6E8F9] mt-1">
                <span className="font-bold">R:</span> {r.answer}
              </p>
            </div>
          ))}
          {!historyRows.length ? <p className="text-xs text-[#F6E8F9AA]">Sin dudas registradas todavía.</p> : null}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving || !mesocycle || week == null}
        className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar contexto semanal'}
      </button>
    </section>
  )
}

