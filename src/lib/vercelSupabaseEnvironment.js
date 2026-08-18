const STAGING_SUPABASE_PROJECT_REF = 'dgkvaorzuebdloegumai'

/**
 * Un Preview nunca debe hablar con Supabase de producción. El ref no es un
 * secreto: forma parte del hostname público del proyecto de staging. Esta
 * barrera se ejecuta en el navegador para impedir que un error de variables
 * convierta un Preview en una puerta hacia datos reales.
 */
export function isPreviewSupabaseTargetSafe({
  supabaseUrl,
  vercelEnvironment,
  expectedProjectRef = STAGING_SUPABASE_PROJECT_REF,
} = {}) {
  if (String(vercelEnvironment || '').trim() !== 'preview') return true

  try {
    const hostname = new URL(String(supabaseUrl || '')).hostname.toLowerCase()
    return hostname.includes(String(expectedProjectRef).toLowerCase())
  } catch {
    return false
  }
}

export { STAGING_SUPABASE_PROJECT_REF }
