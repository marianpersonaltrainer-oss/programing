import { useEffect, useMemo, useState } from 'react'
import { madridWeekdayChipIndex, madridWeekdayLabelEs } from '../../utils/coachTime.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { hasNonTrivialPublishedFeedback } from '../../utils/coachSessionPrep.js'
import { findDia, sessionText, hasProgrammedSessionText } from './coachViewUtils.js'
import { classDisplayTitle } from './coachTheme.js'
import { CoachSessionBriefingPreview } from './CoachSessionBriefing.jsx'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import HeadCoachQuestionDialog from './HeadCoachQuestionDialog.jsx'
import CoachTrialRosterPanel from './CoachTrialRosterPanel.jsx'
import EvoLogo from '../EvoLogo.jsx'

function shortDayLabel(dayName) {
  const name = String(dayName || '').toLowerCase()
  if (name.startsWith('lunes')) return 'Lun'
  if (name.startsWith('martes')) return 'Mar'
  if (name.startsWith('miércoles') || name.startsWith('miercoles')) return 'Mié'
  if (name.startsWith('jueves')) return 'Jue'
  if (name.startsWith('viernes')) return 'Vie'
  if (name.startsWith('sábado') || name.startsWith('sabado')) return 'Sáb'
  if (name.startsWith('domingo')) return 'Dom'
  return String(dayName || '').slice(0, 3)
}

function normalizedClassLabel(label) {
  return String(label || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_-]/g, '')
}

function dayIsToday(dayName) {
  const normalize = (value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
  return normalize(dayName) === normalize(madridWeekdayLabelEs())
}

function latestHandoff(handoffs, classLabel) {
  const classKey = normalizedClassLabel(classLabel)
  return (handoffs || [])
    .filter((handoff) => normalizedClassLabel(handoff?.class_type) === classKey && String(handoff?.note || '').trim())
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0] || null
}

function classEntriesForDay(day) {
  if (!day) return []
  return EVO_SESSION_CLASS_DEFS.filter((definition) => hasProgrammedSessionText(day[definition.key]))
}

function checklistStorageKey(dayName) {
  return `evo_coach_today_checklist:${String(dayName || 'sin-dia').toLowerCase()}`
}

function loadChecklist(dayName) {
  try {
    const value = JSON.parse(localStorage.getItem(checklistStorageKey(dayName)) || '{}')
    return value && typeof value === 'object' ? value : {}
  } catch { return {} }
}

