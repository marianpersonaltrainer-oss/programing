/**
 * Abre una ventana imprimible con la sesión (sin dependencias; window.print).
 */
export function printCoachDaySession({ coachName, dateLabel, dayLabel, blocks }) {
  const safeBlocks = Array.isArray(blocks) ? blocks : []
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const rows = safeBlocks
    .map(
      ({ classLabel, text }) => `
    <section class="block">
      <h2>${esc(classLabel)}</h2>
      <pre class="body">${esc(text)}</pre>
    </section>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(dayLabel)} — sesión</title>
  <style>
    @page { margin: 14mm; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #111; font-size: 11pt; line-height: 1.35; }
    h1 { font-size: 14pt; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
    .meta { font-size: 9pt; color: #444; margin-bottom: 18px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
    .block { margin-bottom: 16px; page-break-inside: avoid; }
    h2 { font-size: 11pt; margin: 0 0 6px; color: #4a1750; text-transform: uppercase; letter-spacing: 0.06em; }
    pre.body { white-space: pre-wrap; word-break: break-word; margin: 0; font-family: inherit; font-size: 10pt; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <h1>Programación · ${esc(dayLabel)}</h1>
  <p class="meta">Coach: <strong>${esc(coachName || '—')}</strong> · ${esc(dateLabel || '')}</p>
  ${rows || '<p>Sin contenido.</p>'}
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`

  const w = window.open('', '_blank', 'noopener,noreferrer')
  if (!w) return false
  w.document.open()
  w.document.write(html)
  w.document.close()
  return true
}
