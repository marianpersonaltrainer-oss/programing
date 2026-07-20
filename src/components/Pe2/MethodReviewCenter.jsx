import { useCallback, useEffect, useMemo, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'
import { getMethodRuleReview, submitMethodRuleReview } from '../../lib/methodRuleReviewApi.js'

const STATUS_LABELS = {
  legacy_unreviewed: 'Sin revisar',
  pending_review: 'Pendiente',
  active: 'Activa',
  rejected: 'Rechazada',
  archived: 'Archivada',
  superseded: 'Sustituida',
}

const TYPE_LABELS = {
  timing: 'Tiempo',
  load: 'Carga',
  exercise: 'Ejercicio',
  format: 'Formato',
  rest: 'Descanso',
}

const VALIDITY_LABELS = {
  permanent: 'Permanente',
  temporary: 'Temporal',
  weekly_exception: 'Excepción semanal',
}

const STRENGTH_LABELS = {
  required: 'Obligatoria',
  preferred: 'Preferencia',
  avoid: 'Evitar',
  prohibited: 'Prohibida',
}

const DAY_LABELS = [
  [1, 'L'],
  [2, 'M'],
  [3, 'X'],
  [4, 'J'],
  [5, 'V'],
  [6, 'S'],
  [7, 'D'],
]

function badgeColors(status) {
  if (status === 'active') return { backgroundColor: '#DCFCE7', color: '#166534' }
  if (status === 'pending_review') return { backgroundColor: '#FEF3C7', color: '#92400E' }
  if (status === 'rejected') return { backgroundColor: '#FEE2E2', color: '#991B1B' }
  return { backgroundColor: '#F3EAF8', color: evoBrand.purple }
}

function SummaryCard({ label, value, tone = 'default' }) {
  const accent = tone === 'warning' ? '#B45309' : tone === 'success' ? '#166534' : evoBrand.purple
  return (
    <div className="rounded-2xl border bg-white px-4 py-3" style={{ borderColor: `${accent}33` }}>
      <p className="text-2xl font-bold" style={{ color: accent }}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: evoBrand.muted }}>{label}</p>
    </div>
  )
}

function SourceRow({ row }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: `${evoBrand.purple}22`, backgroundColor: '#FCFAFC' }}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={badgeColors(row.status)}>
          {STATUS_LABELS[row.status] || row.status}
        </span>
        <span className="text-[10px]" style={{ color: evoBrand.muted }}>#{row.id} · {TYPE_LABELS[row.ruleType] || row.ruleType}</span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: evoBrand.text }}>{row.text}</p>
      {row.triggerContext ? (
        <p className="text-[10px] mt-1" style={{ color: evoBrand.muted }}>Origen: {row.triggerContext}</p>
      ) : null}
    </div>
  )
}

