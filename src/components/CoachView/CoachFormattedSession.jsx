/**
 * Render EVO para WOD/sesiones:
 * - Bloques detectados por cabeceras
 * - Badge de formato (AMRAP/EMOM/FOR TIME/LADDER/CHIPPER/EVERY)
 * - Resaltado inline de %RM y tiempos
 * - Variante `modalLight`: fondo blanco, acento por clase
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
  if (/\bTABATA\b/.test(t)) return 'TABATA'
  if (/\bEVERY\b/.test(t)) return 'EVERY'
  return ''
}

function tokenizeInline(text) {
  const regex =
    /(\b\d{1,3}%\s*(?:RM|1RM|2RM|3RM|4RM|5RM)?\b|\d{1,3}\s*(?:''|['′"]{1,3})\b|\b\d+\s*(?:min|minutos?|seg|segundos?)\b|\(\s*\d+\s*['′"]?\s*[-–]\s*\d+\s*['′"]?\s*\))/gi
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

function renderInline(text, variant, accentColor) {
  const bare = variant === 'bare'
  const modalLight = variant === 'modalLight'
  return tokenizeInline(text).map((part, idx) => {
    if (part.type === 'percent') {
      if (modalLight) {
        return (
          <strong key={idx} className="font-bold" style={{ color: accentColor }}>
            {part.text}
          </strong>
        )
      }
      return (
        <strong key={idx} className="text-[#FFFF4C] font-bold">
          {part.text}
        </strong>
      )
    }
    if (part.type === 'time') {
      if (modalLight) {
        return (
          <strong key={idx} className="text-[#555555] font-semibold">
            {part.text}
          </strong>
        )
      }
      return (
        <strong key={idx} className={bare ? 'text-[#A729AD] font-semibold' : 'text-[#A729AD] font-bold'}>
          {part.text}
        </strong>
      )
    }
    return (
      <span key={idx} className={modalLight ? 'text-[#1a1a1a]' : ''}>
        {part.text}
      </span>
    )
  })
}

function groupLinesForCollapse(rawLines) {
  const groups = []
  let i = 0
  while (i < rawLines.length) {
    const raw = rawLines[i]
    const t = raw.trim()
    const m = t.match(/^▸\s*(.+)$/)
    if (m) {
      const title = m[1].trim()
      const body = []
      i += 1
      while (i < rawLines.length) {
        const nt = rawLines[i].trim()
        if (!nt) {
          i += 1
          break
        }
        if (/^▸\s/.test(rawLines[i].trim())) break
        body.push(rawLines[i])
        i += 1
      }
      groups.push({ type: 'collapse', title, body })
      continue
    }
    groups.push({ type: 'line', line: raw })
    i += 1
  }
  return groups
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

function renderBlockLines(block, blockIdx, variant, accentColor, bare, modalLight, renderAfterLine) {
  const lineGroups = modalLight ? groupLinesForCollapse(block.lines) : block.lines.map((line) => ({ type: 'line', line }))

  return lineGroups.map((group, gIdx) => {
    if (group.type === 'collapse') {
      return (
        <details key={`c-${blockIdx}-${gIdx}`} className="mt-1 mb-2 rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2">
          <summary
            className="cursor-pointer list-none font-semibold text-[13px] [&::-webkit-details-marker]:hidden"
            style={{ color: accentColor }}
          >
            ▸ {group.title}
          </summary>
          <div className="mt-2 space-y-1.5 pl-1">
            {group.body.map((line, lineIdx) => {
              const t = line.trim()
              return (
                <p key={lineIdx} className={modalLight ? 'text-[#1a1a1a] text-[14px] leading-[1.7]' : 'text-[#F6E8F9] leading-[1.6]'}>
                  <span className={`mr-2 ${modalLight ? 'text-[#888888]' : 'text-[#A729AD]'}`}>•</span>
                  {renderInline(t, variant, accentColor)}
                </p>
              )
            })}
          </div>
        </details>
      )
    }
    const line = group.line
    const t = line.trim()
    const suffix = renderAfterLine && t ? renderAfterLine(line, gIdx, t) : null
    return (
      <div key={`${blockIdx}-${gIdx}`}>
        <p
          className={
            modalLight ? 'text-[#1a1a1a] text-[14px] leading-[1.7]' : bare ? 'text-[#F6E8F9] leading-[1.6]' : 'text-[#F6E8F9] leading-relaxed'
          }
        >
          <span className={`mr-2 ${modalLight ? 'text-[#888888]' : 'text-[#A729AD]'}`}>•</span>
          {renderInline(t, variant, accentColor)}
        </p>
        {suffix}
      </div>
    )
  })
}

export default function CoachFormattedSession({ text, accentColor = '#6A1F6D', renderAfterLine, variant = 'card' }) {
  const bare = variant === 'bare'
  const modalLight = variant === 'modalLight'
  const raw = String(text ?? '')
  const lines = raw.split('\n')
  const blocks = toBlocks(lines)

  const rootClass = modalLight
    ? 'coach-formatted-session space-y-6 text-[14px] leading-[1.7] font-evo-body text-[#1a1a1a]'
    : bare
      ? 'coach-formatted-session space-y-5 text-[14px] leading-[1.6] font-evo-body text-[#F6E8F9]'
      : 'coach-formatted-session space-y-3 text-sm font-evo-body'

  return (
    <div className={rootClass}>
      {blocks.map((block, blockIdx) => {
        const format = detectWodFormat(`${block.header}\n${block.lines.join('\n')}`)
        const variantKey = modalLight ? 'modalLight' : bare ? 'bare' : 'card'
        return (
          <section
            key={`${block.header}-${blockIdx}`}
            className={
              modalLight
                ? 'pb-6 border-b border-neutral-200 last:border-0 last:pb-0'
                : bare
                  ? 'pb-5 border-b border-[#6A1F6D]/25 last:border-0 last:pb-0'
                  : 'rounded-[12px] bg-[#1a0f1b] border border-[#6A1F6D]/30 border-l-[3px] px-4 py-4'
            }
          >
            <div className={`flex flex-wrap items-center gap-2 ${bare || modalLight ? 'mb-2.5' : 'mb-3'}`}>
              <span
                className={
                  modalLight
                    ? 'inline-flex items-center bg-[#EEEEEE] text-[#111111] px-2.5 py-1 text-[11px] uppercase tracking-wide font-evo-display'
                    : bare
                      ? 'inline-flex items-center bg-[#6A1F6D] px-2.5 py-1 text-white text-[11px] uppercase tracking-wide font-evo-display'
                      : 'inline-flex items-center rounded-md bg-[#6A1F6D] px-2.5 py-1 text-white text-xs uppercase tracking-wider font-evo-display'
                }
                style={!bare && !modalLight ? { color: '#FFFFFF', borderColor: accentColor } : undefined}
              >
                {block.header}
              </span>
              {format ? (
                <span
                  className={
                    modalLight
                      ? 'inline-flex items-center bg-transparent px-2 py-0.5 text-[10px] font-evo-display uppercase tracking-wide border'
                      : bare
                        ? 'inline-flex items-center border border-[#FFFF4C] text-[#FFFF4C] bg-transparent px-2 py-0.5 text-[10px] font-evo-display uppercase tracking-wide'
                        : 'inline-flex items-center rounded-md bg-[#FFFF4C] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#0C0B0C]'
                  }
                  style={modalLight ? { borderColor: accentColor, color: accentColor } : undefined}
                >
                  {format}
                </span>
              ) : null}
            </div>
            <div className="space-y-1.5">
              {renderBlockLines(block, blockIdx, variantKey, accentColor, bare, modalLight, renderAfterLine)}
            </div>
            {!bare && !modalLight && blockIdx < blocks.length - 1 ? <div className="mt-4 border-t border-[#6A1F6D]/30" /> : null}
          </section>
        )
      })}
    </div>
  )
}
