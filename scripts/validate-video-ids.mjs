/** Extract V('...') IDs from exerciseVideos.js; ensure watch page is not "Video unavailable". */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src/constants/exerciseVideos.js'), 'utf8')
const ids = [...src.matchAll(/V\('([a-zA-Z0-9_-]{11})'\)/g)].map((m) => m[1])
const unique = [...new Set(ids)]

const bad = []
for (const id of unique) {
  const r = await fetch(`https://www.youtube.com/watch?v=${id}`)
  const t = await r.text()
  if (!r.ok || t.includes('Video unavailable') || t.includes("This video isn't available")) {
    bad.push(id)
  }
}
if (bad.length) {
  console.error('Unavailable:', bad)
  process.exit(1)
}
console.log('OK', unique.length, 'unique video IDs')
