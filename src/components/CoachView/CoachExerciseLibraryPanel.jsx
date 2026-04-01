import { useEffect, useMemo, useState } from 'react'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { resolveVideoUrlForExerciseLabel } from '../../constants/exerciseVideos.js'
import { coachBg, coachBorder, coachText, coachUi, CLASS_BADGE_CLASS } from './coachTheme.js'
import { getAllCoachExerciseNotes, setCoachExerciseNote } from '../../utils/coachLibraryCoachNotes.js'

const CLASS_KEY_TO_LABEL = Object.fromEntries(EVO_SESSION_CLASS_DEFS.map((d) => [d.key, d.label]))

const CATEGORY_LABELS = {
  bisagra: 'Bisagra',
  squat: 'Squat',
  empuje_horizontal: 'Empuje horizontal',
  empuje_vertical: 'Empuje vertical',
  jalon: 'Jalón / tirón',
  rotacion: 'Rotación',
  metabolico: 'Metabólico',
  core: 'Core',
  olimpico: 'Olímpico',
  landmine: 'Landmine',
}

const LEVEL_LABELS = {
  basico: 'Básico',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

function classBadge(key) {
  const label = CLASS_KEY_TO_LABEL[key] || key
  const cls = CLASS_BADGE_CLASS[label] || 'bg-gray-100 text-gray-800 border-gray-300'
  return { label, cls }
}

function openVideoUrl(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function normSearch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
}

export default function CoachExerciseLibraryPanel({ exercises, loading, error }) {
  const [filterClass, setFilterClass] = useState('')
  const [filterLevel, setFilterLevel] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [coachNotesById, setCoachNotesById] = useState({})

  useEffect(() => {
    setCoachNotesById((prev) => ({ ...getAllCoachExerciseNotes(), ...prev }))
  }, [exercises])

  const filtered = useMemo(() => {
    let list = exercises || []
    if (filterClass) {
      list = list.filter((e) => Array.isArray(e.classes) && e.classes.includes(filterClass))
    }
    if (filterLevel) {
      list = list.filter((e) => e.level === filterLevel)
    }
    const q = normSearch(searchQuery)
    if (q) {
      list = list.filter((e) => {
        const name = normSearch(e.name)
        const notes = normSearch(e.notes)
        return name.includes(q) || notes.includes(q)
      })
    }
    return list
  }, [exercises, filterClass, filterLevel, searchQuery])

  const byCategory = useMemo(() => {
    const m = new Map()
    for (const e of filtered) {
      const c = e.category || 'otro'
      if (!m.has(c)) m.set(c, [])
      m.get(c).push(e)
    }
    return [...m.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)))
  }, [filtered])

  return (
    <div className={`${coachUi.scroll} pb-24`}>
      <h1 className={`font-evo-display text-xl sm:text-2xl font-black uppercase tracking-wide ${coachText.title} mb-2`}>
        Biblioteca de ejercicios
      </h1>
      <p className={`text-sm ${coachText.muted} mb-6 max-w-2xl`}>
        Documento Maestro EVO — filtra por clase y nivel. Las notas son orientación para el box.
      </p>

      {error && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      )}

      <div className={`flex flex-wrap gap-3 mb-8 p-4 rounded-xl border ${coachBorder} ${coachBg.card}`}>
        <div className="flex flex-col gap-1 min-w-[200px] flex-1">
          <label className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Buscar</label>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nombre o notas…"
            className={`rounded-lg border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white w-full`}
            autoComplete="off"
          />
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Clase</label>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className={`rounded-lg border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white`}
          >
            <option value="">Todas</option>
            {EVO_SESSION_CLASS_DEFS.map(({ key, label }) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1 min-w-[140px]">
          <label className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>Nivel</label>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className={`rounded-lg border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white`}
          >
            <option value="">Todos</option>
            <option value="basico">Básico</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
        </div>
      </div>

      {loading && <p className={`${coachText.muted} font-bold uppercase tracking-widest`}>Cargando biblioteca…</p>}

      {!loading && !filtered.length && (
        <p className={`${coachText.muted}`}>No hay ejercicios con estos filtros o la biblioteca está vacía.</p>
      )}

      <div className="space-y-6">
        {byCategory.map(([cat, items]) => (
          <section key={cat} className={`rounded-xl border ${coachBorder} ${coachBg.card} overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${coachBorder} bg-[#6A1F6D]/8`}>
              <h2 className={`font-evo-display text-base font-bold uppercase tracking-wide ${coachText.title}`}>
                {CATEGORY_LABELS[cat] || cat}
                <span className={`ml-2 text-sm font-semibold ${coachText.muted}`}>({items.length})</span>
              </h2>
            </div>
            <ul className="divide-y divide-[#6A1F6D]/15">
              {items.map((e) => (
                <li key={e.id} className="px-5 py-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className={`font-bold text-base ${coachText.primary} leading-snug`}>{e.name}</p>
                    <div className="flex flex-wrap gap-1.5 items-center shrink-0">
                      {e.is_new ? (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#A729AD] text-white border border-[#6A1F6D]/40">
                          Nuevo
                        </span>
                      ) : null}
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border border-[#6A1F6D]/25 ${coachBg.cardAlt} ${coachText.muted}`}
                      >
                        {LEVEL_LABELS[e.level] || e.level}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(e.classes || []).map((ck) => {
                      const { label, cls } = classBadge(ck)
                      return (
                        <span key={ck} className={`${coachUi.chip} ${cls}`}>
                          {label}
                        </span>
                      )
                    })}
                  </div>
                  {e.notes?.trim() ? (
                    <p className={`text-sm leading-relaxed ${coachText.muted}`}>{e.notes.trim()}</p>
                  ) : null}
                  {(() => {
                    const url = resolveVideoUrlForExerciseLabel(e.name, e.video_url)
                    const isSearch = /youtube\.com\/results/i.test(url)
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(ev) => {
                          ev.preventDefault()
                          openVideoUrl(url)
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#A729AD] hover:underline"
                      >
                        {isSearch ? '▶ Buscar en YouTube' : '▶ Ver vídeo'}
                      </a>
                    )
                  })()}
                  <div className="pt-1">
                    <label className={`block text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-1`}>
                      Mis notas (solo en este dispositivo)
                    </label>
                    <textarea
                      value={coachNotesById[String(e.id)] ?? ''}
                      onChange={(ev) => {
                        const v = ev.target.value
                        const id = String(e.id)
                        setCoachNotesById((prev) => ({ ...prev, [id]: v }))
                        setCoachExerciseNote(e.id, v)
                      }}
                      rows={2}
                      placeholder="Cues, correcciones habituales, escalado que usas en clase…"
                      className={`w-full rounded-lg border ${coachBorder} px-3 py-2 text-sm ${coachText.primary} bg-white`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
