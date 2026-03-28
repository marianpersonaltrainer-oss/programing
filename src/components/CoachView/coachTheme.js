/**
 * Tema shell claro EVO — compartido entre ?coach y programador principal.
 * Sidebar oscuro + contenido liláceo; campos con texto #1A0A1A explícito.
 */

export const coachBg = {
  app: 'bg-[#F6E8F9]',
  sidebar: 'bg-[#1A0D1A]',
  sidebarHover: 'hover:bg-white/10',
  card: 'bg-white',
  cardAlt: 'bg-[#F3EAF8]',
  rowA: 'bg-white',
  rowB: 'bg-[#F3EAF8]',
  overlay: 'bg-black/40',
}

export const coachBorder = 'border-[#6A1F6D]/35'

export const coachText = {
  primary: 'text-[#1A0A1A]',
  muted: 'text-[#5C4D5C]',
  accent: 'text-[#A729AD]',
  title: 'text-[#6A1F6D]',
  onSidebar: 'text-[#F6E8F9]',
  mutedOnSidebar: 'text-[#C4A8C4]',
}

export const coachNav = {
  active: 'bg-[#A729AD] text-white shadow-md',
  idle: `${coachText.onSidebar} ${coachBg.sidebarHover} hover:text-white`,
}

const coachInputBase =
  'w-full text-base bg-white border border-[#6A1F6D]/40 !text-[#1A0A1A] caret-[#1A0A1A] placeholder:!text-[#6B5A6B] placeholder:opacity-100 focus:outline-none focus:border-[#A729AD] focus:ring-1 focus:ring-[#A729AD]/20'

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
  supportHighlight: 'text-[#A729AD] font-bold',
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
  secondaryBtn: `px-6 py-3 rounded-xl border ${coachBorder} ${coachText.primary} hover:bg-[#EDE3F2] text-sm font-semibold`,
}

/** Badges de clase — fondos claros */
export const CLASS_BADGE_CLASS = {
  EvoFuncional: 'bg-[#3C78D8]/12 text-[#1e4a8c] border-[#3C78D8]/45',
  EvoBasics: 'bg-[#E69138]/12 text-[#8b4513] border-[#E69138]/45',
  EvoFit: 'bg-[#6AA84F]/12 text-[#2d5016] border-[#6AA84F]/45',
  EvoHybrix: 'bg-[#F4C430]/18 text-[#6b5900] border-[#F4C430]/55',
  EvoFuerza: 'bg-[#CC0000]/10 text-[#7f1d1d] border-[#CC0000]/45',
  'EvoGimnástica': 'bg-[#E91E8C]/10 text-[#831843] border-[#E91E8C]/45',
  EvoTodos: 'bg-[#A729AD]/12 text-[#5a0d5c] border-[#A729AD]/45',
}

export function classBadgeClass(label) {
  return CLASS_BADGE_CLASS[label] || 'bg-gray-100 text-gray-800 border-gray-300'
}
