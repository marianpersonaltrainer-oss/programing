import { useState, useMemo } from 'react'
import { madridWeekdayChipIndex } from '../../utils/coachTime.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { MESOCYCLES } from '../../constants/evoColors.js'
import { findLastCoachHandoffNote, handoffNoteMetaLine } from '../../utils/coachSessionPrep.js'
import { findDia, sessionText, hasProgrammedSessionText } from './coachViewUtils.js'
import CoachFormattedSession from './CoachFormattedSession.jsx'

const MAIN_CLASS_TABS = [
  { key: 'evofuncional', tabLabel: 'FUNCIONAL' },
  { key: 'evobasics', tabLabel: 'BASICS' },
  { key: 'evofit', tabLabel: 'FIT' },
]

function shortDayLabel(dayName) {
  const n = String(dayName || '').toLowerCase()
  if (n.startsWith('lunes')) return 'Lun'
  if (n.startsWith('martes')) return 'Mar'
  if (n.startsWith('miércoles') || n.startsWith('miercoles')) return 'Mié'
  if (n.startsWith('jueves')) return 'Jue'
  if (n.startsWith('viernes')) return 'Vie'
  return String(dayName || '')
}

function truncate(s, n) {
  const t = String(s || '').trim()
  if (t.length <= n) return t
  return `${t.slice(0, n - 1)}…`
}

function HandoffCompactLine({ handoff }) {
  const [open, setOpen] = useState(false)
  if (!handoff?.note) return null
  const meta = handoffNoteMetaLine(handoff)
  const oneLine = `${meta ? `${meta} · ` : ''}${truncate(handoff.note, 60)}`
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="w-full text-left rounded-none border-l-[3px] border-[#FFFF4C] bg-[#1a0f1b] px-[14px] py-2.5 text-[13px] text-[#F6E8F9] hover:bg-[#221427] transition-colors"
    >
      {open ? (
        <span className="block whitespace-pre-wrap leading-snug">{handoff.note}</span>
      ) : (
        <span className="block line-clamp-2">{oneLine}</span>
      )}
    </button>
  )
}

/**
 * Pantalla principal «Hoy»: contexto, chips día, tabs clase, nota pase, WOD, CTA asistente.
 */
export default function CoachTodayScreen({
  weekData,
  activeWeekRow,
  coachName,
  activeDay,
  setActiveDay,
  classTabKey,
  setClassTabKey,
  onConsultAssistant,
}) {
  const dias = weekData?.dias || []
  const workWeek = useMemo(() => dias.slice(0, 5), [dias])

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
  const classDef = EVO_SESSION_CLASS_DEFS.find((d) => d.key === classTabKey) || EVO_SESSION_CLASS_DEFS[0]
  const sessionRaw = dia ? sessionText(dia[classTabKey]) : ''
  const hasSession = dia ? hasProgrammedSessionText(dia[classTabKey]) : false
  const lastHandoff = dia && classDef?.label ? findLastCoachHandoffNote(classDef.label, activeWeekRow?.id ?? null) : null

  const madridChipIndex = useMemo(() => madridWeekdayChipIndex(), [])

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0C0B0C]">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]">
        <p
          className="px-4 pt-3 pb-2 font-evo-body text-[12px] leading-tight text-[#F6E8F966]"
          style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
        >
          {contextLine}
        </p>

        <div className="flex gap-2 px-4 pb-3 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

        <div className="flex border-b border-[#6A1F6D]/35 px-2">
          {MAIN_CLASS_TABS.map(({ key, tabLabel }) => {
            const active = classTabKey === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setClassTabKey(key)}
                className={`flex-1 py-3 text-center font-evo-display text-[13px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                  active ? 'text-[#FFFF4C] border-[#FFFF4C]' : 'text-[#F6E8F966] border-transparent'
                }`}
              >
                {tabLabel}
              </button>
            )
          })}
        </div>

        <div className="px-4 pt-3">
          {lastHandoff ? <HandoffCompactLine handoff={lastHandoff} /> : null}
        </div>

        <div className="px-4 pt-5 pb-4">
          {!dia ? (
            <p className="text-sm text-[#F6E8F966]">No hay datos para este día.</p>
          ) : !hasSession ? (
            <p className="text-sm text-[#F6E8F966]">Sin programación para {classDef.label} este día.</p>
          ) : (
            <CoachFormattedSession text={sessionRaw} accentColor={classDef.color} variant="bare" />
          )}
        </div>
      </div>

      <div className="fixed left-0 right-0 z-[105] bottom-[max(4.25rem,calc(3.5rem+env(safe-area-inset-bottom,0px)))] px-4 pointer-events-none">
        <button
          type="button"
          onClick={() => {
            if (!dia || !classDef) {
              onConsultAssistant(null)
              return
            }
            onConsultAssistant({
              dayName: dia.nombre,
              classLabel: classDef.label,
              sessionText: sessionRaw || '',
            })
          }}
          className="pointer-events-auto w-full py-3.5 rounded-xl bg-[#6A1F6D] text-[#FFFF4C] font-evo-display font-semibold text-[14px] uppercase tracking-wide shadow-lg border border-[#A729AD]/40 active:scale-[0.99] transition-transform"
        >
          Consultar al asistente
        </button>
      </div>
    </div>
  )
}
