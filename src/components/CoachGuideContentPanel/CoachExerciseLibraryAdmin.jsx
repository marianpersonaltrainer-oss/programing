import { useState, useEffect, useCallback, useRef } from 'react'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { coachAdminUi, coachBorder, coachField, coachText } from '../CoachView/coachTheme.js'

function trimVideoUrl(s) {
  return String(s || '').trim()
}

/** @returns {string | null} */
function youtubeEmbedSrcFromUrl(raw) {
  try {
    const u = new URL(trimVideoUrl(raw))
    if (u.protocol !== 'https:') return null
    const host = u.hostname.replace(/^www\./, '').toLowerCase()
    const idParam = u.searchParams.get('v')
    if ((host === 'youtube.com' || host === 'm.youtube.com') && idParam && /^[a-zA-Z0-9_-]{11}$/.test(idParam)) {
      return `https://www.youtube-nocookie.com/embed/${idParam}`
    }
    const mShort = u.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/)
    if (host === 'youtube.com' && mShort) return `https://www.youtube-nocookie.com/embed/${mShort[1]}`
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').slice(0, 11)
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`
    }
    return null
  } catch {
    return null
  }
}

function isLibraryVideoVerified(row) {
  if (!trimVideoUrl(row?.video_url)) return true
  return row?.video_url_verified !== false
}

const CATEGORIES = [
  { value: 'bisagra', label: 'Bisagra' },
  { value: 'squat', label: 'Squat' },
  { value: 'empuje_horizontal', label: 'Empuje horizontal' },
  { value: 'empuje_vertical', label: 'Empuje vertical' },
  { value: 'jalon', label: 'Jalón / tirón' },
  { value: 'rotacion', label: 'Rotación' },
  { value: 'metabolico', label: 'Metabólico' },
  { value: 'core', label: 'Core' },
  { value: 'olimpico', label: 'Olímpico' },
  { value: 'landmine', label: 'Landmine' },
]

const LEVELS = [
  { value: 'basico', label: 'Básico' },
  { value: 'intermedio', label: 'Intermedio' },
  { value: 'avanzado', label: 'Avanzado' },
]

const emptyForm = () => ({
  id: null,
  name: '',
  category: 'bisagra',
  classes: [],
  level: 'basico',
  notes: '',
  is_new: false,
  active: true,
  video_url: '',
  video_url_verified: true,
})

export default function CoachExerciseLibraryAdmin({ adminSecret }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)
  const [videoCheck, setVideoCheck] = useState({ status: 'idle', message: '' })
  const baselineRef = useRef({ video_url: '', video_url_verified: true })

  const load = useCallback(async () => {
    if (!adminSecret?.trim()) {
      setRows([])
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/coach-exercise-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: adminSecret.trim(), action: 'list' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setRows(json.data || [])
    } catch (e) {
      setError(e?.message || 'No se pudo cargar')
    } finally {
      setLoading(false)
    }
  }, [adminSecret])

  useEffect(() => {
    load()
  }, [load])

  function startNew() {
    baselineRef.current = { video_url: '', video_url_verified: true }
    setVideoCheck({ status: 'idle', message: '' })
    setForm(emptyForm())
    setEditingId('new')
  }

  function startEdit(row) {
    const vu = isLibraryVideoVerified(row)
    baselineRef.current = {
      video_url: row.video_url || '',
      video_url_verified: vu,
    }
    setVideoCheck({ status: 'idle', message: '' })
    setForm({
      id: row.id,
      name: row.name || '',
      category: row.category || 'bisagra',
      classes: Array.isArray(row.classes) ? [...row.classes] : [],
      level: row.level || 'basico',
      notes: row.notes || '',
      is_new: !!row.is_new,
      active: row.active !== false,
      video_url: row.video_url || '',
      video_url_verified: vu,
    })
    setEditingId(row.id)
  }

  async function handleCheckVideoUrl() {
    const url = trimVideoUrl(form.video_url)
    if (!url) {
      setError('Pega una URL de vídeo antes de comprobar.')
      return
    }
    setVideoCheck({ status: 'loading', message: '' })
    setError('')
    try {
      const res = await fetch(`/api/video-check?url=${encodeURIComponent(url)}`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVideoCheck({ status: 'error', message: json.error || `Error ${res.status}` })
        return
      }
      if (json.ok) {
        setVideoCheck({ status: 'ok', message: json.message || 'Enlace comprobado.' })
      } else {
        setVideoCheck({ status: 'error', message: json.message || 'El enlace no respondió como esperado.' })
      }
    } catch (e) {
      setVideoCheck({ status: 'error', message: e?.message || 'No se pudo comprobar' })
    }
  }

  function toggleClass(key) {
    setForm((f) => {
      const set = new Set(f.classes)
      if (set.has(key)) set.delete(key)
      else set.add(key)
      return { ...f, classes: [...set] }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!adminSecret?.trim()) {
      setError('Falta la clave de administración.')
      return
    }
    if (!form.name.trim()) {
      setError('El nombre es obligatorio.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const vUrl = form.video_url.trim()
      const row = {
        id: form.id || undefined,
        name: form.name.trim(),
        category: form.category,
        classes: form.classes,
        level: form.level,
        notes: form.notes.trim() || null,
        is_new: form.is_new,
        active: form.active,
        video_url: vUrl || null,
        video_url_verified: vUrl ? form.video_url_verified === true : true,
      }
      const res = await fetch('/api/coach-exercise-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: adminSecret.trim(), action: 'upsert', row }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      setForm(emptyForm())
      setEditingId(null)
      await load()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!id || !window.confirm('¿Eliminar este ejercicio de la biblioteca?')) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/coach-exercise-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: adminSecret.trim(), action: 'delete', id }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      if (editingId === id) {
        setForm(emptyForm())
        setEditingId(null)
      }
      await load()
    } catch (err) {
      setError(err?.message || 'Error al eliminar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`space-y-6 ${coachText.primary}`}>
      {!adminSecret?.trim() && (
        <p className={`text-sm ${coachText.muted}`}>
          Introduce la clave de administración arriba (pestaña «Guía / avisos») y vuelve a esta pestaña para cargar y editar ejercicios.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className={`text-sm font-bold uppercase tracking-widest ${coachText.muted}`}>
          {loading ? 'Cargando…' : `${rows.length} ejercicios`}
        </p>
        <button
          type="button"
          onClick={startNew}
          disabled={saving || editingId === 'new'}
          className="text-xs font-bold uppercase px-4 py-2 rounded-xl bg-[#A729AD] text-white hover:bg-[#6A1F6D] disabled:opacity-40"
        >
          + Nuevo ejercicio
        </button>
      </div>

      {(editingId === 'new' || (editingId && form.id)) && (
        <form onSubmit={handleSave} className={`rounded-xl border ${coachBorder} p-4 space-y-4 bg-[#F3EAF8]/50`}>
          <p className="font-evo-display text-sm font-bold uppercase text-[#6A1F6D]">
            {editingId === 'new' ? 'Nuevo ejercicio' : 'Editar ejercicio'}
          </p>
          <div>
            <label className={coachAdminUi.subLabel}>Nombre</label>
            <input
              className={coachField}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={coachAdminUi.subLabel}>Categoría</label>
              <select
                className={coachField}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={coachAdminUi.subLabel}>Nivel</label>
              <select
                className={coachField}
                value={form.level}
                onChange={(e) => setForm((f) => ({ ...f, level: e.target.value }))}
              >
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={coachAdminUi.subLabel}>Clases donde aplica</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {EVO_SESSION_CLASS_DEFS.map(({ key, label }) => (
                <label
                  key={key}
                  className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer ${
                    form.classes.includes(key) ? 'bg-[#A729AD]/15 border-[#A729AD]/50' : `${coachBorder} bg-white`
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={form.classes.includes(key)}
                    onChange={() => toggleClass(key)}
                    className="rounded border-[#6A1F6D]/40"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={coachAdminUi.subLabel}>Notas de ejecución</label>
            <textarea
              className={`${coachField} min-h-[80px]`}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className={coachAdminUi.subLabel}>URL de vídeo (YouTube, Vimeo, Instagram…)</label>
            <input
              className={`${coachField} font-mono text-sm`}
              value={form.video_url}
              onChange={(e) => {
                const next = e.target.value
                const nextT = trimVideoUrl(next)
                const base = baselineRef.current
                const baseT = trimVideoUrl(base.video_url)
                const urlUnchanged = nextT === baseT
                setVideoCheck({ status: 'idle', message: '' })
                setForm((f) => ({
                  ...f,
                  video_url: next,
                  video_url_verified: !nextT ? true : urlUnchanged ? base.video_url_verified : false,
                }))
              }}
              placeholder="https://..."
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCheckVideoUrl}
                disabled={saving || !trimVideoUrl(form.video_url) || videoCheck.status === 'loading'}
                className="text-xs font-bold uppercase px-3 py-2 rounded-lg border border-[#6A1F6D]/40 text-[#6A1F6D] hover:bg-[#A729AD]/10 disabled:opacity-40"
              >
                {videoCheck.status === 'loading' ? 'Comprobando…' : 'Comprobar enlace'}
              </button>
              {videoCheck.status === 'ok' ? (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, video_url_verified: true }))}
                  className="text-xs font-bold uppercase px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  Marcar vídeo como verificado
                </button>
              ) : null}
            </div>
            {videoCheck.status === 'ok' ? (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">{videoCheck.message}</p>
            ) : null}
            {videoCheck.status === 'error' ? (
              <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{videoCheck.message}</p>
            ) : null}
            {(() => {
              const embed = youtubeEmbedSrcFromUrl(form.video_url)
              if (!embed) return null
              return (
                <div className="rounded-lg overflow-hidden border border-[#6A1F6D]/20 bg-black/5 aspect-video max-w-md">
                  <iframe
                    title="Vista previa del vídeo"
                    src={embed}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )
            })()}
            {trimVideoUrl(form.video_url) ? (
              <label className="flex items-start gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-[#6A1F6D]/40"
                  checked={form.video_url_verified === true}
                  disabled={(() => {
                    const currentUrl = trimVideoUrl(form.video_url)
                    const base = baselineRef.current
                    const urlMatchesBaseline = currentUrl === trimVideoUrl(base.video_url)
                    const canTurnOn =
                      videoCheck.status === 'ok' || (urlMatchesBaseline && base.video_url_verified === true)
                    if (!currentUrl) return true
                    if (form.video_url_verified) return false
                    return !canTurnOn
                  })()}
                  onChange={(e) => setForm((f) => ({ ...f, video_url_verified: e.target.checked }))}
                />
                <span>
                  Vídeo verificado (se usa en Excel, contexto de generación y enlaces de coach). Activa solo tras
                  «Comprobar enlace» o si el enlace no ha cambiado desde la última vez verificada.
                </span>
              </label>
            ) : (
              <p className={`text-xs ${coachText.muted}`}>Sin URL de vídeo no hace falta verificación.</p>
            )}
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Activo (visible en ?coach)
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_new}
                onChange={(e) => setForm((f) => ({ ...f, is_new: e.target.checked }))}
              />
              Marcar como NUEVO
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 min-w-[120px] py-3 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-40 text-white font-bold text-sm uppercase"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoCheck({ status: 'idle', message: '' })
                setForm(emptyForm())
                setEditingId(null)
              }}
              className={coachAdminUi.secondaryBtn}
            >
              Cancelar
            </button>
            {form.id ? (
              <button
                type="button"
                onClick={() => handleDelete(form.id)}
                disabled={saving}
                className="px-4 py-3 rounded-xl border border-red-300 text-red-700 text-sm font-bold uppercase hover:bg-red-50"
              >
                Eliminar
              </button>
            ) : null}
          </div>
        </form>
      )}

      <div className={`rounded-xl border ${coachBorder} overflow-hidden max-h-[min(50vh,480px)] overflow-y-auto`}>
        <table className="w-full text-left text-sm">
          <thead className={`sticky top-0 ${coachText.muted} bg-[#F3EAF8] uppercase text-[10px] tracking-widest font-bold`}>
            <tr>
              <th className="px-3 py-2">Nombre</th>
              <th className="px-3 py-2 hidden sm:table-cell">Cat.</th>
              <th className="px-3 py-2 hidden md:table-cell">Nivel</th>
              <th className="px-3 py-2 hidden lg:table-cell">Vídeo</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${coachBorder} hover:bg-[#F3EAF8]/80`}>
                <td className="px-3 py-2 font-medium text-[#1A0A1A] max-w-[200px] truncate">{r.name}</td>
                <td className="px-3 py-2 hidden sm:table-cell text-xs">{r.category}</td>
                <td className="px-3 py-2 hidden md:table-cell text-xs">{r.level}</td>
                <td className="px-3 py-2 hidden lg:table-cell text-xs whitespace-nowrap">
                  {!trimVideoUrl(r.video_url) ? (
                    <span className={coachText.muted}>—</span>
                  ) : isLibraryVideoVerified(r) ? (
                    <span className="text-emerald-700">OK</span>
                  ) : (
                    <span className="text-amber-800 font-semibold">Pendiente</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.active === false ? <span className="text-amber-700">Inactivo</span> : <span className="text-emerald-700">Activo</span>}
                  {r.is_new ? <span className="ml-1 text-[#A729AD] font-bold">NUEVO</span> : null}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="text-[#A729AD] font-bold text-xs uppercase hover:underline"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <p className={`px-4 py-8 text-center ${coachText.muted}`}>No hay filas. Comprueba Supabase o inserta el SQL inicial.</p>
        )}
      </div>
    </div>
  )
}