/** Pantalla principal: una secuencia simple para preparar, impartir y relevar. */
export default function CoachTodayScreenV2({
  weekData,
  activeDay,
  setActiveDay,
  todayHandoffs = [],
  onOpenFeedback,
  onOpenTrial,
}) {
  const [expandedKey, setExpandedKey] = useState(null)
  const [headCoachContext, setHeadCoachContext] = useState(null)
  const [trialMeta, setTrialMeta] = useState({ state: 'loading', count: 0 })
  const [checklist, setChecklist] = useState({})
  const days = weekData?.dias || []
  const selectedDay = findDia(days, activeDay)
  const classes = useMemo(() => classEntriesForDay(selectedDay), [selectedDay])
  const currentExpandedKey = classes.some((definition) => definition.key === expandedKey)
    ? expandedKey
    : null
  const showTodayHandoffs = Boolean(selectedDay && dayIsToday(selectedDay.nombre))

  useEffect(() => {
    setChecklist(loadChecklist(selectedDay?.nombre))
  }, [selectedDay?.nombre])

  const toggleChecklist = (id) => {
    const next = { ...checklist, [id]: !checklist[id] }
    setChecklist(next)
    try { localStorage.setItem(checklistStorageKey(selectedDay?.nombre), JSON.stringify(next)) } catch { /* opcional */ }
  }

  const trialSummary = trialMeta.state === 'loading'
    ? 'Comprobando'
    : trialMeta.state === 'unavailable'
      ? 'Revisar conexión'
      : trialMeta.count === 0
        ? 'Ninguna prevista'
        : `${trialMeta.count} preparada${trialMeta.count === 1 ? '' : 's'}`

  return (
    <div className="coach-page flex flex-1 min-h-0 flex-col overflow-y-auto pb-8">
      <header className="coach-turn-cover px-5 pt-5 sm:px-8">
        <div className="coach-turn-cover-inner mx-auto w-full max-w-5xl">
          <div className="coach-turn-cover-top">
            <EvoLogo imgClassName="h-14 w-auto object-contain" />
            <span>{selectedDay?.nombre || 'Semana activa'}</span>
          </div>
          <div className="coach-turn-cover-copy">
            <p>MI TURNO</p>
            <h1>Tu día,<br />bien llevado.</h1>
            <span>{classes.length === 0 ? 'Sin clases publicadas' : `${classes.length} ${classes.length === 1 ? 'clase para preparar' : 'clases para preparar'}`}</span>
          </div>
          <p className="coach-turn-cover-note">Todo lo necesario antes de empezar. Una cosa cada vez.</p>
        </div>
      </header>

      <nav aria-label="Días de la semana" className="coach-day-tabs mx-auto flex w-full max-w-5xl gap-2 overflow-x-auto px-5 py-5 sm:px-8">
        {days.map((day, index) => {
          const active = activeDay === day.nombre
          const today = index === madridWeekdayChipIndex()
          return (
            <button
              key={day.nombre}
              type="button"
              onClick={() => setActiveDay(day.nombre)}
              data-active={active}
              className="coach-day-tab relative shrink-0 border px-3.5 py-2.5 font-bold transition-colors"
            >
              <span>{shortDayLabel(day.nombre)}</span>
              {today ? <span className="coach-day-today" aria-label="Hoy" /> : null}
            </button>
          )
        })}
      </nav>

      <main className="mx-auto w-full max-w-5xl px-5 sm:px-8">
        <section className="coach-primary-task" aria-label="Paso de hoy">
          <span className="coach-primary-task-number" aria-hidden>01</span>
          <div>
            <p className="coach-eyebrow">Para empezar</p>
            <h2>{classes.length === 1 ? 'Prepara tu única clase de hoy' : `Prepara tus ${classes.length} clases de hoy`}</h2>
            <p>Abre solo la que necesitas: sesión, clave de dirección y relevo del equipo.</p>
          </div>
        </section>

        <section className="coach-today-glance mt-5" aria-label="Resumen de hoy">
          <div>
            <span>Clases</span>
            <strong>{classes.length || '—'}</strong>
            <small>{classes.length === 1 ? 'para impartir' : 'para impartir hoy'}</small>
          </div>
          <div>
            <span>Pruebas</span>
            <strong className={trialMeta.state === 'unavailable' ? 'coach-glance-warning' : ''}>{trialMeta.state === 'ready' ? trialMeta.count : '—'}</strong>
            <small>{trialSummary}</small>
          </div>
          <div>
            <span>Relevo</span>
            <strong>{todayHandoffs.length || '—'}</strong>
            <small>{todayHandoffs.length ? 'notas del equipo' : 'sin notas nuevas'}</small>
          </div>
        </section>

        <CoachTrialRosterPanel onOpenTrial={onOpenTrial} onStatusChange={setTrialMeta} variant="inline" />

        <section className="coach-today-checklist mt-5" aria-label="Checklist personal">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="coach-eyebrow">Tu checklist</p>
              <h2>Deja tu día encaminado</h2>
            </div>
            <span>Solo para organizarte</span>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { id: 'programacion', label: 'He revisado mis clases y el briefing.' },
              ...(trialMeta.state === 'ready' && trialMeta.count > 0 ? [{ id: 'pruebas', label: 'He visto las fichas de las personas nuevas.' }] : []),
              { id: 'relevo', label: 'Al acabar, dejaré el relevo útil para el siguiente turno.' },
            ].map((item) => (
              <button key={item.id} type="button" onClick={() => toggleChecklist(item.id)} data-complete={Boolean(checklist[item.id])} className="coach-checklist-row w-full text-left">
                <span aria-hidden>{checklist[item.id] ? '✓' : ''}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        {!selectedDay ? <p className="py-8 text-sm text-[#0C0B0C]/60">No hay programación para este día.</p> : null}
        {selectedDay && !classes.length ? <p className="py-8 text-sm text-[#0C0B0C]/60">No hay clases publicadas para este día.</p> : null}

        <div className="coach-section-heading mt-8">
          <p>Tu recorrido</p>
          <span>{classes.length ? 'Elige una clase' : 'Sin clases hoy'}</span>
        </div>

        <div className="coach-class-list mt-3 divide-y">
          {classes.map((definition, index) => {
            const open = currentExpandedKey === definition.key
            const session = sessionText(selectedDay[definition.key])
            const briefing = sessionText(selectedDay[definition.feedbackKey])
            const handoff = showTodayHandoffs ? latestHandoff(todayHandoffs, definition.label) : null

            return (
              <section key={definition.key} className="coach-class-row">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpandedKey(open ? null : definition.key)}
                  className="coach-class-row-button flex w-full items-center gap-4 px-4 py-5 text-left sm:px-5"
                  style={{ '--coach-session-accent': definition.color }}
                >
                  <span data-open={open} className="coach-class-index flex shrink-0 items-center justify-center text-xs font-black">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="coach-class-name block font-bold">{classDisplayTitle(definition.key)}</span>
                    <span className="coach-class-help mt-1 block">{open ? 'Estás viendo esta sesión' : 'Sesión y claves para impartirla'}</span>
                  </span>
                  <span className="coach-class-action shrink-0 rounded-lg border px-3 py-2 font-bold">{open ? 'Listo' : 'Ver'}</span>
                </button>

                {open ? (
                  <div className="coach-class-expanded grid gap-6 border-t px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.7fr)]">
                    <div>
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#6A1F6D]">La sesión</p>
                      <CoachFormattedSession text={session} accentColor={definition.color} variant="card" />
                    </div>
                    <aside className="space-y-5">
                      {hasNonTrivialPublishedFeedback(briefing) ? (
                        <div className="border-l-2 border-[#6A1F6D] pl-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6A1F6D]">Clave del Head Coach</p>
                          <div className="mt-2 text-[#0C0B0C]"><CoachSessionBriefingPreview text={briefing} lineClamp={4} /></div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-[#0C0B0C]/60">No hay una nota específica del Head Coach para esta clase.</p>
                      )}

                      {handoff?.note ? (
                        <div className="rounded-xl border border-[#DDD2C2] bg-white px-4 py-3">
                          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#6A1F6D]">Nota del equipo hoy</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#0C0B0C]/75">{handoff.note}</p>
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setHeadCoachContext({ dayName: selectedDay.nombre, classLabel: definition.label, sessionText: session })}
                        className="coach-neutral-button w-full rounded-xl border px-4 py-3 text-sm font-bold transition-colors"
                      >
                        Tengo una duda sobre esta clase
                      </button>
                    </aside>
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>

        <button
          type="button"
          onClick={onOpenFeedback}
          className="coach-primary-button mt-5 w-full px-4 py-4 transition-transform active:scale-[0.99]"
        >
          Cuando acabes, dejar una nota del turno
        </button>
      </main>

      {headCoachContext ? <HeadCoachQuestionDialog context={headCoachContext} onClose={() => setHeadCoachContext(null)} /> : null}
    </div>
  )
}