function RuleEditor({ group, busy, onClose, onDone }) {
  const [draft, setDraft] = useState(() => ({
    ...group.defaultDraft,
    classTypesText: (group.defaultDraft.classTypes || []).join(', '),
    changeReason: '',
  }))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const unresolvedRows = group.rows.filter((row) => ['legacy_unreviewed', 'pending_review'].includes(row.status))

  function change(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function toggleDay(day) {
    const days = new Set(draft.dayOfWeek || [])
    if (days.has(day)) days.delete(day)
    else days.add(day)
    change('dayOfWeek', Array.from(days).sort())
  }

  async function submit(action) {
    if (action === 'approve' && !window.confirm('¿Activar esta redacción como regla canónica? Las fuentes del grupo quedarán sustituidas.')) return
    if (action === 'reject' && !window.confirm('¿Rechazar este grupo? No entrará en el método activo.')) return

    setSaving(true)
    setError('')
    try {
      const command = {
        action,
        sourceIds: group.sourceIds,
        canonicalId: draft.canonicalId || null,
        confirmation: action === 'approve'
          ? 'ACTIVAR_REGLA'
          : action === 'reject'
            ? 'RECHAZAR_GRUPO'
            : undefined,
        ruleKey: draft.ruleKey,
        ruleText: draft.ruleText,
        ruleType: draft.ruleType,
        validity: draft.validity,
        strength: draft.strength,
        validFrom: draft.validFrom || null,
        validTo: draft.validTo || null,
        mesocycleKey: draft.mesocycleKey || null,
        weekNumber: draft.weekNumber || null,
        dayOfWeek: draft.dayOfWeek || [],
        classTypes: String(draft.classTypesText || '')
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean),
        roomKey: draft.roomKey || null,
        timeSlot: draft.timeSlot || null,
        changeReason: draft.changeReason || `Revisión de ${group.label}`,
      }
      await submitMethodRuleReview(command)
      await onDone(action)
    } catch (e) {
      setError(e.message || 'No se pudo guardar la revisión.')
    } finally {
      setSaving(false)
    }
  }

  const disabled = saving || busy || group.sourceIds.length === 0

  return (
    <div className="fixed inset-0 z-50 bg-black/45 flex items-end sm:items-center justify-center p-0 sm:p-5" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl">
        <header className="sticky top-0 z-10 bg-white border-b px-5 py-4 flex items-start gap-3" style={{ borderColor: `${evoBrand.purple}22` }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: evoBrand.purple }}>Revisión por tema</p>
            <h2 className="font-evo-display text-xl font-bold mt-1" style={{ color: evoBrand.text }}>{group.label}</h2>
            <p className="text-xs mt-1" style={{ color: evoBrand.muted }}>
              {group.sourceIds.length} fuente(s) se resolverán juntas. Nada se activa al guardar como pendiente.
            </p>
          </div>
          <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: `${evoBrand.purple}33`, color: evoBrand.muted }}>Cerrar</button>
        </header>

        <div className="p-5 space-y-5">
          {group.conflict ? (
            <div className="rounded-2xl border px-4 py-3" style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' }}>
              <p className="text-xs font-bold uppercase tracking-wide mb-1">Contradicción detectada</p>
              <p className="text-sm">{group.conflict}</p>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-xl border px-4 py-3 text-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>{error}</div>
          ) : null}

          <section>
            <label className="block text-xs font-bold mb-1.5" style={{ color: evoBrand.text }}>Redacción canónica</label>
            <textarea
              value={draft.ruleText || ''}
              onChange={(e) => change('ruleText', e.target.value)}
              rows={5}
              className="w-full rounded-xl border px-3 py-2.5 text-sm leading-relaxed"
              style={{ borderColor: `${evoBrand.purple}44` }}
              placeholder="Escribe una única regla clara y aplicable…"
            />
          </section>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold" style={{ color: evoBrand.text }}>Clave del tema</span>
              <input value={draft.ruleKey || ''} onChange={(e) => change('ruleKey', e.target.value.toLowerCase().replace(/\s+/g, '_'))} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}44` }} placeholder="ejemplo_regla" />
            </label>
            <label className="block">
              <span className="text-xs font-bold" style={{ color: evoBrand.text }}>Tipo</span>
              <select value={draft.ruleType || 'format'} onChange={(e) => change('ruleType', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}44` }}>
                {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold" style={{ color: evoBrand.text }}>Vigencia</span>
              <select value={draft.validity || 'permanent'} onChange={(e) => change('validity', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}44` }}>
                {Object.entries(VALIDITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold" style={{ color: evoBrand.text }}>Fuerza</span>
              <select value={draft.strength || 'preferred'} onChange={(e) => change('strength', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}44` }}>
                {Object.entries(STRENGTH_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          {draft.validity !== 'permanent' ? (
            <div className="grid sm:grid-cols-2 gap-3 rounded-2xl border p-4" style={{ borderColor: `${evoBrand.purple}22`, backgroundColor: '#FCFAFC' }}>
              <label className="block">
                <span className="text-xs font-bold">Desde</span>
                <input type="date" value={draft.validFrom || ''} onChange={(e) => change('validFrom', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} />
              </label>
              <label className="block">
                <span className="text-xs font-bold">Hasta</span>
                <input type="date" value={draft.validTo || ''} onChange={(e) => change('validTo', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} />
              </label>
            </div>
          ) : null}

          <details className="rounded-2xl border" style={{ borderColor: `${evoBrand.purple}22` }}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold" style={{ color: evoBrand.purple }}>Alcance concreto (opcional)</summary>
            <div className="border-t px-4 py-4 space-y-4" style={{ borderColor: `${evoBrand.purple}22` }}>
              <div>
                <p className="text-xs font-bold mb-2">Días</p>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map(([day, label]) => (
                    <button key={day} type="button" onClick={() => toggleDay(day)} className="w-9 h-9 rounded-full border text-xs font-bold" style={(draft.dayOfWeek || []).includes(day) ? { backgroundColor: evoBrand.purple, borderColor: evoBrand.purple, color: 'white' } : { borderColor: `${evoBrand.purple}44`, color: evoBrand.purple }}>{label}</button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="block"><span className="text-xs font-bold">Modalidades</span><input value={draft.classTypesText || ''} onChange={(e) => change('classTypesText', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="evofuncional, evobasics" /></label>
                <label className="block"><span className="text-xs font-bold">Mesociclo</span><input value={draft.mesocycleKey || ''} onChange={(e) => change('mesocycleKey', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="fuerza" /></label>
                <label className="block"><span className="text-xs font-bold">Semana</span><input type="number" min="1" value={draft.weekNumber || ''} onChange={(e) => change('weekNumber', e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} /></label>
                <label className="block"><span className="text-xs font-bold">Sala</span><input value={draft.roomKey || ''} onChange={(e) => change('roomKey', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="sala_2" /></label>
                <label className="block"><span className="text-xs font-bold">Franja</span><input value={draft.timeSlot || ''} onChange={(e) => change('timeSlot', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="mañana" /></label>
                <label className="block"><span className="text-xs font-bold">Motivo del cambio</span><input value={draft.changeReason || ''} onChange={(e) => change('changeReason', e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="Qué estamos corrigiendo" /></label>
              </div>
            </div>
          </details>

          <details className="rounded-2xl border" style={{ borderColor: `${evoBrand.purple}22` }}>
            <summary className="cursor-pointer px-4 py-3 text-sm font-bold" style={{ color: evoBrand.purple }}>Ver {unresolvedRows.length} fuente(s) originales</summary>
            <div className="border-t p-3 space-y-2" style={{ borderColor: `${evoBrand.purple}22` }}>
              {unresolvedRows.map((row) => <SourceRow key={row.id} row={row} />)}
            </div>
          </details>

          {group.sourceIds.length === 0 ? (
            <p className="text-sm rounded-xl border px-3 py-2" style={{ color: '#92400E', backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }}>Este grupo ya no tiene fuentes pendientes sobre las que actuar.</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" disabled={disabled} onClick={() => submit('save_pending')} className="px-4 py-2.5 rounded-xl border text-sm font-bold disabled:opacity-40" style={{ borderColor: `${evoBrand.purple}55`, color: evoBrand.purple }}>{saving ? 'Guardando…' : 'Guardar pendiente'}</button>
            <button type="button" disabled={disabled} onClick={() => submit('approve')} className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: evoBrand.accent }}>Aprobar y activar</button>
            <button type="button" disabled={disabled} onClick={() => submit('reject')} className="px-4 py-2.5 rounded-xl border text-sm font-bold disabled:opacity-40" style={{ borderColor: '#FCA5A5', color: '#991B1B' }}>Rechazar grupo</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GroupCard({ group, onReview }) {
  const status = group.counts.unresolved > 0 ? 'pending_review' : group.counts.active > 0 ? 'active' : 'rejected'
  return (
    <article className="rounded-2xl border bg-white overflow-hidden" style={{ borderColor: `${evoBrand.purple}2E` }}>
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={badgeColors(status)}>{group.counts.unresolved > 0 ? `${group.counts.unresolved} por revisar` : STATUS_LABELS[status]}</span>
              {group.conflict && group.counts.unresolved > 0 ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFEDD5', color: '#9A3412' }}>Contradicción</span> : null}
            </div>
            <h2 className="font-evo-display text-lg font-bold" style={{ color: evoBrand.text }}>{group.label}</h2>
            <p className="text-xs mt-1 font-mono" style={{ color: evoBrand.muted }}>{group.ruleKey || 'Necesita una clave antes de aprobar'}</p>
          </div>
          <button type="button" onClick={() => onReview(group)} className="px-3 py-2 rounded-xl text-xs font-bold border hover:bg-black/5" style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.purple }}>{group.counts.unresolved > 0 ? 'Revisar' : 'Ver'}</button>
        </div>
        <p className="text-sm mt-3 leading-relaxed line-clamp-3" style={{ color: evoBrand.text }}>{group.defaultDraft.ruleText || 'Sin redacción propuesta.'}</p>
      </div>
      <div className="border-t px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px]" style={{ borderColor: `${evoBrand.purple}1F`, color: evoBrand.muted }}>
        <span>{group.counts.total} fuente(s)</span>
        <span>{group.counts.active} activa(s)</span>
        <span>{group.counts.rejected + group.counts.superseded} resuelta(s)</span>
      </div>
    </article>
  )
}

export default function MethodReviewCenter() {
  const [review, setReview] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('unresolved')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReview(await getMethodRuleReview())
    } catch (e) {
      setReview(null)
      setError({ code: e.code, message: e.message })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase()
    return (review?.groups || []).filter((group) => {
      if (filter === 'unresolved' && group.counts.unresolved === 0) return false
      if (filter === 'active' && group.counts.active === 0) return false
      if (filter === 'resolved' && group.counts.unresolved > 0) return false
      if (!query) return true
      return `${group.label} ${group.ruleKey || ''} ${group.defaultDraft.ruleText || ''}`.toLowerCase().includes(query)
    })
  }, [review, search, filter])

  async function handleDone() {
    setSelected(null)
    await load()
  }

  return (
    <div className="max-w-6xl">
      <header className="mb-6">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>ProgramingEvo · Método</p>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-evo-display text-3xl sm:text-4xl font-bold" style={{ color: evoBrand.text }}>Centro de revisión</h1>
            <p className="text-sm mt-2 max-w-2xl" style={{ color: evoBrand.muted }}>Las reglas se agrupan por tema. Puedes preparar una redacción sin activarla y aprobarla solo cuando esté clara.</p>
          </div>
          <button type="button" onClick={load} disabled={loading} className="px-4 py-2.5 rounded-xl border text-sm font-bold disabled:opacity-40" style={{ borderColor: `${evoBrand.purple}44`, color: evoBrand.purple }}>{loading ? 'Cargando…' : 'Recargar'}</button>
        </div>
      </header>

      {error?.code === 'migration_required' ? (
        <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: '#FFFFE2', borderColor: '#FACC15', color: evoBrand.text }}>
          <p className="font-bold">El centro está preparado, pero todavía no está conectado.</p>
          <p className="text-sm mt-1">Falta aplicar las migraciones de reglas en un entorno autorizado. No se ha modificado Supabase y ninguna regla se ha activado.</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border px-5 py-4" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>
          <p className="font-bold">No se pudo cargar el método.</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      ) : null}

      {review ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <SummaryCard label="Reglas" value={review.summary.total} />
            <SummaryCard label="Temas" value={review.summary.topics} />
            <SummaryCard label="Por revisar" value={review.summary.unresolved} tone="warning" />
            <SummaryCard label="Contradicciones" value={review.summary.conflicts} tone="warning" />
            <SummaryCard label="Activas" value={review.summary.active} tone="success" />
          </div>

          {!review.access?.includesUnscopedLegacy ? (
            <div className="rounded-xl border px-4 py-3 mb-5 text-sm" style={{ backgroundColor: '#FFF7ED', borderColor: '#FDBA74', color: '#9A3412' }}>
              Las reglas antiguas sin organización están ocultas por seguridad. Configura la organización EVO antes de revisarlas.
            </div>
          ) : null}

          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 rounded-xl border bg-white px-4 py-2.5 text-sm" style={{ borderColor: `${evoBrand.purple}33` }} placeholder="Buscar tema o regla…" />
            <div className="flex rounded-xl border bg-white p-1 overflow-x-auto" style={{ borderColor: `${evoBrand.purple}33` }}>
              {[['unresolved', 'Por revisar'], ['active', 'Activas'], ['resolved', 'Resueltas'], ['all', 'Todas']].map(([value, label]) => (
                <button key={value} type="button" onClick={() => setFilter(value)} className="whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold" style={filter === value ? { backgroundColor: evoBrand.purple, color: 'white' } : { color: evoBrand.muted }}>{label}</button>
              ))}
            </div>
          </div>

          {groups.length ? (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{groups.map((group) => <GroupCard key={group.id} group={group} onReview={setSelected} />)}</div>
          ) : (
            <div className="rounded-2xl border bg-white px-5 py-10 text-center text-sm" style={{ borderColor: `${evoBrand.purple}22`, color: evoBrand.muted }}>No hay temas que coincidan con este filtro.</div>
          )}
        </>
      ) : loading ? <p className="text-sm" style={{ color: evoBrand.muted }}>Agrupando reglas por temas…</p> : null}

      {selected ? <RuleEditor group={selected} busy={loading} onClose={() => setSelected(null)} onDone={handleDone} /> : null}
    </div>
  )
}
