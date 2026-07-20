/**
 * POST /api/method-rule
 * Persiste una regla aprendida en Supabase `method_rules` (service role).
 *
 * Escrituras legacy deshabilitadas por defecto. Solo servidor:
 *   METHOD_RULE_LEGACY_WRITE_ENABLED=true
 *
 * Body JSON: { rule_text, trigger_context?, rule_type?, confidence? }
 */
import { createClient } from '@supabase/supabase-js'
import { isLegacyMethodRulesWriteEnabled } from './lib/methodRuleLegacyFlags.js'

const VALID_RULE_TYPES = new Set(['timing', 'load', 'exercise', 'format', 'rest'])

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, error: 'Method Not Allowed' })
  }

  if (!isLegacyMethodRulesWriteEnabled()) {
    return res.status(403).json({ ok: false, error: 'legacy_writes_disabled' })
  }

  const { rule_text, trigger_context = 'edicion', rule_type = 'exercise', confidence = 70 } = req.body || {}
  const text = String(rule_text || '').trim()
  if (!text) return res.status(400).json({ ok: false, error: 'rule_text requerido' })

  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim()
  if (!serviceKey || !supabaseUrl) {
    return res.status(500).json({ ok: false, error: 'Servidor sin configurar: SUPABASE_SERVICE_ROLE_KEY y URL de Supabase.' })
  }

  const resolvedRuleType = VALID_RULE_TYPES.has(String(rule_type)) ? String(rule_type) : 'exercise'

  const supabase = createClient(supabaseUrl, serviceKey)
  const { error } = await supabase.from('method_rules').insert({
    rule_text: text,
    trigger_context: String(trigger_context).slice(0, 120),
    rule_type: resolvedRuleType,
    source: 'manual_edit',
    confidence: Number(confidence) || 70,
    active: true,
  })

  if (error) return res.status(500).json({ ok: false, error: error.message })
  return res.status(200).json({ ok: true })
}
