import { createClient } from '@supabase/supabase-js'
import { getRequestOrigin, isEvoOriginAllowed } from './lib/evoAllowedOrigins.js'
import {
  adminSecretsMatch,
  checkAdminRateLimit,
} from './lib/evoAdminAuth.js'
import {
  assertPublicationGateApproved,
  buildPublicationTargetFingerprint,
} from '../src/utils/publicationQualityGate.js'
import { validateEvoWeek } from '../src/domain/method/validators/validateEvoWeek.js'
import {
  parseWeeklyOfferSelection,
  weeklyOfferSelectionToValidationOffer,
} from '../src/utils/weeklyOffer.js'
import {
  addProgrammingDays,
  getProgrammingCycleStartDate,
  getProgrammingWeekStartDate,
  normalizeProgrammingDate,
  selectProgrammingContextWeeks,
} from '../src/utils/programmingContextSelection.js'
import { loadPublishedWeeksForContext } from './lib/loadPublishedWeeksForContext.js'
import { filterPublishedOrSupersededRows } from '../src/utils/publishedWeeksLegacy.js'

const REQUIRED_WEEK_DAYS = ['LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO']

function normalizeDayName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
}

function validateExactWeekShape(weekData) {
  const days = Array.isArray(weekData?.dias) ? weekData.dias : []
  if (days.length !== REQUIRED_WEEK_DAYS.length) {
    throw new Error('complete_six_day_week_required')
  }
  const weekStart = normalizeProgrammingDate(weekData?.week_start_date)
  for (let index = 0; index < REQUIRED_WEEK_DAYS.length; index += 1) {
    const expectedName = normalizeDayName(REQUIRED_WEEK_DAYS[index])
    const actualName = normalizeDayName(days[index]?.nombre)
    if (actualName !== expectedName) throw new Error('week_day_order_mismatch')
    const declaredDate = normalizeProgrammingDate(
      days[index]?.fecha || days[index]?.date || '',
    )
    if (declaredDate && weekStart && declaredDate !== addProgrammingDays(weekStart, index)) {
      throw new Error('week_day_date_mismatch')
    }
  }
}

function parseBody(req) {
  const raw = req.body
  if (raw == null || raw === '') return {}
  if (Buffer.isBuffer(raw)) {
    try {
      return JSON.parse(raw.toString('utf8') || '{}')
    } catch {
      return null
    }
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return typeof raw === 'object' ? raw : null
}

function sortedIds(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(String).filter(Boolean))].sort()
}

function sameIds(a, b) {
  return JSON.stringify(sortedIds(a)) === JSON.stringify(sortedIds(b))
}

function rpcArgs({
  weekData,
  mesocycle,
  week,
  draft,
  sourceWeekId,
  contentFingerprint = null,
  validationFingerprint = null,
  validationStatus = 'pending',
  validationScore = null,
  validationBlockers = [],
  validationPending = [],
  validatedAt = null,
}) {
  return {
    p_mesociclo: mesocycle,
    p_semana: week,
    p_titulo: weekData?.titulo || `S${week}`,
    p_data: weekData,
    p_draft_id: draft?.id || null,
    p_expected_revision: draft?.id ? Number(draft.revision) : 0,
    p_source_week_id: sourceWeekId || null,
    p_content_fingerprint: contentFingerprint,
    p_validation_fingerprint: validationFingerprint,
    p_validation_status: validationStatus,
    p_validation_score: validationScore,
    p_validation_blockers: validationBlockers,
    p_validation_pending: validationPending,
    p_validated_at: validatedAt,
  }
}

async function saveDraft(supabase, args) {
  const { data, error } = await supabase.rpc(
    'save_published_week_draft_v2',
    rpcArgs(args),
  )
  if (error) throw error
  if (!data?.id || !Number.isFinite(Number(data?.revision))) {
    throw new Error('invalid_versioned_draft_response')
  }
  return data
}

function attachAdminPublicationContext(weekData, body) {
  const normalized = { ...weekData }
  if (normalized.publication_context?.context_snapshot_at) return normalized
  const selectedWeekIds = sortedIds(body.selectedWeekIds)
  normalized.publication_context = {
    version: 1,
    fingerprint: String(body.contextFingerprint || ''),
    mode: 'exact-cycle-date',
    context_snapshot_at: new Date().toISOString(),
    progression_week_ids: selectedWeekIds,
    historical_week_ids: [],
    selected_week_ids: selectedWeekIds,
  }
  return normalized
}

