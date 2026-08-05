import { useEffect, useRef, useState } from 'react'
import EvoLogo from './components/EvoLogo.jsx'
import Icon from './components/Incorporaciones/Icons.jsx'
import StatusBadge from './components/Incorporaciones/StatusBadge.jsx'
import {
  centerNotices,
  evaluations,
  evolutionSummary,
  firstClassPreparation,
  peopleToConsider,
  previousShiftHandover,
  programmingFeedbackTarget,
  protocols,
  teamOverview,
  todayClasses,
} from './mocks/incorporaciones/data.js'
import {
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  FIRST_CLASS_TEXT_LIMIT,
  FIRST_CLASS_VOLUME_OPTIONS,
  CLOSING_ACTIVITY_DEFINITIONS,
  getClosingBlockers,
  getDirectionExceptions,
  getShiftProgress,
  OPENING_ACTIVITY_DEFINITIONS,
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

const sequenceSteps = ['Iniciar', 'Abrir', 'Preparar', 'Trabajar', 'Finalizar']

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

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return '—'
  return `${formatDate(value)} · ${formatTime(value)}`
}

function formatSandboxPunctuality(shift) {
  const started = new Date(shift.startedAt)
  const startedMinutes = started.getHours() * 60 + started.getMinutes()
  const [startHours, startMinutes] = shift.scheduledStart.split(':').map(Number)
  const scheduledStart = startHours * 60 + startMinutes
  const isInsideTestWindow = startedMinutes >= scheduledStart - 30 && startedMinutes <= scheduledStart + 30
  return isInsideTestWindow ? shift.punctuality.label : 'Fuera del horario de prueba'
}

function PrimaryButton({ children, onClick, icon = 'arrow', className = '', disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#A729AD] px-5 py-3 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(167,41,173,0.18)] transition hover:bg-[#902395] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D] focus:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#A99DAA] disabled:shadow-none ${className}`}
    >
      {children}
      <Icon name={icon} className="h-5 w-5" />
    </button>
  )
}

function SecondaryButton({ children, onClick, icon, disabled = false, className = '' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={`flex min-h-11 items-center gap-3 rounded-xl border border-[#DCCEDD] bg-white px-4 py-3 text-left text-base font-bold text-[#5A3C5D] transition hover:border-[#A729AD] hover:bg-[#FBF2FC] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D]/40 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>
      {icon && <Icon name={icon} className="h-5 w-5 shrink-0 text-[#A729AD]" />}
      <span>{children}</span>
    </button>
  )
}

function TextButton({ children, onClick, className = '' }) {
  return <button type="button" onClick={onClick} className={`min-h-11 text-sm font-bold text-[#6A1F6D] underline decoration-[#A729AD]/50 underline-offset-4 hover:text-[#A729AD] ${className}`}>{children}</button>
}

function LightCard({ children, className = '' }) {
  return <div className={`rounded-2xl border border-[#E4D8E5] bg-white p-4 text-[#241526] shadow-[0_8px_24px_rgba(34,20,39,0.06)] sm:p-5 ${className}`}>{children}</div>
}

function ScreenHeading({ eyebrow, title, detail }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-[#A729AD]">{eyebrow}</p>
      <h1 className="mt-1 font-evo-display text-3xl font-semibold tracking-wide text-[#241526] sm:text-5xl">{title}</h1>
      {detail && <p className="mt-1 max-w-2xl text-base leading-7 text-[#6E5A71]">{detail}</p>}
    </div>
  )
}

function DialogShell({ eyebrow, title, detail, onClose, children }) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    dialogRef.current?.focus()
    return () => previousFocusRef.current?.focus?.()
  }, [title])

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="action-title" tabIndex="-1" onKeyDown={(event) => { if (event.key === 'Escape') onClose() }} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-[1.7rem] bg-[#FBF8FB] p-5 text-[#241526] shadow-2xl outline-none focus:ring-2 focus:ring-[#A729AD] focus:ring-offset-2 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-sm font-bold text-[#A729AD]">{eyebrow}</p><h2 id="action-title" className="mt-1 font-evo-display text-3xl font-semibold">{title}</h2></div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#604B63] hover:bg-[#EEE5EF]">Cerrar</button>
        </div>
        {detail && <p className="mt-3 text-base leading-7 text-[#604B63]">{detail}</p>}
        {children}
      </div>
    </div>
  )
}

