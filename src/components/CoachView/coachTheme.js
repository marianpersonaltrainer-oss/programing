/**
 * Tema Coach EVO v3.
 * Inspirado en la claridad operativa de ADAPLATO: base crema, tipografía
 * tranquila y un único acento EVO para orientar acciones, no inundar pantallas.
 */

import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'

/** Identificadores visuales Hoy v3 (tarjetas + modal): azul / naranja / verde para el trío principal. */
export const CLASS_COLORS = {
  EVOFUNCIONAL: '#4A90D9',
  EVOBASICS: '#E8823A',
  EVOFIT: '#4CAF50',
}

const SESSION_KEY_TO_CLASS_COLOR_KEY = {
  evofuncional: 'EVOFUNCIONAL',
  evobasics: 'EVOBASICS',
  evofit: 'EVOFIT',
}

/** Hex de acento para cualquier sesión publicada (incl. Hybrix, Fuerza, Gimnástica, EvoTodos). */
export function classAccentBySessionKey(sessionKey) {
  const mapped = SESSION_KEY_TO_CLASS_COLOR_KEY[sessionKey]
  if (mapped && CLASS_COLORS[mapped]) return CLASS_COLORS[mapped]
  const def = EVO_SESSION_CLASS_DEFS.find((d) => d.key === sessionKey)
  return def?.color || '#6A1F6D'
}

/** Título tipo EVOFUNCIONAL / EVOGIMNASTICA para chips y modal. */
export function classDisplayTitle(sessionKey) {
  const mapped = SESSION_KEY_TO_CLASS_COLOR_KEY[sessionKey]
  if (mapped) return mapped
  const def = EVO_SESSION_CLASS_DEFS.find((d) => d.key === sessionKey)
  if (!def?.label) return String(sessionKey || '').toUpperCase()
  const rest = String(def.label)
    .replace(/^Evo/i, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, '')
    .toUpperCase()
  return `EVO${rest}`
}

export const coachBg = {
  app: 'bg-[#FCFAF5]',
  sidebar: 'bg-[#FFFDF9]',
  sidebarHover: 'hover:bg-[#F6E9EF]',
  card: 'bg-white',
  cardAlt: 'bg-[#F8F3ED]',
  cardMuted: 'bg-[#F4EFE9]',
  rowA: 'bg-white',
  rowB: 'bg-[#F8F3ED]',
  overlay: 'bg-[#212121]/45',
}

export const coachBorder = 'border-[#DDD2C2]'

export const coachText = {
  primary: 'text-[#212121]',
  muted: 'text-[#6F6B68]',
  accent: 'text-[#6A1F6D]',
  title: 'text-[#212121]',
  onSidebar: 'text-[#212121]',
  mutedOnSidebar: 'text-[#6F6B68]',
}

export const coachNav = {
  active: 'bg-[#6A1F6D] text-white shadow-sm border border-[#6A1F6D]',
  idle: `${coachText.onSidebar} ${coachBg.sidebarHover} hover:text-[#6A1F6D]`,
}

const coachInputBase =
  'w-full text-base bg-white border border-[#DDD2C2] !text-[#212121] caret-[#212121] placeholder:!text-[#9A9590] placeholder:opacity-100 focus:outline-none focus:border-[#6A1F6D] focus:ring-2 focus:ring-[#6A1F6D]/15'

export const coachField = `${coachInputBase} rounded-xl px-4 py-3`

export const coachFieldAuth = `${coachInputBase} rounded-2xl px-6 py-4 text-[16px] font-evo-body`

export const coachUi = {
  shell: `fixed inset-0 z-[100] flex flex-col overflow-hidden min-h-0 ${coachBg.app} ${coachText.primary} font-evo-body`,
  contentArea: `flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`,
  scroll: `w-full px-8 py-8 ${coachText.primary}`,
  prose: `text-base leading-relaxed space-y-6 ${coachText.primary} font-evo-body`,
  proseMuted: coachText.muted,
  h2: `text-xl sm:text-2xl font-bold tracking-tight border-b ${coachBorder} pb-3 mb-1 ${coachText.title}`,
  h3: `text-lg font-bold mt-8 mb-3 ${coachText.primary}`,
  card: `rounded-xl border ${coachBorder} ${coachBg.card} p-5 shadow-sm`,
  cardInner: `rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4`,
  tableWrap: `overflow-x-auto rounded-xl border ${coachBorder} ${coachBg.card}`,
  tableHead: 'bg-[#6A1F6D] text-white font-evo-body',
  chip: 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border',
  btnPrimary: 'rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white font-evo-body font-semibold transition-colors',
  supportHighlight: 'text-[#6A1F6D] font-bold',
}

export const coachAdminUi = {
  overlay: 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50',
  dialog: `w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border ${coachBorder} ${coachBg.card} shadow-2xl font-evo-body`,
  header: `sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b ${coachBorder} ${coachBg.sidebar}`,
  title: `font-evo-display text-xl sm:text-2xl font-bold uppercase tracking-wide ${coachText.onSidebar}`,
  form: `p-6 space-y-8 text-base ${coachText.primary}`,
  label: `block text-sm font-bold uppercase tracking-widest ${coachText.muted} mb-2`,
  labelAccent: `block text-sm font-bold uppercase tracking-widest text-[#A729AD] mb-2`,
  labelWhite: `block text-sm font-bold ${coachText.primary} mb-2`,
  subLabel: `block text-sm font-bold ${coachText.muted} mb-1`,
  hint: `text-sm ${coachText.muted} mt-2 leading-relaxed`,
  rowCard: `grid grid-cols-1 sm:grid-cols-12 gap-2 items-start p-3 rounded-xl border ${coachBorder} ${coachBg.cardAlt}`,
  closeBtn: `p-2 rounded-lg ${coachText.mutedOnSidebar} hover:bg-white/10 hover:text-white`,
  secondaryBtn: `px-6 py-3 rounded-xl border ${coachBorder} ${coachText.primary} hover:bg-[#6A1F6D]/20 text-sm font-semibold`,
}

/** Badges de clase — fondos claros */
export const CLASS_BADGE_CLASS = {
  EvoFuncional: 'bg-[#F6E8F9] text-[#6A1F6D] border-[#6A1F6D]/30',
  EvoBasics: 'bg-[#FFFFE2] text-[#6A1F6D] border-[#A729AD]/30',
  EvoFit: 'bg-[#F6E8F9] text-[#6A1F6D] border-[#6A1F6D]/30',
  EvoHybrix: 'bg-[#FFFFE2] text-[#6A1F6D] border-[#A729AD]/30',
  EvoFuerza: 'bg-[#F6E8F9] text-[#6A1F6D] border-[#6A1F6D]/30',
  'EvoGimnástica': 'bg-[#F6E8F9] text-[#6A1F6D] border-[#6A1F6D]/30',
  EvoTodos: 'bg-[#FFFFE2] text-[#6A1F6D] border-[#A729AD]/30',
}

export function classBadgeClass(label) {
  return CLASS_BADGE_CLASS[label] || 'bg-[#F6E8F9] text-[#6A1F6D] border-[#6A1F6D]/30'
}
