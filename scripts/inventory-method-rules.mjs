#!/usr/bin/env node
/**
 * Inventario read-only de reglas desde fuentes del repositorio.
 * No inserta en Supabase ni modifica producción.
 */
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SOURCES = [
  { id: 'systemPrompt.js', path: 'src/constants/systemPrompt.js' },
  { id: 'systemPromptExcel.js', path: 'src/constants/systemPromptExcel.js' },
  { id: 'systemPromptDayEdit.js', path: 'src/constants/systemPromptDayEdit.js' },
  { id: 'mesocycleGenerationBlocks.js', path: 'src/constants/mesocycleGenerationBlocks.js' },
  { id: 'MethodPanel DEFAULT_METHOD', path: 'src/components/MethodPanel/MethodPanel.jsx' },
  { id: 'highImpactLearnedRules.js', path: 'src/utils/highImpactLearnedRules.js' },
]

const TOPIC_PATTERNS = [
  { key: 'warmup_visibility', re: /calentamiento.*(no obligatorio|siempre|opcional)/i },
  { key: 'warmup_purpose', re: /ensayo del (trabajo|d[ií]a)/i },
  { key: 'landmine_frequency', re: /landmine.*(obligatorio|opcional|central)/i },
  { key: 'feedback_format', re: /feedback.*(prosa|viñeta|- )/i },
  { key: 'effective_duration', re: /30 min|32 min|min efectiv/i },
  { key: 'basics_skill_progression', re: /evobasics|juego.*(m[aá]ximo|siempre)/i },
  { key: 'room_capacity', re: /sala|11m|capacidad/i },
  { key: 'summer_schedule', re: /julio|agosto|verano/i },
]

function readSource(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return ''
  }
}

function extractDefaultMethod(src) {
  const m = src.match(/export const DEFAULT_METHOD = `([\s\S]*?)`/)
  return m ? m[1] : ''
}

function scanFile(sourceId, text) {
  const hits = []
  for (const { key, re } of TOPIC_PATTERNS) {
    if (re.test(text)) hits.push({ ruleKey: key, source: sourceId })
  }
  return hits
}

const inventory = {
  generatedAt: new Date().toISOString(),
  sources: [],
  byRuleKey: {},
  classifications: {
    coincidentes: [],
    contradictorias: [],
    duplicadas: [],
    desactualizadas: [],
    pendientes_revision: [],
    candidatas_permanente: [],
    candidatas_temporal: [],
  },
}

for (const s of SOURCES) {
  let text = readSource(s.path)
  if (s.id.includes('MethodPanel')) {
    text = extractDefaultMethod(text)
  }
  const hits = scanFile(s.id, text)
  inventory.sources.push({ id: s.id, path: s.path, topicHits: hits.length, hits })
  for (const h of hits) {
    if (!inventory.byRuleKey[h.ruleKey]) inventory.byRuleKey[h.ruleKey] = []
    inventory.byRuleKey[h.ruleKey].push(h.source)
  }
}

inventory.classifications.contradictorias = [
  {
    ruleKey: 'warmup_visibility',
    detail: 'systemPrompt.js: calentamiento SIEMPRE vs systemPromptExcel/DayEdit: NO obligatorio global',
    action: 'No activar automáticamente; revisión humana → rule_status active',
  },
  {
    ruleKey: 'landmine_frequency',
    detail: 'DEFAULT_METHOD + systemPrompt.js: OBLIGATORIO vs systemPromptExcel.js: opcional',
    action: 'No activar automáticamente',
  },
  {
    ruleKey: 'feedback_format',
    detail: 'systemPromptExcel: viñetas 4 bloques vs QA/regen: prosa corrida',
    action: 'Pendiente revisión',
  },
]

inventory.classifications.duplicadas = [
  'Prohibiciones MU/OHS/thruster: DEFAULT_METHOD + systemPrompt + Excel',
  'EvoFit sin olímpicos: DEFAULT_METHOD + systemPromptExcel',
  'Ensayo calentamiento: systemPrompt + Excel BLOQUE 3 (cuando hay calentamiento)',
]

inventory.classifications.desactualizadas = ['API_COSTS.md: 2 llamadas Excel (hoy 1 POST/día)']

inventory.classifications.pendientes_revision = [
  '53 filas method_rules en producción → legacy_unreviewed tras migración',
  'localStorage programingevo_method_learned (por dispositivo)',
  'Restricciones julio/agosto (operativas; no hardcodeadas en prompts)',
]

inventory.classifications.candidatas_temporal = [
  { ruleKey: 'summer_schedule', note: 'Horario/carga verano; valid_from/valid_to jul–ago' },
  { ruleKey: 'effective_duration', note: '32 min en verano si se confirma' },
]

inventory.classifications.candidatas_permanente = [
  { ruleKey: 'warmup_purpose', note: 'Ensayo del día cuando hay calentamiento' },
  'Prohibiciones ejercicios extremos (MU, OHS principal)',
  'EvoFit sin movimientos olímpicos',
  'Basics juego máx 2 días/semana (Excel)',
]

const outJson = join(ROOT, 'docs/rules-inventory.generated.json')
const outMd = join(ROOT, 'docs/RULES_INVENTORY.md')

writeFileSync(outJson, `${JSON.stringify(inventory, null, 2)}\n`)

const md = `# Inventario de reglas — Sprint 1

Generado: ${inventory.generatedAt}

> Script read-only. No modifica Supabase ni inserta seeds.

## Contradicciones críticas (no activar automáticamente)

${inventory.classifications.contradictorias.map((c) => `- **${c.ruleKey}**: ${c.detail}`).join('\n')}

## Duplicadas

${inventory.classifications.duplicadas.map((d) => `- ${d}`).join('\n')}

## Desactualizadas

${inventory.classifications.desactualizadas.map((d) => `- ${d}`).join('\n')}

## Pendientes de revisión

${inventory.classifications.pendientes_revision.map((d) => `- ${d}`).join('\n')}

## Candidatas permanentes

${inventory.classifications.candidatas_permanente.map((d) => (typeof d === 'string' ? `- ${d}` : `- **${d.ruleKey}**: ${d.note}`)).join('\n')}

## Candidatas temporales

${inventory.classifications.candidatas_temporal.map((d) => `- **${d.ruleKey}**: ${d.note}`).join('\n')}

## Hits por rule_key en fuentes del repo

${Object.entries(inventory.byRuleKey)
  .map(([k, sources]) => `- \`${k}\`: ${[...new Set(sources)].join(', ')}`)
  .join('\n')}

Ver JSON completo: \`docs/rules-inventory.generated.json\`
`

writeFileSync(outMd, md)
console.log('Inventory written:', outMd)
console.log('JSON:', outJson)
