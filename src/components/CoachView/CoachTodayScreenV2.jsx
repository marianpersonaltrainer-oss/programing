import { useMemo, useState } from 'react'
import { madridWeekdayChipIndex, madridWeekdayLabelEs } from '../../utils/coachTime.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { hasNonTrivialPublishedFeedback } from '../../utils/coachSessionPrep.js'
import { findDia, sessionText, hasProgrammedSessionText } from './coachViewUtils.js'
import { classAccentBySessionKey, classDisplayTitle } from './coachTheme.js'
import { CoachSessionBriefingPreview } from './CoachSessionBriefing.jsx'
import CoachFormattedSession from './CoachFormattedSession.jsx'

function shortDayLabel(dayName) {
  const n = String(dayName || '').toLowerCase()
  if (n.startsWith('lunes')) return 'Lun'
  if (n.startsWith('martes')) return 'Mar'
  if (n.startsWith('miércoles') || n.startsWith('miercoles')) return 'Mié'
  if (n.startsWith('jueves')) return 'Jue'
  if (n.startsWith('viernes')) return 'Vie'
  if (n.startsWith('sábado') || n.startsWith('sabado')) return 'Sáb'
  if (n.startsWith('domingo')) return 'Dom'
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
  const normalize = (value) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
  return normalize(dayName) === normalize(madridWeekdayLabelEs())
}

