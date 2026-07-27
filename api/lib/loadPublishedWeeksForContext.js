import {
  isMissingPublicationStatusError,
  withInferredPublicationStatus,
} from '../../src/utils/publishedWeeksLegacy.js'

/**
 * Lee semanas publicadas para el pack de contexto del briefing.
 * Si la migración versionada aún no está aplicada, reintenta sin `publication_status`.
 */
export async function loadPublishedWeeksForContext(supabase, { limit = 160 } = {}) {
  const modernSelect =
    'id, mesociclo, semana, titulo, published_at, publication_status, data, edit_history'
  const legacySelect = 'id, mesociclo, semana, titulo, published_at, is_active, data, edit_history'

  let result = await supabase
    .from('published_weeks')
    .select(modernSelect)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (result.error && isMissingPublicationStatusError(result.error)) {
    console.warn(
      '[published_weeks] Esquema legacy sin publication_status; usando is_active como fallback de lectura.',
    )
    result = await supabase
      .from('published_weeks')
      .select(legacySelect)
      .order('published_at', { ascending: false })
      .limit(limit)
  }

  if (result.error) throw new Error(`published_weeks: ${result.error.message}`)
  return (result.data || []).map(withInferredPublicationStatus)
}
