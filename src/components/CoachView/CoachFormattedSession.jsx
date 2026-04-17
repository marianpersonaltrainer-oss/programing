/**
 * Render EVO para WOD/sesiones:
 * - Bloques detectados por cabeceras
 * - Badge de formato (AMRAP/EMOM/FOR TIME/LADDER/CHIPPER/EVERY)
 * - Resaltado inline de %RM y tiempos
 */

function isLikelyBlockHeader(trimmed) {
  if (!trimmed) return false
  if (/^FESTIVO\b/i.test(trimmed)) return false
  if (/^\(no programada esta semana\)/i.test(trimmed)) return false
  if (/^[ABC]\)\s+\S/i.test(trimmed)) return true
  if (/^(BIENVENIDA|CIERRE|CALENTAMIENTO|TÉCNICA|TECNICA|SKILL|WOD|FUERZA|PARTE|BLOQUE|ACCESORIOS|CASH|CHIPPER|HYBRIX|FOR TIME|AMRAP|EMOM|E2MOM|E3MOM|EVERY|LADDER)\b/i.test(trimmed))
    return true
  if (/WOD\s*[—–-]/i.test(trimmed)) return true
  const letters = trimmed.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '')
  if (letters.length < 4) return false
  const upper = trimmed.toUpperCase()
  if (upper === trimmed && trimmed.length <= 72) return true
  return false
}

function detectWodFormat(text) {
  const t = String(text || '').toUpperCase()
  if (/\bFOR\s+TIME\b/.test(t)) return 'FOR TIME'
  if (/\bAMRAP\b/.test(t)) return 'AMRAP'
  if (/\bEMOM\b/.test(t) || /\bE\d+MOM\b/.test(t)) return 'EMOM'
  if (/\bLADDER\b/.test(t)) return 'LADDER'
  if (/\bCHIPPER\b/.test(t)) return 'CHIPPER'
  if (/\bEVERY\b/.test(t)) return 'EVERY'
  return ''
}

function tokenizeInline(text) {
  const regex = /(\b\d{1,3}%\s*(?:RM|1RM|2RM|3RM|4RM|5RM)?\b|\b\d+\s*(?:min|minutos?|seg|segundos?)\b|\(\s*\d+\s*['′"]?\s*[-–]\s*\d+\s*['′"]?\s*\))/gi
  const tokens = []
  let last = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', text: text.slice(last, m.index) })
    const raw = m[0]
    if (/%/.test(raw)) {
      tokens.push({ type: 'percent', text: raw })
    } else {
      tokens.push({ type: 'time', text: raw })
    }
    last = m.index + raw.length
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) })
  if (!tokens.length) tokens.push({ type: 'text', text })
  return tokens
}

function renderInline(text) {
  return tokenizeInline(text).map((part, idx) => {
    if (part.type === 'percent') {
      return (
        <strong key={idx} className="text-[#FFFF4C] font-bold">
          {part.text}
        </strong>
      )
    }
    if (part.type === 'time') {
      return (
        <strong key={idx} className="text-[#A729AD] font-bold">
          {part.text}
        </strong>
      )
    }
    return <span key={idx}>{part.text}</span>
  })
}

function toBlocks(lines) {
  const blocks = []
  let current = null
  lines.forEach((line) => {
    const raw = line.trimEnd()
    const t = raw.trim()
    if (!t) return
    if (isLikelyBlockHeader(t)) {
      if (current) blocks.push(current)
      current = { header: t, lines: [] }
      return
    }
    if (!current) current = { header: 'BLOQUE', lines: [] }
    current.lines.push(raw)
  })
  if (current) blocks.push(current)
  return blocks
}

export default function CoachFormattedSession({ text, accentColor = '#6A1F6D', renderAfterLine }) {
  const raw = String(text ?? '')
  const lines = raw.split('\n')
  const blocks = toBlocks(lines)

  return (
    <div className="coach-formatted-session space-y-3 text-sm font-evo-body">
      {blocks.map((block, blockIdx) => {
        const format = detectWodFormat(`${block.header}\n${block.lines.join('\n')}`)
        return (
          <section
            key={`${block.header}-${blockIdx}`}
            className="rounded-[12px] bg-[#1a0f1b] border border-[#6A1F6D]/30 border-l-[3px] px-4 py-4"
          >
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span
                className="inline-flex items-center rounded-md bg-[#6A1F6D] px-2.5 py-1 text-white text-xs uppercase tracking-wider font-evo-display"
                style={{ color: '#FFFFFF', borderColor: accentColor }}
              >
                {block.header}
              </span>
              {format ? (
                <span className="inline-flex items-center rounded-md bg-[#FFFF4C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0C0B0C]">
                  {format}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {block.lines.map((line, lineIdx) => {
                const t = line.trim()
                const suffix = renderAfterLine && t ? renderAfterLine(line, lineIdx, t) : null
                return (
                  <div key={`${blockIdx}-${lineIdx}`}>
                    <p className="text-[#F6E8F9] leading-relaxed">
                      <span className="mr-2 text-[#A729AD]">•</span>
                      {renderInline(t)}
                    </p>
                    {suffix}
                  </div>
                )
              })}
            </div>
            {blockIdx < blocks.length - 1 ? <div className="mt-4 border-t border-[#6A1F6D]/30" /> : null}
          </section>
        )
      })}
    </div>
  )
}
