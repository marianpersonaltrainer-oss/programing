import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getShiftProtocol, SHIFT_PROTOCOL_LINKS } from '../../constants/shiftProtocolResources.js'
import { createShiftId, getShiftTaskProgress } from '../../domain/shiftTaskProgress.js'
import { evoBrand } from '../../constants/evoBrand.js'
import {
  createShiftNote,
  createShiftProtocolLog,
  listMyShiftProtocolLogs,
  listTeamShiftNotes,
} from '../../lib/shiftProtocols.js'
import { formatMadridDayHeading, madridTodayYmd } from '../../utils/shiftProtocolTime.js'
import ShiftNoteList from './ShiftNoteList.jsx'
import ShiftPostClassForm from './ShiftPostClassForm.jsx'
import ShiftProtocolLogList from './ShiftProtocolLogList.jsx'

const ACTION_META = {
  apertura: {
    title: 'Apertura',
    description: 'Comprueba que el centro está preparado antes de empezar.',
    button: 'Guardar apertura',
  },
  cierre: {
    title: 'Finalizar turno',
    description: 'Revisa el protocolo correspondiente y deja el turno terminado.',
    button: 'Finalizar turno',
  },
}

const NEXT_ACTION_COPY = {
  opening: ['Empieza por la apertura', 'Abre el protocolo, comprueba el centro y guarda el resultado.'],
  review: ['Revisa personas y novedades', 'Mira la información del equipo antes de continuar con las clases.'],
  first_class: ['Completa la primera clase', 'Guarda el seguimiento post-clase antes de finalizar el turno.'],
  finish: ['Continúa con tus clases', 'Cuando termine tu franja, vuelve aquí para finalizar el turno.'],
  done: ['Turno finalizado', 'Las tres tareas del turno están completadas.'],
}

function openOfficialLink(url, setError) {
  const opened = window.open(url, '_blank')
  if (!opened) {
    setError('No se ha podido abrir el protocolo. Permite las ventanas emergentes e inténtalo de nuevo.')
    return
  }
  opened.opener = null
}

function SectionHeading({ step, title, detail }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: evoBrand.purple }}>{step}</p>
      <h2 className="font-evo-display text-2xl font-bold mt-1" style={{ color: evoBrand.text }}>{title}</h2>
      {detail ? <p className="text-sm leading-relaxed mt-1" style={{ color: evoBrand.muted }}>{detail}</p> : null}
    </div>
  )
}

