import { useMemo, useState } from 'react'
import EvoLogo from './components/EvoLogo.jsx'
import Icon from './components/Incorporaciones/Icons.jsx'
import StatusBadge from './components/Incorporaciones/StatusBadge.jsx'
import {
  briefing,
  endOfShiftItems,
  evaluations,
  evolutionSummary,
  firstClassResults,
  operationalExceptions,
  protocols,
  quickActions,
  shifts,
  shiftTasks,
  specialNotices,
  teamOverview,
} from './mocks/incorporaciones/data.js'

const trainerGlobalNavigation = [
  { id: 'programming', label: 'Programación', icon: 'class' },
  { id: 'shift', label: 'Mi turno', icon: 'today' },
]

const shiftNavigation = [
  { id: 'today', label: 'Hoy' },
  { id: 'protocols', label: 'Protocolos' },
  { id: 'evolution', label: 'Mi evolución' },
]

const directionNavigation = [
  { id: 'programming', label: 'Programación', icon: 'class' },
  { id: 'operations', label: 'Operativa', icon: 'incidents' },
  { id: 'evaluations', label: 'Evaluaciones', icon: 'exceptions' },
  { id: 'team', label: 'Equipo', icon: 'followups' },
]

const statusLabels = {
  pending: 'Pendiente',
  completed: 'Completado',
  overdue: 'Vencido',
  exception: 'Atención',
  empty: 'Más tarde',
}

