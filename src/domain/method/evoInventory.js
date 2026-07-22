import { METHOD_EVO_V1 } from './methodEvoV1.js'
import { splitEvoSessionBlocks } from './evoBasicsSkills.js'

export const EVO_INVENTORY = METHOD_EVO_V1.current_context.inventory

function formatWeightedAmounts(values, suffix = '') {
  return Object.entries(values || {})
    .filter(([key]) => key !== 'note')
    .map(([weight, amount]) => `${String(weight).replace('.', ',')} kg: ${amount}${suffix}`)
    .join(' · ')
}

export function buildCoachInventoryRooms() {
  const rooms = EVO_INVENTORY.rooms
  return [
    {
      sala: 'Sala grande',
      text: `${rooms.large.racks} racks de jaula fijos + barras de dominadas integradas · Prioridad: EvoFuncional`,
    },
    {
      sala: 'Sala pequeña',
      text: `${rooms.small.racks} racks portátiles fijos + barras de dominadas en pared · Máximo ${rooms.small.technical_bar_limit} barras en halterofilia técnica · Prioridad: EvoBasics / EvoFit`,
    },
  ]
}

export function buildCoachInventoryItems() {
  const inventory = EVO_INVENTORY
  const machines = inventory.machines
  return [
    {
      name: 'Barras y discos',
      detail: `Barras: 10 kg: ${inventory.bars.by_weight_kg['10']} · 15 kg: ${inventory.bars.by_weight_kg['15']} · 20 kg: ${inventory.bars.by_weight_kg['20']} · técnicas 180 cm: ${inventory.bars.technical_180cm}. Hay barras para ambas salas; en Sala II monta como máximo ${inventory.bars.room_2_technical_limit} para halterofilia técnica. Discos: ${formatWeightedAmounts(inventory.plates_units)}. Evita dos clases pesadas simultáneas con alto consumo de discos.`,
    },
    {
      name: 'Mancuernas',
      detail: `${formatWeightedAmounts(inventory.dumbbell_pairs, 'p')}\n⚠ 27,5 y 30 kg solo en accesorios o trabajo controlado, no en WODs de repeticiones altas para toda la clase.`,
    },
    {
      name: 'Kettlebells',
      detail: `${formatWeightedAmounts(inventory.kettlebell_units)}\n⚠ 28 kg solo individual o accesorios. No en WODs para toda la clase.`,
    },
    {
      name: 'Slam balls',
      detail: `${formatWeightedAmounts(inventory.slam_ball_minimum_confirmed_units)}. Son cantidades mínimas confirmadas; se suman las unidades antiguas útiles, pero hasta recontarlas no se prometen a la vez en dos clases.`,
    },
    {
      name: 'Wall balls',
      detail: `${formatWeightedAmounts(inventory.wall_ball_units)}\n⚠ Solo 7 kg tiene cantidad cercana a clase completa; organiza parejas o estaciones cuando hagan falta otros pesos.`,
    },
    {
      name: 'Máquinas',
      detail: `RowErg: ${machines.rowerg} · Bicicletas: ${machines.bike} · SkiErg: ${machines.skierg}. Están en una sala: se desplazan las personas, no las máquinas. En simultaneidad hay que reservarlas y usar parejas, estaciones o salidas escalonadas.`,
    },
    {
      name: 'Landmine',
      detail: `${inventory.landmine.total} puestos movibles. Uso habitual por parejas. Pueden compartirse entre dos clases con unos 4 puestos por sala y parejas o grupos pequeños. Como el montaje es costoso, debe aprovecharse en varios movimientos o bloques.`,
    },
    {
      name: 'Anillas',
      detail: `${inventory.rings.total} en total, fijas en sus salas. No se trasladan: cada clase solo puede usar las que ya están instaladas en su sala.`,
    },
    {
      name: 'Cajones',
      detail: `${inventory.boxes.total} · Se pueden mover entre salas y repartir entre dos clases.`,
    },
    {
      name: 'Otro',
      detail: `Paralettes: ${inventory.other.parallettes} · Bancos: ${inventory.other.benches} · Trineos: ${inventory.sled.total} · Farmer carry: ${inventory.other.farmer_carry_handles} · AB mats: ${inventory.other.ab_mats} · Foam rollers: ${inventory.other.foam_rollers} · Bandas: ${inventory.other.red_bands} rojas + ${inventory.other.mini_bands} mini · Combas: ${inventory.other.jump_ropes} · Esterillas: ${inventory.other.mats}`,
    },
  ]
}

const RESOURCE_PATTERNS = {
  landmine: /\blandmine\b|\bLM\s*(?:press|row|squat|deadlift|romanian|lunge|thruster|pallof|rotation)/i,
  barbell: /\bbarra\b|\bbarbell\b|\bback\s+squat\b|\bfront\s+squat\b|\boverhead\s+squat\b|\bpush\s+jerk\b|\bsplit\s+jerk\b|\bhang\s+(?:power\s+)?(?:clean|snatch)\b|\bpower\s+(?:clean|snatch)\b/i,
  sled: /\bsled\b|\btrineo\b/i,
  bench: /\bbench\s+press\b|\bbanco\b/i,
  rings: /\bring\s+(?:row|dip|support|push|biceps)|\banillas?\b/i,
  rowerg: /\browerg\b|\bremo\s+(?:concept|erg)/i,
  skierg: /\bskierg\b|\bski\s*erg\b/i,
  bike: /\bbikeerg\b|\bair\s*bike\b|\bbicicleta\b|\bbike\b/i,
  boxes: /\bbox\s+(?:jump|step)|\bcaj[oó]n\b/i,
}

