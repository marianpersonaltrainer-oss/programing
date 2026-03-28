import { EVO_SESSION_CLASS_DEFS } from '../../constants/evoClasses.js'

export { SESSION_BLOCKS } from '../../constants/evoClasses.js'

export const FEEDBACK_BLOCKS = EVO_SESSION_CLASS_DEFS.map(({ feedbackKey, label }) => {
  const short = label.replace(/^Evo/, '')
  return { key: feedbackKey, label: `Feedback · ${short}` }
})
