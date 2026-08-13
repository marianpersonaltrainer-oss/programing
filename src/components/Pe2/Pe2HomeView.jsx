import { useCallback, useEffect, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import {
  archivePe2Week,
  createPe2WeekDraft,
  getPe2ActiveSlot,
  listPe2WeeksForSlot,
  setPe2ActiveSlot,
} from '../../lib/pe2Supabase.js'
import {
  formatPe2SlotLabel,
  PE2_MESOCYCLES,
  PE2_STATUS_LABELS,
} from './pe2Slot.js'

export default function Pe2HomeView({
  orgId,
  selectedDraftId,
  onSelectDraft,
  onOpenWeek,
  onSlotChange,
}) {
  const [slot, setSlot] = useState(null)
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [savingSlot, setSavingSlot] = useState(false)
  const [error, setError] = useState('')

  const loadDrafts = useCallback(async (activeSlot) => {
    if (!activeSlot?.mesociclo || activeSlot.semana == null) return
    const rows = await listPe2WeeksForSlot(activeSlot.mesociclo, activeSlot.semana)
    setDrafts(rows)
    if (!selectedDraftId && rows.length > 0) {
      const primary = rows.find((r) => r.is_primary) || rows[0]
      onSelectDraft?.(primary.id)
    }
  }, [selectedDraftId, onSelectDraft])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const activeSlot = await getPe2ActiveSlot(orgId)
      setSlot(activeSlot)
      onSlotChange?.(activeSlot)
      await loadDrafts(activeSlot)
    } catch (e) {
      setDrafts([])
      setError(e.message || 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [loadDrafts, onSlotChange, orgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleSlotFieldChange(field, value) {
    if (!slot) return
    const next = {
      ...slot,
      [field]: field === 'semana' ? Number(value) : value,
    }
    setSlot(next)
    setSavingSlot(true)
    setError('')
    try {
      const saved = await setPe2ActiveSlot(next, orgId)
      setSlot(saved)
      onSlotChange?.(saved)
      await loadDrafts(saved)
    } catch (e) {
      setError(e.message || 'No se pudo guardar el slot')
    } finally {
      setSavingSlot(false)
    }
  }

  async function handleCreateDraft() {
    if (!slot || !orgId) return
    setCreating(true)
    setError('')
    try {
      const row = await createPe2WeekDraft({
        mesociclo: slot.mesociclo,
        semana: slot.semana,
        orgId,
        phase: slot.phase,
        titulo: `${formatPe2SlotLabel(slot)} · borrador`,
        is_primary: drafts.length === 0,
      })
      onSelectDraft?.(row.id)
      await loadDrafts(slot)
    } catch (e) {
      setError(e.message || 'No se pudo crear el borrador')
    } finally {
      setCreating(false)
    }
  }

  async function handleArchive(id) {
    if (!window.confirm('¿Archivar este borrador?')) return
    setError('')
    try {
      await archivePe2Week(id)
      if (selectedDraftId === id) onSelectDraft?.(null)
      await loadDrafts(slot)
    } catch (e) {
      setError(e.message || 'No se pudo archivar')
    }
  }

  const mesoMeta = PE2_MESOCYCLES.find((m) => m.value === slot?.mesociclo)

  return (
    <div className="max-w-3xl">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        ProgramingEvo · V2
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold mb-4" style={{ color: evoBrand.text }}>
        Programación
      </h1>

      <div
        className="rounded-2xl border px-5 py-4 mb-6"
        style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}44` }}
      >
        <p className="text-sm font-bold uppercase tracking-wide mb-3" style={{ color: evoBrand.purple }}>
          Slot activo (Supabase)
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: evoBrand.muted }}>Mesociclo</span>
            <select
              value={slot?.mesociclo || 'fuerza'}
              disabled={loading || savingSlot}
              onChange={(e) => handleSlotFieldChange('mesociclo', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: `${evoBrand.purple}33` }}
            >
              {PE2_MESOCYCLES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold" style={{ color: evoBrand.muted }}>Semana</span>
            <select
              value={slot?.semana || 1}
              disabled={loading || savingSlot}
              onChange={(e) => handleSlotFieldChange('semana', e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: `${evoBrand.purple}33` }}
            >
              {Array.from({ length: mesoMeta?.weeks || 6 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>S{n}</option>
              ))}
            </select>
          </label>
        </div>
        {slot ? (
          <p className="text-xs mt-3" style={{ color: evoBrand.muted }}>
            {formatPe2SlotLabel(slot)}{savingSlot ? ' · guardando…' : ''}
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3 mb-6 text-sm"
          style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleCreateDraft}
          disabled={creating || loading || !orgId}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {creating ? 'Creando…' : 'Nuevo borrador'}
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5 disabled:opacity-50"
          style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.text }}
        >
          Recargar
        </button>
        {selectedDraftId ? (
          <button
            type="button"
            onClick={() => onOpenWeek?.()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors hover:bg-black/5"
            style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.purple }}
          >
            Abrir semana →
          </button>
        ) : null}
      </div>

      <div
        className="rounded-2xl border overflow-hidden"
        style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: `${evoBrand.purple}22` }}>
          <p className="text-xs font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>
            Borradores del slot
          </p>
          <span className="text-xs" style={{ color: evoBrand.muted }}>
            {loading ? 'Cargando…' : `${drafts.length}`}
          </span>
        </div>

        {drafts.length === 0 && !loading && !error ? (
          <p className="px-4 py-8 text-sm text-center" style={{ color: evoBrand.muted }}>
            Sin borradores. Crea uno o ejecuta el seed de ejemplo.
          </p>
        ) : null}

        <ul className="divide-y" style={{ borderColor: `${evoBrand.purple}22` }}>
          {drafts.map((row) => (
            <li
              key={row.id}
              className={`px-4 py-3 flex flex-wrap items-center gap-3 ${row.id === selectedDraftId ? 'bg-[#A729AD]/08' : ''}`}
            >
              <button type="button" onClick={() => onSelectDraft?.(row.id)} className="flex-1 min-w-[200px] text-left">
                <p className="text-sm font-semibold truncate" style={{ color: evoBrand.text }}>
                  {row.titulo || 'Sin título'}
                  {row.is_primary ? (
                    <span className="ml-2 text-[10px] font-bold uppercase" style={{ color: evoBrand.purple }}>principal</span>
                  ) : null}
                </p>
                <p className="text-xs mt-0.5" style={{ color: evoBrand.muted }}>
                  {PE2_STATUS_LABELS[row.status] || row.status}
                </p>
              </button>
              <button
                type="button"
                onClick={() => handleArchive(row.id)}
                className="text-xs font-semibold px-2 py-1 rounded-lg hover:bg-black/5"
                style={{ color: evoBrand.muted }}
              >
                Archivar
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