function validateAdminDirectPublication(weekData, mesocycle, week) {
  const cycleStartDate = getProgrammingCycleStartDate(weekData)
  const weekStartDate = getProgrammingWeekStartDate(weekData)
  const expectedCycleId = `${mesocycle}:${cycleStartDate}`
  const expectedWeekStartDate = addProgrammingDays(cycleStartDate, (week - 1) * 7)
  if (!cycleStartDate) {
    throw new Error('exact_cycle_start_date_required')
  }
  if (
    String(weekData?.cycle_id || '') !== expectedCycleId ||
    weekStartDate !== expectedWeekStartDate
  ) {
    throw new Error('exact_cycle_identity_mismatch')
  }
  validateExactWeekShape(weekData)
}

async function validateExactPublication(supabase, weekData, gate, mesocycle, week) {
  assertPublicationGateApproved(gate)
  if (String(gate?.source_status || '').toLowerCase() !== 'aprobado') {
    throw new Error('validation_source_status_not_approved')
  }

  const context = weekData?.publication_context
  if (!context || typeof context !== 'object' || !context.fingerprint) {
    throw new Error('publication_context_required')
  }
  const contextSnapshotMs = Date.parse(context.context_snapshot_at)
  if (
    !Number.isFinite(contextSnapshotMs) ||
    contextSnapshotMs > Date.now() + 5 * 60_000
  ) {
    throw new Error('publication_context_snapshot_invalid')
  }
  const cycleStartDate = getProgrammingCycleStartDate(weekData)
  const weekStartDate = getProgrammingWeekStartDate(weekData)
  const expectedCycleId = `${mesocycle}:${cycleStartDate}`
  const expectedWeekStartDate = addProgrammingDays(cycleStartDate, (week - 1) * 7)
  if (!cycleStartDate) {
    throw new Error('exact_cycle_start_date_required')
  }
  if (
    String(weekData?.cycle_id || '') !== expectedCycleId ||
    weekStartDate !== expectedWeekStartDate
  ) {
    throw new Error('exact_cycle_identity_mismatch')
  }
  validateExactWeekShape(weekData)

  const offerSelection = parseWeeklyOfferSelection(weekData?.oferta_semanal)
  if (!offerSelection) throw new Error('explicit_weekly_offer_required')

  const rows = filterPublishedOrSupersededRows(await loadPublishedWeeksForContext(supabase, { limit: 160 }))
  if (
    rows.some((row) => {
      const publishedMs = Date.parse(row?.published_at)
      return Number.isFinite(publishedMs) && publishedMs > contextSnapshotMs
    })
  ) {
    throw new Error('publication_context_changed')
  }

  const selection = selectProgrammingContextWeeks(rows, weekData, {
    progressionLimit: 6,
    historicalLimit: 6,
  })
  if (selection.mode !== 'exact-cycle-date') {
    throw new Error('exact_cycle_context_not_verified')
  }
  if (!sameIds(selection.selectedWeekIds, context.selected_week_ids)) {
    throw new Error('publication_context_changed')
  }

  const expectedFingerprint = buildPublicationTargetFingerprint({
    weekData,
    mesocycle,
    week,
    phase: String(weekData?.phase || ''),
    offer: weekData.oferta_semanal,
    contextFingerprint: context.fingerprint,
  })
  if (
    gate.content_fingerprint !== expectedFingerprint ||
    gate.validation_fingerprint !== expectedFingerprint
  ) {
    throw new Error('publication_target_fingerprint_mismatch')
  }

  const methodReview = validateEvoWeek(weekData, {
    offer: weeklyOfferSelectionToValidationOffer(offerSelection),
    previousWeeks: selection.progressionWeeks.map((row) => row?.data).filter(Boolean),
    allowFestivo: false,
    allowedHolidayDays: Array.isArray(weekData?.authorized_holiday_days)
      ? weekData.authorized_holiday_days
      : [],
    requireCompleteOffer: true,
  })
  if (!methodReview.valid || methodReview.warnings.length) {
    throw new Error(
      `method_evo_blocked:${[...methodReview.errors, ...methodReview.warnings]
        .slice(0, 8)
        .map((entry) => entry.message)
        .join(' | ')}`,
    )
  }

  const validatedAt = Date.parse(gate.validated_at)
  const ageMs = Date.now() - validatedAt
  if (!Number.isFinite(validatedAt) || ageMs < -5 * 60_000 || ageMs > 24 * 60 * 60_000) {
    throw new Error('validation_timestamp_expired')
  }
}

function errorStatus(error) {
  const message = String(error?.message || '')
  if (/unauthorized/i.test(message)) return 401
  if (/required|invalid|must_be|mismatch/i.test(message)) return 422
  if (/context_changed|revision_conflict|40001/i.test(message)) return 409
  if (/method_evo_blocked|gate|blocked|below_80|expired/i.test(message)) return 422
  return 500
}

