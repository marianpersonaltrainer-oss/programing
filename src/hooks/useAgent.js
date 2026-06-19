/**
 * Agente de chat del dashboard (Marian): programación por días con SYSTEM_PROMPT.
 * Una llamada a `/api/anthropic` por cada mensaje del usuario (historial completo en `messages`).
 * Modelo: PROGRAMMING_MODEL — misma ruta que ExcelGeneratorModal; ver `API_COSTS.md`.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { SYSTEM_PROMPT } from '../constants/systemPrompt.js'
import { buildWeekContext } from '../utils/buildWeekContext.js'
import { getMethodText } from '../components/MethodPanel/MethodPanel.jsx'
import { AI_CONFIG, PROGRAMMING_MODEL } from '../constants/config.js'
import { getCoachExerciseLibrary, supabase } from '../lib/supabase.js'
import { buildGeneratorLibraryBlock } from '../utils/buildGeneratorLibraryContext.js'
import { explainAnthropicFetchFailure } from '../utils/explainAnthropicFetchFailure.js'
import {
  parseAnthropicProxyBody,
  isAnthropicProxyFailure,
  getAnthropicProxyErrorMessage,
} from '../utils/parseAnthropicProxyBody.js'
import { extractAnthropicTextBlocks } from '../utils/extractAnthropicTextBlocks.js'
import { buildMesocycleProgrammingBlock } from '../constants/mesocycleGenerationBlocks.js'
import { buildInferredMethodFromReference } from '../utils/buildInferredMethodFromReference.js'
import {
  getReferenceMesocycleContextForLLM,
  buildReferenceMesocycleSystemAppendix,
} from '../utils/referenceMesocycleContextStorage.js'
import { buildContextSynthesis } from '../utils/buildContextSynthesis.js'
import { setExerciseLibraryRowsCache } from '../utils/extractPatternFromSession.js'
import { DAYS_ORDER, DAYS_ES } from '../constants/evoColors.js'

/**
 * Resuelve el día que se está programando:
 * 1) si el mensaje del usuario nombra un día ("programa el jueves"), ese.
 * 2) si no, el primer día de la semana sin sesión confirmada.
 */
function resolveTargetDay(userText, weekState) {
  const t = String(userText || '').toLowerCase()
  for (const key of DAYS_ORDER) {
    const name = (DAYS_ES[key] || '').toLowerCase()
    if (name && t.includes(name)) return key
  }
  const sessions = weekState?.sessions || {}
  for (const key of DAYS_ORDER) {
    if (!sessions[key]?.confirmed) return key
  }
  return null
}

