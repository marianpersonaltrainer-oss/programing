import { CLASS_COLORS } from '../constants/evoColors.js'

export function detectClassesInContent(content) {
  const found = []
  if (/evofuncional/i.test(content)) found.push('EvoFuncional')
  if (/evobasics/i.test(content))    found.push('EvoBasics')
  if (/evofit|evotone/i.test(content)) found.push('EvoFit')
  return found.length > 0 ? found : ['EvoFuncional']
}

export function getColorForClass(className) {
  return CLASS_COLORS[className] || CLASS_COLORS['EvoFuncional']
}

export function formatSessionForExport(sessions) {
  return Object.entries(sessions)
    .filter(([, s]) => s?.confirmed)
    .map(([, s]) => s.content)
    .join('\n\n════════════════════════════════════════\n\n')
}
