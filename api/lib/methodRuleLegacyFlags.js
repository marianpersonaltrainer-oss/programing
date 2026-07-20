/**
 * Banderas de servidor para cuarentena de method_rules legacy (53 filas sin revisar).
 * Solo variables sin prefijo VITE_ — nunca expuestas al cliente.
 */

export function isLegacyMethodRulesReadEnabled() {
  return String(process.env.METHOD_RULE_LEGACY_READ_ENABLED || '')
    .trim()
    .toLowerCase() === 'true'
}

export function isLegacyMethodRulesWriteEnabled() {
  return String(process.env.METHOD_RULE_LEGACY_WRITE_ENABLED || '')
    .trim()
    .toLowerCase() === 'true'
}
