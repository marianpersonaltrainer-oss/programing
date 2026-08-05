import { useState } from 'react'
import EvoLogo from './components/EvoLogo.jsx'
import Icon from './components/Incorporaciones/Icons.jsx'
import StatusBadge from './components/Incorporaciones/StatusBadge.jsx'
import {
  briefing,
  evaluations,
  evolutionSummary,
  protocols,
  quickActions,
  specialNotices,
  teamOverview,
} from './mocks/incorporaciones/data.js'
import {
  FIRST_CLASS_DISCOMFORT_OPTIONS,
  FIRST_CLASS_MOVEMENT_OPTIONS,
  FIRST_CLASS_TEXT_LIMIT,
  FIRST_CLASS_VOLUME_OPTIONS,
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

function formatSandboxPunctuality(shift) {
  const started = new Date(shift.startedAt)
  const startedMinutes = started.getHours() * 60 + started.getMinutes()
  const [startHours, startMinutes] = shift.scheduledStart.split(':').map(Number)
  const [endHours, endMinutes] = shift.scheduledEnd.split(':').map(Number)
  const scheduledStart = startHours * 60 + startMinutes
  const scheduledEnd = endHours * 60 + endMinutes
  const isInsideTestWindow = startedMinutes >= scheduledStart - 30 && startedMinutes <= scheduledEnd
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

function QuickActionButton({ children, onClick, icon, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-11 items-center gap-3 rounded-xl border border-[#DCCEDD] bg-white px-4 py-3 text-left text-base font-bold text-[#5A3C5D] transition hover:border-[#A729AD] hover:bg-[#FBF2FC] focus:outline-none focus:ring-2 focus:ring-[#6A1F6D]/40 disabled:cursor-not-allowed disabled:opacity-40">
      <Icon name={icon} className="h-5 w-5 shrink-0 text-[#A729AD]" />
      <span>{children}</span>
    </button>
  )
}

function LightCard({ children, className = '' }) {
  return <div className={`rounded-2xl border border-[#E4D8E5] bg-white p-4 text-[#241526] shadow-[0_8px_24px_rgba(34,20,39,0.06)] sm:p-5 ${className}`}>{children}</div>
}

function ScreenHeading({ eyebrow, title, detail }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-bold text-[#A729AD]">{eyebrow}</p>
      <h1 className="mt-1 font-evo-display text-4xl font-semibold tracking-wide text-[#241526] sm:text-5xl">{title}</h1>
      {detail && <p className="mt-1 max-w-2xl text-base leading-7 text-[#6E5A71]">{detail}</p>}
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
  const discomfortDetails = [
    ['Zona de la molestia', record.discomfortZone],
    ['Adaptación que funcionó', record.workingAdaptation],
    ['Siguiente entrenador', record.nextCoachObservation],
  ].filter(([, value]) => value)

  return (
    <div className="mt-5 space-y-3">
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">1 · Movimiento y técnica</p>
        <p className="mt-2 text-base font-bold text-[#342137]">{record.movement}</p>
        {record.movementFollowUp && <p className="mt-2 text-sm leading-6 text-[#6E5A71]">{record.movementFollowUp}</p>}
      </section>
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">2 · Molestia o lesión</p>
        <p className="mt-2 text-base font-bold text-[#342137]">{record.discomfort}</p>
        {discomfortDetails.map(([label, value]) => <p key={label} className="mt-2 text-sm leading-6 text-[#6E5A71]"><strong>{label}:</strong> {value}</p>)}
      </section>
      <section className="rounded-2xl border border-[#E4D8E5] bg-white p-4">
        <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">3 · Trabajo completado</p>
        <dl className="mt-2 space-y-2 text-sm leading-6 text-[#5B465E]"><div><dt className="font-bold">Volumen</dt><dd>{record.volumePercent} %</dd></div><div><dt className="font-bold">Pesos o cargas utilizados</dt><dd>{record.loadsUsed}</dd></div><div><dt className="font-bold">Ejercicios adaptados o sustituidos</dt><dd>{record.adaptedExercises}</dd></div></dl>
      </section>
      <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">Guardado por {record.completedByName} a las {formatTime(record.completedAt)}.</p>
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

function ActionDialog({ action, shift, error, onClose, onConfirm, onClearError }) {
  const [text, setText] = useState('')
  const [endMode, setEndMode] = useState('close')
  const [firstClassRecord, setFirstClassRecord] = useState({
    movement: '',
    movementFollowUp: '',
    discomfort: '',
    discomfortZone: '',
    workingAdaptation: '',
    nextCoachObservation: '',
    volumePercent: '',
    loadsUsed: '',
    adaptedExercises: '',
  })
  const [completed, setCompleted] = useState(Boolean(action === 'first-class' && shift?.firstClassRecord))

  const content = {
    incident: ['Registrar incidencia', 'Describe una situación que Dirección deberá revisar. Quedará abierta tras cerrar el turno.'],
    feedback: ['Feedback operativo del turno', 'Deja únicamente información útil para el relevo. Se mantiene separado del feedback de programación.'],
    'first-class': ['Cerrar primera clase', 'Completa los tres bloques y guarda un único registro operativo.'],
    handover: ['Completar cierre o relevo', 'Confirma cómo termina tu responsabilidad operativa antes de cerrar el turno.'],
    briefing: ['Briefing especial', 'Dato mínimo para actuar; la ficha general permanece fuera de este sandbox.'],
  }[action] || ['Acción local', 'Datos ficticios guardados únicamente en este dispositivo.']

  function confirm() {
    let success = false
    if (action === 'briefing') success = onConfirm('briefing')
    if (action === 'incident') success = onConfirm('incident', text)
    if (action === 'feedback') success = onConfirm('feedback', text)
    if (action === 'handover') success = onConfirm('handover', { mode: endMode, note: text })
    if (action === 'first-class') success = onConfirm('first-class', firstClassRecord)
    if (success) setCompleted(true)
  }

  const savedFirstClassRecord = shift?.firstClassRecord
  const showSavedFirstClass = action === 'first-class' && completed && savedFirstClassRecord

  function updateFirstClass(field, value) {
    onClearError()
    setFirstClassRecord((current) => ({ ...current, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div role="dialog" aria-modal="true" aria-labelledby="action-title" className="max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-[1.7rem] bg-[#FBF8FB] p-5 text-[#241526] shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-base font-bold text-[#A729AD]">Acción local · {shift?.trainerName}</p><h2 id="action-title" className="mt-1 font-evo-display text-3xl font-semibold">{content[0]}</h2></div>
          <button type="button" onClick={onClose} className="min-h-12 rounded-xl px-3 text-base font-bold text-[#604B63] hover:bg-[#EEE5EF]">Cerrar</button>
        </div>
        <p className="mt-3 text-base leading-7 text-[#604B63]">{content[1]}</p>

        {action === 'briefing' && (
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

        {action === 'first-class' && !showSavedFirstClass && (
          <div className="mt-6 space-y-6">
            <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5">
              <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">1 · Movimiento y técnica</p>
              <FirstClassChoiceGroup legend="¿Cómo se movió durante la clase?" options={FIRST_CLASS_MOVEMENT_OPTIONS} value={firstClassRecord.movement} onChange={(movement) => updateFirstClass('movement', movement)} />
              <div className="mt-4"><FirstClassTextField label="¿Qué movimiento o aspecto debemos seguir trabajando?" optional value={firstClassRecord.movementFollowUp} onChange={(movementFollowUp) => updateFirstClass('movementFollowUp', movementFollowUp)} placeholder="Ej. Mantener la espalda neutra en el peso muerto." /></div>
            </section>

            <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5">
              <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">2 · Molestia o lesión</p>
              <FirstClassChoiceGroup legend="¿Cómo respondió la molestia o lesión durante el entrenamiento?" options={FIRST_CLASS_DISCOMFORT_OPTIONS} value={firstClassRecord.discomfort} onChange={(discomfort) => updateFirstClass('discomfort', discomfort)} />
              <div className="mt-4 space-y-4">
                <FirstClassTextField label="Zona de la molestia." optional value={firstClassRecord.discomfortZone} onChange={(discomfortZone) => updateFirstClass('discomfortZone', discomfortZone)} placeholder="Ej. Hombro derecho." />
                <FirstClassTextField label="Adaptación que funcionó." optional value={firstClassRecord.workingAdaptation} onChange={(workingAdaptation) => updateFirstClass('workingAdaptation', workingAdaptation)} placeholder="Ej. Press en suelo con carga ligera." />
                <FirstClassTextField label="Observación para el siguiente entrenador." optional value={firstClassRecord.nextCoachObservation} onChange={(nextCoachObservation) => updateFirstClass('nextCoachObservation', nextCoachObservation)} placeholder="Ej. Mantener la misma variante si aparece molestia." />
              </div>
            </section>

            <section className="rounded-2xl border border-[#E4D8E5] bg-[#FFFDF8] p-4 sm:p-5">
              <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.12em] text-[#A729AD]">3 · Trabajo completado</p>
              <FirstClassChoiceGroup legend="¿Qué parte del entrenamiento completó y con qué carga?" options={FIRST_CLASS_VOLUME_OPTIONS} value={Number(firstClassRecord.volumePercent)} onChange={(volumePercent) => updateFirstClass('volumePercent', volumePercent)} formatOption={(option) => `${option} %`} />
              <div className="mt-4 space-y-4">
                <FirstClassTextField label="Pesos o cargas utilizados." value={firstClassRecord.loadsUsed} onChange={(loadsUsed) => updateFirstClass('loadsUsed', loadsUsed)} placeholder="Ej. Mancuernas de 6 kg y kettlebell de 12 kg." />
                <FirstClassTextField label="Ejercicios adaptados o sustituidos." value={firstClassRecord.adaptedExercises} onChange={(adaptedExercises) => updateFirstClass('adaptedExercises', adaptedExercises)} placeholder="Ej. Remo en lugar de carrera; ninguno si no hubo cambios." />
              </div>
            </section>
          </div>
        )}

        {showSavedFirstClass && <FirstClassSavedSummary record={savedFirstClassRecord} />}
        {error && !completed && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p>}
        {!showSavedFirstClass && <div className="mt-6"><PrimaryButton icon="check" onClick={confirm} disabled={completed}>{completed ? 'Guardado' : action === 'briefing' ? 'Marcar briefing consultado' : action === 'first-class' ? 'Guardar primera clase' : 'Guardar acción'}</PrimaryButton></div>}
        {completed && action !== 'first-class' && <p role="status" className="mt-4 rounded-xl border border-emerald-600/20 bg-emerald-50 p-4 text-base font-semibold text-emerald-800">Acción guardada con {shift?.trainerName} y hora local.</p>}
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
  const shift = flow.currentShift

  const nextAction = (() => {
    if (!shift || shift.status === 'closed') return null
    const opening = shift.tasks.find((task) => task.id === 'opening')
    const briefingTask = shift.tasks.find((task) => task.id === 'briefing')
    const firstClassTask = shift.tasks.find((task) => task.id === 'first-class') || {
      status: shift.firstClassRecord ? 'completed' : 'pending',
      detail: 'Registrar movimiento, molestia y trabajo completado.',
    }
    if (opening?.status !== 'completed') {
      return {
        eyebrow: 'Primero',
        title: 'Confirma la apertura',
        detail: opening.detail,
        button: 'Confirmar apertura',
        action: () => flow.completeTask('opening'),
        secondary: <button type="button" onClick={() => onOpenProtocol('opening')} className="min-h-11 text-sm font-bold text-[#6A1F6D] underline decoration-[#A729AD]/50 underline-offset-4">Consultar protocolo</button>,
      }
    }
    if (briefingTask?.status !== 'completed') {
      return {
        eyebrow: 'Antes de la clase',
        title: 'Revisa el briefing especial',
        detail: briefingTask.detail,
        button: 'Abrir briefing',
        action: () => onAction('briefing'),
      }
    }
    if (firstClassTask?.status !== 'completed') {
      return {
        eyebrow: 'Después de la clase',
        title: 'Registra la primera clase',
        detail: firstClassTask.detail,
        button: 'Cerrar primera clase',
        action: () => onAction('first-class'),
      }
    }
    if (!shift.endPreparation) {
      return {
        eyebrow: 'Fin del turno',
        title: 'Completa el cierre o relevo',
        detail: 'Las tareas críticas están completas. Deja preparado el final del turno.',
        button: 'Preparar cierre o relevo',
        action: () => onAction('handover'),
      }
    }
    return {
      eyebrow: 'Último paso',
      title: 'Cierra el turno',
      detail: `${shift.endPreparation.mode === 'handover' ? 'Relevo' : 'Cierre'} preparado a las ${formatTime(shift.endPreparation.completedAt)}.`,
      button: 'Cerrar turno',
      action: flow.close,
    }
  })()

  return (
    <div>
      <ScreenHeading eyebrow="Mi turno · Hoy" title={shift ? 'Tu turno' : 'Inicia tu turno'} detail={shift ? 'Lo importante, en el orden en que toca resolverlo.' : 'Elige una franja para comenzar la prueba local.'} />
      {!shift && <StartShiftCard onStart={flow.start} />}

      {shift && (
        <div className="space-y-6">
          <section aria-label="Resumen del turno" className="rounded-2xl border border-[#E1D3E3] bg-white px-4 py-3 shadow-[0_4px_16px_rgba(34,20,39,0.04)] sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1"><h2 className="font-evo-display text-2xl font-semibold text-[#241526]">{shift.label} · {shift.scheduledStart}–{shift.scheduledEnd}</h2><p className="text-sm font-semibold text-[#79677C]">{shift.trainerName} · entrada {formatTime(shift.startedAt)}</p></div>
              <p className={`text-sm font-bold ${shift.status === 'closed' ? 'text-emerald-700' : 'text-[#6A1F6D]'}`}>{shift.status === 'closed' ? 'Turno cerrado' : formatSandboxPunctuality(shift)}</p>
            </div>
            <div className="mt-3 flex items-center gap-3"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EEE3EF]"><div className="h-full rounded-full bg-gradient-to-r from-[#A729AD] to-[#FFFF4C]" style={{ width: `${getShiftProgress(shift)}%` }} /></div><strong className="text-sm text-[#6A1F6D]">{getShiftProgress(shift)}%</strong></div>
          </section>

          <section aria-labelledby="now-title" className={`rounded-2xl border p-5 shadow-[0_12px_30px_rgba(89,34,93,0.10)] sm:p-6 ${shift.status === 'closed' ? 'border-emerald-200 bg-white' : 'border-[#E4CDE6] bg-[#FFFFE2]'}`}>
            <p className={`text-sm font-extrabold uppercase tracking-[0.14em] ${shift.status === 'closed' ? 'text-emerald-700' : 'text-[#A729AD]'}`}>Ahora</p>
            {nextAction ? <><p className="mt-3 text-sm font-bold text-[#806E82]">{nextAction.eyebrow}</p><h2 id="now-title" className="mt-1 font-evo-display text-3xl font-semibold text-[#241526] sm:text-4xl">{nextAction.title}</h2><p className="mt-2 max-w-2xl text-base leading-7 text-[#604B63]">{nextAction.detail}</p><div className="mt-5 max-w-sm"><PrimaryButton icon="check" onClick={nextAction.action}>{nextAction.button}</PrimaryButton></div>{nextAction.secondary && <div className="mt-2">{nextAction.secondary}</div>}</> : <><h2 id="now-title" className="mt-2 font-evo-display text-3xl font-semibold text-[#241526]">Todo listo</h2><p className="mt-2 text-base text-[#604B63]">Turno cerrado por {shift.trainerName} a las {formatTime(shift.closedAt)}. Las excepciones abiertas siguen su curso en Dirección.</p></>}
          </section>

          <section aria-labelledby="information-title">
            <div className="mb-2 flex items-baseline justify-between gap-3"><h2 id="information-title" className="font-evo-display text-2xl font-semibold text-[#241526]">Información especial</h2><span className="text-sm font-semibold text-[#806E82]">{specialNotices.slice(0, 3).length} casos</span></div>
            <div className="overflow-hidden rounded-2xl border border-[#E2D6E3] bg-white">{specialNotices.slice(0, 3).map((notice) => <div key={notice.type} className="grid gap-1 border-b border-[#EEE5EF] px-4 py-3 last:border-0 sm:grid-cols-[11rem_1fr] sm:gap-4"><p className="text-sm font-bold text-[#A729AD]">{notice.type}</p><div><p className="text-base font-bold text-[#332036]">{notice.title}</p><p className="mt-0.5 text-sm leading-6 text-[#6E5A71]">{notice.detail}</p></div></div>)}</div>
          </section>

          <section aria-labelledby="register-title">
            <div className="mb-2"><h2 id="register-title" className="font-evo-display text-2xl font-semibold text-[#241526]">Registrar</h2><p className="text-sm text-[#806E82]">Solo si ha ocurrido algo que deba quedar visible.</p></div>
            <div className={`grid gap-2 ${shift.firstClassRecord ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>{quickActions.filter((item) => item.id !== 'handover' && (item.id !== 'first-class' || shift.firstClassRecord)).map((item) => <QuickActionButton key={item.id} icon={item.icon} disabled={shift.status === 'closed' && item.id !== 'first-class'} onClick={() => onAction(item.id)}>{item.id === 'first-class' ? 'Ver primera clase guardada' : item.label}</QuickActionButton>)}</div>
          </section>

          <section aria-labelledby="close-title" className="border-t border-[#DCCEDD] pt-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="close-title" className="font-evo-display text-2xl font-semibold text-[#241526]">Cierre</h2><p className="mt-1 text-sm text-[#6E5A71]">{shift.status === 'closed' ? `Completado a las ${formatTime(shift.closedAt)}` : getOwnCriticalBlockers(shift, shift.trainerId).length === 0 ? shift.endPreparation ? 'Preparado; aparece arriba como siguiente acción.' : 'Disponible como siguiente acción.' : `${getOwnCriticalBlockers(shift, shift.trainerId).length} tareas críticas antes de cerrar.`}</p></div><p className="text-sm font-bold text-[#806E82]">{shift.endPreparation ? `${shift.endPreparation.mode === 'handover' ? 'Relevo' : 'Cierre'} · ${formatTime(shift.endPreparation.completedAt)}` : 'Sin preparar'}</p></div>
          </section>

          <button type="button" onClick={flow.reset} className="min-h-11 text-sm font-bold text-[#806E82] underline underline-offset-4 hover:text-[#6A1F6D]">Reiniciar datos sintéticos</button>
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
  return <div><ScreenHeading eyebrow="Mi turno · Mi evolución" title="Una lectura breve" detail="Operativa diaria separada de la evaluación de calidad de clase." /><div className="grid gap-3 md:grid-cols-2">{evolutionSummary.slice(0, showDetail ? evolutionSummary.length : 3).map((item) => <LightCard key={item.label}><div className="flex items-start justify-between gap-3"><p className="text-base font-bold text-[#A729AD]">{item.label}</p><StatusBadge status={item.status}>{statusLabels[item.status]}</StatusBadge></div><p className="mt-3 font-evo-display text-3xl font-semibold">{item.value}</p><p className="mt-2 text-base text-[#604B63]">{item.detail}</p></LightCard>)}</div>{!showDetail && <button type="button" onClick={() => setShowDetail(true)} className="mt-5 min-h-11 text-base font-bold text-[#6A1F6D] underline underline-offset-4">Ver evaluación y foco de mejora</button>}</div>
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
    if (type === 'first-class') return flow.recordFirstClass(payload)
    if (type === 'feedback') return flow.recordFeedback(payload)
    if (type === 'handover') return flow.prepareEnd(payload.mode, payload.note)
    return false
  }

  let screen
  if (globalArea === 'programming') screen = <ProgrammingReference returnLabel={context === 'coach' ? 'Mi turno' : 'Operativa'} onReturn={() => setGlobalArea(context === 'coach' ? 'shift' : 'operations')} />
  else if (context === 'coach' && shiftArea === 'protocols') screen = <ProtocolsScreen initialProtocol={protocolToOpen} />
  else if (context === 'coach' && shiftArea === 'evolution') screen = <EvolutionScreen />
  else if (context === 'coach') screen = <TodayScreen flow={flow} onAction={(actionId) => { flow.clearMessages(); setAction(actionId) }} onOpenProtocol={(protocolId) => { setProtocolToOpen(protocolId); setShiftArea('protocols') }} />
  else if (globalArea === 'evaluations') screen = <EvaluationsScreen />
  else if (globalArea === 'team') screen = <TeamScreen />
  else screen = <OperationsScreen exceptions={exceptions} />

  return (
    <div className="min-h-[100dvh] bg-[#F6E8F9] font-evo-body text-[#241526] selection:bg-[#A729AD]/25">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[1480px]">
        <aside className="sticky top-0 hidden h-[100dvh] w-72 shrink-0 flex-col border-r border-white/10 bg-[#0C0B0C]/92 px-5 py-6 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3 px-2"><EvoLogo imgClassName="h-10 w-auto object-contain" /><div><p className="font-evo-display text-xl font-bold uppercase tracking-[0.12em] text-white">Programming EVO</p><p className="text-base font-bold text-[#C86CCE]">Entrenador y operativa</p></div></div>
          <nav aria-label={`Áreas de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="mt-10 space-y-2">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 text-left text-base font-bold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}><Icon name={item.icon} className="h-5 w-5" />{item.label}</button>)}</nav>
          {context === 'coach' && globalArea === 'shift' && <nav aria-label="Áreas de Mi turno" className="mt-5 border-l border-white/15 pl-4">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-11 w-full rounded-xl px-3 text-left text-base font-semibold ${shiftArea === item.id ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white'}`}>{item.label}</button>)}</nav>}
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-sm font-bold text-[#C86CCE]">Fase 2.2 · Local</p><p className="mt-1 text-sm leading-6 text-white/55">Datos ficticios · Sin conexión</p></div>
        </aside>

        <div className="min-w-0 flex-1 bg-[linear-gradient(145deg,#F6E8F9_0%,#FFFFE2_55%,#FFFFFF_100%)] pb-28 lg:pb-0">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0C0B0C]/95 px-4 py-3 text-white backdrop-blur-xl sm:px-6 lg:px-10"><div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-2.5 lg:hidden"><EvoLogo imgClassName="h-9 w-auto object-contain" /><div className="min-w-0"><p className="truncate font-evo-display text-lg font-bold uppercase text-white">Programming EVO</p><p className="truncate text-sm font-semibold text-[#C86CCE]">Mi turno · Fase 2.2</p></div></div><div className="flex w-full rounded-xl border border-white/10 bg-white/[0.04] p-1 sm:ml-auto sm:w-auto" aria-label="Cambiar rol simulado">{[['coach', `Entrenador · ${SYNTHETIC_ACTORS.coach.name}`], ['direction', 'Dirección']].map(([id, label]) => <button key={id} type="button" aria-pressed={context === id} onClick={() => changeContext(id)} className={`min-h-11 flex-1 rounded-lg px-3 text-sm font-extrabold transition focus:outline-none focus:ring-2 focus:ring-[#FFFF4C]/70 sm:flex-none sm:px-4 ${context === id ? 'bg-white text-[#241526]' : 'text-white/60 hover:text-white'}`}>{label}</button>)}</div></div>{context === 'coach' && globalArea === 'shift' && <nav aria-label="Secciones de Mi turno" className="mx-auto mt-3 flex max-w-6xl gap-1 overflow-x-auto lg:hidden">{shiftNavigation.map((item) => <button key={item.id} type="button" onClick={() => { setProtocolToOpen(null); setShiftArea(item.id) }} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${shiftArea === item.id ? 'bg-[#A729AD] text-white' : 'bg-white/[0.05] text-white/65'}`}>{item.label}</button>)}</nav>}</header>

          <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
            {flow.notice && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{flow.notice}</p>}
            {flow.error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{flow.error}</p>}
            {screen}
          </main>
        </div>
      </div>

      <nav aria-label={`Navegación móvil de ${context === 'coach' ? 'Entrenador' : 'Dirección'}`} className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#0C0B0C]/96 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl lg:hidden"><div className="mx-auto flex max-w-2xl gap-1 overflow-x-auto">{globalNavigation.map((item) => <button key={item.id} type="button" onClick={() => setGlobalArea(item.id)} className={`flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-3 text-base font-bold ${context === 'direction' ? 'min-w-[7rem]' : ''} ${globalArea === item.id ? 'bg-[#A729AD] text-white' : 'text-white/55'}`}><Icon name={item.icon} className="h-5 w-5" /><span>{item.label}</span></button>)}</div></nav>

      {action && flow.currentShift && <ActionDialog action={action} shift={flow.currentShift} error={flow.error} onClose={() => setAction(null)} onConfirm={confirmAction} onClearError={flow.clearMessages} />}
    </div>
  )
}
