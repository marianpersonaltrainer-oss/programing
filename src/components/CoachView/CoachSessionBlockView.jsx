import { useEffect, useState } from 'react'
import CoachFormattedSession from './CoachFormattedSession.jsx'
import CoachScreenModeOverlay from './CoachScreenModeOverlay.jsx'
import { parseTimedBlocks, classElapsedMinutes, findActiveTimedBlock } from '../../utils/parseSessionTimings.js'
import { findLibraryRowsForLine } from '../../utils/coachLibraryLineMatch.js'
import { resolveVideoUrlForExerciseLabel } from '../../constants/exerciseVideos.js'
import { coachBorder, coachText, coachBg } from './coachTheme.js'

function formatClockFromMs(elapsedMs) {
  const s = Math.floor(elapsedMs / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

const LEVEL_ES = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' }

function EscaladosDetails({ rows }) {
  if (!rows?.length) return null
  return (
    <details className={`mt-1 mb-2 ml-4 sm:ml-6 rounded-xl border ${coachBorder} ${coachBg.cardMuted} px-3 py-2`}>
      <summary className={`text-[11px] font-bold uppercase tracking-widest cursor-pointer ${coachText.accent}`}>
        Escalados →
      </summary>
      <ul className="mt-2 space-y-2 text-xs">
        {rows.map((r) => {
          const url = resolveVideoUrlForExerciseLabel(r.name, r.video_url)
          return (
            <li key={r.id || r.name} className={`${coachText.muted} leading-snug`}>
              <span className={`font-bold ${coachText.primary}`}>{r.name}</span>
              {r.level ? (
                <span className="text-[10px] ml-2 opacity-80">({LEVEL_ES[r.level] || r.level})</span>
              ) : null}
              {r.notes?.trim() ? <p className="mt-0.5 whitespace-pre-wrap">{r.notes.trim()}</p> : null}
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-block mt-1 font-bold ${coachText.accent} hover:underline`}
                >
                  Vídeo
                </a>
              ) : null}
            </li>
          )
        })}
      </ul>
    </details>
  )
}

/**
 * Sesión con temporizador, modo pantalla y desplegables Escalados por línea (biblioteca).
 */
export default function CoachSessionBlockView({
  sessionText,
  accentColor,
  dayName,
  classLabel,
  exerciseLibrary = [],
}) {
  const [screenOpen, setScreenOpen] = useState(false)
  const [timerRunning, setTimerRunning] = useState(false)
  const [startedAt, setStartedAt] = useState(null)
  const [, setTick] = useState(0)

  const blocks = parseTimedBlocks(sessionText)
  const hasTimings = blocks.length > 0

  useEffect(() => {
    if (!timerRunning || !startedAt) return undefined
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [timerRunning, startedAt])

  const elapsedMs = timerRunning && startedAt ? Date.now() - startedAt : 0
  const elapsedMin = timerRunning && startedAt ? classElapsedMinutes(startedAt) : 0
  const activeIdx = timerRunning && hasTimings ? findActiveTimedBlock(blocks, elapsedMin) : -1

  function startTimer() {
    setStartedAt(Date.now())
    setTimerRunning(true)
  }

  function stopTimer() {
    setTimerRunning(false)
    setStartedAt(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          onClick={timerRunning ? stopTimer : startTimer}
          className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl border ${
            timerRunning
              ? 'bg-rose-900 text-white border-rose-950'
              : 'bg-[#1a5f1a] text-white border-green-950'
          }`}
        >
          {timerRunning ? '■ Detener' : '▶ Iniciar clase'}
        </button>
        {timerRunning ? (
          <span className={`text-lg font-black tabular-nums ${coachText.primary}`}>{formatClockFromMs(elapsedMs)}</span>
        ) : null}
        {!hasTimings ? (
          <span className={`text-[10px] ${coachText.muted}`}>
            Sin horarios en texto: cronómetro sin bloques automáticos
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setScreenOpen(true)}
          className="text-[10px] font-bold uppercase tracking-widest px-4 py-2.5 rounded-xl bg-[#1e1e24] text-white border border-white/10 hover:bg-black/80"
        >
          Modo pantalla
        </button>
      </div>

      {hasTimings && timerRunning ? (
        <ul className={`rounded-xl border ${coachBorder} ${coachBg.cardMuted} divide-y divide-black/5 overflow-hidden`}>
          {blocks.map((b, i) => (
            <li
              key={`${b.startMin}-${b.endMin}-${i}`}
              className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                i === activeIdx ? 'bg-[#A729AD]/20 ring-2 ring-[#A729AD]/50 ring-inset' : ''
              }`}
            >
              <span className="font-mono tabular-nums text-[10px] opacity-70">
                {b.startMin}′–{b.endMin}′
              </span>{' '}
              <span className={coachText.primary}>{b.title}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <CoachFormattedSession
        text={sessionText}
        accentColor={accentColor}
        renderAfterLine={(_line, _i, t) => {
          if (t.length < 14) return null
          if (/^(BIENVENIDA|CIERRE)\b/i.test(t)) return null
          if (/^[A-C]\)\s/.test(t) && t.length < 96) return null
          const libRows = findLibraryRowsForLine(t, exerciseLibrary)
          return libRows.length ? <EscaladosDetails rows={libRows} /> : null
        }}
      />

      <CoachScreenModeOverlay
        open={screenOpen}
        onClose={() => setScreenOpen(false)}
        dayName={dayName}
        classLabel={classLabel}
        sessionText={sessionText}
      />
    </div>
  )
}