export default function Pe2ShiftView({ profile }) {
  const [today, setToday] = useState(() => madridTodayYmd())
  const [logs, setLogs] = useState([])
  const [teamNotes, setTeamNotes] = useState([])
  const [peopleNotes, setPeopleNotes] = useState([])
  const [todayPostClassNotes, setTodayPostClassNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState('')
  const [selectedShiftId, setSelectedShiftId] = useState('')
  const [result, setResult] = useState('completado')
  const [comment, setComment] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [reviewFirstClass, setReviewFirstClass] = useState('')
  const [teamNote, setTeamNote] = useState('')
  const [showPostClass, setShowPostClass] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingNote, setSavingNote] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const requestSequence = useRef(0)

  const loadData = useCallback(async () => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    setLoading(true)
    setError('')
    try {
      const [nextLogs, nextTeamNotes, nextPeopleNotes, nextTodayPostClass] = await Promise.all([
        listMyShiftProtocolLogs(today),
        listTeamShiftNotes({ noteType: 'team', ymd: today, limit: 30 }),
        listTeamShiftNotes({ noteType: 'post_class', ymd: today, limit: 30 }),
        listTeamShiftNotes({ noteType: 'post_class', ymd: today, userId: profile?.id || '', limit: 30 }),
      ])
      if (requestSequence.current !== requestId) return
      setLogs(nextLogs)
      setTeamNotes(nextTeamNotes)
      setPeopleNotes(nextPeopleNotes)
      setTodayPostClassNotes(nextTodayPostClass)
    } catch (e) {
      if (requestSequence.current !== requestId) return
      setError(e.message || 'No se ha podido cargar la información del turno.')
    } finally {
      if (requestSequence.current === requestId) setLoading(false)
    }
  }, [profile?.id, today])

  useEffect(() => {
    loadData()
    return () => {
      requestSequence.current += 1
    }
  }, [loadData])

  useEffect(() => {
    const syncMadridDay = () => {
      const currentDay = madridTodayYmd()
      setToday((previousDay) => previousDay === currentDay ? previousDay : currentDay)
    }
    const timer = window.setInterval(syncMadridDay, 60_000)
    window.addEventListener('focus', syncMadridDay)
    document.addEventListener('visibilitychange', syncMadridDay)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', syncMadridDay)
      document.removeEventListener('visibilitychange', syncMadridDay)
    }
  }, [])

  const progress = useMemo(
    () => getShiftTaskProgress(logs, todayPostClassNotes, profile?.id || ''),
    [logs, profile?.id, todayPostClassNotes],
  )
  const [nextTitle, nextDetail] = NEXT_ACTION_COPY[progress.next]

  function beginRecord(recordType) {
    const continuingShift = progress.shiftId && !progress.finishComplete
    if (recordType === 'apertura' && !continuingShift) {
      setReviewFirstClass('')
      setShowPostClass(false)
      setTeamNote('')
    }
    setSelectedShiftId(recordType === 'apertura' && !continuingShift
      ? createShiftId()
      : progress.shiftId)
    setSelectedType(recordType)
    setResult('completado')
    setComment('')
    setConfirmed(false)
    setError('')
    setSuccess('')
  }

  async function handleProtocolSave(event) {
    event.preventDefault()
    const protocol = getShiftProtocol(selectedType)
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await createShiftProtocolLog({
        shiftId: selectedShiftId,
        recordType: selectedType,
        result,
        comment,
        allStepsConfirmed: confirmed,
        firstClassExpected: false,
        protocolVersion: protocol?.version,
      })
      setSuccess(selectedType === 'apertura'
        ? 'Apertura guardada correctamente.'
        : 'Turno finalizado correctamente.')
      setSelectedType('')
      setSelectedShiftId('')
      setComment('')
      setConfirmed(false)
      await loadData()
    } catch (e) {
      setError(e.message || 'No se ha podido guardar este paso del turno.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReviewSave() {
    if (!reviewFirstClass) {
      setError('Indica si tienes una primera clase en este turno.')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const firstClassExpected = reviewFirstClass === 'yes'
      await createShiftProtocolLog({
        shiftId: progress.shiftId,
        recordType: 'revision',
        result: 'completado',
        comment: '',
        allStepsConfirmed: true,
        firstClassExpected,
        protocolVersion: 'v0',
      })
      setSuccess('Personas y novedades revisadas.')
      setShowPostClass(firstClassExpected)
      await loadData()
    } catch (e) {
      setError(e.message || 'No se ha podido guardar la revisión del turno.')
    } finally {
      setSaving(false)
    }
  }

  async function handleTeamNoteSave(event) {
    event.preventDefault()
    setSavingNote(true)
    setError('')
    setSuccess('')
    try {
      await createShiftNote({ shiftId: progress.shiftId, noteType: 'team', teamNote })
      setTeamNote('')
      setSuccess('Novedad guardada para el equipo.')
      await loadData()
    } catch (e) {
      setError(e.message || 'No se ha podido guardar la novedad.')
    } finally {
      setSavingNote(false)
    }
  }

  async function handlePostClassSave(payload) {
    setSavingNote(true)
    try {
      await createShiftNote({ ...payload, shiftId: progress.shiftId })
      setSuccess('Seguimiento post-clase guardado.')
      setShowPostClass(false)
      await loadData()
    } finally {
      setSavingNote(false)
    }
  }

  function renderProtocolForm(recordType) {
    if (selectedType !== recordType) return null
    return (
      <form onSubmit={handleProtocolSave} className="rounded-2xl border p-5 sm:p-6 mt-4" style={{ backgroundColor: evoBrand.paleYellow, borderColor: `${evoBrand.purple}44` }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: evoBrand.purple }}>Paso del turno</p>
            <h3 className="font-evo-display text-xl font-bold mt-1" style={{ color: evoBrand.text }}>{ACTION_META[recordType].title}</h3>
          </div>
          <button type="button" onClick={() => setSelectedType('')} className="text-sm font-semibold" style={{ color: evoBrand.muted }}>Cancelar</button>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-bold" style={{ color: evoBrand.text }}>¿Cómo ha quedado?</legend>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[
              ['completado', 'Completado'],
              ['incidencia', 'Hay una incidencia'],
            ].map(([value, label]) => (
              <label key={value} className="cursor-pointer">
                <input
                  className="sr-only peer"
                  type="radio"
                  name={`shift-result-${recordType}`}
                  value={value}
                  checked={result === value}
                  onChange={() => {
                    setResult(value)
                    if (value === 'completado') setComment('')
                    setError('')
                  }}
                />
                <span className="block rounded-xl border px-3 py-3 text-center text-xs sm:text-sm font-bold bg-white peer-checked:border-[#A729AD] peer-checked:text-[#6A1F6D] peer-focus-visible:ring-2 peer-focus-visible:ring-[#A729AD] peer-focus-visible:ring-offset-2">{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {result === 'completado' ? (
          <label className="flex items-start gap-3 mt-5 rounded-xl bg-white p-4 border cursor-pointer" style={{ borderColor: `${evoBrand.purple}33` }}>
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#A729AD]" />
            <span className="text-sm font-semibold leading-relaxed" style={{ color: evoBrand.text }}>Confirmo que he realizado todos los pasos del protocolo correspondiente.</span>
          </label>
        ) : (
          <label className="block mt-5">
            <span className="text-sm font-bold" style={{ color: evoBrand.text }}>¿Qué paso no has podido completar?</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={600}
              rows={4}
              required
              className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#A729AD]"
              style={{ borderColor: `${evoBrand.purple}44` }}
              placeholder="Explícalo de forma breve y clara…"
            />
          </label>
        )}

        <button
          type="submit"
          disabled={saving || (result === 'completado' && !confirmed) || (result === 'incidencia' && !comment.trim())}
          className="mt-5 w-full rounded-xl px-5 py-3 text-sm font-bold text-white disabled:opacity-40"
          style={{ backgroundColor: evoBrand.accent }}
        >
          {saving ? 'Guardando…' : ACTION_META[recordType].button}
        </button>
      </form>
    )
  }

  const openingProtocol = SHIFT_PROTOCOL_LINKS.find((item) => item.recordType === 'apertura')
  const finishProtocol = SHIFT_PROTOCOL_LINKS.find((item) => item.recordType === 'cierre')
  const canAddShiftDetails = Boolean(
    progress.shiftId && progress.reviewComplete && !progress.finishComplete,
  )

  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-2" style={{ color: evoBrand.muted }}>
        {profile?.full_name ? `Hola, ${profile.full_name}` : 'Equipo EVO'}
      </p>
      <h1 className="font-evo-display text-3xl sm:text-4xl font-bold" style={{ color: evoBrand.text }}>Mi turno</h1>
      <p className="mt-2 text-sm capitalize" style={{ color: evoBrand.muted }}>{formatMadridDayHeading(today)} · hora de Granada</p>

      {error || success ? (
        <div className="sticky top-3 z-20 mt-5 space-y-2">
          {error ? <div role="alert" className="rounded-2xl border px-4 py-3 text-sm shadow-sm" style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', color: '#991B1B' }}>{error}</div> : null}
          {success ? <div role="status" className="rounded-2xl border px-4 py-3 text-sm shadow-sm" style={{ backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', color: '#047857' }}>{success}</div> : null}
        </div>
      ) : null}

      <section className="rounded-2xl border p-5 sm:p-6 mt-7" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <SectionHeading step="1" title="Qué toca ahora" />
        <div className="rounded-2xl mt-4 p-4" style={{ backgroundColor: '#F8F4F8' }}>
          <p className="text-sm font-bold" style={{ color: evoBrand.purple }}>{progress.completed} de 3 tareas completadas</p>
          <h3 className="font-evo-display text-xl font-bold mt-2" style={{ color: evoBrand.text }}>{nextTitle}</h3>
          <p className="text-sm mt-1 leading-relaxed" style={{ color: evoBrand.muted }}>{nextDetail}</p>
        </div>

        {progress.next === 'opening' ? (
          <div className="grid gap-2 mt-4 sm:grid-cols-2">
            <button type="button" onClick={() => beginRecord('apertura')} className="rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: evoBrand.accent }}>Empezar turno</button>
            <button type="button" onClick={() => openOfficialLink(openingProtocol.url, setError)} className="rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: `${evoBrand.purple}55`, color: evoBrand.purple }}>{openingProtocol.label} ↗</button>
          </div>
        ) : null}

        {progress.next === 'review' ? (
          <button type="button" onClick={() => document.getElementById('personas-turno')?.scrollIntoView({ behavior: 'smooth' })} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: evoBrand.accent }}>Revisar personas y novedades</button>
        ) : null}

        {progress.next === 'first_class' ? (
          <button type="button" onClick={() => { setShowPostClass(true); document.getElementById('personas-turno')?.scrollIntoView({ behavior: 'smooth' }) }} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: evoBrand.accent }}>Completar seguimiento de primera clase</button>
        ) : null}

        {progress.next === 'done' ? (
          <button type="button" onClick={() => beginRecord('apertura')} className="mt-4 w-full rounded-xl px-4 py-3 text-sm font-bold text-white" style={{ backgroundColor: evoBrand.accent }}>Empezar otro turno</button>
        ) : null}

        {renderProtocolForm('apertura')}
      </section>

      <section id="personas-turno" className="rounded-2xl border overflow-hidden mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="p-5 sm:p-6 border-b" style={{ borderColor: `${evoBrand.purple}22` }}>
          <SectionHeading step="2" title="Personas a tener en cuenta" detail="Seguimientos post-clase recientes que pueden ayudar al siguiente entrenador." />
          <button type="button" disabled={!canAddShiftDetails} onClick={() => setShowPostClass((value) => !value)} className="mt-4 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: evoBrand.accent }}>{showPostClass ? 'Ocultar formulario' : 'Añadir seguimiento post-clase'}</button>
        </div>
        {progress.next === 'review' ? (
          <fieldset className="m-4 sm:m-5 rounded-2xl border p-4" style={{ borderColor: `${evoBrand.purple}33` }}>
            <legend className="px-1 text-sm font-bold" style={{ color: evoBrand.text }}>¿Tienes una primera clase en este turno?</legend>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[["yes", 'Sí'], ["no", 'No']].map(([value, label]) => (
                <button key={value} type="button" aria-pressed={reviewFirstClass === value} onClick={() => setReviewFirstClass(value)} className={`rounded-xl border px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A729AD] focus-visible:ring-offset-2 ${reviewFirstClass === value ? 'border-[#A729AD] bg-[#F4E6F5] text-[#6A1F6D]' : 'border-[#DCCEDD] bg-white text-[#5C4960]'}`}>{label}</button>
              ))}
            </div>
          </fieldset>
        ) : null}
        {showPostClass ? <div className="p-4 sm:p-5"><ShiftPostClassForm key={progress.shiftId} onSave={handlePostClassSave} saving={savingNote} firstClassRequired={progress.firstClassExpected && !progress.firstClassComplete} /></div> : null}
        <ShiftNoteList notes={peopleNotes} loading={loading} emptyMessage="No hay seguimientos post-clase guardados." />
      </section>

      <section id="novedades-turno" className="rounded-2xl border overflow-hidden mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="p-5 sm:p-6 border-b" style={{ borderColor: `${evoBrand.purple}22` }}>
          <SectionHeading step="3" title="Novedades del turno" detail="Información compartida hoy por el equipo." />
        </div>
        <ShiftNoteList notes={teamNotes} loading={loading} emptyMessage="No hay novedades del equipo para hoy." />
        {progress.next === 'review' ? (
          <div className="p-4 sm:p-5 border-t" style={{ borderColor: `${evoBrand.purple}22` }}>
            <button type="button" disabled={saving || !reviewFirstClass} onClick={handleReviewSave} className="w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: evoBrand.accent }}>{saving ? 'Guardando…' : 'He revisado personas y novedades'}</button>
            {!reviewFirstClass ? <p className="mt-2 text-xs text-center" style={{ color: evoBrand.muted }}>Antes, indica en Personas si tienes una primera clase.</p> : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border p-5 sm:p-6 mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <SectionHeading step="4" title="Anotar algo" detail="¿Ha ocurrido algo que deba saber el equipo?" />
        <form onSubmit={handleTeamNoteSave} className="mt-4">
          <label htmlFor="shift-team-note" className="sr-only">¿Ha ocurrido algo que deba saber el equipo?</label>
          <textarea id="shift-team-note" value={teamNote} onChange={(event) => setTeamNote(event.target.value)} maxLength={600} rows={4} required className="w-full rounded-xl border bg-white px-4 py-3 text-sm focus:outline-none focus:border-[#A729AD]" style={{ borderColor: `${evoBrand.purple}44` }} placeholder="Escribe solo la información necesaria para el relevo…" />
          <button type="submit" disabled={savingNote || !canAddShiftDetails || !teamNote.trim()} className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: evoBrand.accent }}>{savingNote ? 'Guardando…' : 'Guardar novedad'}</button>
        </form>
      </section>

      <section className="rounded-2xl border p-5 sm:p-6 mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <SectionHeading step="5" title="Finalizar turno" detail="Completa este paso al terminar tu franja." />
        {progress.finishComplete ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">Turno finalizado correctamente.</p>
        ) : (
          <div className="grid gap-2 mt-4 sm:grid-cols-2">
            <button type="button" disabled={!progress.canFinish} onClick={() => beginRecord('cierre')} className="rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-40" style={{ backgroundColor: evoBrand.accent }}>Finalizar turno</button>
            <button type="button" onClick={() => openOfficialLink(finishProtocol.url, setError)} className="rounded-xl border px-4 py-3 text-sm font-bold" style={{ borderColor: `${evoBrand.purple}55`, color: evoBrand.purple }}>{finishProtocol.label} ↗</button>
          </div>
        )}
        {!progress.canFinish && !progress.finishComplete ? (
          <p className="mt-3 text-sm" style={{ color: evoBrand.muted }}>
            {!progress.openingComplete ? 'Primero completa la apertura.' : !progress.reviewComplete ? 'Primero revisa personas y novedades.' : 'Falta guardar el seguimiento de la primera clase.'}
          </p>
        ) : null}
        {renderProtocolForm('cierre')}
      </section>

      <section className="rounded-2xl border overflow-hidden mt-5" style={{ backgroundColor: evoBrand.card, borderColor: `${evoBrand.purple}33` }}>
        <div className="px-4 py-4 sm:px-5 border-b flex items-center justify-between gap-3" style={{ borderColor: `${evoBrand.purple}22` }}>
          <div>
            <h2 className="font-evo-display text-lg font-bold" style={{ color: evoBrand.text }}>Actividad de hoy</h2>
            <p className="text-xs mt-1" style={{ color: evoBrand.muted }}>Historial inmutable de los pasos del turno.</p>
          </div>
          <button type="button" onClick={loadData} disabled={loading} className="text-xs font-bold" style={{ color: evoBrand.purple }}>Actualizar</button>
        </div>
        <ShiftProtocolLogList logs={logs} loading={loading} />
      </section>
    </div>
  )
}
