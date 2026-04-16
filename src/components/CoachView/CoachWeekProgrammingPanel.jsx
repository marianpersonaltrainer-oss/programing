import { useState } from 'react'
import {
  findVideosForPublishedDayResolved,
  findVideosInProgramTextResolved,
} from '../../utils/coachLibraryVideoMatch.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { SESSION_BLOCKS, FEEDBACK_BLOCKS } from './coachViewConstants.js'
import {
  findDia,
  sessionText,
  hasProgrammedSessionText,
  previewText,
  buildDayQuickSummary,
  dayFocusLine,
  isFestivoDay,
  getAdjacentNavDayName,
  dayNombreToFeedbackKey,
} from './coachViewUtils.js'
import { coachBg, coachBorder, coachText, coachUi, classBadgeClass } from './coachTheme.js'
import { DAYS_ES } from '../../constants/evoColors.js'
import { coachHasFeedbackForDay } from '../../utils/coachFeedbackLocalLog.js'
import {
  extractMaterialHints,
  findLastCoachHandoffNote,
  formatFeedbackEntrySummary,
  findLastLocalFeedbackSameWeekAndDay,
  handoffNoteMetaLine,
  hasNonTrivialPublishedFeedback,
} from '../../utils/coachSessionPrep.js'
import { printCoachDaySession } from '../../utils/coachPrintSession.js'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import CoachSessionBlockView from './CoachSessionBlockView.jsx'

const TAB_ACTIVE = 'bg-[#A729AD] text-white shadow-md border border-[#A729AD]'
const TAB_IDLE = `bg-white/10 text-white/90 border border-white/20 hover:bg-white/15`

function coachClassNavShortLabel(label) {
  return String(label || '').replace(/^Evo/i, '').trim() || label
}

