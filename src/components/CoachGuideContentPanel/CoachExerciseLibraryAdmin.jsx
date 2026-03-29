import { useState, useEffect, useCallback } from 'react'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { coachAdminUi, coachBorder, coachField, coachText } from '../CoachView/coachTheme.js'

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
})

export default function CoachExerciseLibraryAdmin({ adminSecret }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [editingId, setEditingId] = useState(null)

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
    setForm(emptyForm())
    setEditingId('new')
  }

  function startEdit(row) {
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
    })
    setEditingId(row.id)
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
      const row = {
        id: form.id || undefined,
        name: form.name.trim(),
        category: form.category,
        classes: form.classes,
        level: form.level,
        notes: form.notes.trim() || null,
        is_new: form.is_new,
        active: form.active,
        video_url: form.video_url.trim() || null,
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
          <div>
            <label className={coachAdminUi.subLabel}>URL de vídeo (YouTube, Instagram…)</label>
            <input
              className={`${coachField} font-mono text-sm`}
              value={form.video_url}
              onChange={(e) => setForm((f) => ({ ...f, video_url: e.target.value }))}
              placeholder="https://..."
            />
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
