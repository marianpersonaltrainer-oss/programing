import { useMemo, useState } from 'react'
import { madridWeekdayChipIndex, madridWeekdayLabelEs } from '../../utils/coachTime.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { MESOCYCLES } from '../../constants/evoColors.js'
import { hasNonTrivialPublishedFeedback } from '../../utils/coachSessionPrep.js'
import { findDia, sessionText, hasProgrammedSessionText } from './coachViewUtils.js'
import { classAccentBySessionKey, classDisplayTitle } from './coachTheme.js'
import { CoachSessionBriefingPreview } from './CoachSessionBriefing.jsx'
import WodModal from './WodModal.jsx'

/** Clases con WOD programado o con briefing publicado (p. ej. Gimnástica solo algunos días). */
function classDefsWithContentForDay(dia) {
  if (!dia) return []
  return EVO_SESSION_CLASS_DEFS.filter((def) => {
    const programmed = hasProgrammedSessionText(dia[def.key])
    const fb = hasNonTrivialPublishedFeedback(sessionText(dia[def.feedbackKey]))
    return programmed || fb
  })
}

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

function normClassLabel(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s_-]/g, '')
}

function normDayName(s) {
  return String(s || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** `listTodayHandoffs` es del día calendario en Madrid; solo si el chip coincide con ese día (por nombre, no por índice del array). */
function selectedDayIsMadridCalendarToday(diaNombre) {
  if (!diaNombre) return false
  const todayLabel = madridWeekdayLabelEs()
  return normDayName(todayLabel) === normDayName(diaNombre)
}

/** Último `daily_handoffs` de hoy para esa clase (coincidencia flexible de etiqueta). */
function latestDailyHandoffForClass(handoffs, classLabel) {
  const target = normClassLabel(classLabel)
  const rows = (handoffs || []).filter((h) => {
    const note = String(h?.note || '').trim()
    if (!note) return false
    return normClassLabel(h.class_type) === target
  })
  if (!rows.length) return null
  rows.sort((a, b) => {
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return tb - ta
  })
  return rows[0]
}

function formatShortTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ''
  }
}

function CardDivider() {
  return <div className="my-2 border-t border-[#F6E8F9]/12" aria-hidden />
}

function ClassDayCard({
  classDef,
  accent,
  dia,
  todayHandoffs,
  useDailyHandoffs,
  onOpenWod,
}) {
  const sessionRaw = dia ? sessionText(dia[classDef.key]) : ''
  const hasSession = dia ? hasProgrammedSessionText(dia[classDef.key]) : false
  const sessionFeedbackRaw = dia ? sessionText(dia[classDef.feedbackKey]) : ''
  const hasSessionFeedback = hasNonTrivialPublishedFeedback(sessionFeedbackRaw)
  const daily =
    dia && useDailyHandoffs ? latestDailyHandoffForClass(todayHandoffs, classDef.label) : null

  const handoff = daily
    ? {
        meta: [daily.coach_name, formatShortTime(daily.created_at)].filter(Boolean).join(' · '),
        note: String(daily.note || '').trim(),
      }
      : null

  const title = classDisplayTitle(classDef.key)

  return (
    <article
      className="rounded-[12px] bg-[#1a0f1b] p-4 flex flex-col border-t-4"
      style={{ borderTopColor: accent }}
    >
      <h3 className="font-evo-display font-bold text-[16px] uppercase tracking-wide" style={{ color: accent }}>
        {title}
      </h3>

      <CardDivider />

      <div className="flex-1 min-h-0">
        {handoff ? (
          <>
            <p className="text-[12px] leading-snug text-[#F6E8F9CC]" style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}>
              {handoff.meta}
            </p>
            <p className="mt-1 text-[13px] text-[#F6E8F9] line-clamp-2 leading-snug whitespace-pre-wrap">{handoff.note}</p>
          </>
        ) : (
          <p
            className="text-[12px] italic text-[#F6E8F966]"
            style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
          >
            Sin feedback hoy
          </p>
        )}
      </div>

      {hasSessionFeedback ? (
        <>
          <CardDivider />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#F6E8F966] mb-1">Briefing programación</p>
          <CoachSessionBriefingPreview text={sessionFeedbackRaw} accent={accent} lineClamp={4} />
        </>
      ) : null}

      <CardDivider />

      <button
        type="button"
        disabled={!dia || !hasSession}
        onClick={() => {
          if (!dia || !hasSession) return
          onOpenWod({
            sessionKey: classDef.key,
            classLabel: classDef.label,
            sessionText: sessionRaw,
            sessionFeedback: hasSessionFeedback ? String(sessionFeedbackRaw).trim() : '',
            dailyFeedback: handoff,
            accentColor: accent,
            dayName: dia.nombre,
          })
        }}
        className="mt-0 w-full py-2.5 rounded-lg bg-[#0C0B0C] font-evo-display font-semibold text-[13px] uppercase tracking-wide transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ color: accent, borderWidth: 1, borderStyle: 'solid', borderColor: accent }}
      >
        WOD →
      </button>
    </article>
  )
}

