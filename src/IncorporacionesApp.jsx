import { useState } from 'react'
import EvoLogo from './components/EvoLogo.jsx'
import Icon from './components/Incorporaciones/Icons.jsx'
import StatusBadge from './components/Incorporaciones/StatusBadge.jsx'
import {
  briefing,
  evaluations,
  evolutionSummary,
  firstClassResults,
  protocols,
  quickActions,
  specialNotices,
  teamOverview,
} from './mocks/incorporaciones/data.js'
import {
  getDirectionExceptions,
  getOwnCriticalBlockers,
  getShiftProgress,
  SHIFT_TEMPLATES,
  SYNTHETIC_ACTORS,
} from './domain/shift/shiftDomain.js'
import { useLocalShiftFlow } from './hooks/useLocalShiftFlow.js'

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

function formatTime(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function PrimaryButton({ children, onClick, icon = 'arrow', className = '', disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#A729AD] px-5 py-3 text-base font-extrabold text-white shadow-[0_14px_35px_rgba(167,41,173,0.24)] transition hover:bg-[#BC35C3] focus:outline-none focus:ring-2 focus:ring-[#FFFF4C] focus:ring-offset-2 focus:ring-offset-[#0C0B0C] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#6D596E] disabled:shadow-none ${className}`}
    >
      {children}
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}

function QuickActionButton({ children, onClick, icon, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-12 items-center gap-3 rounded-xl border border-white/12 bg-white/[0.035] px-4 py-3 text-left text-base font-bold text-white/80 transition hover:border-[#A729AD]/70 hover:bg-[#A729AD]/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 disabled:cursor-not-allowed disabled:opacity-40">
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
        <span className="rounded-full border border-[#A729AD]/30 bg-[#A729AD]/10 px-3 py-1 text-base font-bold text-[#E48AE9]">Sandbox Fase 2</span>
        <span className="text-base font-semibold text-white/50">Persistencia local · Datos ficticios</span>
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

function ActionDialog({ action, shift, onClose, onConfirm }) {
  const [selectedResult, setSelectedResult] = useState(firstClassResults[0])
  const [firstClassNotes, setFirstClassNotes] = useState({ load: '', technique: '', sensations: '' })
  const [text, setText] = useState('')
  const [endMode, setEndMode] = useState('close')
  const [completed, setCompleted] = useState(false)

  const content = {
    incident: ['Registrar incidencia', 'Describe una situación que Dirección deberá revisar. Quedará abierta tras cerrar el turno.'],
    feedback: ['Feedback operativo del turno', 'Deja únicamente información útil para el relevo. Se mantiene separado del feedback de programación.'],
    'first-class': ['Cerrar primera clase', 'Deja el resultado del caso y notas prácticas para los próximos entrenadores.'],
    handover: ['Completar cierre o relevo', 'Confirma cómo termina tu responsabilidad operativa antes de cerrar el turno.'],
    briefing: ['Briefing especial', 'Dato mínimo para actuar; la ficha general permanece fuera de este sandbox.'],
  }[action] || ['Acción local', 'Datos ficticios guardados únicamente en este dispositivo.']

  function confirm() {
    let success = false
    if (action === 'briefing') success = onConfirm('briefing')
    if (action === 'incident') success = onConfirm('incident', text)
    if (action === 'feedback') success = onConfirm('feedback', text)
    if (action === 'handover') success = onConfirm('handover', { mode: endMode, note: text })
    if (action === 'first-class') {
      const note = [
        `Primera clase: ${selectedResult}.`,
        firstClassNotes.load && `Cargas/nivel: ${firstClassNotes.load}.`,
        firstClassNotes.technique && `Técnica: ${firstClassNotes.technique}.`,
        firstClassNotes.sensations && `Próximo entrenador: ${firstClassNotes.sensations}.`,
      ].filter(Boolean).join(' ')
      success = onConfirm('feedback', note)
    }
    if (success) setCompleted(true)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="action-title" className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[1.7rem] bg-[#FBF8FB] p-5 text-[#241526] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-base font-bold text-[#A729AD]">Acción local · {shift?.trainerName}</p><h2 id="action-title" className="mt-1 font-evo-display text-3xl font-semibold">{content[0]}</h2></div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#604B63] hover:bg-[#EEE5EF]">Cerrar</button>
        </div>
        <p className="mt-3 text-base leading-7 text-[#604B63]">{content[1]}</p>

        {(action === 'briefing' || action === 'first-class') && (
          <dl className="mt-5 divide-y divide-[#E4D8E5] rounded-2xl border border-[#E4D8E5] bg-white px-4">
            {[
              ['Persona nueva', `${briefing.person} · ${briefing.time}`],
              ['Objetivo', briefing.objective],
              ['Adaptación relevante', briefing.restriction],
              ['Preparación', briefing.preparation],
            ].map(([label, value]) => <div key={label} className="py-4"><dt className="text-base font-bold text-[#A729AD]">{label}</dt><dd className="mt-1 text-base leading-7 text-[#4C3A4F]">{value}</dd></div>)}
          </dl>
        )}

        {(action === 'incident' || action === 'feedback' || action === 'handover') && (
          <label className="mt-5 block text-base font-bold text-[#3E2941]">
            {action === 'incident' ? '¿Qué ha ocurrido?' : action === 'feedback' ? 'Nota para el relevo' : 'Nota opcional'}
            <textarea rows="3" maxLength="240" value={text} onChange={(event) => setText(event.target.value)} placeholder={action === 'incident' ? 'Ej. El remo 04 queda fuera de uso.' : 'Escribe solo la información necesaria.'} className="mt-2 min-h-24 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
            <span className="mt-1 block text-right text-base font-normal text-[#806E82]">{text.length}/240</span>
          </label>
        )}

        {action === 'handover' && (
          <fieldset className="mt-5">
            <legend className="text-base font-bold text-[#6A1F6D]">Resultado del turno</legend>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[['close', 'Cierre'], ['handover', 'Relevo']].map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={endMode === id} onClick={() => setEndMode(id)} className={`min-h-12 rounded-xl border px-4 text-base font-bold ${endMode === id ? 'border-[#A729AD] bg-[#F4E6F5]' : 'border-[#E4D8E5] bg-white'}`}>{label}</button>)}
            </div>
          </fieldset>
        )}

        {action === 'first-class' && (
          <div className="mt-6 space-y-6">
            <fieldset>
              <legend className="text-base font-bold text-[#6A1F6D]">1 · Claves para futuros entrenadores</legend>
              <div className="mt-4 space-y-4">
                {[
                  ['load', '¿Qué cargas o nivel manejó?', 'Ej. mancuernas de 6 kg · nivel inicial'],
                  ['technique', '¿Qué observaste en su coordinación y técnica?', 'Ej. coordina bien · repetir patrón de bisagra'],
                  ['sensations', '¿Qué debe saber el próximo entrenador?', 'Ej. se sintió cómodo · vigilar muñeca derecha'],
                ].map(([id, label, placeholder]) => (
                  <label key={id} className="block text-base font-bold text-[#3E2941]">{label}
                    <textarea rows="2" maxLength="180" value={firstClassNotes[id]} onChange={(event) => setFirstClassNotes((notes) => ({ ...notes, [id]: event.target.value }))} placeholder={placeholder} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
                  </label>
                ))}
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

        <div className="mt-6"><PrimaryButton icon="check" onClick={confirm} disabled={completed}>{completed ? 'Guardado' : action === 'briefing' ? 'Marcar briefing consultado' : 'Guardar acción'}</PrimaryButton></div>
        {completed && <p role="status" className="mt-4 rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 text-base font-semibold text-emerald-800">Acción guardada con {shift?.trainerName} y hora local.</p>}
      </div>
    </div>
  )
}

function StartShiftCard({ onStart }) {
  const [templateId, setTemplateId] = useState('morning')
  const template = SHIFT_TEMPLATES[templateId]
  return (
    <LightCard className="max-w-2xl">
      <p className="text-base font-bold text-[#A729AD]">Entrenador de prueba</p>
      <h2 className="mt-1 font-evo-display text-3xl font-semibold">{SYNTHETIC_ACTORS.coach.name}</h2>
      <p className="mt-2 text-base leading-7 text-[#604B63]">Elige la franja. La hora real de entrada se registrará al iniciar.</p>
      <div className="mt-5 flex rounded-xl border border-[#D9C8DB] bg-white p-1" aria-label="Seleccionar turno">
        {Object.values(SHIFT_TEMPLATES).map((option) => <button key={option.id} type="button" aria-pressed={templateId === option.id} onClick={() => setTemplateId(option.id)} className={`min-h-12 flex-1 rounded-lg px-3 text-base font-extrabold ${templateId === option.id ? 'bg-[#A729AD] text-white' : 'text-[#604B63]'}`}>{option.label}</button>)}
      </div>
      <p className="mt-4 rounded-xl bg-[#F0E7F1] p-4 text-base font-semibold text-[#604B63]">Horario previsto: {template.scheduledStart}–{template.scheduledEnd}</p>
      <div className="mt-5"><PrimaryButton onClick={() => onStart(templateId)}>Iniciar turno</PrimaryButton></div>
    </LightCard>
  )
}

function TodayScreen({ flow, onAction, onOpenProtocol }) {
  const [endOpen, setEndOpen] = useState(false)
  const shift = flow.currentShift

  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Hoy" title={shift ? 'Tu turno operativo' : 'Inicia tu turno'} detail="Un único flujo local, con responsables y horas, sin conexiones externas." />
      {!shift && <StartShiftCard onStart={flow.start} />}

      {shift && (
        <div className="space-y-5">
          <section aria-label="Resumen del turno" className="rounded-2xl border border-[#A729AD]/30 bg-[#1B121C] p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-base font-bold text-[#FFFF4C]">{shift.status === 'closed' ? 'Turno cerrado' : 'Turno actual'}</p><h2 className="mt-1 font-evo-display text-2xl font-semibold text-white">{shift.label} · {shift.scheduledStart}–{shift.scheduledEnd}</h2><p className="mt-2 text-base text-white/65">{shift.trainerName} · Entrada {formatTime(shift.startedAt)} · {shift.punctuality.label}</p></div>
              <StatusBadge status={shift.status === 'closed' ? 'completed' : shift.punctuality.status === 'late' ? 'overdue' : 'completed'}>{shift.status === 'closed' ? 'Cerrado' : shift.punctuality.label}</StatusBadge>
            </div>
            <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-[#A729AD] to-[#FFFF4C]" style={{ width: `${getShiftProgress(shift)}%` }} /></div><strong className="text-base text-white">{getShiftProgress(shift)}%</strong></div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-base font-bold text-[#C86CCE]">Ahora</p><h2 className="font-evo-display text-3xl font-semibold text-white">Tres tareas como máximo</h2></div><span className="text-base text-white/45">{shift.tasks.filter((task) => task.critical).length} críticas</span></div>
            <LightCard className="divide-y divide-[#E4D8E5] !p-0">
              {shift.tasks.map((task) => (
                <div key={task.id} className={`p-4 sm:p-5 ${task.critical ? 'bg-[#FBF0FC]' : ''}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-evo-display text-xl font-semibold">{task.title}</h3><StatusBadge status={task.status}>{statusLabels[task.status]}</StatusBadge>{task.critical && <span className="text-base font-bold text-rose-700">Crítica propia</span>}</div><p className="mt-1 text-base leading-6 text-[#604B63]">{task.detail}</p><p className="mt-2 text-base font-semibold text-[#806E82]">{task.ownerName}{task.completedAt ? ` · ${formatTime(task.completedAt)}` : ''}</p></div>
                    {task.id === 'opening' && <div className="w-full shrink-0 sm:w-56"><PrimaryButton icon="check" disabled={task.status === 'completed' || shift.status === 'closed'} onClick={() => flow.completeTask('opening')}>{task.status === 'completed' ? 'Apertura confirmada' : 'Confirmar apertura'}</PrimaryButton></div>}
                    {task.id === 'briefing' && <button type="button" disabled={shift.status === 'closed'} onClick={() => onAction('briefing')} className="min-h-12 shrink-0 text-left text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4 disabled:opacity-40">{task.status === 'completed' ? 'Reabrir briefing' : 'Abrir briefing'}</button>}
                    {task.id === 'feedback' && <button type="button" disabled={shift.status === 'closed'} onClick={() => onAction('feedback')} className="min-h-12 shrink-0 text-left text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4 disabled:opacity-40">{task.status === 'completed' ? 'Añadir feedback' : 'Dejar feedback'}</button>}
                  </div>
                  {task.id === 'opening' && <button type="button" onClick={() => onOpenProtocol('opening')} className="mt-2 min-h-11 text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Ver protocolo de apertura</button>}
                </div>
              ))}
            </LightCard>
          </section>

          <section>
            <div className="mb-3"><p className="text-base font-bold text-[#C86CCE]">Casos especiales de hoy</p><h2 className="font-evo-display text-3xl font-semibold text-white">Solo lo que debes saber</h2></div>
            <div className="overflow-hidden rounded-2xl border border-[#E4D8E5] bg-[#FBF8FB] text-[#241526]">{specialNotices.map((notice) => <div key={notice.type} className="flex flex-col gap-2 border-b border-[#E4D8E5] px-4 py-3 last:border-0 sm:flex-row sm:items-center"><div className="flex items-center gap-3 sm:w-56"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${notice.status === 'overdue' ? 'bg-rose-500' : notice.status === 'exception' ? 'bg-fuchsia-500' : 'bg-amber-500'}`} /><p className="text-base font-bold text-[#6A1F6D]">{notice.type}</p></div><div className="min-w-0 flex-1"><p className="text-base font-bold">{notice.title}</p><p className="mt-0.5 text-base leading-6 text-[#604B63]">{notice.detail}</p></div></div>)}</div>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-base font-bold text-[#C86CCE]">Registrar</p><h2 className="font-evo-display text-3xl font-semibold text-white">Acciones rápidas</h2></div><span className="text-base font-bold text-white/45">Sin WodBuster</span></div>
            <div className="grid gap-2 sm:grid-cols-2">{quickActions.map((item) => <QuickActionButton key={item.id} icon={item.icon} disabled={shift.status === 'closed'} onClick={() => onAction(item.id)}>{item.id === 'handover' ? 'Completar cierre o relevo' : item.label}</QuickActionButton>)}</div>
          </section>

          <section className="rounded-[1.5rem] border border-white/10 bg-[#171217] p-5 sm:p-6">
            <button type="button" onClick={() => setEndOpen((value) => !value)} aria-expanded={endOpen} className="flex min-h-12 w-full items-center justify-between gap-4 text-left"><span><span className="block text-base font-bold text-[#C86CCE]">Fin del turno</span><span className="mt-1 block font-evo-display text-2xl font-semibold text-white">Cierre o relevo</span></span><Icon name={endOpen ? 'back' : 'arrow'} className={`h-6 w-6 text-[#FFFF4C] ${endOpen ? 'rotate-90' : ''}`} /></button>
            {endOpen && <div className="mt-5 space-y-3"><div className="rounded-xl border border-white/10 p-4"><p className="text-base font-bold text-white">Tareas críticas propias</p><p className="mt-1 text-base text-white/60">{getOwnCriticalBlockers(shift, shift.trainerId).length === 0 ? 'Todas completadas' : `${getOwnCriticalBlockers(shift, shift.trainerId).length} pendientes`}</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-base font-bold text-white">Preparación del fin de turno</p><p className="mt-1 text-base text-white/60">{shift.endPreparation ? `${shift.endPreparation.mode === 'handover' ? 'Relevo' : 'Cierre'} · ${shift.endPreparation.completedByName} · ${formatTime(shift.endPreparation.completedAt)}` : 'Pendiente'}</p></div><div className="grid gap-2 sm:grid-cols-2"><button type="button" disabled={shift.status === 'closed'} onClick={() => onAction('handover')} className="flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/20 px-4 text-base font-bold text-white hover:bg-white/5 disabled:opacity-40">Completar cierre o relevo <Icon name="arrow" className="h-5 w-5 text-[#FFFF4C]" /></button><PrimaryButton icon="check" disabled={shift.status === 'closed'} onClick={flow.close}>{shift.status === 'closed' ? 'Turno cerrado' : 'Cerrar turno'}</PrimaryButton></div>{shift.status === 'closed' && <p role="status" className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-base font-semibold text-emerald-100">Cerrado por {shift.trainerName} a las {formatTime(shift.closedAt)}. Las incidencias abiertas no han bloqueado el cierre.</p>}</div>}
          </section>

          <button type="button" onClick={flow.reset} className="min-h-12 text-base font-bold text-white/60 underline underline-offset-4 hover:text-white">Reiniciar datos sintéticos</button>
        </div>
      )}
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
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{protocols.map((protocol) => <button key={protocol.id} type="button" onClick={() => setActiveProtocol(protocol.id === activeProtocol ? null : protocol.id)} aria-expanded={protocol.id === activeProtocol} className={`rounded-[1.4rem] border p-5 text-left transition ${protocol.id === activeProtocol ? 'border-[#A729AD] bg-[#F5EAF6]' : 'border-[#E4D8E5] bg-[#FBF8FB] hover:border-[#A729AD]'}`}><p className="text-base font-bold text-[#A729AD]">Protocolo</p><h2 className="mt-1 font-evo-display text-2xl font-semibold text-[#241526]">{protocol.title}</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{protocol.summary}</p></button>)}</div>
      {selected && <LightCard className="mt-5"><p className="text-base font-bold text-[#A729AD]">Resumen esencial</p><h2 className="mt-1 font-evo-display text-3xl font-semibold">{selected.title}</h2><ol className="mt-5 space-y-3">{selected.steps.map((step, index) => <li key={step} className="flex gap-3 text-base leading-7 text-[#4C3A4F]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE1EF] font-bold text-[#6A1F6D]">{index + 1}</span><span>{step}</span></li>)}</ol><button type="button" onClick={() => setDocumentMessage(true)} className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Abrir documento oficial <Icon name="arrow" className="h-5 w-5" /></button><p className="mt-2 text-base text-[#806E82]">Enlace ficticio; no se abre ningún documento.</p>{documentMessage && <p role="status" className="mt-3 rounded-xl bg-[#F0E7F1] p-3 text-base font-semibold text-[#6A1F6D]">El documento oficial se abriría aquí en una fase posterior.</p>}</LightCard>}
    </div>
  )
}

function EvolutionScreen() {
  const [showDetail, setShowDetail] = useState(false)
  return <div><ScreenHeading eyebrow="Mi turno · Mi evolución" title="Una lectura breve" detail="Operativa diaria separada de la evaluación de calidad de clase." /><div className="grid gap-3 md:grid-cols-2">{evolutionSummary.slice(0, showDetail ? evolutionSummary.length : 3).map((item) => <LightCard key={item.label}><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 font-evo-display text-3xl font-semibold">{item.value}</p><p className="mt-2 text-base text-[#604B63]">{item.detail}</p></LightCard>)}</div>{!showDetail && <button type="button" onClick={() => setShowDetail(true)} className="mt-5 min-h-12 text-base font-bold text-[#FFFF4C] underline underline-offset-4">Ver evaluación y foco de mejora</button>}</div>
}

function OperationsScreen({ exceptions }) {
  return (
    <div>
      <ScreenHeading eyebrow="Dirección · Operativa" title="Solo excepciones" detail="La actividad rutinaria y los turnos correctos desaparecen de esta vista." />
      {exceptions.length === 0 && <LightCard className="max-w-2xl"><p className="text-base font-bold text-emerald-700">Sin excepciones pendientes</p><h2 className="mt-2 font-evo-display text-3xl font-semibold">No hay nada que perseguir</h2><p className="mt-2 text-base leading-7 text-[#604B63]">Registra una incidencia ficticia como Entrenador para comprobar este flujo.</p></LightCard>}
      <div className="grid gap-3 md:grid-cols-2">{exceptions.map((item) => <LightCard key={item.id} className="ring-2 ring-rose-400"><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 text-base leading-7 text-[#4C3A4F]">{item.detail}</p><dl className="mt-4 space-y-2 rounded-xl bg-[#F0E7F1] p-4 text-base"><div><dt className="font-bold text-[#A729AD]">Registrada por</dt><dd>{item.createdBy} · {formatTime(item.createdAt)}</dd></div><div><dt className="font-bold text-[#A729AD]">Responsable actual</dt><dd>{item.owner}</dd></div><div><dt className="font-bold text-[#A729AD]">Siguiente acción</dt><dd>{item.nextAction}</dd></div></dl></LightCard>)}</div>
    </div>
  )
}

function EvaluationsScreen() {
  return <div><ScreenHeading eyebrow="Dirección · Evaluaciones" title="Dos lecturas distintas" detail="El cumplimiento operativo no se confunde con la calidad de clase." /><div className="grid gap-5 xl:grid-cols-2"><LightCard><p className="text-base font-bold text-[#A729AD]">A · Cumplimiento operativo y protocolos</p><div className="mt-5 space-y-4">{evaluations.operations.map((item) => <div key={item.label} className="border-b border-[#E4D8E5] pb-4 last:border-0"><div className="flex items-center justify-between gap-3"><p className="text-base font-bold">{item.label}</p><strong className="text-xl text-[#6A1F6D]">{item.value}</strong></div><p className="mt-1 text-base text-[#604B63]">{item.detail}</p></div>)}</div></LightCard><LightCard><p className="text-base font-bold text-[#A729AD]">B · Calidad de clase</p><h2 className="mt-3 font-evo-display text-3xl font-semibold">{evaluations.quality.result}</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{evaluations.quality.detail}</p><ul className="mt-5 space-y-3">{evaluations.quality.criteria.map((criterion) => <li key={criterion} className="rounded-xl bg-[#F0E7F1] p-3 text-base font-semibold">{criterion}</li>)}</ul><p className="mt-4 text-base font-semibold text-[#806E82]">Referencia de evaluación; no son tareas diarias del entrenador.</p></LightCard></div></div>
}

function TeamScreen() {
  return <div><ScreenHeading eyebrow="Dirección · Equipo" title="Evolución del equipo" detail="Última evaluación, tendencia y un foco útil por entrenador." /><div className="space-y-3">{teamOverview.map((person) => <LightCard key={person.name}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-3"><h2 className="font-evo-display text-3xl font-semibold">{person.name}</h2><StatusBadge status={person.status}>{person.lastEvaluation}</StatusBadge></div><p className="mt-2 text-base text-[#604B63]">Tendencia: <strong>{person.trend}</strong></p></div><div className="grid gap-3 sm:grid-cols-2 lg:w-1/2"><div className="rounded-xl bg-[#F0E7F1] p-4"><p className="text-base font-bold text-[#A729AD]">Incumplimiento repetido</p><p className="mt-1 text-base">{person.repeated}</p></div><div className="rounded-xl bg-[#F0E7F1] p-4"><p className="text-base font-bold text-[#A729AD]">Foco de formación</p><p className="mt-1 text-base">{person.focus}</p></div></div></div></LightCard>)}</div></div>
}

export default function IncorporacionesApp() {
  const flow = useLocalShiftFlow()
  const [context, setContext] = useState('coach')
  const [globalArea, setGlobalArea] = useState('shift')
  const [shiftArea, setShiftArea] = useState('today')
  const [protocolToOpen, setProtocolToOpen] = useState(null)
  const [action, setAction] = useState(null)

  const globalNavigation = context === 'coach' ? trainerGlobalNavigation : directionNavigation
  const exceptions = getDirectionExceptions(flow.state)

  function changeContext(nextContext) {
    setContext(nextContext)
    setGlobalArea(nextContext === 'coach' ? 'shift' : 'operations')
    setShiftArea('today')
    setAction(null)
    flow.clearMessages()
  }

  function confirmAction(type, payload) {
    if (type === 'briefing') return flow.consultBriefing()
    if (type === 'incident') return flow.recordIncident(payload)
    if (type === 'feedback') return flow.recordFeedback(payload)
    if (type === 'handover') return flow.prepareEnd(payload.mode, payload.note)
    return false
  }

  let screen
  if (globalArea === 'programming') screen = <ProgrammingReference returnLabel={context === 'coach' ? 'Mi turno' : 'Operativa'} onReturn={() => setGlobalArea(context === 'coach' ? 'shift' : 'operations')} />
  else if (context === 'coach' && shiftArea === 'protocols') screen = <ProtocolsScreen initialProtocol={protocolToOpen} />
  else if (context === 'coach' && shiftArea === 'evolution') screen = <EvolutionScreen />
  else if (context === 'coach') screen = <TodayScreen flow={flow} onAction={setAction} onOpenProtocol={(protocolId) => { setProtocolToOpen(protocolId); setShiftArea('protocols') }} />
  else if (globalArea === 'evaluations') screen = <EvaluationsScreen />
  else if (globalArea === 'team') screen = <TeamScreen />
  else screen = <OperationsScreen exceptions={exceptions} />

  return (
    <div className="min-h-[100dvh] bg-[#0C0B0C] font-evo-body text-[#F6E8F9] selection:bg-[#A729AD]/40">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_right,rgba(167,41,173,0.16),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(106,31,109,0.11),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1480px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col border-r border-white/10 bg-[#0C0B0C]/92 px-5 py-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3 px-2"><EvoLogo imgClassName="h-10 w-auto object-contain" /><div><p className="font-evo-display text-xl font-bold uppercase tracking-[0.12em] text-white">Programming EVO</p><p className="text-base font-bold text-[#C86CCE]">Entrenador y operativa</p></div></div>
          <nav aria-label={`Áreas de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="mt-10 space-y-2">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-bold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}><Icon name={item.icon} className="h-5 w-5" />{item.label}</button>)}</nav>
          {context === 'coach' && globalArea === 'shift' && <nav aria-label="Áreas de Mi turno" className="mt-5 border-l border-white/15 pl-4">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-12 w-full rounded-xl px-3 text-left text-base font-semibold ${shiftArea === item.id ? 'bg-white/10 text-[#FFFF4C]' : 'text-white/55 hover:text-white'}`}>{item.label}</button>)}</nav>}
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-base font-bold text-[#FFFF4C]">Fase 2 local</p><p className="mt-2 text-base leading-6 text-white/55">Datos ficticios · Sin conexión · Reiniciables</p></div>
        </aside>

        <div className="min-w-0 flex-1 pb-28 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0C0B0C]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-10"><div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2.5 lg:hidden"><EvoLogo imgClassName="h-9 w-auto object-contain" /><div className="min-w-0"><p className="truncate font-evo-display text-lg font-bold uppercase text-white">Programming EVO</p><p className="truncate text-base font-semibold text-[#C86CCE]">Turno local · Fase 2</p></div></div><div className="flex w-full rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:ml-auto sm:w-auto" aria-label="Cambiar rol simulado">{[['coach', `Entrenador · ${SYNTHETIC_ACTORS.coach.name}`], ['direction', 'Dirección']].map(([id, label]) => <button key={id} type="button" aria-pressed={context === id} onClick={() => changeContext(id)} className={`min-h-12 flex-1 rounded-lg px-3 text-base font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 sm:flex-none sm:px-4 ${context === id ? 'bg-white text-[#241526]' : 'text-white/60 hover:text-white'}`}>{label}</button>)}</div></div>{context === 'coach' && globalArea === 'shift' && <nav aria-label="Secciones de Mi turno" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto lg:hidden">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-12 shrink-0 rounded-xl px-4 text-base font-bold ${shiftArea === item.id ? 'bg-[#A729AD] text-white' : 'bg-white/[0.05] text-white/65'}`}>{item.label}</button>)}</nav>}</header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {flow.notice && <p role="status" className="mb-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-base font-semibold text-emerald-100">{flow.notice}</p>}
            {flow.error && <p role="alert" className="mb-5 rounded-xl border border-rose-300/25 bg-rose-300/10 p-4 text-base font-semibold text-rose-100">{flow.error}</p>}
            {screen}
          </main>
        </div>
      </div>

      <nav aria-label={`Navegación móvil de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0C0B0C]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 text-base font-bold ${context === 'direction' ? 'min-w-[7rem]' : ''} ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/55'}`}><Icon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></button>)}</div></nav>

      {action && flow.currentShift && <ActionDialog action={action} shift={flow.currentShift} onClose={() => setAction(null)} onConfirm={confirmAction} />}
    </div>
  )
}