export function useAgent(weekState) {
  const [messages, setMessages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [libraryAppend, setLibraryAppend] = useState('')
  const [libraryReady, setLibraryReady] = useState(false)
  const abortRef = useRef(null)
  const libraryRowsRef = useRef([])
  const previousWeeksRef = useRef([])
  const coachFeedbackRef = useRef([])

  useEffect(() => {
    let cancelled = false
    getCoachExerciseLibrary()
      .then((rows) => {
        if (cancelled) return
        libraryRowsRef.current = rows
        setExerciseLibraryRowsCache(rows)
        setLibraryAppend(buildGeneratorLibraryBlock(rows))
        setLibraryReady(true)
      })
      .catch(() => {
        if (!cancelled) {
          setLibraryAppend('')
          setLibraryReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    supabase
      .from('published_weeks')
      .select('semana, mesociclo, data, published_at')
      .order('published_at', { ascending: false })
      .limit(6)
      .then(({ data: rows }) => {
        if (!Array.isArray(rows)) return
        previousWeeksRef.current = rows.map((r) => ({
          semana: r.semana,
          mesociclo: r.mesociclo,
          dias: Array.isArray(r.data?.dias) ? r.data.dias : [],
        }))
      })
      .catch(() => {})

    supabase
      .from('coach_session_feedback')
      .select('class_label, notes_next_week, created_at, week_id')
      .not('notes_next_week', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data: rows }) => {
        if (Array.isArray(rows)) coachFeedbackRef.current = rows
      })
      .catch(() => {})
  }, [])

  const sendMessage = useCallback(async (userText) => {
    setError(null)
    setIsGenerating(true)

    const weekCtx = await buildWeekContext(weekState)
    const methodText = getMethodText().trim()
    let systemWithContext = SYSTEM_PROMPT
    if (methodText) {
      systemWithContext += `\n\n════════════════════════════════════════\nMÉTODO Y REGLAS PERMANENTES DE EVO (Tu método)\n════════════════════════════════════════\n\n${methodText}`
    }
    const mesoProgrammingBlock = buildMesocycleProgrammingBlock({
      mesocycle: weekState?.mesocycle,
      week: weekState?.week,
      totalWeeks: weekState?.totalWeeks,
      phase: weekState?.phase,
    })
    if (mesoProgrammingBlock) {
      systemWithContext += `\n\n${mesoProgrammingBlock}`
    }
    const referenceAppendix = buildReferenceMesocycleSystemAppendix(getReferenceMesocycleContextForLLM())
    if (referenceAppendix) {
      systemWithContext += referenceAppendix
      const inferredRules = buildInferredMethodFromReference(getReferenceMesocycleContextForLLM())
      if (inferredRules) {
        systemWithContext += `\n\n${inferredRules}`
      }
    }
    if (weekCtx) {
      systemWithContext += `\n\n════════════════════════════════════════\nCONTEXTO ACTUAL\n════════════════════════════════════════\n\n${weekCtx}`
    }
    try {
      const { data: activeRules, error: activeRulesError } = await supabase
        .from('method_rules')
        .select('rule_type, trigger_context, rule_text, confidence')
        .eq('active', true)
        .order('confidence', { ascending: false })
        .limit(10)

      if (!activeRulesError && Array.isArray(activeRules) && activeRules.length > 0) {
        const rulesBlock = activeRules
          .map((rule) => {
            const confidence = Number.isFinite(rule?.confidence) ? rule.confidence : 50
            const triggerContext = String(rule?.trigger_context || '').trim() || 'general'
            const ruleType = String(rule?.rule_type || '').trim() || 'rule'
            const ruleText = String(rule?.rule_text || '').trim()
            return `- [${ruleType}] (${triggerContext}): ${ruleText} (confianza: ${confidence}%)`
          })
          .join('\n')

        if (rulesBlock) {
          systemWithContext += `\n\n--- SEÑALES DEL CENTRO (aprendizaje acumulado) ---\n${rulesBlock}\n--- FIN SEÑALES ---`
        }
      }
    } catch {
      // El aprendizaje acumulado no debe bloquear la generación.
    }
    if (libraryAppend) {
      systemWithContext += `\n\n${libraryAppend}`
    }

    const targetDay = resolveTargetDay(userText, weekState)
    const synthesis = buildContextSynthesis({
      weekState,
      exerciseLibraryRows: libraryRowsRef.current,
      previousWeeks: previousWeeksRef.current,
      coachFeedback: coachFeedbackRef.current,
      targetDay,
    })
    if (synthesis) {
      systemWithContext += `\n\n${synthesis}`
    }

    console.group('[ProgramingEvo] Contexto enviado a la IA')
    console.log('targetDay:', targetDay)
    console.log('SÍNTESIS DE CONTEXTO:\n', synthesis || '(vacío)')
    console.log(`System prompt completo (${systemWithContext.length} caracteres):`, systemWithContext)
    console.groupEnd()

    const newMessages = [
      ...messages,
      { role: 'user', content: userText },
    ]
    setMessages(newMessages)

    try {
      const controller = new AbortController()
      abortRef.current = controller

      let response
      try {
        // Modelo: sonnet — generación y edición de programación (SYSTEM_PROMPT + contexto semanal).
        response = await fetch('/api/anthropic', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: PROGRAMMING_MODEL,
            max_tokens: AI_CONFIG.maxTokens,
            system: systemWithContext,
            weekContext: weekCtx || '',
            messages: newMessages,
          }),
        })
      } catch (e) {
        if (e?.name === 'AbortError') throw e
        throw new Error(explainAnthropicFetchFailure(e))
      }

      const responseText = await response.text()
      let data
      try {
        data = parseAnthropicProxyBody(responseText)
      } catch {
        throw new Error('La respuesta del servidor no es JSON válido.')
      }

      if (!response.ok || isAnthropicProxyFailure(data)) {
        throw new Error(getAnthropicProxyErrorMessage(data, responseText, response.status))
      }
      const assistantContent = extractAnthropicTextBlocks(data)
      if (!assistantContent.trim()) {
        throw new Error('La API no devolvió texto del asistente.')
      }

      const updated = [
        ...newMessages,
        { role: 'assistant', content: assistantContent },
      ]
      setMessages(updated)
      setIsGenerating(false)
      return assistantContent
    } catch (err) {
      if (err.name === 'AbortError') {
        setIsGenerating(false)
        return
      }
      setError(err.message)
      setIsGenerating(false)
    }
  }, [messages, weekState, libraryAppend])

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  return {
    messages,
    isGenerating,
    error,
    sendMessage,
    stopGeneration,
    clearMessages,
    libraryReady,
  }
}