/**
 * Pantalla «Hoy» v3: tarjetas dinámicas por clase con sesión o briefing publicado; WOD en modal estilo documento.
 */
export default function CoachTodayScreen({
  weekData,
  activeWeekRow,
  activeDay,
  setActiveDay,
  onConsultAssistant,
  exerciseLibrary = [],
  todayHandoffs = [],
}) {
  const [wodModal, setWodModal] = useState(null)
  const dias = weekData?.dias || []
  const workWeek = useMemo(() => dias, [dias])

  const contextLine = useMemo(() => {
    const s = activeWeekRow?.semana
    const m = activeWeekRow?.mesociclo
    const mesoLabel = MESOCYCLES.find((x) => x.value === m)?.label || (m ? String(m) : '')
    const inten = String(weekData?.resumen?.intensidad || '').trim()
    const parts = []
    if (s != null && s !== '') parts.push(`S${s}`)
    if (mesoLabel) parts.push(`Mesociclo ${mesoLabel}`)
    if (inten) parts.push(inten)
    return parts.length ? parts.join(' · ') : 'Semana activa'
  }, [activeWeekRow, weekData])

  const dia = findDia(dias, activeDay)
  const madridChipIndex = useMemo(() => madridWeekdayChipIndex(), [])
  const useDailyHandoffs = dia ? selectedDayIsMadridCalendarToday(dia.nombre) : false
  const classDefsForDay = useMemo(() => classDefsWithContentForDay(dia), [dia])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0C0B0C]">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-0 pb-6">
        <p
          className="px-4 pt-3 pb-2 font-evo-body text-[12px] leading-tight text-[#F6E8F966]"
          style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
        >
          {contextLine}
        </p>

        <div className="flex gap-2 px-4 pb-4 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {workWeek.map((d, idx) => {
            const active = activeDay === d.nombre
            const isTodayChip = idx === madridChipIndex
            return (
              <div key={d.nombre} className="relative shrink-0 flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setActiveDay(d.nombre)}
                  className={`min-w-[3rem] px-3 py-2 rounded-xl border text-[13px] font-evo-display font-bold uppercase tracking-wide transition-colors ${
                    active
                      ? 'bg-[#A729AD] text-white border-[#A729AD]'
                      : 'bg-transparent text-[#F6E8F966] border-[#6A1F6D44]'
                  }`}
                >
                  {shortDayLabel(d.nombre)}
                </button>
                {isTodayChip ? <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#FFFF4C]" aria-hidden /> : <span className="mt-1 h-1.5 w-1.5" />}
              </div>
            )
          })}
        </div>

        <div className="px-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {!dia ? (
            <p className="text-sm text-[#F6E8F966] xl:col-span-3">No hay datos para este día.</p>
          ) : classDefsForDay.length === 0 ? (
            <p className="text-sm text-[#F6E8F966] xl:col-span-3">Sin sesiones ni briefing publicado para este día.</p>
          ) : (
            classDefsForDay.map((classDef) => {
              const accent = classAccentBySessionKey(classDef.key)
              return (
                <ClassDayCard
                  key={classDef.key}
                  classDef={classDef}
                  accent={accent}
                  dia={dia}
                  todayHandoffs={todayHandoffs}
                  useDailyHandoffs={useDailyHandoffs}
                  onOpenWod={setWodModal}
                />
              )
            })
          )}
        </div>
      </div>

      {wodModal ? (
        <WodModal
          open
          onClose={() => setWodModal(null)}
          sessionKey={wodModal.sessionKey}
          classLabel={wodModal.classLabel}
          dayName={wodModal.dayName}
          sessionText={wodModal.sessionText}
          sessionFeedback={wodModal.sessionFeedback}
          dailyFeedback={wodModal.dailyFeedback}
          accentColor={wodModal.accentColor}
          exerciseLibrary={exerciseLibrary}
          onConsultAssistant={(ctx) => {
            setWodModal(null)
            onConsultAssistant(ctx)
          }}
        />
      ) : null}
    </div>
  )
}