function CoachVideoChips({ videos, title = 'Vídeos rápidos', subtitle }) {
  if (!videos?.length) {
    return (
      <div className={`rounded-xl p-5 border ${coachBorder} ${coachBg.card}`}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${coachText.accent}`}>{title}</p>
        <p className={`text-sm ${coachText.muted} leading-relaxed`}>
          {subtitle ||
            'No hay coincidencias con la biblioteca (ni URL de vídeo en Supabase). Usa Soporte o revisa el nombre del movimiento en Contenido Coach → Biblioteca.'}
        </p>
      </div>
    )
  }
  return (
    <div className={`rounded-xl p-5 border border-[#A729AD]/30 ${coachBg.cardMuted}`}>
      <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${coachText.accent}`}>{title}</p>
      <div className="flex flex-wrap gap-2">
        {videos.map(({ name, url }) => (
          <a
            key={`${name}-${url}`}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir vídeo: ${name} (nueva pestaña)`}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2.5 rounded-xl bg-[#A729AD] text-white hover:bg-[#6A1F6D] border border-[#6A1F6D]/40 shadow-sm active:scale-[0.98] transition-all"
          >
            <span className="text-sm leading-none opacity-95" aria-hidden>
              ▶
            </span>
            <span className="max-w-[12rem] truncate normal-case">{name}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function ClassVideoCollapse({ sessionKey, videos, open, onToggle }) {
  return (
    <div className={`border-t ${coachBorder} pt-4`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-2 text-left text-sm font-bold ${coachText.accent} py-1`}
      >
        <span>🎬 Ver vídeos de esta clase</span>
        <span className="text-xs opacity-80">{open ? '▲' : '▼'}</span>
      </button>
      {open ? (
        <div className="mt-3">
          {videos.length ? (
            <div className="flex flex-wrap gap-2">
              {videos.map(({ name, url }) => (
                <a
                  key={`${name}-${url}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Abrir vídeo: ${name} (nueva pestaña)`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2.5 rounded-xl bg-[#A729AD] text-white hover:bg-[#6A1F6D] border border-[#6A1F6D]/40 shadow-sm active:scale-[0.98] transition-all"
                >
                  <span className="text-sm leading-none opacity-95" aria-hidden>
                    ▶
                  </span>
                  <span className="max-w-[12rem] truncate normal-case">{name}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${coachText.muted} mt-1`}>Nada en la biblioteca para el texto de esta clase.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text || ''))
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = String(text || '')
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

export default function CoachWeekProgrammingPanel({
  weekData,
  activeDay,
  setActiveDay,
  weekTab,
  setWeekTab,
  onOpenSupport,
  onOpenFeedbackFromClass,
  exerciseLibrary = [],
  coachName = '',
  weekRow = null,
}) {
  const dias = weekData?.dias || []
  const [openClassVideos, setOpenClassVideos] = useState({})
  const [copiedKey, setCopiedKey] = useState(null)
  const [prepDayName, setPrepDayName] = useState(null)

  const ask = (text, context = null) => {
    onOpenSupport(text, context)
    setActiveDay('show')
    setWeekTab('dias')
  }

  const askClassSupport = (dayName, label, sessionValue, prefill) => {
    ask(prefill, {
      dayName,
      classLabel: label,
      sessionText: sessionValue || '',
    })
  }

  const toggleClassVideos = (key) => {
    setOpenClassVideos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className={`border-b ${coachBorder} ${coachBg.app} relative z-10`}>
      {weekData?.resumen && (
        <div className={`px-5 py-4 border-b ${coachBorder} ${coachUi.card} rounded-none border-x-0 border-t-0`}>
          <p className={`text-[11px] font-bold ${coachText.accent} uppercase tracking-widest mb-1.5`}>Orientación semanal</p>
          <p className={`text-sm font-bold leading-tight ${coachText.primary} uppercase tracking-tight`}>
            {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
            {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
          </p>
          <p className={`text-sm mt-2 leading-relaxed ${coachText.muted}`}>{weekData.resumen.nota}</p>
        </div>
      )}

      {activeDay === 'show' && (
        <>
          <div className={`flex gap-2 px-6 pt-4 pb-3 border-b ${coachBorder} ${coachBg.sidebar} overflow-x-auto`}>
            <button
              type="button"
              onClick={() => setWeekTab('dias')}
              className={`text-xs px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest transition-all shrink-0 border ${
                weekTab === 'dias' ? TAB_ACTIVE : TAB_IDLE
              }`}
            >
              Por día
            </button>
            <button
              type="button"
              onClick={() => setWeekTab('excel')}
              className={`text-xs px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest transition-all shrink-0 border ${
                weekTab === 'excel' ? TAB_ACTIVE : TAB_IDLE
              }`}
            >
              Vista Excel
            </button>
            <button
              type="button"
              onClick={() => setWeekTab('videos')}
              className={`text-xs px-4 py-2.5 rounded-xl font-bold uppercase tracking-widest transition-all shrink-0 border ${
                weekTab === 'videos' ? TAB_ACTIVE : TAB_IDLE
              }`}
            >
              Vídeos
            </button>
          </div>

          {weekTab === 'dias' && (
            <div className="px-6 py-6 space-y-6">
              <p className={`text-sm ${coachText.muted} font-bold uppercase tracking-widest`}>
                Toca un día para el detalle. Soporte para preguntas al asistente.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {dias.map((dia) => {
                  const festivo = isFestivoDay(dia)
                  const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
                  const focus = dayFocusLine(dia, SESSION_BLOCKS)
                  const videoCount = findVideosForPublishedDayResolved(dia, exerciseLibrary).length
                  const dayKey = dayNombreToFeedbackKey(dia.nombre)
                  const hasDayFeedback =
                    dayKey &&
                    weekRow?.id &&
                    coachName?.trim() &&
                    coachHasFeedbackForDay(weekRow.id, dayKey, coachName)
                  if (festivo) {
                    return (
                      <div
                        key={dia.nombre}
                        className="text-left rounded-xl p-6 bg-gray-100 opacity-60 cursor-not-allowed min-h-[200px] flex flex-col border-0 shadow-none ring-0"
                        aria-label={`${dia.nombre}, festivo`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <p className="text-lg font-medium text-gray-800 uppercase tracking-tight">{dia.nombre}</p>
                        </div>
                        <p className="text-sm font-medium uppercase tracking-widest text-gray-600">Festivo · sin sesión</p>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={dia.nombre}
                      type="button"
                      onClick={() => setActiveDay(dia.nombre)}
                      className={`text-left rounded-xl p-6 border ${coachBorder} ${coachBg.card} hover:border-[#A729AD]/50 hover:shadow-md transition-all active:scale-[0.99] min-h-[200px] flex flex-col`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className={`text-lg font-black ${coachText.primary} uppercase tracking-tight`}>{dia.nombre}</p>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {videoCount > 0 ? (
                              <span className="text-xs font-bold uppercase tracking-wide text-[#6A1F6D] bg-[#A729AD]/15 border border-[#A729AD]/35 px-2.5 py-1 rounded-lg">
                                ▶ {videoCount}
                              </span>
                            ) : null}
                            {hasDayFeedback ? (
                              <span
                                className="text-emerald-600 text-xl font-black leading-none"
                                title="Enviaste feedback este día (log en este dispositivo)"
                                aria-label="Feedback este día registrado"
                              >
                                ✓
                              </span>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setPrepDayName(dia.nombre)
                            }}
                            className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border ${coachBorder} ${coachBg.cardMuted} ${coachText.accent} hover:bg-[#A729AD]/10`}
                          >
                            Preparar clase
                          </button>
                        </div>
                      </div>
                      {focus && (
                        <div className={`mb-4 rounded-lg border ${coachBorder} ${coachBg.cardMuted} px-4 py-3`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${coachText.accent}`}>Objetivo del día</p>
                          <p className={`text-base leading-snug ${coachText.primary} line-clamp-4`}>{focus}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {labels.length ? (
                          labels.map((lb) => (
                            <span
                              key={lb}
                              className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide border ${classBadgeClass(lb)}`}
                            >
                              {lb}
                            </span>
                          ))
                        ) : (
                          <span className={`text-xs ${coachText.muted} font-bold uppercase`}>Sin bloques en datos</span>
                        )}
                      </div>
                      {preview && preview !== focus ? (
                        <pre
                          className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans flex-1`}
                        >
                          {preview}
                        </pre>
                      ) : null}
                      {!preview && sessionText(dia.wodbuster) ? (
                        <pre
                          className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans flex-1`}
                        >
                          {previewText(dia.wodbuster, 8, 400)}
                        </pre>
                      ) : null}
                      <p className={`text-xs ${coachText.accent} font-bold uppercase tracking-widest mt-4`}>Ver detalle →</p>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {weekTab === 'videos' && (
            <div className="px-6 py-6 space-y-8 pb-10">
              <p className={`text-sm ${coachText.muted} font-bold uppercase tracking-widest leading-relaxed`}>
                Vídeos por día — enlaces directos desde la biblioteca (Supabase) cuando hay URL.
              </p>
              {dias.map((dia) => {
                const vids = findVideosForPublishedDayResolved(dia, exerciseLibrary)
                return (
                  <div key={dia.nombre} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-base font-bold ${coachText.primary} uppercase tracking-widest`}>{dia.nombre}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setWeekTab('dias')
                          setActiveDay(dia.nombre)
                        }}
                        className={`text-xs font-bold ${coachText.accent} uppercase tracking-wide underline decoration-[#A729AD]/40`}
                      >
                        Ver texto del día
                      </button>
                    </div>
                    <CoachVideoChips
                      videos={vids}
                      title={vids.length ? `Vídeos · ${dia.nombre}` : `Sin vídeos · ${dia.nombre}`}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {weekTab === 'excel' && (
            <div className="px-6 py-6 space-y-6 pb-10">
              <p className={`text-sm ${coachText.muted} font-bold uppercase tracking-widest`}>
                Todas las sesiones por día (como Excel publicado).
              </p>
              {dias.map((dia) => {
                const sessions = SESSION_BLOCKS.filter(({ key }) => hasProgrammedSessionText(dia[key]))
                const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const wb = sessionText(dia.wodbuster)
                return (
                  <div key={dia.nombre} className={`rounded-xl border ${coachBorder} overflow-hidden ${coachBg.card} shadow-sm`}>
                    <div className="px-5 py-3 bg-[#6A1F6D] text-white flex items-center justify-between gap-2">
                      <span className="text-sm font-bold uppercase tracking-widest">{dia.nombre}</span>
                      <button
                        type="button"
                        onClick={() => ask(`Tengo una duda sobre la programación del ${dia.nombre}: `)}
                        className="text-xs font-bold uppercase tracking-widest text-white/90 underline decoration-white/40"
                      >
                        Preguntar
                      </button>
                    </div>
                    <div className="p-5 space-y-4">
                      {sessions.map(({ label, color, key }) => (
                        <div key={key} className={`rounded-xl p-4 border ${coachBorder} ${coachBg.cardMuted}`}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>
                            {label}
                          </p>
                          <CoachFormattedSession text={dia[key]} accentColor={color || '#6A1F6D'} />
                        </div>
                      ))}
                      {feedbacks.map(({ label, key }) => (
                        <div key={key} className={`rounded-xl p-4 border ${coachBorder} ${coachBg.cardMuted}`}>
                          <p className={`text-xs font-bold ${coachText.accent} uppercase tracking-widest mb-2`}>{label}</p>
                          <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
                        </div>
                      ))}
                      {wb && (
                        <div className={`rounded-xl p-4 border border-emerald-700/30 bg-emerald-50/80`}>
                          <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-2">WodBuster / alumno</p>
                          <CoachFormattedSession text={dia.wodbuster} accentColor="#047857" />
                        </div>
                      )}
                      {!sessions.length && !feedbacks.length && !wb && (
                        <p className={`text-sm ${coachText.muted}`}>Sin contenido para este día.</p>
                      )}
                      <div className={`pt-4 border-t ${coachBorder}`}>
                        <CoachVideoChips videos={findVideosForPublishedDayResolved(dia, exerciseLibrary)} title={`▶ Vídeos · ${dia.nombre}`} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {activeDay !== 'show' && activeDay != null && (
        <div className={`border-t ${coachBorder}`}>
          {(() => {
            const diaNav = findDia(dias, activeDay)
            const navBlocks = diaNav
              ? SESSION_BLOCKS.filter(({ key }) => hasProgrammedSessionText(diaNav[key]))
              : []
            return (
              <div
                className={`sticky top-0 z-[1] border-b ${coachBorder} bg-white/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.04)]`}
              >
                <div className={`px-6 py-4 flex flex-wrap items-center gap-2`}>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDay('show')
                      setWeekTab('dias')
                    }}
                    className={`text-xs font-bold uppercase tracking-widest ${coachText.accent} border border-[#A729AD]/40 px-4 py-2 rounded-xl hover:bg-[#A729AD]/10`}
                  >
                    ← Volver a días
                  </button>
                  {(() => {
                    const prev = getAdjacentNavDayName(dias, activeDay, 'prev')
                    const next = getAdjacentNavDayName(dias, activeDay, 'next')
                    return (
                      <>
                        <button
                          type="button"
                          disabled={!prev}
                          onClick={() => prev && setActiveDay(prev)}
                          className={`text-xs font-bold uppercase tracking-widest border px-3 py-2 rounded-xl ${
                            prev
                              ? `${coachText.accent} border-[#A729AD]/40 hover:bg-[#A729AD]/10`
                              : 'opacity-30 cursor-not-allowed border-black/10'
                          }`}
                          aria-label="Día anterior"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          disabled={!next}
                          onClick={() => next && setActiveDay(next)}
                          className={`text-xs font-bold uppercase tracking-widest border px-3 py-2 rounded-xl ${
                            next
                              ? `${coachText.accent} border-[#A729AD]/40 hover:bg-[#A729AD]/10`
                              : 'opacity-30 cursor-not-allowed border-black/10'
                          }`}
                          aria-label="Día siguiente"
                        >
                          →
                        </button>
                      </>
                    )
                  })()}
                  <span className={`text-base font-black ${coachText.primary} uppercase tracking-tight`}>{activeDay}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const dia = findDia(dias, activeDay)
                      if (!dia) return
                      const blocks = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key])).map(({ label, key }) => ({
                        classLabel: label,
                        text: sessionText(dia[key]),
                      }))
                      if (sessionText(dia.wodbuster)) {
                        blocks.push({
                          classLabel: 'Vista alumno (WodBuster)',
                          text: sessionText(dia.wodbuster),
                        })
                      }
                      printCoachDaySession({
                        coachName: coachName?.trim() || '—',
                        dateLabel: new Date().toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }),
                        dayLabel: activeDay,
                        blocks,
                      })
                    }}
                    className={`text-[10px] font-bold uppercase tracking-widest ml-auto px-4 py-2 rounded-xl border ${coachBorder} ${coachBg.cardMuted} ${coachText.primary} hover:bg-[#A729AD]/10`}
                  >
                    Imprimir día
                  </button>
                </div>
                {navBlocks.length > 0 ? (
                  <nav
                    className="flex gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-2.5 pt-1 border-t border-black/6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label="Ir a clase del día"
                  >
                    {navBlocks.map((block) => (
                      <button
                        key={block.key}
                        type="button"
                        onClick={() => {
                          document.getElementById(`coach-class-anchor-${block.key}`)?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }}
                        className={`shrink-0 text-xs font-bold uppercase tracking-wide px-3.5 py-2 rounded-xl border border-[#A729AD]/35 bg-[#F3EAF8] text-[#4a154d] hover:bg-[#A729AD]/15 active:scale-[0.98] transition-transform`}
                      >
                        {coachClassNavShortLabel(block.label)}
                      </button>
                    ))}
                  </nav>
                ) : null}
              </div>
            )
          })()}
          {(() => {
            const dia = findDia(dias, activeDay)
            if (!dia) {
              return (
                <div className="px-6 py-8">
                  <p className={`text-sm ${coachText.muted}`}>No hay datos para este día en la semana publicada.</p>
                </div>
              )
            }
            const dayName = dia.nombre
            const blocksWithSession = SESSION_BLOCKS.filter(({ key }) => hasProgrammedSessionText(dia[key]))
            const wb = sessionText(dia.wodbuster)

            return (
              <div className="px-6 pb-10 pt-6 space-y-6">
                {blocksWithSession.map((block) => {
                  const { key, label, color } = block
                  const def = EVO_SESSION_CLASS_DEFS.find((d) => d.key === key)
                  const fbKey = def?.feedbackKey
                  const fbText = fbKey ? sessionText(dia[fbKey]) : ''
                  const slice = [sessionText(dia[key]), fbText].filter(Boolean).join('\n')
                  const classVideos = findVideosInProgramTextResolved(slice, exerciseLibrary)

                  const copyId = `${dayName}-${key}`
                  const fk = dayNombreToFeedbackKey(dayName)
                  const lastHandoff = findLastCoachHandoffNote(label, weekRow?.id ?? null)
                  return (
                    <div
                      key={key}
                      id={`coach-class-anchor-${key}`}
                      className={`scroll-mt-36 rounded-xl border ${coachBorder} ${coachBg.card} p-5 shadow-sm space-y-5`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <p className="text-base font-black uppercase tracking-tight flex-1 min-w-0" style={{ color }}>
                          {label}
                        </p>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {typeof onOpenFeedbackFromClass === 'function' && fk ? (
                            <button
                              type="button"
                              onClick={() => onOpenFeedbackFromClass(fk, label)}
                              className={`text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl border ${coachBorder} ${coachBg.cardMuted} ${coachText.accent} hover:bg-[#A729AD]/10`}
                            >
                              Feedback
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await copyTextToClipboard(dia[key])
                              if (ok) {
                                setCopiedKey(copyId)
                                setTimeout(() => setCopiedKey((c) => (c === copyId ? null : c)), 2000)
                              }
                            }}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl bg-[#3f0f42] text-white border border-[#2a0a2c] hover:bg-[#4d1850]"
                          >
                            {copiedKey === copyId ? 'Copiado ✓' : 'Copiar'}
                          </button>
                        </div>
                      </div>
                      {lastHandoff ? (
                        <div
                          className="rounded-lg border border-amber-300/70 bg-[#fffbeb] px-4 py-3.5 space-y-2 shadow-[3px_4px_0_rgba(180,130,0,0.12)] -rotate-[0.35deg]"
                          role="note"
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900/85 flex items-center gap-2">
                            <span className="text-base leading-none" aria-hidden>
                              📝
                            </span>
                            Nota para ti (último coach)
                          </p>
                          <p className="text-[11px] font-semibold text-amber-900/75">{handoffNoteMetaLine(lastHandoff)}</p>
                          <p className="text-sm font-semibold text-amber-950 leading-snug whitespace-pre-wrap">
                            {lastHandoff.note}
                          </p>
                        </div>
                      ) : null}
                      <CoachSessionBlockView
                        sessionText={dia[key]}
                        accentColor={color}
                        dayName={dayName}
                        classLabel={label}
                        exerciseLibrary={exerciseLibrary}
                      />

                      {fbText ? (
                        <div className="space-y-2">
                          <p className={`text-xs font-bold uppercase tracking-widest ${coachText.title}`}>Feedback del día</p>
                          <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{fbText}</pre>
                        </div>
                      ) : null}

                      <ClassVideoCollapse
                        sessionKey={key}
                        videos={classVideos}
                        open={!!openClassVideos[key]}
                        onToggle={() => toggleClassVideos(key)}
                      />

                      <div className={`space-y-5 pt-4 border-t ${coachBorder}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
                          Soporte — elige el tipo de consulta
                        </p>

                        <div className="space-y-2">
                          <p className={`text-[11px] font-bold uppercase tracking-tight ${coachText.accent}`}>Lesión</p>
                          <button
                            type="button"
                            onClick={() =>
                              askClassSupport(
                                dayName,
                                label,
                                dia[key],
                                `En ${dayName} · ${label}: necesito adaptar por lesión (indica zona o diagnóstico si lo tienes). ¿Qué sustituciones y cargas concretas propones? `,
                              )
                            }
                            className="w-full text-left text-xs px-4 py-3.5 rounded-xl font-bold uppercase tracking-wide text-amber-50 bg-amber-900 border-2 border-amber-950 shadow-sm hover:bg-amber-950 active:scale-[0.99]"
                          >
                            Lesión — sustituciones y escalado
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className={`text-[11px] font-bold uppercase tracking-tight ${coachText.accent}`}>Embarazo</p>
                          <button
                            type="button"
                            onClick={() =>
                              askClassSupport(
                                dayName,
                                label,
                                dia[key],
                                `En ${dayName} · ${label}: necesito adaptar para embarazada (indica trimestre o semanas si lo sabes). ¿Qué cambios concretos en la sesión? `,
                              )
                            }
                            className="w-full text-left text-xs px-4 py-3.5 rounded-xl font-bold uppercase tracking-wide text-rose-50 bg-rose-900 border-2 border-rose-950 shadow-sm hover:bg-rose-950 active:scale-[0.99]"
                          >
                            Embarazo — adaptar esta sesión
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className={`text-[11px] font-bold uppercase tracking-tight ${coachText.accent}`}>
                            Otras adaptaciones
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              askClassSupport(
                                dayName,
                                label,
                                dia[key],
                                `En ${dayName} · ${label}: necesito adaptar la sesión (poco tiempo, poco material, nivel heterogéneo del grupo u otro). ¿Plan B concreto ejercicio a ejercicio? `,
                              )
                            }
                            className="w-full text-left text-xs px-4 py-3.5 rounded-xl font-bold uppercase tracking-wide text-white bg-[#4a154d] border-2 border-[#2f0d32] shadow-sm hover:bg-[#3d1240] active:scale-[0.99]"
                          >
                            Adaptaciones — tiempo, material o grupo
                          </button>
                        </div>

                        <div className={`space-y-2 pt-1 border-t ${coachBorder}`}>
                          <p className={`text-[11px] font-bold uppercase tracking-tight ${coachText.muted}`}>General</p>
                          <button
                            type="button"
                            onClick={() =>
                              askClassSupport(
                                dayName,
                                label,
                                dia[key],
                                `Sobre ${dayName} · ${label}: tengo una duda: `,
                              )
                            }
                            className="w-full text-left text-xs px-4 py-3 rounded-xl bg-[#3f0f42] text-white font-bold uppercase tracking-widest border border-[#2a0a2c] shadow-sm hover:bg-[#4d1850] active:scale-[0.98]"
                          >
                            Otra duda sobre {label}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {!blocksWithSession.length && !wb ? (
                  <p className={`text-sm ${coachText.muted}`}>
                    Este día no tiene bloques en los datos publicados. Pide al programador que vuelva a publicar.
                  </p>
                ) : null}

                {wb ? (
                  <div className={`rounded-xl p-5 border border-emerald-700/35 bg-emerald-50/90 shadow-sm space-y-2`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest">Vista alumno (WodBuster)</p>
                      <button
                        type="button"
                        onClick={async () => {
                          const id = `${dayName}-wodbuster`
                          const ok = await copyTextToClipboard(dia.wodbuster)
                          if (ok) {
                            setCopiedKey(id)
                            setTimeout(() => setCopiedKey((c) => (c === id ? null : c)), 2000)
                          }
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-xl bg-emerald-800 text-white border border-emerald-950 hover:bg-emerald-900"
                      >
                        {copiedKey === `${dayName}-wodbuster` ? 'Copiado ✓' : 'Copiar'}
                      </button>
                    </div>
                    <CoachFormattedSession text={dia.wodbuster} accentColor="#047857" />
                  </div>
                ) : null}
              </div>
            )
          })()}
        </div>
      )}

      {prepDayName
        ? (() => {
            const diaPrep = findDia(dias, prepDayName)
            if (!diaPrep) return null
            const combinedText = [
              ...SESSION_BLOCKS.map(({ key }) => sessionText(diaPrep[key])).filter(Boolean),
              sessionText(diaPrep.wodbuster),
            ].join('\n')
            const hints = extractMaterialHints(combinedText)
            const blocksWithText = SESSION_BLOCKS.filter(({ key }) => sessionText(diaPrep[key]))
            const prepDayKey = dayNombreToFeedbackKey(diaPrep.nombre)
            const weekIdForPrep = weekRow?.id ?? null
            return (
              <div
                className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
                role="dialog"
                aria-modal="true"
                aria-labelledby="prep-class-title"
                onClick={() => setPrepDayName(null)}
              >
                <div
                  className={`w-full sm:max-w-lg max-h-[min(88dvh,560px)] overflow-y-auto rounded-t-2xl sm:rounded-2xl border ${coachBorder} ${coachBg.card} shadow-2xl flex flex-col`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`px-5 py-4 border-b ${coachBorder} flex items-start justify-between gap-3 shrink-0`}>
                    <div>
                      <h2 id="prep-class-title" className={`text-lg font-black uppercase tracking-tight ${coachText.title}`}>
                        Preparar clase
                      </h2>
                      <p className={`text-sm font-bold ${coachText.primary} mt-1`}>{diaPrep.nombre}</p>
                      <p className={`text-[10px] ${coachText.muted} mt-1`}>
                        Material sugerido; feedback publicado en la programación primero y el log local como complemento.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPrepDayName(null)}
                      className={`p-2 rounded-xl ${coachText.muted} hover:bg-black/5 shrink-0`}
                      aria-label="Cerrar"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="px-5 py-4 space-y-5 overflow-y-auto">
                    <section>
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted} mb-2`}>
                        Material a tener a mano
                      </p>
                      {hints.length ? (
                        <ul className={`list-disc list-inside text-sm ${coachText.primary} space-y-1`}>
                          {hints.map((h) => (
                            <li key={h}>{h}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`text-sm ${coachText.muted}`}>
                          No detectamos palabras clave de material en el texto. Revisa el detalle del día o añade notas en
                          biblioteca.
                        </p>
                      )}
                    </section>
                    <section className="space-y-3">
                      <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
                        Feedback por clase
                      </p>
                      {blocksWithText.length ? (
                        blocksWithText.map(({ label, key }) => {
                          const def = EVO_SESSION_CLASS_DEFS.find((d) => d.key === key)
                          const fbKey = def?.feedbackKey
                          const publishedRaw = fbKey ? sessionText(diaPrep[fbKey]) : ''
                          const hasPub = hasNonTrivialPublishedFeedback(publishedRaw)
                          const complement =
                            prepDayKey && weekIdForPrep != null
                              ? findLastLocalFeedbackSameWeekAndDay(label, weekIdForPrep, prepDayKey)
                              : null
                          return (
                            <div
                              key={key}
                              className={`rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4 space-y-2`}
                            >
                              <p className={`text-xs font-black uppercase tracking-wide ${coachText.accent}`}>{label}</p>
                              {hasPub ? (
                                <div className="space-y-1">
                                  <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
                                    Publicado (programación)
                                  </p>
                                  <p className={`text-sm leading-snug ${coachText.primary} whitespace-pre-wrap`}>
                                    {publishedRaw}
                                  </p>
                                </div>
                              ) : null}
                              {complement ? (
                                <div className={`space-y-1 ${hasPub ? `pt-2 border-t ${coachBorder}` : ''}`}>
                                  <p className={`text-[10px] font-bold uppercase tracking-widest ${coachText.muted}`}>
                                    {hasPub
                                      ? 'Complemento — log local (esta semana, este día)'
                                      : 'Log local (esta semana, este día)'}
                                  </p>
                                  <p className={`text-[10px] ${coachText.muted}`}>
                                    {complement.created_at || complement.savedAt
                                      ? new Date(complement.created_at || complement.savedAt).toLocaleString('es-ES', {
                                          dateStyle: 'short',
                                          timeStyle: 'short',
                                        })
                                      : '—'}
                                    {complement.day_key ? ` · ${DAYS_ES[complement.day_key] || complement.day_key}` : ''}
                                  </p>
                                  <p className={`text-sm leading-snug ${coachText.primary} whitespace-pre-wrap`}>
                                    {formatFeedbackEntrySummary(complement)}
                                  </p>
                                </div>
                              ) : null}
                              {!hasPub && !complement ? (
                                <p className={`text-sm ${coachText.muted}`}>
                                  Sin feedback publicado para esta clase ni entradas relevantes en el log.
                                </p>
                              ) : null}
                            </div>
                          )
                        })
                      ) : (
                        <p className={`text-sm ${coachText.muted}`}>Este día no tiene bloques de sesión en los datos.</p>
                      )}
                    </section>
                  </div>
                </div>
              </div>
            )
          })()
        : null}
    </div>
  )
}
