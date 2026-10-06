import { useMemo, useState } from 'react'
import { coachBg, coachBorder, coachText } from './coachTheme.js'

function Badge({ children, tone = 'purple' }) {
  const classes = tone === 'green'
    ? 'border-emerald-300/35 bg-emerald-950/30 text-emerald-100'
    : tone === 'amber'
      ? 'border-amber-300/45 bg-amber-950/35 text-amber-100'
      : 'border-[#A729AD]/55 bg-[#6A1F6D]/20 text-[#E7B8EA]'
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${classes}`}>{children}</span>
}

function formatTime(value) {
  if (!value) return 'Pendiente de confirmar'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Pendiente de confirmar'
  return date.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
}

function EmptyState({ children }) {
  return <div className={`rounded-2xl border ${coachBorder} ${coachBg.card} p-6 text-sm leading-relaxed ${coachText.muted}`}>{children}</div>
}

/**
 * Panel de lectura. Los datos llegan exclusivamente desde listCoachOperations:
 * no contiene casos de muestra ni permite editar reservas o fichas WodBuster.
 */
export default function CoachNewPeoplePanel({ onOpenFeedback, dashboard = null, loading = false, error = '' }) {
  const handoffs = useMemo(() => (dashboard?.people || []).map((person) => ({
    id: person.reference,
    phase: person.phase || 'Acompañamiento',
    time: formatTime(person.sessionAt),
    person: person.reference,
    status: person.phase === 'Clase de prueba' ? 'Prueba asignada' : 'Continuidad',
    objective: person.objective,
    experience: person.experience,
    context: person.context,
    precaution: person.precaution,
    observe: person.observe,
    close: person.close,
    timeline: person.timeline || [],
  })), [dashboard])
  const [selectedId, setSelectedId] = useState('')
  const [readIds, setReadIds] = useState([])
  const selected = handoffs.find((item) => item.id === selectedId) || handoffs[0]
  const isRead = selected ? readIds.includes(selected.id) : false
  const markRead = () => {
    if (!selected) return
    setReadIds((current) => (current.includes(selected.id) ? current : [...current, selected.id]))
  }

  if (loading) return <EmptyState>Actualizando tus clases de prueba e incorporaciones…</EmptyState>
  if (error) return <EmptyState>Para mostrar personas nuevas, entra con tu cuenta individual de EVO. El código compartido sirve para consultar programación, pero no abre datos de personas.</EmptyState>
  if (!dashboard) return <EmptyState>La conexión está preparada. Cuando WodBuster entregue una prueba o incorporación asignada a tu cuenta, aparecerá aquí.</EmptyState>
  if (!handoffs.length) return <EmptyState>No tienes ninguna clase de prueba ni incorporación asignada ahora. Esta pantalla se actualizará cuando haya una asignación real desde WodBuster.</EmptyState>

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-5 pb-8 space-y-5">
      <header className={`rounded-2xl border ${coachBorder} ${coachBg.card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#FFFF4C]">Personas nuevas</p>
            <h2 className={`mt-1 text-xl font-evo-display font-bold ${coachText.primary}`}>Lo que necesitas saber antes de recibirlas</h2>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${coachText.muted}`}>Solo el relevo útil de tu clase. Sin pagos, teléfonos, conversaciones completas ni diagnósticos.</p>
          </div>
          <Badge tone="green">Actualizado desde WodBuster</Badge>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.6fr)]">
        <aside className={`rounded-2xl border ${coachBorder} ${coachBg.card} overflow-hidden`} aria-label="Personas asignadas">
          <div className="border-b border-[#6A1F6D]/35 px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F9]/65">Próximas sesiones</p></div>
          <div className="p-2 space-y-1.5">
            {handoffs.map((item) => {
              const active = item.id === selected?.id
              const read = readIds.includes(item.id)
              return <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${active ? 'border-[#A729AD] bg-[#6A1F6D]/25' : 'border-transparent hover:border-[#6A1F6D]/45 hover:bg-[#6A1F6D]/10'}`}>
                <div className="flex items-start justify-between gap-2"><span className="text-xs font-bold text-white">{item.person}</span>{read ? <span className="text-[10px] text-emerald-200">Leído</span> : <span className="h-2 w-2 rounded-full bg-[#FFFF4C]" aria-label="Pendiente" />}</div>
                <p className="mt-1 text-[11px] font-semibold text-[#D79BDD]">{item.phase}</p><p className="mt-1 text-[11px] text-[#F6E8F9]/65">{item.time}</p>
              </button>
            })}
          </div>
        </aside>

        <article className={`rounded-2xl border ${coachBorder} ${coachBg.card} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">{selected.phase}</p><h3 className={`mt-1 text-xl font-extrabold ${coachText.primary}`}>{selected.person}</h3><p className={`mt-1 text-sm ${coachText.muted}`}>{selected.time}</p></div>
            <Badge tone={isRead ? 'green' : 'purple'}>{isRead ? 'Relevo leído' : selected.status}</Badge>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            {selected.objective ? <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3"><dt className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F9]/55">Objetivo</dt><dd className="mt-1.5 text-sm leading-relaxed text-[#F6E8F9]">{selected.objective}</dd></div> : null}
            {selected.experience ? <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3"><dt className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F9]/55">Experiencia</dt><dd className="mt-1.5 text-sm leading-relaxed text-[#F6E8F9]">{selected.experience}</dd></div> : null}
            {selected.context ? <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F9]/55">Contexto útil</dt><dd className="mt-1.5 text-sm leading-relaxed text-[#F6E8F9]">{selected.context}</dd></div> : null}
            {selected.precaution ? <div className="rounded-xl border border-amber-300/35 bg-amber-950/25 px-3 py-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-widest text-amber-200">Precaución para esta sesión</dt><dd className="mt-1.5 text-sm leading-relaxed text-amber-50">{selected.precaution}</dd></div> : null}
            {selected.observe ? <div className="rounded-xl border border-[#A729AD]/35 bg-[#6A1F6D]/10 px-3 py-3 sm:col-span-2"><dt className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Qué observar</dt><dd className="mt-1.5 text-sm leading-relaxed text-[#F6E8F9]">{selected.observe}</dd></div> : null}
          </dl>
          {selected.close ? <div className="mt-5 rounded-xl border border-emerald-300/25 bg-emerald-950/20 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-200">Al terminar</p><p className="mt-1.5 text-sm leading-relaxed text-emerald-50">{selected.close}</p></div> : null}
          {selected.timeline?.length ? <div className="mt-3 rounded-xl border border-white/10 bg-black/10 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-widest text-[#D79BDD]">Evolución útil del equipo</p><div className="mt-2 space-y-2">{selected.timeline.map((item) => <p key={`${item.occurredAt}:${item.coach}`} className="text-sm leading-relaxed text-[#F6E8F9]"><strong className="text-[#FFFF4C]">{item.coach}:</strong> {item.text}</p>)}</div></div> : null}
          <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={markRead} className="rounded-xl bg-[#A729AD] px-4 py-3 text-xs font-bold uppercase tracking-widest text-white hover:bg-[#6A1F6D]">{isRead ? 'Leído' : 'Marcar como leído'}</button>{selected.phase === 'Clase de prueba' ? <button type="button" onClick={onOpenFeedback} className="rounded-xl border border-[#FFFF4C]/60 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#FFFF4C] hover:bg-[#FFFF4C]/10">Abrir cierre de prueba</button> : null}</div>
        </article>
      </div>
    </section>
  )
}
