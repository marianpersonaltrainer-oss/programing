import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { findVideosInProgramTextResolved } from '../../utils/coachLibraryVideoMatch.js'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import { CoachSessionBriefingModalBody } from './CoachSessionBriefing.jsx'
import { classDisplayTitle } from './coachTheme.js'

function youtubeVideoId(url) {
  const s = String(url || '')
  const m = s.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/i)
  return m ? m[1] : null
}

/**
 * Modal a pantalla completa, fondo blanco (WodBuster-style).
 * `onConsultAssistant` recibe { dayName, classLabel, sessionText } (solo WOD); el padre cierra el modal si aplica.
 */
export default function WodModal({
  open,
  onClose,
  sessionKey,
  classLabel,
  dayName,
  sessionText,
  sessionFeedback = '',
  dailyFeedback = null,
  accentColor,
  exerciseLibrary,
  onConsultAssistant,
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const videoLookupText = [sessionText, sessionFeedback]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join('\n')
  const videos = videoLookupText
    ? findVideosInProgramTextResolved(videoLookupText, exerciseLibrary || [], {
        specializedOnly: false,
      })
    : []
  const inlineExerciseLinks = findVideosInProgramTextResolved(String(sessionText || ''), exerciseLibrary || [], {
    specializedOnly: false,
  }).slice(0, 24)

  if (!mounted || !open) return null

  const titleUpper = classDisplayTitle(sessionKey)
  const dayUpper = String(dayName || '').toUpperCase()

  const node = (
    <div
      className="fixed inset-0 z-[180] flex flex-col bg-white text-[#1a1a1a] font-evo-body"
      role="dialog"
      aria-modal="true"
      aria-label={`WOD ${classLabel}`}
    >
      <div className="flex-shrink-0 flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 border-b border-neutral-200">
        <button
          type="button"
          onClick={onClose}
          className="p-3 rounded-xl text-[#1a1a1a] hover:bg-neutral-100 text-2xl leading-none font-light"
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <h2
          className="font-evo-display font-bold text-[18px] uppercase tracking-tight mb-2"
          style={{ color: accentColor }}
        >
          {titleUpper} · {dayUpper}
        </h2>

        {dailyFeedback?.note ? (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">Feedback de hoy</p>
            {dailyFeedback?.meta ? <p className="text-[11px] text-amber-700/90 mt-0.5">{dailyFeedback.meta}</p> : null}
            <p className="text-[13px] leading-snug text-amber-900 mt-1 whitespace-pre-wrap">{dailyFeedback.note}</p>
          </div>
        ) : null}

        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Entrenamiento</p>
        <CoachFormattedSession
          text={sessionText}
          accentColor={accentColor}
          variant="modalProse"
          exerciseLinks={inlineExerciseLinks}
          linkifyExerciseNames
        />

        <div className="mt-5 rounded-2xl border-2 border-[#A729AD]/35 bg-gradient-to-b from-[#FAF5FC] to-white shadow-md shadow-[#6A1F6D]/10 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-[#A729AD]/15 bg-white/80">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#6A1F6D]">Ayuda en esta sesión</p>
            <p className="text-[13px] text-neutral-600 mt-1 leading-snug">
              Vídeos de la biblioteca y asistente, sin bajar al final del texto.
            </p>
          </div>

          <div className="px-4 py-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-[13px] sm:text-[15px] font-evo-display font-bold uppercase tracking-wide text-[#1a1a1a]">
                  🎬 Vídeos de referencia
                </p>
                {videos.length ? (
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#A729AD]/15 text-[#6A1F6D]">
                    {videos.length} vídeo{videos.length === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
              {!videos.length ? (
                <p className="text-sm text-neutral-600 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/80 px-3 py-3">
                  No hay vídeos enlazados para este bloque (revisa la biblioteca o los nombres en programación).
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1">
                  {videos.map(({ name, url }) => {
                    const id = youtubeVideoId(url)
                    return (
                      <a
                        key={`${name}-${url}`}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-4 rounded-xl border-2 border-neutral-200 hover:border-[#A729AD]/50 hover:shadow-md overflow-hidden bg-white transition-all active:scale-[0.99]"
                      >
                        {id ? (
                          <img
                            src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`}
                            alt=""
                            className="w-36 h-24 sm:w-40 sm:h-28 object-cover shrink-0 bg-neutral-100"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-36 h-24 sm:w-40 sm:h-28 shrink-0 bg-gradient-to-br from-[#6A1F6D] to-[#A729AD] flex items-center justify-center text-white text-2xl">
                            ▶
                          </div>
                        )}
                        <span className="py-3 pr-3 text-[15px] sm:text-base font-semibold text-[#1a1a1a] leading-snug self-center min-w-0">
                          {name}
                        </span>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#A729AD]/12">
              <p className="text-[13px] sm:text-[15px] font-evo-display font-bold uppercase tracking-wide text-[#1a1a1a] mb-2">
                🤖 Asistente EVO
              </p>
              <p className="text-xs text-neutral-600 mb-3">
                Dudas sobre el WOD de hoy; enviamos el día, clase y texto programado automáticamente.
              </p>
              <button
                type="button"
                onClick={() => {
                  onConsultAssistant({
                    dayName,
                    classLabel,
                    sessionText: String(sessionText || ''),
                    sessionFeedbackText: String(sessionFeedback || '').trim() || undefined,
                  })
                }}
                className="w-full py-4 px-4 rounded-xl text-[15px] sm:text-[16px] font-bold uppercase tracking-wide text-white shadow-lg shadow-[#6A1F6D]/30 transition-all hover:brightness-110 hover:shadow-xl active:scale-[0.99]"
                style={{ backgroundColor: accentColor || '#6A1F6D' }}
              >
                Consultar al asistente
              </button>
            </div>
          </div>
        </div>

        {String(sessionFeedback || '').trim() ? (
          <div className="mt-5 rounded-lg border border-[#A729AD]/28 bg-[#F8F1FB] px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#6A1F6D] mb-1.5">Briefing programación</p>
            <CoachSessionBriefingModalBody text={sessionFeedback} accentColor={accentColor} />
          </div>
        ) : null}
      </div>
    </div>
  )

  return createPortal(node, document.body)
}
