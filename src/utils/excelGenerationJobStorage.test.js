import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildGenerationJobStorageKey,
  createGenerationJob,
  jobHasResumableProgress,
  loadGenerationJob,
  saveGenerationJob,
} from './excelGenerationJobStorage.js'

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
}

describe('excelGenerationJobStorage', () => {
  beforeEach(() => {
    globalThis.localStorage = createMemoryStorage()
  })

  it('persiste y recupera job por fingerprint', () => {
    const fingerprint = buildGenerationJobStorageKey({
      mesocycle: 'FUERZA',
      week: 6,
      generationDays: ['LUNES'],
      weeklyOffer: { dias: { LUNES: ['evofuncional'] } },
      instructions: '',
    })
    const job = createGenerationJob({ fingerprint })
    job.completedDays = ['LUNES']
    job.partialWeek = { titulo: 'S6', dias: [{ nombre: 'LUNES', evofuncional: 'test' }] }
    saveGenerationJob(fingerprint, job)
    const loaded = loadGenerationJob(fingerprint)
    expect(loaded?.jobId).toBe(job.jobId)
    expect(jobHasResumableProgress(loaded)).toBe(true)
  })

  it('permite reintentar una sincronización final pero no reabre un job cancelado', () => {
    expect(
      jobHasResumableProgress({
        serverJobId: 'job-sync',
        phase: 'sync_pending',
        completedDays: ['LUNES'],
        partialWeek: { dias: [{ nombre: 'LUNES', evofuncional: 'test' }] },
      }),
    ).toBe(true)
    expect(
      jobHasResumableProgress({
        serverJobId: 'job-cancelled',
        phase: 'cancelled',
        completedDays: ['LUNES'],
        partialWeek: { dias: [{ nombre: 'LUNES', evofuncional: 'test' }] },
      }),
    ).toBe(false)
  })
})