export default async function handler(req, res) {
  const originValue = getRequestOrigin(req)
  const isDev = process.env.NODE_ENV === 'development'
  if (!(isDev && !originValue) && !isEvoOriginAllowed(originValue)) {
    return res.status(403).json({ error: 'origin_not_allowed' })
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  const body = parseBody(req)
  if (body === null) return res.status(400).json({ error: 'invalid_json' })

  const serverSecret = String(process.env.COACH_GUIDE_ADMIN_SECRET || '').trim()
  const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseUrl = String(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  ).trim()
  if (!serverSecret || !serviceKey || !supabaseUrl) {
    return res.status(500).json({ error: 'server_not_configured_for_publication' })
  }
  const action = String(body.action || '')
  const mesocycle = String(body.mesocycle || body.mesociclo || '').trim()
  const week = Number(body.week ?? body.semana)
  const cycleId = String(body.cycleId || body.cycle_id || '').trim()
  const weekData = body.weekData
  const draftId = String(body.draftId || '').trim() || null
  const expectedRevision = Number(body.expectedRevision)
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  try {
    const exceeded = await checkAdminRateLimit(supabase, req, {
      endpoint: '/api/published-week-versions',
      limit: 40,
      windowMinutes: 10,
    })
    if (exceeded) {
      return res.status(429).json({
        error: 'rate_limit_exceeded',
        retry_after_seconds: 600,
      })
    }
  } catch (error) {
    console.error('[published-week-versions] rate limit unavailable:', error?.message || error)
    return res.status(503).json({ error: 'rate_limit_unavailable' })
  }

  if (!adminSecretsMatch(body.secret, serverSecret)) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  if (action === 'get_draft') {
    if (!mesocycle || !Number.isInteger(week) || week < 1 || !cycleId) {
      return res.status(400).json({ error: 'invalid_draft_lookup' })
    }
    const { data, error } = await supabase
      .from('published_weeks')
      .select('*')
      .eq('mesociclo', mesocycle)
      .eq('semana', week)
      .eq('cycle_id', cycleId)
      .eq('publication_status', 'draft')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('[published-week-versions] get_draft:', error.message || error)
      return res.status(500).json({ error: 'draft_lookup_failed' })
    }
    return res.status(200).json({ row: data || null, active: false })
  }

  if (
    !['save_draft', 'publish'].includes(action) ||
    !mesocycle ||
    !Number.isInteger(week) ||
    week < 1 ||
    !Number.isInteger(expectedRevision) ||
    (draftId ? expectedRevision < 1 : expectedRevision !== 0) ||
    !weekData ||
    typeof weekData !== 'object' ||
    Array.isArray(weekData)
  ) {
    return res.status(400).json({ error: 'invalid_publication_request' })
  }

  const normalized = { ...weekData, mesociclo: mesocycle, semana: week }
  try {
    if (action === 'publish') {
      if (body.adminDirectPublish === true) {
        assertPublicationGateApproved(body.qualityGate)
        const prepared = attachAdminPublicationContext(normalized, body)
        validateAdminDirectPublication(prepared, mesocycle, week)
        Object.assign(normalized, prepared)
      } else {
        await validateExactPublication(
          supabase,
          normalized,
          body.qualityGate,
          mesocycle,
          week,
        )
      }
    }

    if (action === 'save_draft') {
      const staged = await saveDraft(supabase, {
        weekData: normalized,
        mesocycle,
        week,
        draft: draftId ? { id: draftId, revision: expectedRevision } : null,
        sourceWeekId: body.sourceWeekId || null,
        validationStatus: 'pending',
        validationPending: ['La publicación requiere validar de nuevo esta revisión exacta.'],
      })
      return res.status(200).json({ row: staged, active: false })
    }

    const gate = body.qualityGate
    const { data: published, error: publishError } = await supabase.rpc(
      'save_and_publish_published_week_v2',
      {
        p_mesociclo: mesocycle,
        p_semana: week,
        p_titulo: normalized?.titulo || `S${week}`,
        p_data: normalized,
        p_draft_id: draftId,
        p_expected_revision: expectedRevision,
        p_source_week_id: body.sourceWeekId || null,
        p_validation_fingerprint: gate.content_fingerprint,
        p_validation_score: Number(gate.score),
        p_validation_blockers: gate.blockers,
        p_validation_pending: gate.pending,
        p_validated_at: gate.validated_at,
      },
    )
    if (publishError) throw publishError
    if (
      !published?.id ||
      published?.publication_status !== 'published' ||
      published?.is_active !== true
    ) {
      throw new Error('atomic_publication_not_confirmed')
    }
    return res.status(200).json({ row: published, active: true })
  } catch (error) {
    const message = String(error?.message || error)
    console.error('[published-week-versions]', message)
    return res.status(errorStatus(error)).json({
      error: message.slice(0, 1200),
      code: error?.code || null,
    })
  }
}