function PrimaryButton({ children, onClick, icon = 'arrow', className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#A729AD] px-5 py-3 text-base font-extrabold text-white shadow-[0_14px_35px_rgba(167,41,173,0.24)] transition hover:bg-[#BC35C3] focus:outline-none focus:ring-2 focus:ring-[#FFFF4C] focus:ring-offset-2 focus:ring-offset-[#0C0B0C] active:scale-[0.99] ${className}`}
    >
      {children}
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}

function QuickActionButton({ children, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/12 bg-white/[0.035] px-4 py-3 text-left text-base font-bold text-white/80 transition hover:border-[#A729AD]/70 hover:bg-[#A729AD]/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70">
      <Icon name={icon} className="h-5 w-5 shrink-0 text-[#C86CCE]" />
      <span>{children}</span>
    </button>
  )
}

function LightCard({ children, className = '' }) {
  return <div className={`rounded-[1.5rem] border border-[#E4D8E5] bg-[#FBF8FB] p-5 text-[#241526] shadow-[0_18px_55px_rgba(34,20,39,0.08)] sm:p-6 ${className}`}>{children}</div>
}

function ScreenHeading({ eyebrow, title, detail }) {
  return (
    <div className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#A729AD]/30 bg-[#A729AD]/10 px-3 py-1 text-base font-bold text-[#E48AE9]">Sandbox Fase 1</span>
        <span className="text-base font-semibold text-white/50">Datos ficticios</span>
      </div>
      <p className="text-base font-bold text-[#C86CCE]">{eyebrow}</p>
      <h1 className="mt-1 font-evo-display text-4xl font-semibold tracking-wide text-white sm:text-5xl">{title}</h1>
      {detail && <p className="mt-2 max-w-2xl text-base leading-7 text-white/65">{detail}</p>}
    </div>
  )
}

function ProgrammingReference({ returnLabel, onReturn }) {
  return (
    <div>
      <ScreenHeading eyebrow="Programming EVO" title="Programación" detail="Área existente del mismo producto. Este sandbox no la reconstruye ni la modifica." />
      <LightCard className="max-w-2xl">
        <p className="font-evo-display text-3xl font-semibold">La programación continúa donde ya está</p>
        <p className="mt-3 text-base leading-7 text-[#604B63]">Entrenamiento del día, notas, objetivo, estímulo, preparación de clase y feedback de sesión permanecen en la funcionalidad actual.</p>
        <div className="mt-6"><PrimaryButton onClick={onReturn}>Volver a {returnLabel}</PrimaryButton></div>
      </LightCard>
    </div>
  )
}

function ActionDialog({ action, onClose }) {
  const [selectedResult, setSelectedResult] = useState(firstClassResults[0])
  const [firstClassNotes, setFirstClassNotes] = useState({ load: '', technique: '', sensations: '' })
  const [completed, setCompleted] = useState(false)

  const content = {
    incident: ['Registrar incidencia', 'Describe visualmente una situación especial. No se guarda ni se envía información.'],
    feedback: ['Feedback operativo del turno', 'Incidencia, seguimiento o relevo. Se mantiene separado del feedback del alumno y de la primera clase.'],
    'first-class': ['Cerrar primera clase', 'Deja el resultado del caso y tres notas prácticas para los próximos entrenadores.'],
    handover: ['Dejar relevo', 'Transfiere únicamente pendientes e incidencias que necesitan atención.'],
    briefing: ['Briefing especial', 'Dato mínimo para actuar; la ficha general permanece en WodBuster.'],
  }[action] || ['Acción simulada', 'Esta acción es completamente local y ficticia.']

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="action-title" className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[1.7rem] bg-[#FBF8FB] p-5 text-[#241526] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-base font-bold text-[#A729AD]">{action === 'first-class' ? 'Feedback del alumno · Primera clase' : 'Acción local ficticia'}</p><h2 id="action-title" className="mt-1 font-evo-display text-3xl font-semibold">{content[0]}</h2></div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#604B63] hover:bg-[#EEE5EF]">Cerrar</button>
        </div>
        <p className="mt-3 text-base leading-7 text-[#604B63]">{content[1]}</p>

        {(action === 'briefing' || action === 'first-class') && (
          <dl className="mt-5 divide-y divide-[#E4D8E5] rounded-2xl border border-[#E4D8E5] bg-white px-4">
            {[['Persona nueva', `${briefing.person} · ${briefing.time}`], ['Objetivo', briefing.objective], ['Adaptación relevante', briefing.restriction], ['Preparación', briefing.preparation]].map(([label, value]) => (
              <div key={label} className="py-4"><dt className="text-base font-bold text-[#A729AD]">{label}</dt><dd className="mt-1 text-base leading-7 text-[#4C3A4F]">{value}</dd></div>
            ))}
          </dl>
        )}

        {action === 'first-class' && (
          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className="text-base font-bold text-[#6A1F6D]">1 · Claves para futuros entrenadores</legend>
              <p className="mt-1 text-base leading-7 text-[#806E82]">Notas breves sobre esta primera clase. No son feedback operativo del turno.</p>
              <div className="mt-4 space-y-4">
                <label className="block text-base font-bold text-[#3E2941]">¿Qué cargas o nivel manejó?
                  <textarea rows="2" maxLength="180" value={firstClassNotes.load} onChange={(event) => setFirstClassNotes((notes) => ({ ...notes, load: event.target.value }))} placeholder="Ej. mancuernas de 6 kg · nivel inicial" className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
                  <span className="mt-1 flex justify-between gap-3 text-base font-normal text-[#806E82]"><span>Máximo recomendado: 180 caracteres</span><span>{firstClassNotes.load.length}/180</span></span>
                </label>
                <label className="block text-base font-bold text-[#3E2941]">¿Qué observaste en su coordinación y técnica?
                  <textarea rows="2" maxLength="180" value={firstClassNotes.technique} onChange={(event) => setFirstClassNotes((notes) => ({ ...notes, technique: event.target.value }))} placeholder="Ej. coordina bien · repetir patrón de bisagra" className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
                  <span className="mt-1 flex justify-between gap-3 text-base font-normal text-[#806E82]"><span>Máximo recomendado: 180 caracteres</span><span>{firstClassNotes.technique.length}/180</span></span>
                </label>
                <label className="block text-base font-bold text-[#3E2941]">¿Qué debe saber el próximo entrenador?
                  <textarea rows="2" maxLength="180" value={firstClassNotes.sensations} onChange={(event) => setFirstClassNotes((notes) => ({ ...notes, sensations: event.target.value }))} placeholder="Ej. se sintió cómodo · vigilar muñeca derecha" className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
                  <span className="mt-1 flex justify-between gap-3 text-base font-normal text-[#806E82]"><span>Máximo recomendado: 180 caracteres</span><span>{firstClassNotes.sensations.length}/180</span></span>
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-base font-bold text-[#6A1F6D]">2 · Resultado operativo del caso</legend>
              <div className="mt-3 space-y-2" role="radiogroup" aria-label="Resultado operativo de primera clase">
                {firstClassResults.map((result) => <button key={result} type="button" role="radio" aria-checked={selectedResult === result} onClick={() => setSelectedResult(result)} className={`min-h-12 w-full rounded-xl border px-4 py-3 text-left text-base font-bold ${selectedResult === result ? 'border-[#A729AD] bg-[#F4E6F5]' : 'border-[#E4D8E5] bg-white'}`}>{result}</button>)}
              </div>
            </fieldset>
          </div>
        )}

        <div className="mt-6"><PrimaryButton icon="check" onClick={() => setCompleted(true)}>{action === 'first-class' ? 'Guardar cierre simulado' : 'Confirmar acción simulada'}</PrimaryButton></div>
        {completed && <p role="status" className="mt-4 rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 text-base font-semibold text-emerald-800">{action === 'first-class' ? `${selectedResult}. Notas prácticas registradas visualmente.` : 'Acción completada visualmente.'} No se ha guardado ningún dato.</p>}
      </div>
    </div>
  )
}

function TodayScreen({ onAction, onOpenProtocol }) {
  const [shift, setShift] = useState('morning')
  const [mainTaskDone, setMainTaskDone] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [wodMessage, setWodMessage] = useState(false)
  const data = shifts[shift]

  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Hoy" title="Lo que necesita acción" detail="Cinco bloques breves. Solo excepciones y acciones del turno." />
      {wodMessage && <p role="status" className="mb-4 rounded-xl border border-[#FFFF4C]/30 bg-[#FFFF4C]/10 p-4 text-base text-[#FFFFB3]">En producción, este enlace abriría WodBuster. En el sandbox no navega ni realiza peticiones.</p>}

      <div className="space-y-5">
        <section aria-label="Resumen del turno" className="rounded-2xl border border-[#A729AD]/30 bg-[#1B121C] p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-base font-bold text-[#FFFF4C]">Turno actual</p><div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-evo-display text-2xl font-semibold text-white">{data.label} · {data.time}</h2><span className="text-base text-white/65">{data.entry}</span></div></div>
            <div className="flex rounded-xl border border-white/15 bg-black/20 p-1 sm:w-auto" aria-label="Seleccionar turno">
              {Object.entries(shifts).map(([id, option]) => <button key={id} type="button" aria-pressed={shift === id} onClick={() => setShift(id)} className={`min-h-12 flex-1 rounded-lg px-4 text-base font-extrabold ${shift === id ? 'bg-white text-[#241526]' : 'text-white/65'}`}>{option.label}</button>)}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#A729AD] to-[#FFFF4C]" style={{ width: `${data.progress}%` }} /></div><strong className="text-base text-white">{data.progress}%</strong></div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-base font-bold text-[#C86CCE]">Ahora</p><h2 className="font-evo-display text-3xl font-semibold text-white">Tres tareas</h2></div><span className="text-base text-white/45">1 prioritaria</span></div>
          <LightCard className="divide-y divide-[#E4D8E5] !p-0">
            {shiftTasks.map((task) => (
              <div key={task.id} className={`p-4 sm:p-5 ${task.primary ? 'bg-[#FBF0FC]' : ''}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-evo-display text-xl font-semibold">{task.title}</h3><StatusBadge status={mainTaskDone && task.primary ? 'completed' : task.status}>{mainTaskDone && task.primary ? 'Hecho' : statusLabels[task.status]}</StatusBadge></div><p className="mt-1 text-base leading-6 text-[#604B63]">{task.detail}</p></div>{task.primary && <div className="w-full shrink-0 sm:w-56"><PrimaryButton icon="check" onClick={() => setMainTaskDone(true)}>{mainTaskDone ? 'Confirmada' : 'Confirmar apertura'}</PrimaryButton></div>}{task.id === 'briefing' && <button type="button" onClick={() => onAction('briefing')} className="min-h-12 shrink-0 text-left text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Abrir briefing</button>}</div>
                {task.primary && <button type="button" onClick={() => onOpenProtocol('opening')} className="mt-2 min-h-11 text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Ver protocolo de apertura</button>}
              </div>
            ))}
          </LightCard>
        </section>

        <section>
          <div className="mb-3"><p className="text-base font-bold text-[#C86CCE]">Casos especiales de hoy</p><h2 className="font-evo-display text-3xl font-semibold text-white">Solo lo que debes saber</h2></div>
          <div className="overflow-hidden rounded-2xl border border-[#E4D8E5] bg-[#FBF8FB] text-[#241526]">{specialNotices.map((notice) => <div key={notice.type} className="flex flex-col gap-2 border-b border-[#E4D8E5] px-4 py-3 last:border-0 sm:flex-row sm:items-center"><div className="flex items-center gap-3 sm:w-56"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${notice.status === 'overdue' ? 'bg-rose-500' : notice.status === 'exception' ? 'bg-fuchsia-500' : 'bg-amber-500'}`} /><p className="text-base font-bold text-[#6A1F6D]">{notice.type}</p></div><div className="min-w-0 flex-1"><p className="text-base font-bold">{notice.title}</p><p className="mt-0.5 text-base leading-6 text-[#604B63]">{notice.detail}</p></div></div>)}</div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-base font-bold text-[#C86CCE]">Registrar</p><h2 className="font-evo-display text-3xl font-semibold text-white">Acciones rápidas</h2></div><button type="button" onClick={() => setWodMessage(true)} className="min-h-11 text-base font-bold text-[#FFFF4C] underline underline-offset-4">Abrir WodBuster</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{quickActions.map((action) => <QuickActionButton key={action.id} icon={action.icon} onClick={() => onAction(action.id)}>{action.label}</QuickActionButton>)}</div>
        </section>

        <section className="rounded-[1.5rem] border border-white/10 bg-[#171217] p-5 sm:p-6">
          <button type="button" onClick={() => setEndOpen((value) => !value)} aria-expanded={endOpen} className="flex min-h-12 w-full items-center justify-between gap-4 text-left"><span><span className="block text-base font-bold text-[#C86CCE]">Fin del turno</span><span className="mt-1 block font-evo-display text-2xl font-semibold text-white">Caja, sala, relevo y cierre</span></span><Icon name={endOpen ? 'back' : 'arrow'} className={`h-6 w-6 text-[#FFFF4C] ${endOpen ? 'rotate-90' : ''}`} /></button>
          {endOpen && <div className="mt-5 space-y-2">{endOfShiftItems.map((item) => <div key={item.label} className="flex flex-col gap-2 rounded-xl border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-base font-bold text-white">{item.label}</p><p className="mt-1 text-base text-white/60">{item.value}</p></div><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div>)}<div className="pt-3"><button type="button" onClick={() => onAction('handover')} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/20 px-4 text-base font-bold text-white hover:bg-white/5">Completar relevo o cierre <Icon name="arrow" className="h-5 w-5 text-[#FFFF4C]" /></button></div></div>}
        </section>
      </div>
    </div>
  )
}

function ProtocolsScreen({ initialProtocol }) {
  const [activeProtocol, setActiveProtocol] = useState(initialProtocol)
  const [documentMessage, setDocumentMessage] = useState(false)
  const selected = protocols.find((protocol) => protocol.id === activeProtocol)

  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Protocolos" title="Biblioteca operativa" detail="Resúmenes breves para consultar desde aquí o desde una tarea contextual." />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {protocols.map((protocol) => <button key={protocol.id} type="button" onClick={() => setActiveProtocol(protocol.id === activeProtocol ? null : protocol.id)} aria-expanded={protocol.id === activeProtocol} className={`rounded-[1.4rem] border p-5 text-left transition ${protocol.id === activeProtocol ? 'border-[#A729AD] bg-[#F5EAF6]' : 'border-[#E4D8E5] bg-[#FBF8FB] hover:border-[#A729AD]'}`}><p className="text-base font-bold text-[#A729AD]">Protocolo</p><h2 className="mt-1 font-evo-display text-2xl font-semibold text-[#241526]">{protocol.title}</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{protocol.summary}</p></button>)}
      </div>
      {selected && <LightCard className="mt-5"><p className="text-base font-bold text-[#A729AD]">Resumen esencial</p><h2 className="mt-1 font-evo-display text-3xl font-semibold">{selected.title}</h2><ol className="mt-5 space-y-3">{selected.steps.map((step, index) => <li key={step} className="flex gap-3 text-base leading-7 text-[#4C3A4F]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE1EF] font-bold text-[#6A1F6D]">{index + 1}</span><span>{step}</span></li>)}</ol><button type="button" onClick={() => setDocumentMessage(true)} className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Abrir documento oficial <Icon name="arrow" className="h-5 w-5" /></button><p className="mt-2 text-base text-[#806E82]">Enlace ficticio; no se abre ningún documento.</p>{documentMessage && <p role="status" className="mt-3 rounded-xl bg-[#F0E7F1] p-3 text-base font-semibold text-[#6A1F6D]">El documento oficial se abriría aquí en una fase posterior.</p>}</LightCard>}
    </div>
  )
}

function EvolutionScreen() {
  const [showDetail, setShowDetail] = useState(false)
  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Mi evolución" title="Una lectura breve" detail="Operativa diaria separada de la evaluación de calidad de clase." />
      <div className="grid gap-3 md:grid-cols-2">{evolutionSummary.slice(0, showDetail ? evolutionSummary.length : 3).map((item) => <LightCard key={item.label}><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 font-evo-display text-3xl font-semibold">{item.value}</p><p className="mt-2 text-base text-[#604B63]">{item.detail}</p></LightCard>)}</div>
      {!showDetail && <button type="button" onClick={() => setShowDetail(true)} className="mt-5 min-h-12 text-base font-bold text-[#FFFF4C] underline underline-offset-4">Ver evaluación y foco de mejora</button>}
    </div>
  )
}

function OperationsScreen() {
  const [focused, setFocused] = useState(false)
  return (
    <div><ScreenHeading eyebrow="Dirección · Operativa" title="Solo excepciones" detail="La actividad rutinaria desaparece de esta vista." /><div className="grid gap-3 md:grid-cols-2">{operationalExceptions.map((item, index) => <LightCard key={`${item.label}-${item.owner}`} className={index === 1 ? 'ring-2 ring-rose-400' : ''}><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 text-base leading-7 text-[#4C3A4F]">{item.detail}</p><p className="mt-2 text-base font-semibold text-[#806E82]">{item.owner}</p>{index === 1 && <div className="mt-5"><PrimaryButton onClick={() => setFocused(true)}>Localizar excepción prioritaria</PrimaryButton>{focused && <p role="status" className="mt-3 text-base font-semibold text-emerald-700">Excepción localizada visualmente.</p>}</div>}</LightCard>)}</div></div>
  )
}

function EvaluationsScreen() {
  return (
    <div><ScreenHeading eyebrow="Dirección · Evaluaciones" title="Dos lecturas distintas" detail="El cumplimiento operativo no se confunde con la calidad de clase." /><div className="grid gap-5 xl:grid-cols-2"><LightCard><p className="text-base font-bold text-[#A729AD]">A · Cumplimiento operativo y protocolos</p><div className="mt-5 space-y-4">{evaluations.operations.map((item) => <div key={item.label} className="border-b border-[#E4D8E5] pb-4 last:border-0"><div className="flex items-center justify-between gap-3"><p className="text-base font-bold">{item.label}</p><strong className="text-xl text-[#6A1F6D]">{item.value}</strong></div><p className="mt-1 text-base text-[#604B63]">{item.detail}</p></div>)}</div></LightCard><LightCard><p className="text-base font-bold text-[#A729AD]">B · Calidad de clase</p><h2 className="mt-3 font-evo-display text-3xl font-semibold">{evaluations.quality.result}</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{evaluations.quality.detail}</p><ul className="mt-5 space-y-3">{evaluations.quality.criteria.map((criterion) => <li key={criterion} className="rounded-xl bg-[#F0E7F1] p-3 text-base font-semibold">{criterion}</li>)}</ul><p className="mt-4 text-base font-semibold text-[#806E82]">Referencia de evaluación; no son tareas diarias del entrenador.</p></LightCard></div></div>
  )
}

function TeamScreen() {
  return (
    <div><ScreenHeading eyebrow="Dirección · Equipo" title="Evolución del equipo" detail="Última evaluación, tendencia y un foco útil por entrenador." /><div className="space-y-3">{teamOverview.map((person) => <LightCard key={person.name}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-3"><h2 className="font-evo-display text-3xl font-semibold">{person.name}</h2><StatusBadge status={person.status}>{person.lastEvaluation}</StatusBadge></div><p className="mt-2 text-base text-[#604B63]">Tendencia: <strong>{person.trend}</strong></p></div><div className="grid gap-3 sm:grid-cols-2 lg:w-1/2"><div className="rounded-xl bg-[#F0E7F1] p-4"><p className="text-base font-bold text-[#A729AD]">Incumplimiento repetido</p><p className="mt-1 text-base">{person.repeated}</p></div><div className="rounded-xl bg-[#F0E7F1] p-4"><p className="text-base font-bold text-[#A729AD]">Foco de formación</p><p className="mt-1 text-base">{person.focus}</p></div></div></div></LightCard>)}</div></div>
  )
}

export default function IncorporacionesApp() {
  const [context, setContext] = useState('coach')
  const [globalArea, setGlobalArea] = useState('shift')
  const [shiftArea, setShiftArea] = useState('today')
  const [protocolToOpen, setProtocolToOpen] = useState(null)
  const [action, setAction] = useState(null)

  const globalNavigation = context === 'coach' ? trainerGlobalNavigation : directionNavigation
  const activeGlobal = context === 'coach' ? globalArea : globalArea
  const screen = useMemo(() => {
    if (activeGlobal === 'programming') return <ProgrammingReference returnLabel={context === 'coach' ? 'Mi turno' : 'Operativa'} onReturn={() => setGlobalArea(context === 'coach' ? 'shift' : 'operations')} />
    if (context === 'coach') {
      if (shiftArea === 'protocols') return <ProtocolsScreen initialProtocol={protocolToOpen} />
      if (shiftArea === 'evolution') return <EvolutionScreen />
      return <TodayScreen onAction={setAction} onOpenProtocol={(protocolId) => { setProtocolToOpen(protocolId); setShiftArea('protocols') }} />
    }
    if (activeGlobal === 'evaluations') return <EvaluationsScreen />
    if (activeGlobal === 'team') return <TeamScreen />
    return <OperationsScreen />
  }, [activeGlobal, context, protocolToOpen, shiftArea])

  function changeContext(nextContext) {
    setContext(nextContext)
    setGlobalArea(nextContext === 'coach' ? 'shift' : 'operations')
    setShiftArea('today')
  }

  return (
    <div className="min-h-[100dvh] bg-[#0C0B0C] font-evo-body text-[#F6E8F9] selection:bg-[#A729AD]/40">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,41,173,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(106,31,109,0.11),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1480px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col border-r border-white/10 bg-[#0C0B0C]/92 px-5 py-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3 px-2"><EvoLogo imgClassName="h-10 w-auto object-contain" /><div><p className="font-evo-display text-xl font-bold uppercase tracking-[0.12em] text-white">Programming EVO</p><p className="text-base font-bold text-[#C86CCE]">Entrenador y operativa</p></div></div>
          <nav aria-label={`Áreas de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="mt-10 space-y-2">
            {globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-bold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 ${activeGlobal === item.id ? 'bg-[#A729AD] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}><Icon name={item.icon} className="h-5 w-5" />{item.label}</button>)}
          </nav>
          {context === 'coach' && activeGlobal === 'shift' && <nav aria-label="Áreas de Mi turno" className="mt-5 border-l border-white/15 pl-4">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-12 w-full rounded-xl px-3 text-left text-base font-semibold ${shiftArea === item.id ? 'bg-white/10 text-[#FFFF4C]' : 'text-white/55 hover:text-white'}`}>{item.label}</button>)}</nav>}
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-base font-bold text-[#FFFF4C]">Sandbox local</p><p className="mt-2 text-base leading-6 text-white/55">Ruta temporal · Datos ficticios · Sin conexión</p></div>
        </aside>

        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0C0B0C]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2.5 lg:hidden"><EvoLogo imgClassName="h-9 w-auto object-contain" /><div className="min-w-0"><p className="truncate font-evo-display text-lg font-bold uppercase text-white">Programming EVO</p><p className="truncate text-base font-semibold text-[#C86CCE]">Sandbox temporal</p></div></div>
              <div className="flex w-full rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:ml-auto sm:w-auto" aria-label="Cambiar contexto">{[['coach', 'Entrenador'], ['direction', 'Dirección']].map(([id, label]) => <button key={id} type="button" aria-pressed={context === id} onClick={() => changeContext(id)} className={`min-h-12 flex-1 rounded-lg px-3 text-base font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 sm:flex-none sm:px-4 ${context === id ? 'bg-white text-[#241526]' : 'text-white/60 hover:text-white'}`}>{label}</button>)}</div>
            </div>
            {context === 'coach' && activeGlobal === 'shift' && <nav aria-label="Secciones de Mi turno" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto lg:hidden">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-12 shrink-0 rounded-xl px-4 text-base font-bold ${shiftArea === item.id ? 'bg-[#A729AD] text-white' : 'bg-white/[0.05] text-white/65'}`}>{item.label}</button>)}</nav>}
          </header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{screen}</main>
        </div>
      </div>

      <nav aria-label={`Navegación móvil de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0C0B0C]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 text-base font-bold ${context === 'direction' ? 'min-w-[7rem]' : ''} ${activeGlobal === item.id ? 'bg-[#A729AD] text-white' : 'text-white/55'}`}><Icon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></button>)}</div>
      </nav>

      {action && <ActionDialog action={action} onClose={() => setAction(null)} />}
    </div>
  )
}
