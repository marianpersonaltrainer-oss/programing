import { parseBriefingForDisplay } from '../../utils/feedbackV2Schema.js'

/**
 * Parte un briefing largo en párrafos legibles: saltos de línea, guiones largos (—),
 * punto y seguido + mayúscula, o punto y coma.
 */
export function briefingReadableParagraphs(text) {
  const t = String(text || '').trim()
  if (!t) return []

  if (/\n/.test(t)) {
    return t
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .flatMap((segment) => splitOneBlock(segment))
  }
  return splitOneBlock(t)
}

function splitOneBlock(s) {
  const trimmed = s.trim()
  if (!trimmed) return []

  const dashParts = trimmed.split(/\s*[—–]\s+/).map((x) => x.trim()).filter(Boolean)
  const blocks = dashParts.length > 1 ? dashParts : [trimmed]

  const out = []
  for (const block of blocks) {
    const semi = block.split(/;\s+/).map((x) => x.trim()).filter(Boolean)
    const pieces = semi.length > 1 ? semi : [block]
    for (const piece of pieces) {
      const sents = splitSpanishSentences(piece)
      out.push(...(sents.length > 0 ? sents : [piece]))
    }
  }
  return out.filter(Boolean)
}

function splitSpanishSentences(text) {
  const t = text.trim()
  if (!t) return []
  const parts = t.split(/(?<=[.!?])\s+(?=[¿¡]?(?:\p{Lu}|\d{1,2}\s))/u).map((x) => x.trim()).filter(Boolean)
  if (parts.length > 1) return parts
  return [t]
}

/** Resumen en tarjeta (pase + briefing publicado). */
export function CoachSessionBriefingPreview({ text, accent, lineClamp = 4 }) {
  const parsed = parseBriefingForDisplay(text)
  if (parsed.type === 'empty') return null

  const clamp = lineClamp === 3 ? 'line-clamp-3' : 'line-clamp-5'

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
      <div className={`space-y-2 text-[12px] leading-snug ${clamp}`}>
        {rows.map(([label, body]) => (
          <div key={label} className="space-y-1">
            <p className="text-[#F6E8F9]/95">
              <span className="font-bold" style={{ color: accent }}>
                {label}
              </span>
            </p>
            <div className="space-y-1 pl-0 border-l-2 border-[#F6E8F9]/15 pl-2">
              {briefingReadableParagraphs(String(body).trim()).map((para, j) => (
                <p key={j} className="text-[#F6E8F9]/90 leading-snug">
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const paras = briefingReadableParagraphs(parsed.text)
  const preview = paras.slice(0, 4)
  return (
    <div
      className={`space-y-1.5 text-[13px] text-[#F6E8F9]/95 ${clamp} overflow-hidden`}
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      {preview.map((para, i) => (
        <p key={i} className="leading-snug border-l-2 border-[#F6E8F9]/12 pl-2">
          {para}
          {i === preview.length - 1 && paras.length > preview.length ? ' …' : ''}
        </p>
      ))}
    </div>
  )
}

/** Bloque completo en modal (mismo briefing). */
export function CoachSessionBriefingModalBody({ text, accentColor = '#16a34a' }) {
  const parsed = parseBriefingForDisplay(text)
  if (parsed.type === 'empty') return null

  const rail = { borderLeftColor: accentColor }

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
        className="space-y-4 text-[14px] text-[#1a1a1a] border-b border-neutral-200 pb-4 mb-4"
        style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
      >
        {rows.map(([label, body]) => (
          <div key={label} className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">{label}</p>
            <div className="space-y-2.5 pl-1 border-l-2 border-neutral-200 pl-3" style={rail}>
              {briefingReadableParagraphs(String(body).trim()).map((para, j) => (
                <p key={j} className="leading-[1.65] text-[#1a1a1a]">
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const paras = briefingReadableParagraphs(parsed.text)
  return (
    <div
      className="space-y-2.5 text-[14px] text-[#1a1a1a] border-b border-neutral-200 pb-4 mb-4"
      style={{ fontFamily: 'Montserrat, var(--font-evo-body), sans-serif' }}
    >
      <div className="space-y-2.5 pl-1 border-l-2 border-neutral-200 pl-3" style={rail}>
        {paras.map((para, i) => (
          <p key={i} className="leading-[1.65] text-[#1a1a1a]">
            {para}
          </p>
        ))}
      </div>
    </div>
  )
}
