/** Tema vista ?coach y panel admin Contenido Coach — EVO, legible en móvil */

export const coachBg = {
  app: 'bg-[#1A0D1A]',
  sidebar: 'bg-[#0F060F]',
  sidebarHover: 'hover:bg-[#1A0D1A]',
  card: 'bg-[#2D1A2D]',
  cardAlt: 'bg-[#241224]',
  rowA: 'bg-[#2D1A2D]',
  rowB: 'bg-[#241224]',
  overlay: 'bg-black/60',
}

export const coachBorder = 'border-[#6A1F6D]'

export const coachText = {
  primary: 'text-[#F0ECF0]',
  muted: 'text-[#C4A8C4]',
  accent: 'text-[#A729AD]',
  title: 'text-[#FFFF4C]',
}

export const coachNav = {
  active: 'bg-[#6A1F6D] text-white',
  idle: 'text-[#D4B8D4] hover:bg-[#1A0D1A] hover:text-[#F0ECF0]',
}

const coachInputBase =
  'w-full text-base bg-[#2D1A2D] border border-[#6A1F6D] !text-[#F0ECF0] caret-[#F0ECF0] placeholder:!text-[#C4A8C4] placeholder:opacity-100 focus:outline-none focus:border-[#A729AD]/60'

/** Campos formulario (coach + admin) */
export const coachField = `${coachInputBase} rounded-xl px-4 py-3`

/** Login / nombre — mismo contraste, más aire */
export const coachFieldAuth = `${coachInputBase} rounded-2xl px-6 py-4 text-[16px] focus:ring-1 focus:ring-[#A729AD]/25 font-evo-body`

export const coachUi = {
  shell: `fixed inset-0 z-[100] flex flex-col overflow-hidden min-h-0 ${coachBg.app} ${coachText.primary} font-evo-body`,
  contentArea: `flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`,
  scroll: `w-full px-8 py-8 ${coachText.primary}`,
  prose: `text-base leading-relaxed space-y-6 ${coachText.primary} font-evo-body`,
  proseMuted: coachText.muted,
  h2: `font-evo-display text-xl sm:text-2xl font-bold uppercase tracking-wide border-b ${coachBorder} pb-3 mb-1 text-[#FFFF4C]`,
  h3: `font-evo-display text-lg font-bold mt-8 mb-3 ${coachText.primary}`,
  card: `rounded-xl border ${coachBorder} ${coachBg.card} p-5`,
  cardInner: `rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4`,
  tableWrap: `overflow-x-auto rounded-xl border ${coachBorder}`,
  tableHead: 'bg-[#6A1F6D] text-white font-evo-display',
  chip: 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border',
  btnPrimary: 'rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white font-evo-body font-semibold transition-colors',
  supportHighlight: 'text-[#FFFF4C]',
}

/** Modal Contenido Coach — misma lectura que ?coach */
export const coachAdminUi = {
  overlay: 'fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70',
  dialog: `w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border ${coachBorder} ${coachBg.app} shadow-2xl font-evo-body`,
  header: `sticky top-0 flex items-center justify-between gap-3 px-6 py-4 border-b ${coachBorder} ${coachBg.sidebar}`,
  title: 'font-evo-display text-xl sm:text-2xl font-bold uppercase tracking-wide text-[#FFFF4C]',
  form: 'p-6 space-y-8 text-base',
  label: `block text-sm font-bold uppercase tracking-widest ${coachText.muted} mb-2`,
  labelAccent: `block text-sm font-bold uppercase tracking-widest text-[#FFFF4C] mb-2`,
  labelWhite: `block text-sm font-bold ${coachText.primary} mb-2`,
  subLabel: `block text-sm font-bold ${coachText.muted} mb-1`,
  hint: `text-sm ${coachText.muted} mt-2 leading-relaxed`,
  rowCard: `grid grid-cols-1 sm:grid-cols-12 gap-2 items-start p-3 rounded-xl border ${coachBorder} ${coachBg.card}`,
  closeBtn: `p-2 rounded-lg ${coachText.muted} ${coachBg.sidebarHover} hover:text-[#F0ECF0]`,
  secondaryBtn: `px-6 py-3 rounded-xl border ${coachBorder} ${coachText.primary} ${coachBg.sidebarHover} text-sm font-semibold`,
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
