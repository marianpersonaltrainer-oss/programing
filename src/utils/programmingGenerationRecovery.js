import { EXCEL_DAY_ORDER } from './excelGenerationPlan.js'
import {
  jobHasResumableProgress,
} from './excelGenerationJobStorage.js'
import { remoteSnapshotToLocalJob } from './programmingGenerationJobApi.js'
import {
  getSelectedClassKeysForDay,
  parseWeeklyOfferSelection,
} from './weeklyOffer.js'

/**
 * Convierte un snapshot remoto en el estado mínimo que necesita el modal al
 * remontar. No depende de ningún briefing que siguiera vivo en memoria.
 */
export function buildProgrammingGenerationRecoveryState(
  snapshot,
  fallbackJob = {},
) {
  const job = remoteSnapshotToLocalJob(snapshot, fallbackJob)
  if (!job) return null

  const configuration =
    job.configuration && typeof job.configuration === 'object'
      ? job.configuration
      : {}
  const offerSelection = parseWeeklyOfferSelection(
    configuration.weeklyOffer,
  )
  const configuredDays = Array.isArray(configuration.generationDays)
    ? configuration.generationDays.filter((day) =>
        EXCEL_DAY_ORDER.includes(day),
      )
    : []
  const configuredDaySet = new Set(configuredDays)
  const generationDaySelection = offerSelection
    ? Object.fromEntries(
        EXCEL_DAY_ORDER.map((day) => [
          day,
          configuredDaySet.size
            ? configuredDaySet.has(day)
            : getSelectedClassKeysForDay(offerSelection, day).length > 0,
        ]),
      )
    : null
  const contextPack = String(configuration.briefingContextPack || '')
  const proposalTitle = String(configuration.proposalTitle || '').trim()
  const proposalNarrative = String(
    configuration.proposalNarrative || '',
  ).trim()

  return {
    job,
    configuration,
    offerSelection,
    generationDaySelection,
    pendingDays: configuredDays.filter(
      (day) => !job.completedDays.includes(day),
    ),
    contextPack,
    contextReady:
      configuration.contextVerified === true && !!contextPack.trim(),
    proposalReady:
      configuration.proposalAccepted === true &&
      !!proposalTitle &&
      !!proposalNarrative,
    canResume: jobHasResumableProgress(job),
  }
}
