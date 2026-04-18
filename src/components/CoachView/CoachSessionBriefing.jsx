import { parseBriefingForDisplay } from '../../utils/feedbackV2Schema.js'

/** Resumen en tarjeta (pase + briefing publicado). */
export function CoachSessionBriefingPreview({ text, accent, lineClamp = 4 }) {
  const parsed = parseBriefingForDisplay(text)
  if (parsed.type === 'empty') return null

  const clamp = lineClamp === 3 ? 'line-clamp-3' : 'line-clamp-4'

  if (parsed.type === 'v2' || parsed.type === 'partial') {
    const rows =
      parsed.type === 'v2'
        ? [
            ['Objetivo', parsed.objetivo],
            ['Sensaciones', parsed.sensaciones],
            ['Anticipación', parsed.anticipacion],
          ].filter(([, body]) => body?.trim())
        : parsed.fields.map((f) => [f.label, f.text])

    return (
      <div className={`space-y-1.5 text-[12px] leading-snug ${clamp}`}>
        {rows.map(([label, body]) => (
          <p key={label} className="text-[#F6E8F9]/95">
            <span className="font-bold" style={{ color: accent }}>
              {label}
            </span>
            <span className="text-[#F6E8F9CC]"> · </span>
            <span className="whitespace-pre-line">{String(body).trim()}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <p
      className={`text-[13px] text-[#F6E8F9]/95 ${clamp} leading-snug whitespace-pre-line`}
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      {parsed.text}
    </p>
  )
}

/** Bloque completo en modal (mismo briefing). */
export function CoachSessionBriefingModalBody({ text, accentColor }) {
  const parsed = parseBriefingForDisplay(text)
  if (parsed.type === 'empty') return null

  if (parsed.type === 'v2' || parsed.type === 'partial') {
    const rows =
      parsed.type === 'v2'
        ? [
            ['Objetivo', parsed.objetivo],
            ['Sensaciones', parsed.sensaciones],
            ['Anticipación', parsed.anticipacion],
          ].filter(([, body]) => body?.trim())
        : parsed.fields.map((f) => [f.label, f.text])

    return (
      <div
        className="space-y-2.5 text-[14px] leading-relaxed text-[#1a1a1a] border-b border-neutral-200 pb-3 mb-3"
        style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
      >
        {rows.map(([label, body]) => (
          <p key={label}>
            <span className="font-bold" style={{ color: accentColor }}>
              {label}
            </span>
            <span className="text-neutral-500"> · </span>
            <span className="whitespace-pre-line">{String(body).trim()}</span>
          </p>
        ))}
      </div>
    )
  }

  return (
    <div
      className="text-[14px] leading-relaxed text-[#1a1a1a] whitespace-pre-wrap border-b border-neutral-200 pb-3 mb-3"
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      {parsed.text}
    </div>
  )
}
