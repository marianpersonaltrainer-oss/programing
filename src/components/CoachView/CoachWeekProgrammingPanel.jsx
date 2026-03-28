import { findVideosForPublishedDay } from '../../constants/exerciseVideos.js'
import { SESSION_BLOCKS, FEEDBACK_BLOCKS } from './coachViewConstants.js'
import { findDia, sessionText, previewText, buildDayQuickSummary, dayFocusLine } from './coachViewUtils.js'
import { coachBg, coachBorder, coachText, coachUi, classBadgeClass } from './coachTheme.js'

const TAB_ACTIVE = 'bg-[#6A1F6D] text-white shadow-lg shadow-purple-950/30'
const TAB_IDLE = `bg-[#1A1F2E] ${coachText.muted} hover:text-[#E8EAF0] border ${coachBorder}`

function CoachVideoChips({ videos, title = 'Vídeos rápidos', subtitle }) {
  if (!videos?.length) {
    return (
      <div className={`rounded-xl p-5 border ${coachBorder} ${coachBg.card}`}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${coachText.accent}`}>{title}</p>
        <p className={`text-sm ${coachText.muted} leading-relaxed`}>
          {subtitle ||
            'No hay coincidencias con la biblioteca de ejercicios en este día. Usa Soporte o busca en YouTube el nombre del movimiento.'}
        </p>
      </div>
    )
  }
  return (
    <div className={`rounded-xl p-5 border border-red-900/40 bg-gradient-to-br from-[#1a0a0a] to-[#1A1F2E]`}>
      <p className="text-xs font-bold text-red-300 uppercase tracking-widest mb-2">{title}</p>
      <p className="text-sm text-red-200/70 mb-4 leading-snug">Abre YouTube con búsqueda orientada a técnica.</p>
      <div className="flex flex-wrap gap-2">
        {videos.map(({ name, url }) => (
          <a
            key={name}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2.5 rounded-xl bg-[#FF0000] text-white hover:bg-[#cc0000] shadow-md active:scale-[0.97] transition-transform"
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

export default function CoachWeekProgrammingPanel({ weekData, activeDay, setActiveDay, weekTab, setWeekTab, onOpenSupport }) {
  const dias = weekData?.dias || []

  const ask = (text) => {
    onOpenSupport(text)
    setActiveDay('show')
    setWeekTab('dias')
  }

  return (
    <div className={`border-b ${coachBorder} ${coachBg.app} relative z-10`}>
      {weekData?.resumen && (
        <div className={`px-6 py-6 border-b ${coachBorder} ${coachUi.card} rounded-none border-x-0 border-t-0`}>
          <p className={`text-xs font-bold ${coachText.accent} uppercase tracking-widest mb-2`}>Orientación semanal</p>
          <p className="text-base font-bold leading-tight text-[#E8EAF0] uppercase tracking-tight">
            {weekData.resumen.estimulo} · {weekData.resumen.intensidad}
            {weekData.resumen.foco ? ` · ${weekData.resumen.foco}` : ''}
          </p>
          <p className={`text-[15px] mt-3 leading-relaxed ${coachText.muted}`}>{weekData.resumen.nota}</p>
        </div>
      )}

      {activeDay === 'show' && (
        <>
          <div className={`flex gap-2 px-6 pt-4 pb-3 border-b ${coachBorder} bg-[#0F1117] overflow-x-auto`}>
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
                  const videoCount = findVideosForPublishedDay(dia).length
                  return (
                    <button
                      key={dia.nombre}
                      type="button"
                      onClick={() => setActiveDay(dia.nombre)}
                      className={`text-left rounded-xl p-6 border ${coachBorder} ${coachBg.card} hover:border-[#A729AD]/40 hover:shadow-lg hover:shadow-purple-900/10 transition-all active:scale-[0.99] min-h-[200px] flex flex-col`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <p className="text-lg font-black text-[#E8EAF0] uppercase tracking-tight">{dia.nombre}</p>
                        {videoCount > 0 && (
                          <span className="text-xs font-bold uppercase tracking-wide text-red-200 bg-red-950/60 border border-red-800/50 px-2.5 py-1 rounded-lg shrink-0">
                            ▶ {videoCount}
                          </span>
                        )}
                      </div>
                      {focus && (
                        <div className={`mb-4 rounded-lg border ${coachBorder} bg-[#0F1117] px-4 py-3`}>
                          <p className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${coachText.accent}`}>Objetivo del día</p>
                          <p className={`text-[15px] leading-snug ${coachText.primary} line-clamp-4`}>{focus}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {labels.length ? (
                          labels.map((lb) => (
                            <span key={lb} className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase tracking-wide border ${classBadgeClass(lb)}`}>
                              {lb}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-amber-300 font-bold uppercase">Sin bloques en datos</span>
                        )}
                      </div>
                      {preview && preview !== focus ? (
                        <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans flex-1`}>
                          {preview}
                        </pre>
                      ) : null}
                      {!preview && sessionText(dia.wodbuster) ? (
                        <pre className={`text-sm text-emerald-300/90 font-medium whitespace-pre-wrap leading-relaxed line-clamp-5 font-sans flex-1`}>
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
                Biblioteca EVO por día — un toque abre YouTube.
              </p>
              {dias.map((dia) => {
                const vids = findVideosForPublishedDay(dia)
                return (
                  <div key={dia.nombre} className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-base font-bold text-[#E8EAF0] uppercase tracking-widest">{dia.nombre}</p>
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
              <p className={`text-sm ${coachText.muted} font-bold uppercase tracking-widest`}>Todas las sesiones por día (como Excel publicado).</p>
              {dias.map((dia) => {
                const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
                const wb = sessionText(dia.wodbuster)
                return (
                  <div key={dia.nombre} className={`rounded-xl border ${coachBorder} overflow-hidden ${coachBg.card}`}>
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
                        <div key={key} className={`rounded-xl p-4 border ${coachBorder} bg-[#161B2A]`}>
                          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color }}>
                            {label}
                          </p>
                          <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
                        </div>
                      ))}
                      {feedbacks.map(({ label, key }) => (
                        <div key={key} className="rounded-xl p-4 border border-indigo-900/50 bg-indigo-950/30">
                          <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">{label}</p>
                          <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
                        </div>
                      ))}
                      {wb && (
                        <div className="rounded-xl p-4 border border-emerald-900/50 bg-emerald-950/20">
                          <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">WodBuster / alumno</p>
                          <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia.wodbuster}</pre>
                        </div>
                      )}
                      {!sessions.length && !feedbacks.length && !wb && (
                        <p className={`text-sm ${coachText.muted}`}>Sin contenido para este día.</p>
                      )}
                      <div className={`pt-4 border-t ${coachBorder}`}>
                        <CoachVideoChips videos={findVideosForPublishedDay(dia)} title={`▶ Vídeos · ${dia.nombre}`} />
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
          <div className={`px-6 py-4 flex flex-wrap items-center gap-2 sticky top-0 z-[1] border-b ${coachBorder} bg-[#0F1117]/95 backdrop-blur-sm`}>
            <button
              type="button"
              onClick={() => {
                setActiveDay('show')
                setWeekTab('dias')
              }}
              className={`text-xs font-bold uppercase tracking-widest ${coachText.accent} border border-[#A729AD]/40 px-4 py-2 rounded-xl hover:bg-[#6A1F6D]/20`}
            >
              ← Volver a días
            </button>
            <span className="text-sm font-bold text-[#E8EAF0] uppercase tracking-tight">{activeDay}</span>
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
            const { labels, preview } = buildDayQuickSummary(dia, SESSION_BLOCKS)
            const focus = dayFocusLine(dia, SESSION_BLOCKS)
            const sessions = SESSION_BLOCKS.filter(({ key }) => sessionText(dia[key]))
            const feedbacks = FEEDBACK_BLOCKS.filter(({ key }) => sessionText(dia[key]))
            const wb = sessionText(dia.wodbuster)
            const hasAny = sessions.length > 0 || feedbacks.length > 0 || wb
            const dayName = dia.nombre
            const dayVideos = findVideosForPublishedDay(dia)

            return (
              <div className="px-6 pb-10 pt-6 space-y-6">
                <CoachVideoChips
                  videos={dayVideos}
                  title={`Vídeos del ${dayName}`}
                  subtitle={`Nada en biblioteca para el ${dayName}. Pregunta en Soporte.`}
                />

                {focus && (
                  <div className={`rounded-xl border ${coachBorder} bg-[#1A1F2E] p-6`}>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-2 ${coachText.accent}`}>Objetivo del día</p>
                    <p className="text-[16px] font-semibold leading-relaxed text-[#E8EAF0]">{focus}</p>
                  </div>
                )}

                <div className={`rounded-xl p-6 border border-[#A729AD]/30 bg-[#6A1F6D]/15`}>
                  <p className={`text-xs font-bold ${coachText.accent} uppercase tracking-widest mb-3`}>Resumen rápido</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {labels.map((lb) => (
                      <span key={lb} className={`text-[10px] px-2.5 py-1 rounded-lg font-bold uppercase border ${classBadgeClass(lb)}`}>
                        {lb}
                      </span>
                    ))}
                  </div>
                  {preview ? (
                    <pre className={`text-[15px] ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{preview}</pre>
                  ) : (
                    <p className={`text-sm ${coachText.muted}`}>Sin extracto adicional.</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      ask(`Tengo una duda sobre la programación del ${dayName}: ¿puedes orientarme con tiempos y escalado?`)
                    }
                    className="text-xs px-5 py-3 rounded-xl bg-[#6A1F6D] text-white font-bold uppercase tracking-widest shadow-lg hover:bg-[#7d2582] active:scale-[0.98]"
                  >
                    Preguntar por {dayName}
                  </button>
                  <button
                    type="button"
                    onClick={() => ask(`Sobre el ${dayName}: ¿qué harías si tengo poco tiempo o falta material en sala?`)}
                    className={`text-xs px-5 py-3 rounded-xl border ${coachBorder} ${coachBg.card} font-bold uppercase tracking-widest ${coachText.primary} hover:border-[#A729AD]/40`}
                  >
                    Plan B / poco tiempo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      ask(`En el ${dayName}, ¿cómo escalarías el WOD para nivel principiante manteniendo el estímulo?`)
                    }
                    className={`text-xs px-5 py-3 rounded-xl border ${coachBorder} ${coachBg.card} font-bold uppercase tracking-widest ${coachText.primary} hover:border-[#A729AD]/40`}
                  >
                    Escalado principiantes
                  </button>
                </div>

                <p className={`text-xs ${coachText.muted} font-bold uppercase tracking-widest`}>Detalle completo</p>
                <div className="space-y-4">
                  {sessions.map(({ label, color, key }) => (
                    <div key={key} className={`rounded-xl p-5 border ${coachBorder} ${coachBg.card}`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <p className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                          {label}
                        </p>
                        <button
                          type="button"
                          onClick={() => ask(`Sobre ${dayName} · ${label}: tengo una duda concreta: `)}
                          className={`text-xs font-bold ${coachText.accent} uppercase shrink-0 underline decoration-[#A729AD]/40`}
                        >
                          Preguntar esta clase
                        </button>
                      </div>
                      <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
                    </div>
                  ))}
                  {feedbacks.map(({ label, key }) => (
                    <div key={key} className="rounded-xl p-5 border border-indigo-900/50 bg-indigo-950/25">
                      <p className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-2">{label}</p>
                      <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia[key]}</pre>
                    </div>
                  ))}
                  {!hasAny && (
                    <p className={`text-sm ${coachText.muted}`}>
                      Este día no tiene bloques en los datos publicados. Pide al programador que vuelva a publicar.
                    </p>
                  )}
                  {wb && (
                    <div className="rounded-xl p-5 border border-emerald-900/50 bg-emerald-950/20">
                      <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2">Vista alumno (WodBuster)</p>
                      <pre className={`text-sm ${coachText.muted} font-medium whitespace-pre-wrap leading-relaxed font-sans`}>{dia.wodbuster}</pre>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
