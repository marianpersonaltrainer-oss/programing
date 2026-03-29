import {
  publishedDayProgramText,
  findVideosInProgramText,
  findVideosForPublishedDay,
  findExercisesWithVideos,
  resolveVideoUrlForExerciseLabel,
} from '../constants/exerciseVideos.js'

/**
 * Coincidencias por nombre en biblioteca Supabase (todas las filas con nombre).
 * URL: video_url válida si existe; si no, mapa EXERCISE_VIDEOS; si no, búsqueda YouTube.
 */
export function matchLibraryVideosInLowerText(lowerText, libraryRows, { max = 40, dedupeByUrl = true } = {}) {
  const rows = (libraryRows || []).filter((r) => String(r?.name || '').trim())
  const sorted = [...rows].sort((a, b) => String(b.name || '').length - String(a.name || '').length)
  const out = []
  const usedUrls = new Set()
  const lt = lowerText || ''
  for (const r of sorted) {
    const name = String(r.name || '').trim()
    if (!name) continue
    if (out.length >= max) break
    if (!lt.includes(name.toLowerCase())) continue
    const url = resolveVideoUrlForExerciseLabel(name, r.video_url)
    if (dedupeByUrl && usedUrls.has(url)) continue
    if (dedupeByUrl) usedUrls.add(url)
    out.push({ name, url })
  }
  return out
}

function mergeLibraryAndStatic(lib, stat) {
  const out = [...lib]
  for (const s of stat || []) {
    const sl = String(s.name || '').toLowerCase()
    const overlapped = lib.some((l) => {
      const ll = String(l.name || '').toLowerCase()
      return ll.includes(sl) || sl.includes(ll)
    })
    if (!overlapped) out.push(s)
  }
  return out
}

/** Vídeos del día: prioridad biblioteca Supabase; resto desde mapa estático si no solapan por nombre. */
export function findVideosForPublishedDayResolved(dia, libraryRows) {
  const lib = matchLibraryVideosInLowerText(publishedDayProgramText(dia).toLowerCase(), libraryRows)
  const stat = findVideosForPublishedDay(dia)
  return mergeLibraryAndStatic(lib, stat)
}

/** Vídeos en un fragmento de texto (p. ej. una clase). */
export function findVideosInProgramTextResolved(text, libraryRows) {
  const lib = matchLibraryVideosInLowerText((text || '').toLowerCase(), libraryRows)
  const stat = findVideosInProgramText(text)
  return mergeLibraryAndStatic(lib, stat)
}

/** Como findExercisesWithVideos (máx. 8) pero prioriza URLs de la biblioteca Supabase. */
export function findExercisesWithVideosResolved(text, libraryRows) {
  const lib = matchLibraryVideosInLowerText((text || '').toLowerCase(), libraryRows, {
    max: 8,
    dedupeByUrl: true,
  })
  const stat = findExercisesWithVideos(text)
  return mergeLibraryAndStatic(lib, stat).slice(0, 8)
}
