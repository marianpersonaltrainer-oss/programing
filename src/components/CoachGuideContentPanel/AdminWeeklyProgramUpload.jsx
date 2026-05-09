import { useMemo, useState } from 'react'
import {
  getPublishedWeekByMesocycleAndWeek,
  upsertPublishedWeekBySlot,
} from '../../lib/supabase.js'
import { analyzeWeeklyProgramXlsx } from '../../utils/analyzeWeeklyProgramXlsx.js'

const MESO_OPTS = ['fuerza', 'autocarga', 'mixto']
const WEEK_OPTS = Array.from({ length: 12 }, (_, i) => i + 1)

export default function AdminWeeklyProgramUpload() {
  const [file, setFile] = useState(null)
  const [mesocycle, setMesocycle] = useState('autocarga')
  const [week, setWeek] = useState(1)
  const [phase, setPhase] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState('')

  const canAnalyze = !!file && !busy
  const canImport = result?.score > 70 && !importing

  const bucketClass = useMemo(() => {
    if (!result) return 'text-[#F6E8F9]'
    if (result.score >= 85) return 'text-emerald-300'
    if (result.score >= 70) return 'text-amber-300'
    return 'text-red-300'
  }, [result])

  async function handleAnalyze() {
    if (!file) return
    setBusy(true)
    setError('')
    setImportMsg('')
    try {
      const buf = await file.arrayBuffer()
      let previousWeekData = null
      if (Number(week) > 1) {
        const prev = await getPublishedWeekByMesocycleAndWeek(mesocycle, Number(week) - 1)
        previousWeekData = prev?.data || null
      }
      const out = await analyzeWeeklyProgramXlsx({
        buffer: buf,
        mesocycle,
        week: Number(week),
        phase,
        previousWeekData,
      })
      setResult(out)
    } catch (e) {
      setError(e?.message || 'No se pudo analizar el Excel')
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  async function handleImportAnyway() {
    if (!result?.parsedWeekData || !canImport) return
    setImporting(true)
    setError('')
    setImportMsg('')
    try {
      const weekData = {
        ...result.parsedWeekData,
        mesociclo: mesocycle,
        semana: Number(week),
      }
      await upsertPublishedWeekBySlot(weekData, mesocycle, Number(week))
      setImportMsg('Importación completada: semana guardada en Supabase (idempotente por semana + mesociclo).')
    } catch (e) {
      setError(e?.message || 'No se pudo importar en Supabase')
    } finally {
      setImporting(false)
    }
  }

  async function handleExportReport() {
    if (!result?.reportText) return
    try {
      await navigator.clipboard.writeText(result.reportText)
      setImportMsg('Informe copiado al portapapeles.')
      setTimeout(() => setImportMsg(''), 2500)
    } catch {
      setImportMsg('No se pudo copiar automáticamente.')
      setTimeout(() => setImportMsg(''), 2500)
    }
  }

  return (
    <section className="space-y-4">
      <p className="text-sm text-[#F6E8F9CC]">
        Sube un Excel semanal, analízalo con scoring automático y solo luego importa en Supabase.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="space-y-1 md:col-span-2">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Archivo .xlsx</span>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Mesociclo activo</span>
          <select
            value={mesocycle}
            onChange={(e) => setMesocycle(e.target.value)}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            {MESO_OPTS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Semana</span>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
          >
            {WEEK_OPTS.map((w) => (
              <option key={w} value={w}>
                S{w}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="space-y-1 block">
        <span className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA]">Fase (opcional, para informe)</span>
        <input
          value={phase}
          onChange={(e) => setPhase(e.target.value)}
          placeholder="Ej.: Volumen mixto"
          className="w-full h-11 rounded-lg bg-[#221427] border border-[#6A1F6D] px-3 text-[#F6E8F9]"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          className="h-11 px-4 rounded-lg bg-[#6A1F6D] text-[#FFFF4C] font-evo-display uppercase disabled:opacity-50"
        >
          {busy ? 'Analizando…' : 'Analizar antes de importar'}
        </button>
        <button
          type="button"
          onClick={handleExportReport}
          disabled={!result}
          className="h-11 px-4 rounded-lg bg-[#A729AD] text-white font-evo-display uppercase disabled:opacity-50"
        >
          Exportar informe
        </button>
        {canImport ? (
          <button
            type="button"
            onClick={handleImportAnyway}
            disabled={importing}
            className="h-11 px-4 rounded-lg bg-emerald-600 text-white font-evo-display uppercase disabled:opacity-50"
          >
            {importing ? 'Importando…' : 'Importar de todas formas'}
          </button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-300">{error}</p> : null}
      {importMsg ? <p className="text-sm text-emerald-300">{importMsg}</p> : null}

      {result ? (
        <div className="rounded-xl border border-[#6A1F6D]/40 bg-[#221427] p-4 space-y-3">
          <p className={`text-lg font-extrabold ${bucketClass}`}>Score total: {result.score}/100</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">Estructura: {result.points.estructura}/25</p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">Variedad: {result.points.variedad}/25</p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">Coherencia: {result.points.coherencia}/25</p>
            <p className="rounded-lg border border-[#6A1F6D]/30 px-2 py-1 text-[#F6E8F9]">Feedback: {result.points.feedback}/25</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#F6E8F9AA] mb-1">Alertas</p>
            <ul className="space-y-1 max-h-44 overflow-y-auto">
              {result.alerts.slice(0, 120).map((a, i) => (
                <li key={`${i}-${a}`} className="text-xs text-red-200">
                  - {a}
                </li>
              ))}
              {!result.alerts.length ? <li className="text-xs text-emerald-200">- Sin alertas</li> : null}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  )
}

