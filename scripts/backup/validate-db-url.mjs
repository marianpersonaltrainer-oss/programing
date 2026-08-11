#!/usr/bin/env node

import { chmod, writeFile } from 'node:fs/promises'

function fail(message) {
  console.error(`backup configuration error: ${message}`)
  process.exit(1)
}

const outputFile = process.env.DB_URL_OUTPUT_FILE
const expectedRef = String(process.env.SUPABASE_PRODUCTION_PROJECT_REF || '').trim()
const rawValue = process.env.SUPABASE_POOLER_URL || process.env.SUPABASE_DB_URL || ''
const rawUrl = String(rawValue).trim().replace(/^['"]|['"]$/g, '')
const allowLocalTestUrl = process.env.BACKUP_ALLOW_LOCAL_TEST_URL === '1'

if (!outputFile) fail('DB_URL_OUTPUT_FILE is required')
if (!rawUrl) fail('SUPABASE_POOLER_URL or SUPABASE_DB_URL is required')
if (!expectedRef) fail('SUPABASE_PRODUCTION_PROJECT_REF is required')
if (!/^[a-z0-9-]{6,64}$/i.test(expectedRef)) fail('the expected project ref has an invalid format')

let parsed
try {
  parsed = new URL(rawUrl)
} catch {
  fail('the database URI is not valid')
}

if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
  fail('the database URI must start with postgres:// or postgresql://')
}
if (!parsed.hostname || !parsed.username) fail('the database URI is incomplete')
if (parsed.pathname !== '/postgres') fail('the database URI must select the postgres database')
if (parsed.hostname.endsWith('.pooler.supabase.com') && parsed.port !== '5432') {
  fail('database dumps require the Supabase session pooler on port 5432')
}

if (parsed.password === 'YOUR-PASSWORD') {
  const password = process.env.SUPABASE_DB_PASSWORD || ''
  if (!password) fail('SUPABASE_DB_PASSWORD is required for a URI with YOUR-PASSWORD')
  parsed.password = password
}
if (!parsed.password) fail('the database URI must include a password')

if (!allowLocalTestUrl) {
  const hostMatch = parsed.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i)
  const userMatch = decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9-]+)$/i)
  const refs = [hostMatch?.[1], userMatch?.[1]].filter(Boolean)

  if (refs.length === 0) {
    fail('the URI does not expose a Supabase project ref in its host or username')
  }
  if (refs.some((projectRef) => projectRef !== expectedRef)) {
    fail('the URI does not belong to the expected production project')
  }
}

if (!parsed.searchParams.has('sslmode') && !allowLocalTestUrl) {
  parsed.searchParams.set('sslmode', 'require')
}

await writeFile(outputFile, parsed.toString(), { encoding: 'utf8', mode: 0o600 })
await chmod(outputFile, 0o600)
