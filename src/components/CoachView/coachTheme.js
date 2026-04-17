/**
 * Tema oscuro oficial EVO para la vista coach.
 */

export const coachBg = {
  app: 'bg-[#0C0B0C]',
  sidebar: 'bg-[#0C0B0C]',
  sidebarHover: 'hover:bg-white/10',
  card: 'bg-[#1a0f1b]',
  cardAlt: 'bg-[#1a0f1b]',
  cardMuted: 'bg-[#1a0f1b]',
  rowA: 'bg-[#1a0f1b]',
  rowB: 'bg-[#151015]',
  overlay: 'bg-black/60',
}

export const coachBorder = 'border-[#6A1F6D]/40'

export const coachText = {
  primary: 'text-[#FFFFFF]',
  muted: 'text-[#F6E8F9]/85',
  accent: 'text-[#A729AD]',
  title: 'text-[#FFFFFF]',
  onSidebar: 'text-[#F6E8F9]',
  mutedOnSidebar: 'text-[#F6E8F9]/60',
}

export const coachNav = {
  active: 'bg-[#A729AD] text-white shadow-md border border-[#6A1F6D]/50',
  idle: `${coachText.onSidebar} ${coachBg.sidebarHover} hover:text-[#FFFF4C]`,
}

const coachInputBase =
  'w-full text-base bg-[#1a0f1b] border border-[#6A1F6D] !text-[#FFFFFF] caret-[#FFFFFF] placeholder:!text-[#F6E8F9]/50 placeholder:opacity-100 focus:outline-none focus:border-[#A729AD] focus:ring-1 focus:ring-[#A729AD]/25'

export const coachField = `${coachInputBase} rounded-xl px-4 py-3`

export const coachFieldAuth = `${coachInputBase} rounded-2xl px-6 py-4 text-[16px] font-evo-body`

export const coachUi = {
  shell: `fixed inset-0 z-[100] flex flex-col overflow-hidden min-h-0 ${coachBg.app} ${coachText.primary} font-evo-body`,
  contentArea: `flex-1 flex flex-col min-h-0 overflow-hidden ${coachBg.app}`,
  scroll: `w-full px-8 py-8 ${coachText.primary}`,
  prose: `text-base leading-relaxed space-y-6 ${coachText.primary} font-evo-body`,
  proseMuted: coachText.muted,
  h2: `font-evo-display text-xl sm:text-2xl font-bold uppercase tracking-wide border-b ${coachBorder} pb-3 mb-1 ${coachText.title}`,
  h3: `font-evo-display text-lg font-bold mt-8 mb-3 ${coachText.primary}`,
  card: `rounded-xl border ${coachBorder} ${coachBg.card} p-5 shadow-sm`,
  cardInner: `rounded-xl border ${coachBorder} ${coachBg.cardAlt} p-4`,
  tableWrap: `overflow-x-auto rounded-xl border ${coachBorder} ${coachBg.card}`,
  tableHead: 'bg-[#6A1F6D] text-white font-evo-display',
  chip: 'text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-lg border',
  btnPrimary: 'rounded-xl bg-[#A729AD] hover:bg-[#6A1F6D] text-white font-evo-body font-semibold transition-colors',
  supportHighlight: 'text-[#FFFF4C] font-bold',
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
  EvoFuncional: 'bg-[#6A1F6D]/25 text-[#F6E8F9] border-[#6A1F6D]/45',
  EvoBasics: 'bg-[#A729AD]/20 text-[#F6E8F9] border-[#A729AD]/45',
  EvoFit: 'bg-[#6A1F6D]/20 text-[#F6E8F9] border-[#6A1F6D]/45',
  EvoHybrix: 'bg-[#A729AD]/20 text-[#F6E8F9] border-[#A729AD]/45',
  EvoFuerza: 'bg-[#6A1F6D]/20 text-[#F6E8F9] border-[#6A1F6D]/45',
  'EvoGimnástica': 'bg-[#6A1F6D]/20 text-[#F6E8F9] border-[#6A1F6D]/45',
  EvoTodos: 'bg-[#A729AD]/20 text-[#F6E8F9] border-[#A729AD]/45',
}

export function classBadgeClass(label) {
  return CLASS_BADGE_CLASS[label] || 'bg-[#1a0f1b] text-[#F6E8F9] border-[#6A1F6D]/40'
}
