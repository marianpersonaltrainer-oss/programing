import { useState, useEffect } from 'react'
import { getCoachGuideSettings } from '../../lib/supabase.js'

function normalizeRows(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => ({
    name: String(r?.name ?? '').trim(),
    qty: String(r?.qty ?? '').trim(),
    rules: String(r?.rules ?? '').trim(),
  }))
}

export default function CoachGuideContentPanel({ onClose }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [adminSecret, setAdminSecret] = useState(() => {
    try {
      return sessionStorage.getItem('evo_coach_guide_admin_secret') || ''
    } catch {
      return ''
    }
  })
  const [activeNotice, setActiveNotice] = useState('')
  const [contactChannel, setContactChannel] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [contactSchedule, setContactSchedule] = useState('')
  const [responseTime, setResponseTime] = useState('')
  const [materialOverride, setMaterialOverride] = useState('')
  const [rows, setRows] = useState([{ name: '', qty: '', rules: '' }])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const data = await getCoachGuideSettings()
        if (cancelled) return
        if (data) {
          setActiveNotice(data.active_notice || '')
          setContactChannel(data.contact_channel || '')
          setContactPerson(data.contact_person || '')
          setContactSchedule(data.contact_schedule || '')
          setResponseTime(data.response_time || data.contact_response || '')
          setMaterialOverride(data.material_override || '')
          const r = normalizeRows(data.material_table)
          setRows(r.length ? r : [{ name: '', qty: '', rules: '' }])
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'No se pudieron cargar los datos')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  function addRow() {
    setRows((prev) => [...prev, { name: '', qty: '', rules: '' }])
  }

  function removeRow(i) {
    setRows((prev) => {
      const next = prev.filter((_, j) => j !== i)
      return next.length ? next : [{ name: '', qty: '', rules: '' }]
    })
  }

  function updateRow(i, field, value) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!adminSecret.trim()) {
      setError('Introduce la clave de administración (la misma que COACH_GUIDE_ADMIN_SECRET en Vercel).')
      return
    }
    setSaving(true)
    setError('')
    try {
      const material_table = rows.filter((r) => r.name || r.qty || r.rules)
      const patch = {
        active_notice: activeNotice.trim() || null,
        contact_channel: contactChannel.trim() || null,
        contact_person: contactPerson.trim() || null,
        contact_schedule: contactSchedule.trim() || null,
        response_time: responseTime.trim() || null,
        contact_response: responseTime.trim() || null,
        material_override: materialOverride.trim() || null,
        material_table,
      }
      const res = await fetch('/api/coach-guide-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: adminSecret.trim(), patch }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || `Error ${res.status}`)
      }
      try {
        sessionStorage.setItem('evo_coach_guide_admin_secret', adminSecret.trim())
      } catch {
        /* ignore */
      }
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const field =
    'w-full rounded-xl px-4 py-3 text-sm bg-[#160D16] border border-[#3D1A3D] text-[#E8EAF0] placeholder-[#9B80A0] focus:outline-none focus:border-[#A729AD]/60'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[#3D1A3D] bg-[#0C0B0C] shadow-2xl font-evo-body"
        role="dialog"
        aria-labelledby="coach-content-title"
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b border-[#3D1A3D] bg-[#0A0808]">
          <h2 id="coach-content-title" className="font-evo-display text-lg font-bold uppercase tracking-wide text-[#FFFF4C]">
            Contenido Coach
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-[#9B80A0] hover:bg-[#1A0A1A] hover:text-[#E8EAF0]"
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-8">
          {loading && <p className="text-sm text-[#9B80A0]">Cargando desde Supabase…</p>}
          {error && (
            <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">{error}</p>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#9B80A0] mb-2">Clave de administración</label>
            <input
              type="password"
              autoComplete="off"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className={field}
              placeholder="COACH_GUIDE_ADMIN_SECRET (servidor)"
            />
            <p className="text-[11px] text-[#9B80A0] mt-2 leading-relaxed">
              Debe coincidir con la variable <code className="text-[#FFFF4C]/90">COACH_GUIDE_ADMIN_SECRET</code> en Vercel. No es el código
              de acceso de los coaches.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-[#FFFF4C] mb-2">Aviso activo (banner en ?coach)</label>
            <textarea
              value={activeNotice}
              onChange={(e) => setActiveNotice(e.target.value)}
              className={`${field} min-h-[72px]`}
              placeholder="Ej.: Esta semana el jueves no hay clase de tarde."
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <p className="font-evo-display text-sm font-bold uppercase text-white">Canal de soporte</p>
            <div>
              <label className="block text-xs font-bold text-[#9B80A0] mb-1">Canal (WhatsApp, email, etc.)</label>
              <textarea value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} className={`${field} min-h-[60px]`} rows={2} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#9B80A0] mb-1">Persona de contacto</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#9B80A0] mb-1">Horario</label>
              <input value={contactSchedule} onChange={(e) => setContactSchedule(e.target.value)} className={field} />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#9B80A0] mb-1">Tiempo de respuesta</label>
              <textarea value={responseTime} onChange={(e) => setResponseTime(e.target.value)} className={`${field} min-h-[60px]`} rows={2} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-white mb-2">Material — texto libre (opcional)</label>
            <textarea
              value={materialOverride}
              onChange={(e) => setMaterialOverride(e.target.value)}
              className={`${field} min-h-[100px] font-mono text-[13px]`}
              placeholder="Si rellenas esto y no hay filas en la tabla, se muestra solo este bloque en Material."
              rows={5}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className="font-evo-display text-sm font-bold uppercase text-white">Inventario (tabla)</p>
              <button type="button" onClick={addRow} className="text-xs font-bold uppercase text-[#A729AD] hover:text-[#FFFF4C]">
                + Fila
              </button>
            </div>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-start p-3 rounded-xl border border-[#3D1A3D] bg-[#160D16]">
                  <input
                    className={`${field} sm:col-span-4`}
                    placeholder="Material"
                    value={r.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                  />
                  <input
                    className={`${field} sm:col-span-2`}
                    placeholder="Cantidad"
                    value={r.qty}
                    onChange={(e) => updateRow(i, 'qty', e.target.value)}
                  />
                  <input
                    className={`${field} sm:col-span-5`}
                    placeholder="Reglas de uso"
                    value={r.rules}
                    onChange={(e) => updateRow(i, 'rules', e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="sm:col-span-1 text-xs text-red-400 hover:text-red-300 py-3"
                    disabled={rows.length <= 1}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 py-3 rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] disabled:opacity-40 text-white font-bold text-sm uppercase tracking-wide transition-colors"
            >
              {saving ? 'Guardando…' : 'Guardar en Supabase'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-[#3D1A3D] text-[#E8EAF0] hover:bg-[#1A0A1A] text-sm font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
