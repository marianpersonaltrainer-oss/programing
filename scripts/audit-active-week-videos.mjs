/**
 * Audita vídeos resueltos para la semana ACTIVA (misma lógica que la app coach).
 * Uso: node --env-file=.env scripts/audit-active-week-videos.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Dynamic import of app modules (no bundler)
const { publishedDayProgramText, findVideosForPublishedDay, EXERCISE_VIDEOS } = await import(
  join(root, 'src/constants/exerciseVideos.js')
)
const { findVideosForPublishedDayResolved, getTrustedLibraryVideoUrl } = await import(
  join(root, 'src/utils/coachLibraryVideoMatch.js')
)

const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan credenciales Supabase en .env')
  process.exit(1)
}

const supabase = createClient(url, key)

async function youtubeOembedOk(watchUrl) {
  const oembed = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`
  try {
    const r = await fetch(oembed, { signal: AbortSignal.timeout(8000) })
    return r.ok
  } catch {
    return false
  }
}

function extractYoutubeId(u) {
  const m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/watch\?v=|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  return m ? m[1] : null
}

function classifyUrl(url) {
  if (!url) return 'none'
  if (/^\/api\/video-resolve\?/i.test(url)) return 'resolver'
  if (/youtube\.com\/results/i.test(url)) return 'search'
  if (extractYoutubeId(url)) return 'youtube'
  return 'other'
}

const { data: week, error: weekErr } = await supabase
  .from('published_weeks')
  .select('*')
  .eq('is_active', true)
  .order('published_at', { ascending: false })
  .limit(1)
  .maybeSingle()

if (weekErr) throw weekErr
if (!week?.data) {
  console.error('No hay semana activa en Supabase')
  process.exit(1)
}

const { data: library, error: libErr } = await supabase
  .from('coach_exercise_library')
  .select('name, video_url, video_url_verified, category')
  .order('name')

if (libErr) console.warn('Biblioteca:', libErr.message)

const dias = week.data?.dias || []
console.log(`\n=== Semana activa: ${week.mesociclo} S${week.semana} — ${week.titulo || week.data?.titulo || ''} ===\n`)

const seen = new Map()
const issues = []

for (const dia of dias) {
  const dayName = dia?.nombre || '?'
  const videos = findVideosForPublishedDayResolved(dia, library || [])
  const dayText = publishedDayProgramText(dia)

  for (const { name, url } of videos) {
    const key = `${name}::${url}`
    if (seen.has(key)) continue
    seen.set(key, { dayName, name, url })

    const kind = classifyUrl(url)
    let status = 'ok'
    let detail = ''

    if (kind === 'resolver') {
      status = 'fallback'
      detail = 'Usa /api/video-resolve (puede no coincidir con el ejercicio)'
    } else if (kind === 'search') {
      status = 'search'
      detail = 'Enlace de búsqueda YouTube, no vídeo directo'
    } else if (kind === 'youtube') {
      const id = extractYoutubeId(url)
      const ok = await youtubeOembedOk(url)
      if (!ok) {
        status = 'broken'
        detail = `YouTube oembed falló (id: ${id})`
      }
    } else if (kind === 'other') {
      status = 'unknown'
      detail = 'URL no reconocida'
    }

    if (status !== 'ok') {
      issues.push({ dayName, name, url, status, detail, kind })
    }
  }
}

const weekText = dias.map((d) => publishedDayProgramText(d)).join('\n')
const staticVideos = findVideosForPublishedDay({ wodbuster: weekText })

const brokenStatic = []
for (const { name, url } of staticVideos) {
  const id = extractYoutubeId(url)
  if (!id) continue
  const ok = await youtubeOembedOk(url)
  if (!ok) brokenStatic.push({ name, url, id })
}

console.log(`Días: ${dias.length} · Vídeos únicos resueltos: ${seen.size}`)
console.log(`Problemas detectados: ${issues.length}\n`)

const byStatus = {}
for (const i of issues) {
  byStatus[i.status] = (byStatus[i.status] || 0) + 1
}
console.log('Por tipo:', byStatus)

for (const dia of dias) {
  const dayIssues = issues.filter((i) => i.dayName === dia.nombre)
  if (!dayIssues.length) continue
  console.log(`\n--- ${dia.nombre} ---`)
  for (const i of dayIssues) {
    console.log(`  [${i.status}] ${i.name}`)
    console.log(`    ${i.detail}`)
    console.log(`    ${i.url}`)
  }
}

if (brokenStatic.length) {
  console.log('\n--- Mapa estático (exerciseVideos.js) con oembed roto en esta semana ---')
  for (const b of brokenStatic) {
    console.log(`  ${b.name} → ${b.id} (${b.url})`)
  }
}

// Library rows with broken verified URLs referenced in week
const libIssues = []
for (const row of library || []) {
  const trusted = getTrustedLibraryVideoUrl(row)
  if (!trusted) continue
  const lower = weekText.toLowerCase()
  if (!lower.includes(String(row.name || '').toLowerCase())) continue
  const id = extractYoutubeId(trusted)
  if (!id) continue
  const ok = await youtubeOembedOk(trusted)
  if (!ok) libIssues.push({ name: row.name, url: trusted, id, verified: row.video_url_verified })
}

if (libIssues.length) {
  console.log('\n--- Biblioteca Supabase (ejercicios de la semana) con vídeo roto ---')
  for (const l of libIssues) {
    console.log(`  ${l.name} → ${l.id} (verified: ${l.verified})`)
  }
}

if (!issues.length && !brokenStatic.length && !libIssues.length) {
  console.log('\n✓ Todos los vídeos resueltos responden OK en oembed.')
}
