#!/usr/bin/env node

import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const script = fileURLToPath(new URL('./validate-db-url.mjs', import.meta.url))
const tempDirectory = await mkdtemp(join(tmpdir(), 'evo-backup-url-test-'))

function run(overrides = {}) {
  const outputFile = join(tempDirectory, `url-${Math.random().toString(16).slice(2)}`)
  const env = {
    PATH: process.env.PATH,
    DB_URL_OUTPUT_FILE: outputFile,
    SUPABASE_PRODUCTION_PROJECT_REF: 'prodref1234567890abcd',
    ...overrides,
  }
  const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8' })
  return { ...result, outputFile }
}

try {
  const missing = run()
  assert.notEqual(missing.status, 0)
  assert.equal(missing.stdout, '')

  const wrongProject = run({
    SUPABASE_DB_URL:
      'postgresql://postgres.otherref1234567890:secret@aws-0-eu.pooler.supabase.com:5432/postgres',
  })
  assert.notEqual(wrongProject.status, 0)
  assert.equal(wrongProject.stdout, '')
  assert.doesNotMatch(wrongProject.stderr, /secret|postgresql:\/\//)

  const placeholderWithoutPassword = run({
    SUPABASE_DB_URL:
      'postgresql://postgres.prodref1234567890abcd:YOUR-PASSWORD@aws-0-eu.pooler.supabase.com:5432/postgres',
  })
  assert.notEqual(placeholderWithoutPassword.status, 0)
  assert.doesNotMatch(placeholderWithoutPassword.stderr, /postgresql:\/\//)

  const transactionPooler = run({
    SUPABASE_DB_URL:
      'postgresql://postgres.prodref1234567890abcd:secret@aws-0-eu.pooler.supabase.com:6543/postgres',
  })
  assert.notEqual(transactionPooler.status, 0)
  assert.doesNotMatch(transactionPooler.stderr, /secret|postgresql:\/\//)

  const valid = run({
    SUPABASE_DB_URL:
      'postgresql://postgres.prodref1234567890abcd:YOUR-PASSWORD@aws-0-eu.pooler.supabase.com:5432/postgres',
    SUPABASE_DB_PASSWORD: 'valid-secret-password',
  })
  assert.equal(valid.status, 0, valid.stderr)
  assert.equal(valid.stdout, '')
  assert.equal(valid.stderr, '')
  const normalized = await readFile(valid.outputFile, 'utf8')
  assert.match(normalized, /^postgresql:\/\//)
  assert.match(normalized, /sslmode=require/)
  assert.match(normalized, /valid-secret-password/)

  const localTest = run({
    SUPABASE_DB_URL: 'postgresql://postgres:local-password@source-db:5432/postgres',
    BACKUP_ALLOW_LOCAL_TEST_URL: '1',
  })
  assert.equal(localTest.status, 0, localTest.stderr)

  console.log('database URL validation tests: PASS')
} finally {
  await rm(tempDirectory, { recursive: true, force: true })
}
