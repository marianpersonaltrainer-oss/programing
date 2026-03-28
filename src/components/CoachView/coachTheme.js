/** Tema oscuro exclusivo de la vista ?coach */

export const coachBg = {
  app: 'bg-[#111827]',
  sidebar: 'bg-[#0A0D14]',
  card: 'bg-[#1A1F2E]',
  cardAlt: 'bg-[#1E2433]',
  rowA: 'bg-[#1E2433]',
  rowB: 'bg-[#161B2A]',
  overlay: 'bg-black/60',
}

export const coachBorder = 'border-[#2A3042]'

export const coachText = {
  primary: 'text-[#E8EAF0]',
  muted: 'text-[#9BA3B8]',
  accent: 'text-[#9B3FA0]',
}

/** Item activo sidebar: morado EVO #6A1F6D */
export const coachNav = {
  active: 'bg-[#6A1F6D] text-white',
  idle: 'text-[#9BA3B8] hover:bg-[#1E2433] hover:text-[#E8EAF0]',
}

export const coachUi = {
  shell: `min-h-[100dvh] flex flex-col ${coachBg.app} ${coachText.primary}`,
  contentArea: `flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`,
  scroll: `flex-1 min-h-0 overflow-y-auto overscroll-contain px-8 py-8 ${coachText.primary}`,
  prose: `text-[15px] leading-relaxed space-y-6 ${coachText.primary}`,
  proseMuted: coachText.muted,
  h2: `text-lg font-extrabold uppercase tracking-wide border-b ${coachBorder} pb-3 mb-1 ${coachText.primary}`,
  h3: `text-base font-bold mt-8 mb-3 ${coachText.primary}`,
  card: `rounded-xl border ${coachBorder} ${coachBg.card} p-5`,
  cardInner: `rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4`,
  tableWrap: `overflow-x-auto rounded-xl border ${coachBorder}`,
  tableHead: 'bg-[#6A1F6D] text-white',
  chip: 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border',
}

/** Badges de clase sobre fondo oscuro (colores EVO conservados, más contraste). */
export const CLASS_BADGE_CLASS = {
  EvoFuncional: 'bg-[#2F7BBE]/30 text-[#93C5FD] border-[#2F7BBE]/55',
  EvoBasics: 'bg-[#E07B39]/30 text-[#FDBA74] border-[#E07B39]/55',
  EvoFit: 'bg-[#2FBE7B]/30 text-[#86EFAC] border-[#2FBE7B]/55',
  EvoHybrix: 'bg-[#BE2F2F]/30 text-[#FCA5A5] border-[#BE2F2F]/55',
  EvoFuerza: 'bg-[#BE2F2F]/30 text-[#FCA5A5] border-[#BE2F2F]/55',
  'EvoGimnástica': 'bg-[#D93F8E]/30 text-[#F9A8D4] border-[#D93F8E]/55',
}

export function classBadgeClass(label) {
  return CLASS_BADGE_CLASS[label] || 'bg-[#374151] text-[#D1D5DB] border-[#4B5563]'
}

/** Barra lateral en fichas de clase (guía). */
export const CLASS_BAR_HEX = {
  funcional: '#2F7BBE',
  basics: '#E07B39',
  fit: '#2FBE7B',
  hybrix: '#BE2F2F',
}