function FirstClassChoiceGroup({ legend, options, value, onChange, formatOption = (option) => option }) {
  return (
    <fieldset>
      <legend className="text-base font-bold text-[#3E2941]">{legend}</legend>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label={legend}>
        {options.map((option) => (
          <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)} className={`min-h-11 w-full rounded-xl border px-4 py-3 text-left text-sm font-bold leading-6 transition sm:text-base ${value === option ? 'border-[#A729AD] bg-[#F4E6F5] text-[#4A214D]' : 'border-[#E4D8E5] bg-white text-[#5A465D] hover:border-[#BC8FC0]'}`}>
            {formatOption(option)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function FirstClassTextField({ label, value, onChange, placeholder, optional = false }) {
  return (
    <label className="block text-sm font-bold text-[#4A354D]">
      {label}{optional && <span className="ml-1 font-medium text-[#8B798D]"> · opcional</span>}
      <textarea rows="2" maxLength={FIRST_CLASS_TEXT_LIMIT} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 min-h-20 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 text-[#241526] outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" />
      <span className="mt-1 block text-right text-xs font-medium text-[#8B798D]">{value.length}/{FIRST_CLASS_TEXT_LIMIT}</span>
    </label>
  )
}

function FirstClassSavedSummary({ record }) {
  const optionalDetails = [
    ['Aspecto a seguir trabajando', record.movementFollowUp],
    ['Zona de la molestia', record.discomfortZone],
    ['Adaptación que funcionó', record.workingAdaptation],
    ['Siguiente entrenador', record.nextCoachObservation],
  ].filter(([, value]) => value)
  return (
    <div className="mt-5 space-y-3">
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4"><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">1 · Movimiento y técnica</p><p className="mt-2 text-base font-bold text-[#342137]">{record.movement}</p></section>
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4"><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">2 · Molestia o lesión</p><p className="mt-2 text-base font-bold text-[#342137]">{record.discomfort}</p></section>
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4"><p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">3 · Trabajo completado</p><p className="mt-2 text-base font-bold text-[#342137]">{record.volumePercent} % · {record.loadsUsed}</p><p className="mt-1 text-sm text-[#6E5A71]">{record.adaptedExercises}</p></section>
      {optionalDetails.length > 0 && <section className="rounded-2xl bg-[#F0E7F1] p-4">{optionalDetails.map(([label, value]) => <p key={label} className="mt-1 text-sm leading-6 text-[#5B465E] first:mt-0"><strong>{label}:</strong> {value}</p>)}</section>}
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Guardado por {record.completedByName} a las {formatTime(record.completedAt)}.</p>
    </div>
  )
}

function FirstClassDialog({ shift, error, onClose, onConfirm, onClearError }) {
  const [record, setRecord] = useState({
    movement: '', movementFollowUp: '', discomfort: '', discomfortZone: '', workingAdaptation: '', nextCoachObservation: '', volumePercent: '', loadsUsed: '', adaptedExercises: '',
  })
  const saved = shift.firstClassRecord
  function update(field, value) {
    onClearError()
    setRecord((current) => ({ ...current, [field]: value }))
  }
  return (
    <DialogShell eyebrow={`Primera clase · ${shift.trainerName}`} title={saved ? 'Primera clase registrada' : 'Registrar primera clase'} detail={saved ? 'El registro queda disponible para revisar durante y después del turno.' : 'Completa los tres bloques obligatorios.'} onClose={onClose}>
      {saved ? <FirstClassSavedSummary record={saved} /> : <>
        <div className="mt-6 space-y-6">
          <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5"><p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">1 · Movimiento y técnica</p><FirstClassChoiceGroup legend="¿Cómo se movió durante la clase?" options={FIRST_CLASS_MOVEMENT_OPTIONS} value={record.movement} onChange={(value) => update('movement', value)} /><div className="mt-4"><FirstClassTextField label="¿Qué movimiento o aspecto debemos seguir trabajando?" optional value={record.movementFollowUp} onChange={(value) => update('movementFollowUp', value)} placeholder="Ej. Mantener la espalda neutra en el peso muerto." /></div></section>
          <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5"><p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">2 · Molestia o lesión</p><FirstClassChoiceGroup legend="¿Cómo respondió la molestia o lesión durante el entrenamiento?" options={FIRST_CLASS_DISCOMFORT_OPTIONS} value={record.discomfort} onChange={(value) => update('discomfort', value)} /><div className="mt-4 space-y-4"><FirstClassTextField label="Zona de la molestia." optional value={record.discomfortZone} onChange={(value) => update('discomfortZone', value)} placeholder="Ej. Hombro derecho." /><FirstClassTextField label="Adaptación que funcionó." optional value={record.workingAdaptation} onChange={(value) => update('workingAdaptation', value)} placeholder="Ej. Press en suelo con carga ligera." /><FirstClassTextField label="Observación para el siguiente entrenador." optional value={record.nextCoachObservation} onChange={(value) => update('nextCoachObservation', value)} placeholder="Ej. Mantener la misma variante si aparece molestia." /></div></section>
          <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5"><p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">3 · Trabajo completado</p><FirstClassChoiceGroup legend="¿Qué parte del entrenamiento completó y con qué carga?" options={FIRST_CLASS_VOLUME_OPTIONS} value={Number(record.volumePercent)} onChange={(value) => update('volumePercent', value)} formatOption={(option) => `${option} %`} /><div className="mt-4 space-y-4"><FirstClassTextField label="Pesos o cargas utilizados." value={record.loadsUsed} onChange={(value) => update('loadsUsed', value)} placeholder="Ej. Mancuernas de 6 kg y kettlebell de 12 kg." /><FirstClassTextField label="Ejercicios adaptados o sustituidos." value={record.adaptedExercises} onChange={(value) => update('adaptedExercises', value)} placeholder="Ej. Remo en lugar de carrera; ninguno si no hubo cambios." /></div></section>
        </div>
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
        <div className="mt-6"><PrimaryButton icon="check" onClick={() => onConfirm(record)}>Guardar primera clase</PrimaryButton></div>
      </>}
    </DialogShell>
  )
}

function IncidentDialog({ shift, openingItemId, openingCheckId, closingItemId, closingCheckId, error, onClose, onConfirm, onClearError }) {
  const [description, setDescription] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [nextAction, setNextAction] = useState('')
  const openingItem = shift.openingChecklist.find((item) => item.id === openingItemId)
  const openingCheck = openingItem?.checks.find((check) => check.id === openingCheckId)
  const closingItem = shift.closingChecklist.find((item) => item.id === closingItemId)
  const closingCheck = closingItem?.checks.find((check) => check.id === closingCheckId)
  const affectedCheck = openingCheck || closingCheck
  function update(setter, value) {
    onClearError()
    setter(value)
  }
  function confirm() {
    const success = onConfirm({ description, dueAt, nextAction, openingItemId, openingCheckId, closingItemId, closingCheckId })
    if (success) onClose()
  }
  return (
    <DialogShell eyebrow={`Incidencia · ${shift.trainerName}`} title={affectedCheck ? 'Registrar problema de comprobación' : 'Anotar una incidencia'} detail={affectedCheck ? `El elemento “${affectedCheck.label}” quedará como excepción trazada; la actividad seguirá pendiente hasta que confirmes el resto y la finalices.` : 'La incidencia quedará visible para Dirección con responsable, plazo y siguiente acción.'} onClose={onClose}>
      <div className="mt-5 space-y-4">
        <label className="block text-sm font-bold text-[#4A354D]">¿Qué ha ocurrido?<textarea rows="3" maxLength="240" value={description} onChange={(event) => update(setDescription, event.target.value)} placeholder="Ej. El remo 04 queda fuera de uso." className="mt-2 min-h-24 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-bold text-[#4A354D]">Responsable<input value={SYNTHETIC_ACTORS.direction.name} readOnly className="mt-2 min-h-11 w-full rounded-xl border border-[#D9C8DB] bg-[#F0E7F1] px-4 py-3 text-base font-semibold text-[#5A465D]" /></label>
          <label className="block text-sm font-bold text-[#4A354D]">Plazo<input type="text" value={dueAt} onChange={(event) => update(setDueAt, event.target.value)} placeholder="2026-08-05T14:00" className="mt-2 min-h-11 w-full rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" /></label>
        </div>
        <label className="block text-sm font-bold text-[#4A354D]">Siguiente acción<input value={nextAction} onChange={(event) => update(setNextAction, event.target.value)} placeholder="Ej. Revisar el remo y confirmar si vuelve a servicio." className="mt-2 min-h-11 w-full rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" /></label>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      <div className="mt-6"><PrimaryButton icon="check" onClick={confirm}>Guardar incidencia</PrimaryButton></div>
    </DialogShell>
  )
}

function ActivityChecks({ item, onCheck, onProblem }) {
  return (
    <div className="mt-5 space-y-2">
      {item.checks.map((check) => (
        <div key={check.id} data-testid={`activity-check-${item.id}-${check.id}`} className={`rounded-xl border p-4 ${check.status === 'checked' ? 'border-emerald-200 bg-emerald-50' : check.status === 'exception' ? 'border-amber-300 bg-[#FFFFE2]' : 'border-[#E4D8E5] bg-white'}`}>
          <div className="flex items-start gap-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${check.status === 'checked' ? 'bg-emerald-600 text-white' : check.status === 'exception' ? 'bg-amber-500 text-white' : 'bg-[#F0E7F1] text-[#6A1F6D]'}`}><Icon name={check.status === 'checked' ? 'check' : check.status === 'exception' ? 'exceptions' : 'today'} className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="text-base font-bold leading-6">{check.label}</p>{check.status === 'checked' && <p className="mt-1 text-sm text-[#5C6B61]">{check.completedByName} · {formatDateTime(check.completedAt)}</p>}{check.status === 'exception' && <p className="mt-1 text-sm text-[#745B26]">Excepción asignada · incidencia {check.incidentId}</p>}</div>
          </div>
          {check.status === 'pending' && <div className="mt-3 flex flex-col gap-2 pl-10 sm:flex-row"><button type="button" onClick={() => onCheck(check.id)} className="min-h-11 rounded-xl bg-[#F0E7F1] px-4 text-sm font-extrabold text-[#6A1F6D] hover:bg-[#E8D5EA] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D] focus:ring-offset-2">Confirmar {check.label.replace(/\.$/, '').toLowerCase()}</button><button type="button" onClick={() => onProblem(check.id)} className="min-h-11 rounded-xl px-4 text-sm font-bold text-[#6A1F6D] underline decoration-[#A729AD]/50 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#6A1F6D]">Registrar problema</button></div>}
        </div>
      ))}
    </div>
  )
}

function PreviousShiftContext() {
  return (
    <div className="mt-5 space-y-4">
      <LightCard><p className="text-sm font-bold text-[#A729AD]">Nota del turno anterior</p><p className="mt-2 text-base leading-7 text-[#4C3A4F]">{previousShiftHandover.note}</p></LightCard>
      <div>{previousShiftHandover.incidents.map((incident) => <LightCard key={incident.id}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-[#A729AD]">Incidencia activa · {incident.element}</p><StatusBadge status="exception">{incident.status}</StatusBadge></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="font-bold">Responsable</dt><dd>{incident.owner}</dd></div><div><dt className="font-bold">Plazo</dt><dd>{incident.dueAt}</dd></div><div className="sm:col-span-2"><dt className="font-bold">Siguiente acción</dt><dd>{incident.nextAction}</dd></div></dl></LightCard>)}</div>
    </div>
  )
}

function FirstClassPreparationContext() {
  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-2">
      <LightCard><p className="text-sm font-bold text-[#A729AD]">{firstClassPreparation.time} · {firstClassPreparation.room}</p><h3 className="mt-1 font-evo-display text-2xl font-semibold">{firstClassPreparation.type}</h3><p className="mt-3 text-sm font-bold">Objetivo</p><p className="mt-1 text-base leading-7 text-[#604B63]">{firstClassPreparation.objective}</p><p className="mt-3 text-sm font-bold">Personas y adaptaciones</p><p className="mt-1 text-base leading-7 text-[#604B63]">{firstClassPreparation.people}</p></LightCard>
      <LightCard><p className="text-sm font-bold text-[#A729AD]">Preparación concreta</p><ol className="mt-3 space-y-2">{firstClassPreparation.steps.map((step, index) => <li key={step} className="flex gap-3 text-sm leading-6"><strong className="text-[#A729AD]">{index + 1}</strong><span>{step}</span></li>)}</ol><p className="mt-4 text-sm font-bold">Material</p><p className="mt-1 text-sm leading-6 text-[#604B63]">{firstClassPreparation.material}</p><p className="mt-4 text-sm font-bold">Alternativa prevista</p><p className="mt-1 text-sm leading-6 text-[#604B63]">{firstClassPreparation.alternative}</p></LightCard>
    </div>
  )
}

export function OpeningActivityScreen({ shift, itemId, flow, onBack, onProblem, onProgrammingReview, onCompleted }) {
  const item = shift.openingChecklist.find((candidate) => candidate.id === itemId)
  const definition = OPENING_ACTIVITY_DEFINITIONS[itemId]
  const ready = item.checks.every((check) => ['checked', 'exception'].includes(check.status))

  function finish() {
    if (itemId === 'previous-shift') {
      item.checks.filter((check) => check.status === 'pending').forEach((check) => flow.completeOpeningCheck(itemId, check.id))
    }
    const success = flow.completeOpeningItem(itemId, { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) })
    if (success) onCompleted()
  }

  return (
    <div data-testid={`opening-work-${itemId}`}>
      <TextButton onClick={onBack}>← Volver a la apertura</TextButton>
      <ScreenHeading eyebrow="Abrir y preparar la sala" title={item.label.replace(/\.$/, '')} detail="Realiza la actividad aquí. La pantalla general solo mostrará el resultado y el siguiente paso." />
      {itemId === 'previous-shift' && <PreviousShiftContext />}
      {itemId === 'first-class-setup' && <FirstClassPreparationContext />}
      {itemId === 'systems' && <LightCard><p className="text-base leading-7 text-[#604B63]">Comprueba que cada sistema responde. Si uno falla, registra el problema desde ese elemento para conservar el vínculo.</p></LightCard>}
      {itemId === 'spaces' && <LightCard><p className="text-base leading-7 text-[#604B63]">Recorre físicamente sala y baños. Cada comprobación conserva su propio estado.</p></LightCard>}
      {itemId === 'schedule' && <LightCard><p className="text-base leading-7 text-[#604B63]">La revisión se realiza en Programación, donde viven objetivo, estructura, material y adaptaciones de cada clase.</p><div className="mt-4"><PrimaryButton icon="class" onClick={onProgrammingReview}>Abrir Programación</PrimaryButton></div></LightCard>}
      {!['previous-shift', 'schedule'].includes(itemId) && <ActivityChecks item={item} onCheck={(checkId) => flow.completeOpeningCheck(itemId, checkId)} onProblem={(checkId) => onProblem(itemId, checkId)} />}
      {itemId === 'previous-shift' && item.status !== 'completed' && <div className="mt-5 max-w-md"><PrimaryButton icon="check" onClick={finish}>Confirmar relevo revisado</PrimaryButton></div>}
      {!['previous-shift', 'schedule'].includes(itemId) && item.status !== 'completed' && <div className="mt-5 max-w-md"><PrimaryButton icon="check" disabled={!ready} onClick={finish}>Finalizar actividad</PrimaryButton>{!ready && <p className="mt-2 text-sm font-semibold text-[#806E82]">Completa cada comprobación o deja una excepción correctamente asignada.</p>}</div>}
      {item.status === 'completed' && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Actividad finalizada por {item.completedByName} · {formatDateTime(item.completedAt)}.</p>}
    </div>
  )
}

export function ProgrammingOpeningReview({ shift, flow, onBack, onCompleted }) {
  const item = shift.openingChecklist.find((candidate) => candidate.id === 'schedule')
  const definition = OPENING_ACTIVITY_DEFINITIONS.schedule
  const ready = item.checks.every((check) => check.status === 'checked')
  function finish() {
    const success = flow.completeOpeningItem('schedule', { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) })
    if (success) onCompleted()
  }
  return (
    <div data-testid="programming-opening-review">
      <TextButton onClick={onBack}>← Volver a Mi turno</TextButton>
      <ScreenHeading eyebrow="Programación · Revisión del turno" title="Revisa las clases del turno" detail="Este contenido pertenece a Programación. Mi turno conserva únicamente la evidencia de que cada clase fue revisada." />
      <div className="space-y-4">{todayClasses.map((classItem) => { const check = item.checks.find((candidate) => candidate.id === classItem.id); return <LightCard key={classItem.id}><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><p className="text-sm font-bold text-[#A729AD]">{classItem.time} · {classItem.room} · {classItem.trainer}</p><h2 className="mt-1 font-evo-display text-3xl font-semibold">{classItem.type}</h2><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><p className="font-bold">Objetivo</p><p className="mt-1 leading-6 text-[#604B63]">{classItem.objective}</p></div><div><p className="font-bold">Estructura o bloques</p><p className="mt-1 leading-6 text-[#604B63]">{classItem.blocks.join(' · ')}</p></div><div><p className="font-bold">Material</p><p className="mt-1 leading-6 text-[#604B63]">{classItem.material}</p></div><div><p className="font-bold">Adaptaciones y avisos</p><p className="mt-1 leading-6 text-[#604B63]">{classItem.adaptations} {classItem.alerts}</p></div></div></div><button type="button" disabled={check.status === 'checked'} onClick={() => flow.completeOpeningCheck('schedule', classItem.id)} className="min-h-11 shrink-0 rounded-xl bg-[#F0E7F1] px-4 text-sm font-extrabold text-[#6A1F6D] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D] disabled:bg-emerald-100 disabled:text-emerald-800">{check.status === 'checked' ? `Revisada · ${formatTime(check.completedAt)}` : 'Confirmar clase revisada'}</button></div></LightCard> })}</div>
      {item.status !== 'completed' && <div className="mt-5 max-w-md"><PrimaryButton icon="check" disabled={!ready} onClick={finish}>Confirmar revisión de Programación</PrimaryButton></div>}
      {item.status === 'completed' && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Revisión finalizada por {item.completedByName} · {formatDateTime(item.completedAt)}.</p>}
    </div>
  )
}

function ClosingDialog({ shift, flow, error, onClose, initialItemId = null, onProblem }) {
  const [note, setNote] = useState(shift.closingNote || '')
  const [activeItemId, setActiveItemId] = useState(initialItemId)
  const blockers = getClosingBlockers(shift, shift.trainerId)
  const incidentsReady = shift.incidents.every((incident) => incident.status !== 'open' || (incident.ownerId && incident.dueAt && incident.nextAction))
  const firstClassReady = !shift.tasks.some((task) => task.id === 'first-class') || Boolean(shift.firstClassRecord)
  function finish() {
    if (flow.close(note)) onClose()
  }
  function openActivity(itemId) {
    const item = shift.closingChecklist.find((candidate) => candidate.id === itemId)
    if (!item.openedAt && !flow.openClosingItem(itemId)) return
    setActiveItemId(itemId)
  }
  if (activeItemId) {
    const item = shift.closingChecklist.find((candidate) => candidate.id === activeItemId)
    const definition = CLOSING_ACTIVITY_DEFINITIONS[activeItemId]
    const ready = item.checks.every((check) => ['checked', 'exception'].includes(check.status))
    function finishActivity() {
      const success = flow.completeClosingItem(activeItemId, { kind: definition.evidenceKind, checkIds: definition.checks.map((check) => check.id) })
      if (success) setActiveItemId(null)
    }
    return (
      <DialogShell eyebrow="Final del turno · Evidencia" title={item.label.replace(/\.$/, '')} detail="Realiza cada comprobación. Una excepción asignada queda vinculada al elemento, pero la actividad no finaliza hasta que confirmes el conjunto." onClose={() => setActiveItemId(null)}>
        <TextButton onClick={() => setActiveItemId(null)}>← Volver a la checklist final</TextButton>
        <ActivityChecks item={item} onCheck={(checkId) => flow.completeClosingCheck(activeItemId, checkId)} onProblem={(checkId) => onProblem(activeItemId, checkId)} />
        {item.status !== 'completed' && <div className="mt-5"><PrimaryButton icon="check" disabled={!ready} onClick={finishActivity}>Finalizar comprobación</PrimaryButton></div>}
        {item.status === 'completed' && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Comprobación finalizada por {item.completedByName} · {formatDateTime(item.completedAt)}.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      </DialogShell>
    )
  }
  return (
    <DialogShell eyebrow={`Final del turno · ${shift.trainerName}`} title={shift.endLabel} detail="Revisa la checklist. Cada comprobación obligatoria guarda responsable y hora." onClose={onClose}>
      <div className="mt-5 space-y-2">
        <div className={`rounded-xl border p-4 ${firstClassReady ? 'border-emerald-200 bg-emerald-50' : 'border-[#E4D8E5] bg-white'}`}><p className="text-base font-bold">Primera clase y seguimientos obligatorios registrados.</p><p className="mt-1 text-sm text-[#6E5A71]">{firstClassReady ? 'Comprobado mediante los registros del turno.' : 'Falta registrar la primera clase.'}</p></div>
        <div className={`rounded-xl border p-4 ${incidentsReady ? 'border-emerald-200 bg-emerald-50' : 'border-[#E4D8E5] bg-white'}`}><p className="text-base font-bold">Incidencias resueltas o asignadas.</p><p className="mt-1 text-sm text-[#6E5A71]">{incidentsReady ? 'Todas tienen responsable, plazo y siguiente acción.' : 'Existe una incidencia sin trasladar correctamente.'}</p></div>
        {shift.closingChecklist.map((item) => (
          <div key={item.id} data-testid={`closing-item-${item.id}`} className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${item.status === 'completed' || item.status === 'not-required' ? 'border-emerald-200 bg-emerald-50' : 'border-[#E4D8E5] bg-white'}`}>
            <div><p className="text-base font-bold">{item.label}</p><p className="mt-1 text-sm text-[#6E5A71]">{item.status === 'completed' ? `${item.completedByName} · ${formatDateTime(item.completedAt)}` : item.status === 'not-required' ? 'No corresponde al último turno del día.' : 'Pendiente de comprobar.'}</p></div>
            {item.required && <button type="button" onClick={() => openActivity(item.id)} className="min-h-11 shrink-0 rounded-xl bg-[#F0E7F1] px-4 text-sm font-extrabold text-[#6A1F6D] hover:bg-[#E8D5EA] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D]">{item.status === 'completed' ? 'Ver evidencia' : item.openedAt ? 'Continuar comprobación' : 'Abrir comprobación'}</button>}
          </div>
        ))}
      </div>
      <label className="mt-5 block text-sm font-bold text-[#4A354D]">Nota para el siguiente turno <span className="font-medium text-[#8B798D]">· opcional</span><textarea rows="3" maxLength="240" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Escribe solo si el siguiente entrenador necesita contexto." className="mt-2 min-h-24 w-full resize-none rounded-xl border border-[#D9C8DB] bg-white px-4 py-3 text-base font-normal leading-6 outline-none placeholder:text-[#9A879D] focus:border-[#A729AD] focus:ring-2 focus:ring-[#A729AD]/20" /></label>
      {blockers.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-[#FFFFE2] p-4"><p className="text-sm font-extrabold text-[#6A1F6D]">{blockers.length} obligaciones pendientes</p><ul className="mt-2 space-y-1 text-sm leading-6 text-[#5B465E]">{blockers.map((blocker) => <li key={blocker.id}>• {blocker.label}</li>)}</ul></div>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
      <div className="mt-6"><PrimaryButton icon="check" disabled={blockers.length > 0} onClick={finish}>{shift.endLabel}</PrimaryButton></div>
    </DialogShell>
  )
}

function ProgrammingReference({ target, returnLabel, onReturn, openingReview = false, shift, flow, onOpeningReviewComplete }) {
  if (openingReview && shift) {
    return <ProgrammingOpeningReview shift={shift} flow={flow} onBack={onReturn} onCompleted={onOpeningReviewComplete} />
  }
  return (
    <div>
      <ScreenHeading eyebrow="Programming EVO" title="Programación" detail="El feedback del entrenamiento pertenece a su día y clase; Operativa no lo almacena." />
      <LightCard className="max-w-2xl">
        {target ? <><p className="text-sm font-bold text-[#A729AD]">{target.dateLabel} · {target.time}</p><h2 className="mt-1 font-evo-display text-3xl font-semibold">{target.className}</h2><p className="mt-3 text-base leading-7 text-[#604B63]">Has llegado a la clase correspondiente. En la aplicación real, el campo de feedback de sesión continúa dentro de Programación.</p></> : <><p className="font-evo-display text-3xl font-semibold">La programación continúa donde ya está</p><p className="mt-3 text-base leading-7 text-[#604B63]">Entrenamiento del día, notas, objetivo, estímulo, preparación de clase y feedback de sesión permanecen en esta área.</p></>}
        <div className="mt-6"><PrimaryButton onClick={onReturn}>Volver a {returnLabel}</PrimaryButton></div>
      </LightCard>
    </div>
  )
}

function StartShiftCard({ onStart }) {
  const [templateId, setTemplateId] = useState('morning')
  const template = SHIFT_TEMPLATES[templateId]
  return (
    <LightCard className="max-w-2xl">
      <p className="text-sm font-bold text-[#A729AD]">Entrenador asignado</p>
      <h2 className="mt-1 font-evo-display text-3xl font-semibold">{SYNTHETIC_ACTORS.coach.name}</h2>
      <p className="mt-2 text-base leading-7 text-[#604B63]">Selecciona el turno asignado. Al iniciar se guardarán fecha y hora real de entrada; la apertura seguirá pendiente.</p>
      <div className="mt-5 flex rounded-xl border border-[#D9C8DB] bg-white p-1" aria-label="Seleccionar turno">
        {Object.values(SHIFT_TEMPLATES).map((option) => <button key={option.id} type="button" aria-pressed={templateId === option.id} onClick={() => setTemplateId(option.id)} className={`min-h-12 flex-1 rounded-lg px-3 text-base font-extrabold ${templateId === option.id ? 'bg-[#A729AD] text-white' : 'text-[#604B63]'}`}>{option.label}</button>)}
      </div>
      <p className="mt-4 rounded-xl bg-[#F0E7F1] p-4 text-base font-semibold text-[#604B63]">Turno asignado: {template.label} · {template.scheduledStart}–{template.scheduledEnd}</p>
      <div className="mt-5"><PrimaryButton onClick={() => onStart(templateId)}>Iniciar turno</PrimaryButton></div>
    </LightCard>
  )
}

function SequenceProgress({ shift, stage }) {
  const activeIndex = shift?.status === 'closed' ? 4 : stage === 'opening' ? 1 : stage === 'preparation' ? 2 : stage === 'work' ? 3 : 0
  return (
    <ol aria-label="Progreso del turno" className="grid grid-cols-5 gap-1 rounded-2xl border border-[#E1D3E3] bg-white p-2 shadow-[0_4px_16px_rgba(34,20,39,0.04)]">
      {sequenceSteps.map((label, index) => <li key={label} className={`flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-center text-[0.68rem] font-extrabold sm:text-sm ${index === activeIndex ? 'bg-[#A729AD] text-white' : index < activeIndex ? 'bg-[#F0E7F1] text-[#6A1F6D]' : 'text-[#9A879D]'}`}><span className="text-xs sm:hidden">{index}</span><span className="hidden sm:inline">{index} · {label}</span></li>)}
    </ol>
  )
}

function ShiftSummary({ shift }) {
  return (
    <section aria-label="Resumen del turno" className="rounded-2xl border border-[#E1D3E3] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(34,20,39,0.04)] sm:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-evo-display text-2xl font-semibold">{shift.assignedShift}</h2><p className="text-sm font-semibold text-[#79677C]">{shift.trainerName} · {formatDate(shift.startedAt)} · entrada {formatTime(shift.startedAt)}</p></div><p className={`text-sm font-bold ${shift.status === 'closed' ? 'text-emerald-700' : 'text-[#6A1F6D]'}`}>{shift.status === 'closed' ? `${shift.endLabel} · ${formatTime(shift.closedAt)}` : formatSandboxPunctuality(shift)}</p></div>
      <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEE3EF]"><div className="h-full rounded-full bg-[#A729AD]" style={{ width: `${getShiftProgress(shift)}%` }} /></div><strong className="text-sm text-[#6A1F6D]">{getShiftProgress(shift)}%</strong></div>
    </section>
  )
}

export function OpeningStep({ shift, onOpenItem, onOpenProtocol }) {
  const nextPendingId = shift.openingChecklist.find((item) => item.status !== 'completed')?.id
  return (
    <section aria-labelledby="opening-title" className="rounded-2xl border border-[#E4CDE6] bg-[#FFFFE2] p-5 shadow-[0_12px_30px_rgba(89,34,93,0.10)] sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#A729AD]">Ahora · Paso 1</p>
      <h2 id="opening-title" className="mt-2 font-evo-display text-3xl font-semibold sm:text-4xl">Abrir y preparar la sala</h2>
      <p className="mt-2 max-w-2xl text-base leading-7 text-[#604B63]">Entra en la actividad que toca, realiza sus comprobaciones y vuelve aquí con una evidencia verificable.</p>
      <div className="mt-5 space-y-2">
        {shift.openingChecklist.map((item, index) => (
          <div key={item.id} data-testid={`opening-item-${item.id}`} className={`rounded-xl border p-4 ${item.status === 'completed' ? 'border-emerald-200 bg-emerald-50' : 'border-[#E4D8E5] bg-white'}`}>
            <div className="flex gap-3"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${item.status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-[#F0E7F1] text-[#6A1F6D]'}`}>{item.status === 'completed' ? <Icon name="check" className="h-4 w-4" /> : index + 1}</span><div className="min-w-0 flex-1"><p className="text-base font-bold leading-6">{item.label}</p>{item.status === 'completed' && <p className="mt-1 text-sm text-[#5C6B61]">{item.completedByName} · {formatDateTime(item.completedAt)}</p>}</div></div>
            <div className="mt-3 pl-11">{item.status === 'completed' ? <button type="button" onClick={() => onOpenItem(item.id)} className="min-h-11 text-sm font-bold text-[#6A1F6D] underline decoration-[#A729AD]/50 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#6A1F6D]">Ver evidencia</button> : item.id === nextPendingId ? <button type="button" onClick={() => onOpenItem(item.id)} className="min-h-11 rounded-xl bg-[#A729AD] px-4 text-sm font-extrabold text-white hover:bg-[#902395] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D] focus:ring-offset-2">{item.openedAt ? 'Continuar actividad' : 'Abrir actividad'}</button> : <p className="flex min-h-11 items-center text-sm font-semibold text-[#9A879D]">Disponible después de la actividad anterior.</p>}</div>
          </div>
        ))}
      </div>
      <TextButton className="mt-3" onClick={onOpenProtocol}>Ver protocolo completo de apertura</TextButton>
    </section>
  )
}

function PreparationBlock({ title, children }) {
  return <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4"><h3 className="font-evo-display text-2xl font-semibold">{title}</h3><div className="mt-3 divide-y divide-[#EEE5EF]">{children}</div></section>
}

function PreparationStep({ flow }) {
  return (
    <section aria-labelledby="preparation-title" className="rounded-2xl border border-[#E4CDE6] bg-[#FFFFE2] p-5 shadow-[0_12px_30px_rgba(89,34,93,0.10)] sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#A729AD]">Ahora · Paso 2</p>
      <h2 id="preparation-title" className="mt-2 font-evo-display text-3xl font-semibold sm:text-4xl">Prepara tu turno</h2>
      <p className="mt-2 max-w-2xl text-base leading-7 text-[#604B63]">Horario mínimo y solo las personas o avisos que cambian cómo debes actuar.</p>
      <div className="mt-5 grid gap-3 xl:grid-cols-3">
        <PreparationBlock title="Clases de hoy">{todayClasses.map((item) => <div key={`${item.time}-${item.type}`} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-bold text-[#A729AD]">{item.time} · {item.room}</p><p className="mt-1 text-base font-bold">{item.type}</p><p className="text-sm text-[#6E5A71]">{item.trainer}</p></div>)}</PreparationBlock>
        <PreparationBlock title="Personas a tener en cuenta">{peopleToConsider.map((item) => <div key={item.person} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-bold text-[#A729AD]">{item.type}</p><p className="mt-1 text-base font-bold">{item.person}</p><p className="mt-1 text-sm leading-6 text-[#6E5A71]">{item.detail}</p></div>)}</PreparationBlock>
        <PreparationBlock title="Avisos del centro">{centerNotices.map((item) => <div key={item.title} className="py-3 first:pt-0 last:pb-0"><p className="text-sm font-bold text-[#A729AD]">{item.type}</p><p className="mt-1 text-base font-bold">{item.title}</p><p className="mt-1 text-sm leading-6 text-[#6E5A71]">{item.detail}</p></div>)}</PreparationBlock>
      </div>
      <div className="mt-5 max-w-sm"><PrimaryButton icon="check" onClick={flow.completePreparation}>Confirmar turno preparado</PrimaryButton></div>
    </section>
  )
}

function WorkStep({ shift, onIncident, onFirstClass, onProgramming }) {
  const hasFirstClass = shift.tasks.some((task) => task.id === 'first-class')
  return (
    <section aria-labelledby="work-title" className="rounded-2xl border border-[#E4CDE6] bg-[#FFFFE2] p-5 shadow-[0_12px_30px_rgba(89,34,93,0.10)] sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#A729AD]">Ahora · Paso 3</p>
      <h2 id="work-title" className="mt-2 font-evo-display text-3xl font-semibold sm:text-4xl">Trabaja con el turno preparado</h2>
      <p className="mt-2 max-w-2xl text-base leading-7 text-[#604B63]">Durante el turno solo se muestran las tres acciones que pueden requerir registro.</p>
      <div className="mt-5 grid gap-2 md:grid-cols-3">
        <SecondaryButton icon="incidents" onClick={onIncident}>Anotar una incidencia</SecondaryButton>
        {hasFirstClass ? <SecondaryButton icon="signups" onClick={onFirstClass}>{shift.firstClassRecord ? 'Ver primera clase registrada' : 'Registrar primera clase'}</SecondaryButton> : <div className="flex min-h-11 items-center rounded-xl border border-[#E4D8E5] bg-white/60 px-4 text-sm font-semibold text-[#8B798D]">No hay primera clase en este turno.</div>}
        <SecondaryButton icon="class" onClick={onProgramming}>Dar feedback del entrenamiento</SecondaryButton>
      </div>
      <p className="mt-3 text-sm font-semibold text-[#806E82]">El feedback se abre en Programación y no se guarda en Operativa.</p>
    </section>
  )
}

function ClosingPanel({ shift, onReview }) {
  const blockers = getClosingBlockers(shift, shift.trainerId)
  return (
    <section aria-labelledby="finish-title" className="rounded-2xl border border-[#DCCEDD] bg-white p-5 sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[#A729AD]">Paso 4</p>
      <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><h2 id="finish-title" className="font-evo-display text-3xl font-semibold">Finalizar turno</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{blockers.length > 0 ? `${blockers.length} obligaciones pendientes antes de ${shift.endLabel.toLowerCase()}.` : `Todo preparado para ${shift.endLabel.toLowerCase()}.`}</p>{blockers.length > 0 && <TextButton onClick={onReview}>Ver qué falta</TextButton>}</div><div className="w-full max-w-sm"><PrimaryButton icon="check" disabled={blockers.length > 0} onClick={onReview}>Finalizar turno</PrimaryButton></div></div>
    </section>
  )
}

function AuditSummary({ shift }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="rounded-2xl border border-emerald-200 bg-white p-5 sm:p-6">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-emerald-700">Turno finalizado</p><h2 className="mt-2 font-evo-display text-3xl font-semibold">{shift.endLabel} a las {formatTime(shift.closedAt)}</h2><p className="mt-2 text-base text-[#604B63]">{shift.closedByName} · {formatDate(shift.closedAt)}</p>
      <TextButton className="mt-3" onClick={() => setOpen((value) => !value)}>{open ? 'Ocultar registro de apertura y cierre' : 'Ver registro de apertura y cierre'}</TextButton>
      {open && <div className="mt-4 grid gap-4 lg:grid-cols-2"><div><h3 className="font-evo-display text-2xl font-semibold">Apertura y preparación</h3><div className="mt-2 space-y-2">{shift.openingChecklist.map((item) => <div key={item.id} className="rounded-xl bg-[#F0E7F1] p-3"><p className="text-sm font-bold">{item.label}</p><p className="mt-1 text-xs text-[#6E5A71]">{item.completedByName} · {formatDateTime(item.completedAt)}</p><p className="mt-1 text-xs text-[#6E5A71]">{item.evidence?.outcomes?.length || 0} evidencias · {item.evidence?.outcomes?.filter((outcome) => outcome.status === 'exception').length || 0} excepciones</p></div>)}<div className="rounded-xl bg-[#F0E7F1] p-3"><p className="text-sm font-bold">Turno completo preparado.</p><p className="mt-1 text-xs text-[#6E5A71]">{shift.shiftPreparation.completedByName} · {formatDateTime(shift.shiftPreparation.completedAt)}</p></div></div></div><div><h3 className="font-evo-display text-2xl font-semibold">{shift.endLabel}</h3><div className="mt-2 space-y-2">{shift.firstClassRecord && <div className="rounded-xl bg-[#F0E7F1] p-3"><p className="text-sm font-bold">Primera clase y seguimientos obligatorios registrados.</p><p className="mt-1 text-xs text-[#6E5A71]">{shift.firstClassRecord.completedByName} · {formatDateTime(shift.firstClassRecord.completedAt)}</p></div>}<div className="rounded-xl bg-[#F0E7F1] p-3"><p className="text-sm font-bold">Incidencias resueltas o asignadas.</p><p className="mt-1 text-xs text-[#6E5A71]">{shift.incidents.length === 0 ? 'Sin incidencias en este turno.' : `${shift.incidents.length} incidencia asignada con responsable, plazo y siguiente acción.`}</p></div>{shift.closingChecklist.filter((item) => item.required).map((item) => <div key={item.id} className="rounded-xl bg-[#F0E7F1] p-3"><p className="text-sm font-bold">{item.label}</p><p className="mt-1 text-xs text-[#6E5A71]">{item.completedByName} · {formatDateTime(item.completedAt)}</p><p className="mt-1 text-xs text-[#6E5A71]">{item.evidence?.outcomes?.length || 0} evidencias · {item.evidence?.outcomes?.filter((outcome) => outcome.status === 'exception').length || 0} excepciones</p></div>)}</div>{shift.closingNote && <div className="mt-3 rounded-xl border border-[#E4D8E5] p-3"><p className="text-sm font-bold">Nota para el siguiente turno</p><p className="mt-1 text-sm text-[#6E5A71]">{shift.closingNote}</p></div>}</div></div>}
    </section>
  )
}

function TodayScreen({ flow, openingActivityId, onOpenOpeningActivity, onCloseOpeningActivity, onAction, onOpenProtocol, onProgramming, onProgrammingReview }) {
  const shift = flow.currentShift
  const openingComplete = shift?.tasks.find((task) => task.id === 'opening')?.status === 'completed'
  const stage = !shift ? 'start' : !openingComplete ? 'opening' : !shift.shiftPreparation ? 'preparation' : 'work'
  if (shift && openingActivityId) {
    return <OpeningActivityScreen shift={shift} itemId={openingActivityId} flow={flow} onBack={onCloseOpeningActivity} onProblem={(itemId, checkId) => onAction({ type: 'incident', openingItemId: itemId, openingCheckId: checkId })} onProgrammingReview={onProgrammingReview} onCompleted={onCloseOpeningActivity} />
  }
  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Hoy" title={shift ? 'Tu turno, paso a paso' : 'Iniciar turno'} detail={shift ? 'Completa el momento actual y la siguiente parte aparecerá sola.' : 'Registra la entrada real sin confirmar todavía la apertura.'} />
      {!shift && <StartShiftCard onStart={flow.start} />}
      {shift && <div className="space-y-5"><SequenceProgress shift={shift} stage={stage} /><ShiftSummary shift={shift} />{shift.status === 'closed' ? <AuditSummary shift={shift} /> : <>{stage === 'opening' && <OpeningStep shift={shift} onOpenItem={onOpenOpeningActivity} onOpenProtocol={() => onOpenProtocol('opening')} />}{stage === 'preparation' && <PreparationStep flow={flow} />}{stage === 'work' && <WorkStep shift={shift} onIncident={() => onAction({ type: 'incident' })} onFirstClass={() => onAction({ type: 'first-class' })} onProgramming={onProgramming} />}<ClosingPanel shift={shift} onReview={() => onAction({ type: 'closing' })} /></>}<button type="button" onClick={flow.reset} className="min-h-11 text-sm font-bold text-[#806E82] underline underline-offset-4 hover:text-[#6A1F6D]">Reiniciar datos sintéticos</button></div>}
    </div>
  )
}

function ProtocolsScreen({ initialProtocol }) {
  const [activeProtocol, setActiveProtocol] = useState(initialProtocol)
  const [documentMessage, setDocumentMessage] = useState(false)
  const selected = protocols.find((protocol) => protocol.id === activeProtocol)
  return (
    <div><ScreenHeading eyebrow="Mi turno · Protocolos" title="Biblioteca operativa" detail="Las instrucciones completas permanecen fuera del recorrido principal." /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{protocols.map((protocol) => <button key={protocol.id} type="button" onClick={() => setActiveProtocol(protocol.id === activeProtocol ? null : protocol.id)} aria-expanded={protocol.id === activeProtocol} className={`rounded-[1.4rem] border p-5 text-left transition ${protocol.id === activeProtocol ? 'border-[#A729AD] bg-[#F5EAF6]' : 'border-[#E4D8E5] bg-[#FBF8FB] hover:border-[#A729AD]'}`}><p className="text-sm font-bold text-[#A729AD]">Protocolo</p><h2 className="mt-1 font-evo-display text-2xl font-semibold">{protocol.title}</h2><p className="mt-2 text-base leading-7 text-[#604B63]">{protocol.summary}</p></button>)}</div>{selected && <LightCard className="mt-5"><p className="text-sm font-bold text-[#A729AD]">Instrucciones completas</p><h2 className="mt-1 font-evo-display text-3xl font-semibold">{selected.title}</h2><ol className="mt-5 space-y-3">{selected.steps.map((step, index) => <li key={step} className="flex gap-3 text-base leading-7 text-[#4C3A4F]"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEE1EF] font-bold text-[#6A1F6D]">{index + 1}</span><span>{step}</span></li>)}</ol><button type="button" onClick={() => setDocumentMessage(true)} className="mt-6 inline-flex min-h-12 items-center gap-2 text-base font-bold text-[#6A1F6D] underline decoration-[#A729AD] underline-offset-4">Abrir documento oficial <Icon name="arrow" className="h-5 w-5" /></button><p className="mt-2 text-sm text-[#806E82]">Enlace ficticio; no se abre ningún documento.</p>{documentMessage && <p role="status" className="mt-3 rounded-xl bg-[#F0E7F1] p-3 text-base font-semibold text-[#6A1F6D]">El documento oficial se abriría aquí en una fase posterior.</p>}</LightCard>}</div>
  )
}

function EvolutionScreen() {
  const [showDetail, setShowDetail] = useState(false)
  return <div><ScreenHeading eyebrow="Mi turno · Mi evolución" title="Una lectura breve" detail="Operativa diaria separada de la evaluación de calidad de clase." /><div className="grid gap-3 md:grid-cols-2">{evolutionSummary.slice(0, showDetail ? evolutionSummary.length : 3).map((item) => <LightCard key={item.label}><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 font-evo-display text-3xl font-semibold">{item.value}</p><p className="mt-2 text-base text-[#604B63]">{item.detail}</p></LightCard>)}</div>{!showDetail && <TextButton className="mt-5" onClick={() => setShowDetail(true)}>Ver evaluación y foco de mejora</TextButton>}</div>
}

function OperationsScreen({ exceptions }) {
  return <div><ScreenHeading eyebrow="Dirección · Operativa" title="Solo excepciones" detail="La actividad rutinaria y los turnos correctos desaparecen de esta vista." />{exceptions.length === 0 && <LightCard className="max-w-2xl"><p className="text-base font-bold text-emerald-700">Sin excepciones pendientes</p><h2 className="mt-2 font-evo-display text-3xl font-semibold">No hay nada que perseguir</h2><p className="mt-2 text-base leading-7 text-[#604B63]">Anota una incidencia ficticia como Entrenador para comprobar este flujo.</p></LightCard>}<div className="grid gap-3 md:grid-cols-2">{exceptions.map((item) => <LightCard key={item.id} className="ring-2 ring-rose-400"><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 text-base leading-7 text-[#4C3A4F]">{item.detail}</p><dl className="mt-4 space-y-2 rounded-xl bg-[#F0E7F1] p-4 text-base"><div><dt className="font-bold text-[#A729AD]">Registrada por</dt><dd>{item.createdBy} · {formatTime(item.createdAt)}</dd></div><div><dt className="font-bold text-[#A729AD]">Responsable actual</dt><dd>{item.owner}</dd></div><div><dt className="font-bold text-[#A729AD]">Plazo</dt><dd>{formatDateTime(item.dueAt)}</dd></div><div><dt className="font-bold text-[#A729AD]">Siguiente acción</dt><dd>{item.nextAction}</dd></div></dl></LightCard>)}</div></div>
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
  const [programmingTarget, setProgrammingTarget] = useState(null)
  const [programmingMode, setProgrammingMode] = useState('default')
  const [openingActivityId, setOpeningActivityId] = useState(null)
  const [action, setAction] = useState(null)
  const globalNavigation = context === 'coach' ? trainerGlobalNavigation : directionNavigation
  const exceptions = getDirectionExceptions(flow.state)

  function changeContext(nextContext) {
    setContext(nextContext)
    setGlobalArea(nextContext === 'coach' ? 'shift' : 'operations')
    setShiftArea('today')
    setAction(null)
    setProgrammingTarget(null)
    setProgrammingMode('default')
    setOpeningActivityId(null)
    flow.clearMessages()
  }

  function openProgrammingFeedback() {
    setProgrammingTarget(programmingFeedbackTarget)
    setProgrammingMode('feedback')
    setGlobalArea('programming')
    flow.clearMessages()
  }

  function openOpeningActivity(itemId) {
    const item = flow.currentShift?.openingChecklist.find((candidate) => candidate.id === itemId)
    if (!item) return
    flow.clearMessages()
    if (item.status !== 'completed' && !item.openedAt && !flow.openOpeningItem(itemId)) return
    setOpeningActivityId(itemId)
  }

  function openProgrammingReview() {
    setProgrammingMode('opening-review')
    setGlobalArea('programming')
    flow.clearMessages()
  }

  function closeAction() {
    if (action?.returnTo) setAction(action.returnTo)
    else setAction(null)
  }

  let screen
  if (globalArea === 'programming') screen = <ProgrammingReference target={programmingTarget} returnLabel={context === 'coach' ? 'Mi turno' : 'Operativa'} openingReview={programmingMode === 'opening-review'} shift={flow.currentShift} flow={flow} onReturn={() => setGlobalArea(context === 'coach' ? 'shift' : 'operations')} onOpeningReviewComplete={() => { setOpeningActivityId(null); setProgrammingMode('default'); setGlobalArea('shift') }} />
  else if (context === 'coach' && shiftArea === 'protocols') screen = <ProtocolsScreen initialProtocol={protocolToOpen} />
  else if (context === 'coach' && shiftArea === 'evolution') screen = <EvolutionScreen />
  else if (context === 'coach') screen = <TodayScreen flow={flow} openingActivityId={openingActivityId} onOpenOpeningActivity={openOpeningActivity} onCloseOpeningActivity={() => setOpeningActivityId(null)} onAction={(nextAction) => { flow.clearMessages(); setAction(nextAction) }} onOpenProtocol={(protocolId) => { setProtocolToOpen(protocolId); setShiftArea('protocols') }} onProgramming={openProgrammingFeedback} onProgrammingReview={openProgrammingReview} />
  else if (globalArea === 'evaluations') screen = <EvaluationsScreen />
  else if (globalArea === 'team') screen = <TeamScreen />
  else screen = <OperationsScreen exceptions={exceptions} />

  return (
    <div className="min-h-[100dvh] bg-[#F6E8F9] font-evo-body text-[#241526] selection:bg-[#A729AD]/25">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1480px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col border-r border-white/10 bg-[#0C0B0C]/95 px-5 py-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3 px-2"><EvoLogo imgClassName="h-10 w-auto object-contain" /><div><p className="font-evo-display text-xl font-bold uppercase tracking-[0.12em] text-white">Programming EVO</p><p className="text-base font-bold text-[#C86CCE]">Entrenador y operativa</p></div></div>
          <nav aria-label={`Áreas de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="mt-10 space-y-2">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-bold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}><Icon name={item.icon} className="h-5 w-5" />{item.label}</button>)}</nav>
          {context === 'coach' && globalArea === 'shift' && <nav aria-label="Áreas de Mi turno" className="mt-5 border-l border-white/15 pl-4">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-11 w-full rounded-xl px-3 text-left text-base font-semibold ${shiftArea === item.id ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'}`}>{item.label}</button>)}</nav>}
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-bold text-[#C86CCE]">Fase 2.3 · Local</p><p className="mt-1 text-sm leading-6 text-white/55">Secuencia guiada · Datos ficticios</p></div>
        </aside>

        <div className="min-w-0 flex-1 bg-[linear-gradient(145deg,#F6E8F9_0%,#FFFFE2_55%,#FFFFFF_100%)] pb-28 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0C0B0C]/95 px-4 py-3 text-white backdrop-blur-xl sm:px-6 lg:px-10"><div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2.5 lg:hidden"><EvoLogo imgClassName="h-9 w-auto object-contain" /><div className="min-w-0"><p className="truncate font-evo-display text-lg font-bold uppercase text-white">Programming EVO</p><p className="truncate text-sm font-semibold text-[#C86CCE]">Mi turno · Fase 2.3</p></div></div><div className="flex w-full rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:ml-auto sm:w-auto" aria-label="Cambiar rol simulado">{[['coach', `Entrenador · ${SYNTHETIC_ACTORS.coach.name}`], ['direction', 'Dirección']].map(([id, label]) => <button key={id} type="button" aria-pressed={context === id} onClick={() => changeContext(id)} className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 sm:flex-none sm:px-4 ${context === id ? 'bg-white text-[#241526]' : 'text-white/60 hover:text-white'}`}>{label}</button>)}</div></div>{context === 'coach' && globalArea === 'shift' && <nav aria-label="Secciones de Mi turno" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto lg:hidden">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${shiftArea === item.id ? 'bg-[#A729AD] text-white' : 'bg-white/[0.05] text-white/65'}`}>{item.label}</button>)}</nav>}</header>
          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{flow.notice && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{flow.notice}</p>}{flow.error && !action && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{flow.error}</p>}{screen}</main>
        </div>
      </div>
      <nav aria-label={`Navegación móvil de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0C0B0C]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 text-base font-bold ${context === 'direction' ? 'min-w-[7rem]' : ''} ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/55'}`}><Icon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></button>)}</div></nav>
      {action?.type === 'incident' && flow.currentShift && <IncidentDialog shift={flow.currentShift} openingItemId={action.openingItemId} openingCheckId={action.openingCheckId} closingItemId={action.closingItemId} closingCheckId={action.closingCheckId} error={flow.error} onClose={closeAction} onConfirm={flow.recordIncident} onClearError={flow.clearMessages} />}
      {action?.type === 'first-class' && flow.currentShift && <FirstClassDialog shift={flow.currentShift} error={flow.error} onClose={() => setAction(null)} onConfirm={flow.recordFirstClass} onClearError={flow.clearMessages} />}
      {action?.type === 'closing' && flow.currentShift && <ClosingDialog shift={flow.currentShift} flow={flow} error={flow.error} initialItemId={action.itemId} onProblem={(closingItemId, closingCheckId) => setAction({ type: 'incident', closingItemId, closingCheckId, returnTo: { type: 'closing', itemId: closingItemId } })} onClose={() => setAction(null)} />}
    </div>
  )
}
