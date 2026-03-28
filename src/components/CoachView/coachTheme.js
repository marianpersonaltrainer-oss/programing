/** Tema vista ?coach — manual de marca EVO */

export const coachBg = {
  app: 'bg-[#0C0B0C]',
  sidebar: 'bg-[#0A0808]',
  sidebarHover: 'hover:bg-[#1A0A1A]',
  card: 'bg-[#160D16]',
  cardAlt: 'bg-[#1D0F1D]',
  rowA: 'bg-[#160D16]',
  rowB: 'bg-[#1D0F1D]',
  overlay: 'bg-black/60',
}

export const coachBorder = 'border-[#3D1A3D]'

export const coachText = {
  primary: 'text-[#E8EAF0]',
  muted: 'text-[#9B80A0]',
  accent: 'text-[#A729AD]',
  title: 'text-[#FFFF4C]',
}

export const coachNav = {
  active: 'bg-[#6A1F6D] text-white',
  idle: 'text-[#9B80A0] hover:bg-[#1A0A1A] hover:text-[#E8EAF0]',
}

export const coachUi = {
  shell: `fixed inset-0 z-[100] flex flex-col overflow-hidden min-h-0 ${coachBg.app} ${coachText.primary} font-evo-body`,
  contentArea: `flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`,
  scroll: `w-full px-8 py-8 ${coachText.primary}`,
  prose: `text-[15px] leading-relaxed space-y-6 ${coachText.primary} font-evo-body`,
  proseMuted: coachText.muted,
  h2: `font-evo-display text-lg font-bold uppercase tracking-wide border-b ${coachBorder} pb-3 mb-1 text-[#FFFF4C]`,
  h3: `font-evo-display text-base font-bold mt-8 mb-3 text-white`,
  card: `rounded-xl border ${coachBorder} ${coachBg.card} p-5`,
  cardInner: `rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4`,
  tableWrap: `overflow-x-auto rounded-xl border ${coachBorder}`,
  tableHead: 'bg-[#6A1F6D] text-white font-evo-display',
  chip: 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border',
  btnPrimary: 'rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white font-evo-body font-semibold transition-colors',
  supportHighlight: 'text-[#FFFF4C]',
}

/** Badges de clase — colores WodBuster sobre fondo oscuro */
export const CLASS_BADGE_CLASS = {
  EvoFuncional: 'bg-[#3C78D8]/25 text-[#93C5FD] border-[#3C78D8]/60',
  EvoBasics: 'bg-[#E69138]/25 text-[#FDBA74] border-[#E69138]/60',
  EvoFit: 'bg-[#6AA84F]/25 text-[#BBF7D0] border-[#6AA84F]/60',
  EvoHybrix: 'bg-[#F4C430]/25 text-[#FEF08A] border-[#F4C430]/65',
  EvoFuerza: 'bg-[#CC0000]/30 text-[#FCA5A5] border-[#CC0000]/65',
  'EvoGimnástica': 'bg-[#E91E8C]/25 text-[#F9A8D4] border-[#E91E8C]/60',
}

export function classBadgeClass(label) {
  return CLASS_BADGE_CLASS[label] || 'bg-[#374151]/40 text-[#D1D5DB] border-[#4B5563]'
}
