/**
 * Carga reglas method_rules legacy para el briefing (solo si está explícitamente habilitado).
 */
import { isLegacyMethodRulesReadEnabled } from './methodRuleLegacyFlags.js'

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {(label: string, err: unknown) => void} [logSkip]
 * @returns {Promise<Array<Record<string, unknown>>|null>}
 *   null = lectura legacy deshabilitada (no incluir bloque en el pack).
 */
export async function loadLegacyMethodRulesForBriefing(supabase, logSkip) {
  if (!isLegacyMethodRulesReadEnabled()) {
    return null
  }

  const { data, error } = await supabase
    .from('method_rules')
    .select('rule_type, trigger_context, rule_text, confidence')
    .eq('active', true)
    .order('confidence', { ascending: false })
    .limit(30)

  if (error) {
    logSkip?.('method_rules', error)
    return []
  }

  return data || []
}

export { isLegacyMethodRulesReadEnabled } from './methodRuleLegacyFlags.js'
