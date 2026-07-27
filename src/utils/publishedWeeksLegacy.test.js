import { describe, expect, it } from 'vitest'
import {
  filterPublishedOrSupersededRows,
  inferPublicationStatus,
  isMissingPublicationStatusError,
  withInferredPublicationStatus,
} from './publishedWeeksLegacy.js'

describe('publishedWeeksLegacy', () => {
  it('detecta columna publication_status ausente', () => {
    expect(
      isMissingPublicationStatusError({
        message: 'column published_weeks.publication_status does not exist',
      }),
    ).toBe(true)
  })

  it('infiere published desde is_active', () => {
    expect(inferPublicationStatus({ is_active: true, published_at: '2026-01-01' })).toBe('published')
  })

  it('infiere legacy_unverified cuando hay published_at pero no is_active', () => {
    expect(inferPublicationStatus({ published_at: '2026-01-01', is_active: false })).toBe(
      'legacy_unverified',
    )
  })

  it('filtra filas publicadas o superseded inferidas', () => {
    const rows = filterPublishedOrSupersededRows([
      { id: '1', is_active: true, published_at: '2026-01-01' },
      { id: '2', publication_status: 'superseded', published_at: '2026-01-02' },
      { id: '3', publication_status: 'draft' },
    ])
    expect(rows.map((row) => row.id)).toEqual(['1', '2'])
    expect(withInferredPublicationStatus(rows[0]).publication_status).toBe('published')
  })
})
