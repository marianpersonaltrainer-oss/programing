import { sanitizeCoachFeedbackText } from '../../utils/coachFeedbackText.js'

/** Resumen en tarjeta (pase + briefing publicado). */
export function CoachSessionBriefingPreview({ text, lineClamp = 4 }) {
  const body = sanitizeCoachFeedbackText(text)
  if (!body) return null

  const clamp = lineClamp === 3 ? 'line-clamp-3' : 'line-clamp-4'

  return (
    <p
      className={`text-[13px] text-[#F6E8F9]/95 ${clamp} leading-snug whitespace-pre-line`}
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      {body}
    </p>
  )
}

/** Bloque completo en modal (mismo briefing). */
export function CoachSessionBriefingModalBody({ text }) {
  const body = sanitizeCoachFeedbackText(text)
  if (!body) return null

  return (
    <div
      className="text-[14px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap border-b border-neutral-200 pb-3 mb-3"
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      {body}
    </div>
  )
}
