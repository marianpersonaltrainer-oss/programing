/**
 * Compatibilidad con Supabase sin migración `published_weeks_versioned_publication`.
 * Solo infiere `publication_status` para lecturas; no sustituye la migración en escrituras versionadas.
 */

export function isMissingPublicationStatusError(error) {
  const msg = String(error?.message || error || '')
  return msg.includes('publication_status') && msg.includes('does not exist')
}

export function isMissingPublishedWeeksV2ColumnError(error) {
  const msg = String(error?.message || error || '')
  return (
    (msg.includes('publication_status') ||
      msg.includes('cycle_id') ||
      msg.includes('version_number') ||
      msg.includes('content_fingerprint')) &&
    msg.includes('does not exist')
  )
}

export function inferPublicationStatus(row) {
  if (!row || typeof row !== 'object') return 'legacy_unverified'
  const explicit = String(row.publication_status || row?.data?.publication_status || '').trim()
  if (explicit) return explicit
  if (row.is_active === true) return 'published'
  if (row.published_at) return 'legacy_unverified'
  return 'draft'
}

export function withInferredPublicationStatus(row) {
  if (!row || typeof row !== 'object') return row
  return {
    ...row,
    publication_status: inferPublicationStatus(row),
  }
}

export function isPublishedOrSupersededRow(row) {
  const status = inferPublicationStatus(row)
  return status === 'published' || status === 'superseded'
}

export function filterPublishedOrSupersededRows(rows) {
  return (rows || []).filter(isPublishedOrSupersededRow).map(withInferredPublicationStatus)
}
