import { useEffect, useMemo, useState } from 'react'
import { evoBrand } from '../../constants/evoBrand.js'

function planSessions(plan) {
  return Array.isArray(plan?.sessions) ? plan.sessions : []
}

export default function Pe2WeeklyDraftBoard({ plan, saving = false, onChange, onSave }) {
  const sessions = planSessions(plan)
  const [selectedId, setSelectedId] = useState(() => sessions[0]?.sourceId || null)

  useEffect(() => {
    if (!sessions.some((session) => session.sourceId === selectedId)) {
      setSelectedId(sessions[0]?.sourceId || null)
    }
  }, [plan, selectedId, sessions])

  const selected = useMemo(
    () => sessions.find((session) => session.sourceId === selectedId) || sessions[0] || null,
    [selectedId, sessions],
  )

  const updateSelected = (patch) => {
    if (!selected) return
    onChange?.({
      ...plan,
      sessions: sessions.map((session) => (
        session.sourceId === selected.sourceId ? { ...session, ...patch } : session
      )),
    })
  }

  if (!plan) {
    return (
      <section className="rounded-2xl border border-dashed p-5" style={{ borderColor: evoBrand.border }}>
        <p className="text-sm font-bold" style={{ color: evoBrand.text }}>Plan semanal pendiente</p>
        <p className="mt-1 text-sm" style={{ color: evoBrand.muted }}>
          Revisa un Excel de Programming y conviértelo en borrador para editar toda la semana desde aquí. No se publica ni se envía al equipo.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: evoBrand.border }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.accent }}>
            Borrador semanal editable
          </p>
          <h2 className="mt-1 font-evo-display text-xl font-bold" style={{ color: evoBrand.text }}>
            Todas las clases de la semana
          </h2>
          <p className="mt-1 text-sm" style={{ color: evoBrand.muted }}>
            Cada clase se edita aquí como parte del mismo plan. Guardar solo actualiza este borrador; no publica ni modifica Programming clásico.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {saving ? 'Guardando…' : 'Guardar borrador semanal'}
        </button>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
          {sessions.map((session) => {
            const active = session.sourceId === selected?.sourceId
            return (
              <button
                key={session.sourceId}
                type="button"
                onClick={() => setSelectedId(session.sourceId)}
                className="rounded-xl border px-3 py-3 text-left"
                style={{
                  borderColor: active ? evoBrand.accent : evoBrand.border,
                  backgroundColor: active ? '#FAF7FC' : 'transparent',
                  color: evoBrand.text,
                }}
              >
                <span className="block text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: evoBrand.accent }}>
                  {session.dayName} · {session.classType}
                </span>
                <strong className="mt-1 block text-sm">{session.title}</strong>
              </button>
            )
          })}
        </div>

        {selected ? (
          <div className="rounded-xl border p-4" style={{ borderColor: evoBrand.border, backgroundColor: '#FAF7FC' }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: evoBrand.accent }}>
              Clase dentro de la semana
            </p>
            <label className="mt-3 grid gap-1.5">
              <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>Título para el equipo</span>
              <input
                value={selected.title || ''}
                onChange={(event) => updateSelected({ title: event.target.value })}
                maxLength={180}
                className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
                style={{ borderColor: evoBrand.border, color: evoBrand.text }}
              />
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>Programación</span>
              <textarea
                value={selected.programming || ''}
                onChange={(event) => updateSelected({ programming: event.target.value })}
                rows={11}
                maxLength={12000}
                className="w-full rounded-xl border px-3 py-2 text-sm leading-6 outline-none"
                style={{ borderColor: evoBrand.border, color: evoBrand.text }}
              />
            </label>
            <label className="mt-3 grid gap-1.5">
              <span className="text-sm font-semibold" style={{ color: evoBrand.text }}>Nota para entrenadores</span>
              <textarea
                value={selected.feedback || ''}
                onChange={(event) => updateSelected({ feedback: event.target.value })}
                rows={4}
                maxLength={5000}
                placeholder="Solo si hay algo que el equipo debe saber en esta clase."
                className="w-full rounded-xl border px-3 py-2 text-sm leading-6 outline-none"
                style={{ borderColor: evoBrand.border, color: evoBrand.text }}
              />
            </label>
          </div>
        ) : null}
      </div>

      <p className="mt-4 text-xs" style={{ color: evoBrand.muted }}>
        {sessions.length} clase(s) en este borrador semanal{plan.sourceFile ? ` · origen: ${plan.sourceFile}` : ''}.
      </p>
    </section>
  )
}
