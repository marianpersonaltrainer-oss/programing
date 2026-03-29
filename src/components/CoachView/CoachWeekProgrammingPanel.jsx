import { useState } from 'react'
import {
  findVideosForPublishedDayResolved,
  findVideosInProgramTextResolved,
} from '../../utils/coachLibraryVideoMatch.js'
import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'
import { SESSION_BLOCKS, FEEDBACK_BLOCKS } from './coachViewConstants.js'
import { findDia, sessionText, previewText, buildDayQuickSummary, dayFocusLine } from './coachViewUtils.js'
import { coachBg, coachBorder, coachText, coachUi, classBadgeClass } from './coachTheme.js'

const TAB_ACTIVE = 'bg-[#A729AD] text-white shadow-md border border-[#A729AD]'
const TAB_IDLE = `bg-white/10 text-white/90 border border-white/20 hover:bg-white/15`

function openVideoTab(url) {
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
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
            onClick={(ev) => {
              ev.preventDefault()
              openVideoTab(url)
            }}
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
                  onClick={(ev) => {
                    ev.preventDefault()
                    openVideoTab(url)
                  }}
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

export default function CoachWeekProgrammingPanel({
  weekData,
  activeDay,
  setActiveDay,
  weekTab,
  setWeekTab,
  onOpenSupport,
  exerciseLibrary = [],
}) {
  const dias = weekData?.dias || []
  const [openClassVideos, setOpenClassVideos] = useState({})

  const ask = (text) => {
    onOpenSupport(text)
    setActiveDay('show')
    setWeekTab('dias')
  }

  const toggleClassVideos = (key) => {
    setOpenClassVideos((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className={`border-b ${coachBorder} ${coachBg.app} relative z-10`}>
      {weekData?.resumen && (
        <div className={`px-6 py-6 border-b ${coachBorder} ${coachUi.card} rounded-none border-x-0 border-t-0`}>
          <p className={`text-xs font-bold ${coachText.accent} uppercase tracking-widest mb-2`}>Orientación semanal</p>
          <p className={`text-base font-bold leading-tight ${coachText.primary} uppercase tracking-tight`}>
            {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
            {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
          </p>
          <p className={`text-base mt-3 leading-relaxed ${coachText.muted}`}>{weekData.resumen.nota}</p>
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
                  const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
                  const focus = dayFocusLine(dia, SESSION_BLOCKS)
                  const videoCount = findVideosForPublishedDayResolved(dia, exerciseLibrary).length
                  return (
                    <button
                      key={dia.nombre}
                      type="button"
                      onClick={() => setActiveDay(dia.nombre)}
                      className={`text-left rounded-xl p-6 border ${coachBorder} ${coachBg.card} hover:border-[#A729AD]/50 hover:shadow-md transition-all active:scale-[0.99] min-h-[200px] flex flex-col`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className={`text-lg font-black ${coachText.primary} uppercase tracking-tight`}>{dia.nombre}</p>
                        {videoCount > 0 && (
                          <span className="text-xs font-bold uppercase tracking-wide text-[#6A1F6D] bg-[#A729AD]/15 border border-[#A729AD]/35 px-2.5 py-1 rounded-lg shrink-0">
                            ▶ {videoCount}
                          </span>
                        )}
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
                const vids = findVideosForPublishedDay(dia)
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
                const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
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
                          <pre className={`text-sm ${coachText.primary} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
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
                          <pre className={`text-sm ${coachText.primary} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia.wodbuster}</pre>
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
          <div
            className={`px-6 py-4 flex flex-wrap items-center gap-2 sticky top-0 z-[1] border-b ${coachBorder} bg-white/95 backdrop-blur-sm`}
          >
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
            <span className={`text-base font-black ${coachText.primary} uppercase tracking-tight`}>{activeDay}</span>
          </div>
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
            const blocksWithSession = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
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

                  return (
                    <div key={key} className={`rounded-xl border ${coachBorder} ${coachBg.card} p-5 shadow-sm space-y-5`}>
                      <p className="text-base font-black uppercase tracking-tight" style={{ color }}>
                        {label}
                      </p>
                      <pre className={`text-sm ${coachText.primary} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>

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

                      <div className={`flex flex-col sm:flex-row flex-wrap gap-2 pt-2 border-t ${coachBorder}`}>
                        <button
                          type="button"
                          onClick={() => ask(`Sobre ${dayName} · ${label}: tengo una duda: `)}
                          className="text-xs px-4 py-3 rounded-xl bg-[#6A1F6D] text-white font-bold uppercase tracking-widest shadow-sm hover:bg-[#7d2582] active:scale-[0.98]"
                        >
                          Preguntar por {label}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            ask(
                              `En ${dayName} · ${label}: necesito adaptar por lesión o embarazo. ¿Qué sustituciones y escalado propones? `,
                            )
                          }
                          className={`text-xs px-4 py-3 rounded-xl border ${coachBorder} ${coachBg.cardMuted} font-bold uppercase tracking-widest ${coachText.primary} hover:border-[#A729AD]/50`}
                        >
                          Adaptar lesión / embarazo
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            ask(`En ${dayName} · ${label}: tengo poco tiempo o poco material. ¿Plan B concreto? `)
                          }
                          className={`text-xs px-4 py-3 rounded-xl border ${coachBorder} ${coachBg.cardMuted} font-bold uppercase tracking-widest ${coachText.primary} hover:border-[#A729AD]/50`}
                        >
                          Plan B / poco tiempo
                        </button>
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
                  <div className={`rounded-xl p-5 border border-emerald-700/35 bg-emerald-50/90 shadow-sm`}>
                    <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-2">Vista alumno (WodBuster)</p>
                    <pre className={`text-sm ${coachText.primary} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia.wodbuster}</pre>
                  </div>
                ) : null}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