export function detectEvoEquipmentUsage(session) {
  const text = String(session || '')
  const blocks = splitEvoSessionBlocks(text)
  const usage = []
  for (const [key, pattern] of Object.entries(RESOURCE_PATTERNS)) {
    if (!pattern.test(text)) continue
    const blockCount = blocks.filter(({ text: blockText }) => pattern.test(blockText)).length
    const lineCount = text.split('\n').filter((line) => pattern.test(line)).length
    usage.push({ key, blockCount, lineCount })
  }
  return usage
}

function hasExplicitSetupException(text) {
  return /\b(?:por\s+seguridad|motivo\s+t[eé]cnico|sin\s+reutilizar|no\s+se\s+reutiliza|evitar\s+fatiga|solo\s+en\s+este\s+bloque)\b/i.test(
    String(text || ''),
  )
}

export function validateHighSetupReuse(session) {
  const text = String(session || '')
  const blocks = splitEvoSessionBlocks(text)
  if (blocks.length < 2 || hasExplicitSetupException(text)) return []
  const usage = detectEvoEquipmentUsage(text)
  const warnings = []
  const highSetup = new Set(['landmine', 'barbell', 'sled', 'bench'])
  for (const item of usage) {
    if (!highSetup.has(item.key) || item.blockCount >= 2 || item.lineCount >= 2) continue
    const labels = { landmine: 'landmine', barbell: 'barra/rack', sled: 'trineo', bench: 'banco' }
    warnings.push({
      code: 'VAL-MATERIAL-002',
      severity: 'warning',
      message: `${labels[item.key]} exige un montaje relevante y solo aparece una vez. Reutilízalo en otro bloque o movimiento, o deja explícita la excepción técnica, de seguridad o fatiga.`,
    })
  }
  return warnings
}

function usesHeavyBarbell(text) {
  const usesBar = detectEvoEquipmentUsage(text).some((item) => item.key === 'barbell')
  if (!usesBar) return false
  return /(?:@|al\s+)(?:8[0-9]|9[0-9]|100)\s*%|\b(?:pesad[oa]|RIR\s*[01]|RM|single|doble\s+pesad[oa])\b/i.test(
    String(text || ''),
  )
}

/** Avisos conservadores cuando varias modalidades del mismo día compiten por recursos compartidos. */
export function validateDailyEquipmentSimultaneity(sessions) {
  const active = (sessions || []).filter((entry) => String(entry?.session || '').trim())
  const warnings = []
  const usersByResource = new Map()
  for (const entry of active) {
    for (const item of detectEvoEquipmentUsage(entry.session)) {
      const users = usersByResource.get(item.key) || []
      users.push(entry.classKey)
      usersByResource.set(item.key, users)
    }
  }

  for (const key of ['rowerg', 'skierg', 'bike']) {
    const users = usersByResource.get(key) || []
    if (users.length < 2) continue
    warnings.push({
      code: 'VAL-MATERIAL-003',
      severity: 'warning',
      message: `${key} aparece en ${users.length} clases del mismo día. Reserva las unidades entre salas y define parejas, estaciones o salidas escalonadas.`,
    })
  }

  const sledUsers = usersByResource.get('sled') || []
  if (sledUsers.length > 1) {
    warnings.push({
      code: 'VAL-MATERIAL-003',
      severity: 'warning',
      message: `Los ${EVO_INVENTORY.sled.total} trineos aparecen en varias clases del mismo día; separa horarios/estaciones o rediseña una de las sesiones.`,
    })
  }

  const landmineUsers = usersByResource.get('landmine') || []
  if (landmineUsers.length > 2) {
    warnings.push({
      code: 'VAL-MATERIAL-003',
      severity: 'warning',
      message: `Landmine aparece en ${landmineUsers.length} clases. Ocho puestos permiten dos clases por parejas, no tres montajes completos simultáneos.`,
    })
  }

  const heavyBars = active.filter((entry) => usesHeavyBarbell(entry.session))
  if (heavyBars.length > 1) {
    warnings.push({
      code: 'VAL-MATERIAL-003',
      severity: 'warning',
      message: 'Hay dos o más clases con barra pesada el mismo día. Comprueba reparto de discos, racks, cargas compatibles y tiempos de cambio antes de aprobar.',
    })
  }

  const benchUsers = usersByResource.get('bench') || []
  if (benchUsers.length > 1) {
    warnings.push({
      code: 'VAL-MATERIAL-003',
      severity: 'warning',
      message: `Los ${EVO_INVENTORY.other.benches} bancos aparecen en varias clases; organiza parejas y reserva puestos o cambia un bloque.`,
    })
  }

  return warnings
}
