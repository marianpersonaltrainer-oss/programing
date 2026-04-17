import { useState, useEffect } from 'react'
import { getCoachGuideSettings } from '../../lib/supabase.js'
import { coachAdminUi, coachBorder, coachField, coachText } from '../CoachView/coachTheme.js'
import CoachSessionFeedbackAdmin from './CoachSessionFeedbackAdmin.jsx'
import CoachExerciseLibraryAdmin from './CoachExerciseLibraryAdmin.jsx'
import CoachWeekExportAdmin from './CoachWeekExportAdmin.jsx'
import AdminHandoffHistory from './AdminHandoffHistory.jsx'
import AdminTeamPulse from './AdminTeamPulse.jsx'

function normalizeRows(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((r) => ({
    name: String(r?.name ?? '').trim(),
    qty: String(r?.qty ?? '').trim(),
    rules: String(r?.rules ?? '').trim(),
  }))
}

export default function CoachGuideContentPanel({ onClose }) {
  const [adminTab, setAdminTab] = useState('guide')
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

  return (
    <div className={coachAdminUi.overlay}>
      <div
        className={`${coachAdminUi.dialog} ${adminTab === 'biblioteca' || adminTab === 'export' ? 'max-w-4xl' : ''}`}
        role="dialog"
        aria-labelledby="coach-content-title"
      >
        <div className={coachAdminUi.header}>
          <h2 id="coach-content-title" className={coachAdminUi.title}>
            Contenido Coach
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={coachAdminUi.closeBtn}
            aria-label="Cerrar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={`flex gap-1 px-6 pt-4 border-b ${coachBorder}`}>
          <button
            type="button"
            onClick={() => setAdminTab('guide')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'guide' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Guía / avisos
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('feedback')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'feedback' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Feedbacks
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('biblioteca')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'biblioteca' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Biblioteca
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('export')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'export' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Exportar semana
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('handoffs')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'handoffs' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Historial de pases
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('pulse')}
            className={`px-4 py-2 rounded-t-lg text-xs font-bold uppercase tracking-wide transition-colors ${
              adminTab === 'pulse' ? 'bg-[#A729AD] text-white' : 'text-[#5C4D5C] hover:bg-[#F3EAF8]'
            }`}
          >
            Pulso del equipo
          </button>
        </div>

        {adminTab === 'export' ? (
          <div className={`px-6 py-4 max-h-[min(85vh,900px)] overflow-y-auto`}>
            <CoachWeekExportAdmin />
            <button type="button" onClick={onClose} className={`mt-6 ${coachAdminUi.secondaryBtn}`}>
              Cerrar
            </button>
          </div>
        ) : adminTab === 'handoffs' ? (
          <div className={`px-6 py-4 max-h-[min(85vh,900px)] overflow-y-auto`}>
            <AdminHandoffHistory />
            <button type="button" onClick={onClose} className={`mt-6 ${coachAdminUi.secondaryBtn}`}>
              Cerrar
            </button>
          </div>
        ) : adminTab === 'pulse' ? (
          <div className={`px-6 py-4 max-h-[min(85vh,900px)] overflow-y-auto`}>
            <AdminTeamPulse />
            <button type="button" onClick={onClose} className={`mt-6 ${coachAdminUi.secondaryBtn}`}>
              Cerrar
            </button>
          </div>
        ) : adminTab === 'biblioteca' ? (
          <div className={`${coachAdminUi.form} max-h-[min(85vh,900px)] overflow-y-auto`}>
            <div>
              <label className={coachAdminUi.label}>Clave de administración</label>
              <input
                type="password"
                autoComplete="off"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                className={coachField}
                placeholder="COACH_GUIDE_ADMIN_SECRET (servidor)"
              />
            </div>
            <CoachExerciseLibraryAdmin adminSecret={adminSecret} />
            <button type="button" onClick={onClose} className={`${coachAdminUi.secondaryBtn} w-full`}>
              Cerrar
            </button>
          </div>
        ) : adminTab === 'feedback' ? (
          <div className="px-6 py-4">
            <CoachSessionFeedbackAdmin />
            <button type="button" onClick={onClose} className={`mt-6 ${coachAdminUi.secondaryBtn}`}>
              Cerrar
            </button>
          </div>
        ) : (
        <form onSubmit={handleSave} className={coachAdminUi.form}>
          {loading && <p className={`text-base ${coachText.muted}`}>Cargando desde Supabase…</p>}
          {error && (
            <p className="text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">{error}</p>
          )}

          <div>
            <label className={coachAdminUi.label}>Clave de administración</label>
            <input
              type="password"
              autoComplete="off"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              className={coachField}
              placeholder="COACH_GUIDE_ADMIN_SECRET (servidor)"
            />
            <p className={coachAdminUi.hint}>
              Debe coincidir con la variable <code className="text-[#FFFF4C]/90">COACH_GUIDE_ADMIN_SECRET</code> en Vercel. No es el código
              de acceso de los coaches.
            </p>
          </div>

          <div>
            <label className={coachAdminUi.labelAccent}>Aviso activo (banner en ?coach)</label>
            <textarea
              value={activeNotice}
              onChange={(e) => setActiveNotice(e.target.value)}
              className={`${coachField} min-h-[72px]`}
              placeholder="Ej.: Esta semana el jueves no hay clase de tarde."
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <p className={`font-evo-display text-base font-bold uppercase ${coachText.primary}`}>Canal de soporte</p>
            <div>
              <label className={coachAdminUi.subLabel}>Canal (WhatsApp, email, etc.)</label>
              <textarea value={contactChannel} onChange={(e) => setContactChannel(e.target.value)} className={`${coachField} min-h-[60px]`} rows={2} />
            </div>
            <div>
              <label className={coachAdminUi.subLabel}>Persona de contacto</label>
              <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={coachField} />
            </div>
            <div>
              <label className={coachAdminUi.subLabel}>Horario</label>
              <input value={contactSchedule} onChange={(e) => setContactSchedule(e.target.value)} className={coachField} />
            </div>
            <div>
              <label className={coachAdminUi.subLabel}>Tiempo de respuesta</label>
              <textarea value={responseTime} onChange={(e) => setResponseTime(e.target.value)} className={`${coachField} min-h-[60px]`} rows={2} />
            </div>
          </div>

          <div>
            <label className={coachAdminUi.labelWhite}>Material — texto libre (opcional)</label>
            <textarea
              value={materialOverride}
              onChange={(e) => setMaterialOverride(e.target.value)}
              className={`${coachField} min-h-[100px] font-mono text-sm`}
              placeholder="Si rellenas esto y no hay filas en la tabla, se muestra solo este bloque en Material."
              rows={5}
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <p className={`font-evo-display text-base font-bold uppercase ${coachText.primary}`}>Inventario (tabla)</p>
              <button type="button" onClick={addRow} className="text-sm font-bold uppercase text-[#A729AD] hover:text-[#FFFF4C]">
                + Fila
              </button>
            </div>
            <div className="space-y-3">
              {rows.map((r, i) => (
                <div key={i} className={coachAdminUi.rowCard}>
                  <input
                    className={`${coachField} sm:col-span-4`}
                    placeholder="Material"
                    value={r.name}
                    onChange={(e) => updateRow(i, 'name', e.target.value)}
                  />
                  <input
                    className={`${coachField} sm:col-span-2`}
                    placeholder="Cantidad"
                    value={r.qty}
                    onChange={(e) => updateRow(i, 'qty', e.target.value)}
                  />
                  <input
                    className={`${coachField} sm:col-span-5`}
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
            <button type="button" onClick={onClose} className={coachAdminUi.secondaryBtn}>
              Cancelar
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