function latestHandoff(handoffs, classLabel) {
  const classKey = normalizedClassLabel(classLabel)
  const matched = (handoffs || [])
    .filter((handoff) => normalizedClassLabel(handoff?.class_type) === classKey && String(handoff?.note || '').trim())
    .sort((a, b) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
  return matched[0] || null
}

function classEntriesForDay(day) {
  if (!day) return []
  return EVO_SESSION_CLASS_DEFS.filter((definition) => hasProgrammedSessionText(day[definition.key]))
}

/**
 * Vista experimental, activada solo con ?coachTodayPreview=1.
 * Consume únicamente la semana publicada y el feedback que la vista Coach ya
 * muestra. No lee ni guarda seguimientos personales de adaptaciones.
 */
export default function CoachTodayScreenV2({
  weekData,
  activeDay,
  setActiveDay,
  todayHandoffs = [],
  onOpenFeedback,
}) {
  const [expandedKey, setExpandedKey] = useState(null)
  const [headCoachNoticeOpen, setHeadCoachNoticeOpen] = useState(false)
  const days = weekData?.dias || []
  const selectedDay = findDia(days, activeDay)
  const classes = useMemo(() => classEntriesForDay(selectedDay), [selectedDay])
  const currentExpandedKey = classes.some((definition) => definition.key === expandedKey)
    ? expandedKey
    : classes[0]?.key || null
  const showTodayHandoffs = Boolean(selectedDay && dayIsToday(selectedDay.nombre))

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-y-auto bg-[#0C0B0C] px-4 pb-10 pt-5 sm:px-7 lg:px-10">
      <header className="mx-auto w-full max-w-6xl border-b border-[#F6E8F9]/15 pb-5">
        <p className="font-evo-display text-[11px] font-bold uppercase tracking-[0.2em] text-[#A729AD]">EVO · Coach</p>
        <h1 className="mt-2 font-evo-display text-3xl font-black tracking-tight text-[#F6E8F9] sm:text-4xl">Mis clases de hoy</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#F6E8F9]/65">
          Abre tu clase, revisa la programación y deja el relevo claro al terminar.
        </p>
      </header>

      <nav aria-label="Días de la semana" className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto py-5">
        {days.map((day, index) => {
          const active = activeDay === day.nombre
          const today = index === madridWeekdayChipIndex()
          return (
            <button
              key={day.nombre}
              type="button"
              onClick={() => setActiveDay(day.nombre)}
              className={`relative shrink-0 rounded-xl border px-3 py-2 text-sm font-bold transition-colors ${
                active
                  ? 'border-[#A729AD] bg-[#A729AD] text-white'
                  : 'border-[#6A1F6D]/45 bg-transparent text-[#F6E8F9]/70 hover:border-[#A729AD]/70'
              }`}
            >
              {shortDayLabel(day.nombre)}
              {today ? <span className="absolute -bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#FFFF4C]" /> : null}
            </button>
          )
        })}
      </nav>

      <main className="mx-auto w-full max-w-6xl">
        {!selectedDay ? <p className="text-sm text-[#F6E8F9]/65">No hay programación para este día.</p> : null}
        {selectedDay && !classes.length ? <p className="text-sm text-[#F6E8F9]/65">No hay clases publicadas para este día.</p> : null}

        <div className="divide-y divide-[#F6E8F9]/15 border-y border-[#F6E8F9]/15">
          {classes.map((definition) => {
            const open = currentExpandedKey === definition.key
            const accent = classAccentBySessionKey(definition.key)
            const session = sessionText(selectedDay[definition.key])
            const briefing = sessionText(selectedDay[definition.feedbackKey])
            const handoff = showTodayHandoffs ? latestHandoff(todayHandoffs, definition.label) : null
            return (
              <section key={definition.key} className="py-1">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setExpandedKey(open ? null : definition.key)}
                  className="flex w-full items-center gap-4 px-1 py-5 text-left sm:px-3"
                >
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: accent }} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-evo-display text-xl font-bold text-[#F6E8F9]">{classDisplayTitle(definition.key)}</span>
                    <span className="mt-1 block text-sm text-[#F6E8F9]/60">Clase publicada · toca para {open ? 'cerrar' : 'ver'}</span>
                  </span>
                  <span className="text-xl text-[#FFFF4C]" aria-hidden>{open ? '−' : '+'}</span>
                </button>

                {open ? (
                  <div className="grid gap-8 px-1 pb-7 pt-1 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.72fr)] sm:px-3">
                    <div>
                      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#F6E8F9]/55">Programación de la clase</p>
                      <CoachFormattedSession text={session} accentColor={accent} variant="card" />
                    </div>

                    <aside className="border-l-0 border-[#A729AD]/35 pl-0 lg:border-l lg:pl-7">
                      {hasNonTrivialPublishedFeedback(briefing) ? (
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F6E8F9]/55">Feedback del Head Coach</p>
                          <div className="mt-3 border-t border-[#A729AD]/35 pt-3">
                            <CoachSessionBriefingPreview text={briefing} lineClamp={4} />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm leading-relaxed text-[#F6E8F9]/60">Sin briefing publicado para esta clase.</p>
                      )}

                      {handoff?.note ? (
                        <div className="mt-5 border-t border-[#FFFF4C]/45 pt-4">
                          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFFF4C]">Feedback del equipo hoy</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#F6E8F9]/85">{handoff.note}</p>
                        </div>
                      ) : null}

                      <div className="mt-6 border-t border-[#F6E8F9]/15 pt-5">
                        <p className="text-sm leading-relaxed text-[#F6E8F9]/65">
                          Las adaptaciones privadas aparecerán aquí solo cuando la conexión segura esté preparada.
                        </p>
                        <button
                          type="button"
                          onClick={() => setHeadCoachNoticeOpen(true)}
                          className="mt-4 w-full rounded-xl bg-[#A729AD] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#8e2294]"
                        >
                          Preguntar dudas sobre esta clase
                        </button>
                      </div>
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
          className="mt-6 text-sm font-semibold text-[#F6E8F9] underline decoration-[#A729AD] decoration-2 underline-offset-4 hover:text-white"
        >
          Al terminar: registrar feedback
        </button>
      </main>

      {headCoachNoticeOpen ? (
        <div className="fixed inset-0 z-[190] flex items-end bg-black/70 p-4 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Head Coach en preparación">
          <div className="w-full max-w-md rounded-2xl border border-[#A729AD]/60 bg-[#1A0F1B] p-6 shadow-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFFF4C]">Head Coach</p>
            <h2 className="mt-2 font-evo-display text-2xl font-bold text-[#F6E8F9]">Conexión en preparación</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#F6E8F9]/75">
              La clase ya está contextualizada. La respuesta del Head Coach se conectará aquí cuando esté lista la vía privada y segura.
            </p>
            <button type="button" onClick={() => setHeadCoachNoticeOpen(false)} className="mt-6 w-full rounded-xl border border-[#F6E8F9]/35 px-4 py-3 text-sm font-bold text-[#F6E8F9] hover:border-[#F6E8F9]/70">
              Entendido
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
