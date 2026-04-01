/**
 * Vista de sesión en texto plano con jerarquía visual (sin markdown):
 * - Encabezados de bloque en color
 * - Líneas de ejercicio con sangría
 * - Rangos (X' - Y') en negrita
 */

const PAREN_TIMING = /(\(\s*\d+\s*['′']?\s*[-–]\s*\d+\s*['′']?\s*\))/g

function isLikelyBlockHeader(trimmed) {
  if (!trimmed) return false
  if (/^FESTIVO\b/i.test(trimmed)) return false
  if (/^[ABC]\)\s+\S/i.test(trimmed)) return true
  if (/^(BIENVENIDA|CIERRE|CALENTAMIENTO|TÉCNICA|TECNICA|WOD|FUERZA|PARTE|BLOQUE|ACCESORIOS|CASH|CHIPPER|HYBRIX|FOR TIME|AMRAP|EMOM|E2MOM|E3MOM)\b/i.test(trimmed))
    return true
  if (/WOD\s*[—–-]/i.test(trimmed)) return true
  const letters = trimmed.replace(/[^a-záéíóúñA-ZÁÉÍÓÚÑ]/g, '')
  if (letters.length < 4) return false
  const upper = trimmed.toUpperCase()
  if (upper === trimmed && trimmed.length <= 72) return true
  return false
}

function partsWithBoldTimings(line) {
  const out = []
  let last = 0
  let m
  const re = new RegExp(PAREN_TIMING.source, 'gi')
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ type: 'text', text: line.slice(last, m.index) })
    out.push({ type: 'time', text: m[1] })
    last = m.index + m[1].length
  }
  if (last < line.length) out.push({ type: 'text', text: line.slice(last) })
  if (out.length === 0) out.push({ type: 'text', text: line })
  return out
}

export default function CoachFormattedSession({ text, accentColor = '#6A1F6D' }) {
  const raw = String(text ?? '')
  const lines = raw.split('\n')

  return (
    <div className="coach-formatted-session text-sm font-medium leading-relaxed font-sans">
      {lines.map((line, i) => {
        const trimmed = line.trimEnd()
        const t = trimmed.trim()

        if (!t) {
          return <div key={i} className="h-2" aria-hidden />
        }

        if (isLikelyBlockHeader(t)) {
          return (
            <p
              key={i}
              className="font-extrabold uppercase tracking-wide text-[13px] mt-3 first:mt-0 mb-1"
              style={{ color: accentColor }}
            >
              {partsWithBoldTimings(t).map((p, j) =>
                p.type === 'time' ? (
                  <strong key={j} className="text-[#1A0A1A] font-black">
                    {p.text}
                  </strong>
                ) : (
                  <span key={j}>{p.text}</span>
                ),
              )}
            </p>
          )
        }

        return (
          <p key={i} className="pl-4 sm:pl-6 text-[#1A0A1A]/95 mb-0.5">
            {partsWithBoldTimings(trimmed).map((p, j) =>
              p.type === 'time' ? (
                <strong key={j} className="font-bold text-[#1A0A1A]">
                  {p.text}
                </strong>
              ) : (
                <span key={j}>{p.text}</span>
              ),
            )}
          </p>
        )
      })}
    </div>
  )
}
