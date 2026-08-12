/**
 * Agente de chat del dashboard (Marian): programación por días con SYSTEM_PROMPT.
 * Una llamada a `/api/anthropic` por cada mensaje del usuario (historial completo en `messages`).
 * Modelo: PROGRAMMING_MODEL — misma ruta que ExcelGeneratorModal; ver `API_COSTS.md`.
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import { SYSTEM_PROMPT } from '../constants/systemPrompt.js'
import {
  buildWeekContext,
  buildWeekContextTarget,
  loadExactWeekContext,
  weekContextTargetKey,
} from '../utils/buildWeekContext.js'
import { buildMethodPromptAppendix } from '../utils/methodPrompt.js'
import { AI_CONFIG, PROGRAMMING_MODEL } from '../constants/config.js'
import { getCoachExerciseLibrary } from '../lib/supabase.js'
import { buildGeneratorLibraryBlock } from '../utils/buildGeneratorLibraryContext.js'
import { explainAnthropicFetchFailure } from '../utils/explainAnthropicFetchFailure.js'
import {
  parseAnthropicProxyBody,
  isAnthropicProxyFailure,
  getAnthropicProxyErrorMessage,
} from '../utils/parseAnthropicProxyBody.js'
import { extractAnthropicTextBlocks } from '../utils/extractAnthropicTextBlocks.js'
import { buildMesocycleProgrammingBlock } from '../constants/mesocycleGenerationBlocks.js'
import { buildContextSynthesis } from '../utils/buildContextSynthesis.js'
import { setExerciseLibraryRowsCache } from '../utils/extractPatternFromSession.js'
import { DAYS_ORDER, DAYS_ES } from '../constants/evoColors.js'
import { EVO_SESSION_CLASS_DEFS } from '../constants/evoClasses.js'

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

export function isCurrentAgentRequest(
  requestId,
  requestTargetKey,
  activeRequestId,
  currentTargetKey,
  requestSessionsKey = '',
  currentSessionsKey = '',
) {
  return (
    requestId === activeRequestId &&
    !!requestTargetKey &&
    requestTargetKey === currentTargetKey &&
    (!requestSessionsKey || requestSessionsKey === currentSessionsKey)
  )
}

export function weekSessionsContextKey(weekState) {
  const sessions = weekState?.sessions || {}
  return JSON.stringify(
    DAYS_ORDER.map((day) => {
      const session = sessions[day]
      return [
        day,
        !!session?.confirmed,
        String(session?.content || ''),
        Array.isArray(session?.classes)
          ? [...session.classes].map(String).sort()
          : [],
      ]
    }),
  )
}

export function contextWeeksForSynthesis(rows) {
  const shortLabels = {
    evofuncional: 'Func',
    evobasics: 'Basic',
    evofit: 'Fit',
    evohybrix: 'Hyb',
    evofuerza: 'Fza',
    evogimnastica: 'Gim',
    evotodos: 'Todos',
  }
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row?.id,
    semana: row?.semana ?? row?.data?.semana,
    mesociclo: row?.mesociclo ?? row?.data?.mesociclo,
    dias: (Array.isArray(row?.data?.dias) ? row.data.dias : []).map((day) => {
      const sessions = EVO_SESSION_CLASS_DEFS
        .map(({ key, label }) => {
          const legacyKey = {
            evofuncional: 'wodFuncional',
            evobasics: 'wodBasics',
            evofit: 'wodFit',
            evohybrix: 'wodHybrix',
            evofuerza: 'wodFuerza',
            evogimnastica: 'wodGimnastica',
            evotodos: 'wodTodos',
          }[key]
          const text = String(day?.[key] || day?.[legacyKey] || '').trim()
          return text ? { key, label, text } : null
        })
        .filter(Boolean)
      const compactPreview = sessions
        .map(({ key, text }) => {
          const oneLine = text.replace(/\s+/g, ' ').trim()
          return `${shortLabels[key]}:${oneLine.slice(0, 8)}`
        })
        .join(' | ')
      const fullSessions = sessions
        .filter(({ key }) => key !== 'evobasics' && key !== 'evofit')
        .map(({ label, text }) => `${label}: ${text}`)
      return {
        ...day,
        // buildContextSynthesis conserva por compatibilidad tres campos y
        // recorta su preview. Esta copia compacta pone las siete modalidades
        // antes del corte y mantiene después el texto íntegro para patrones.
        evofuncional: [compactPreview, ...fullSessions]
          .filter(Boolean)
          .join('\n'),
      }
    }),
  }))
}

export function useAgent(weekState) {
  const [messages, setMessages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [libraryReady, setLibraryReady] = useState(false)
  const [contextReady, setContextReady] = useState(false)
  const abortRef = useRef(null)
  const libraryRowsRef = useRef([])
  const libraryAppendRef = useRef('')
  const libraryReadyRef = useRef(false)
  const libraryErrorRef = useRef('')
  const previousWeeksRef = useRef([])
  const coachFeedbackRef = useRef([])
  const messagesRef = useRef([])
  const contextSnapshotRef = useRef(null)
  const contextPromiseRef = useRef(null)
  const contextLoadRunRef = useRef(0)
  const requestRunRef = useRef(0)
  const activeRequestRef = useRef(0)
  const targetKey = weekContextTargetKey(weekState)
  const targetKeyRef = useRef(targetKey)
  targetKeyRef.current = targetKey
  const sessionsKey = weekSessionsContextKey(weekState)
  const sessionsKeyRef = useRef(sessionsKey)
  sessionsKeyRef.current = sessionsKey

  useEffect(() => {
    let cancelled = false
    getCoachExerciseLibrary()
      .then((rows) => {
        if (cancelled) return
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('La biblioteca oficial EVO está vacía.')
        }
        libraryRowsRef.current = rows
        setExerciseLibraryRowsCache(rows)
        const append = buildGeneratorLibraryBlock(rows)
        if (!String(append || '').trim()) {
          throw new Error('La biblioteca oficial EVO no generó contexto válido.')
        }
        libraryAppendRef.current = append
        libraryErrorRef.current = ''
        libraryReadyRef.current = true
        setLibraryReady(true)
      })
      .catch((libraryError) => {
        if (!cancelled) {
          libraryAppendRef.current = ''
          libraryReadyRef.current = false
          setLibraryReady(false)
          libraryErrorRef.current =
            libraryError?.message ||
            'No se pudo cargar la biblioteca oficial EVO.'
          setError(libraryErrorRef.current)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    activeRequestRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    setIsGenerating(false)
  }, [sessionsKey])

  useEffect(() => {
    const loadRunId = ++contextLoadRunRef.current
    const requestTargetKey = targetKey
    const target = buildWeekContextTarget(weekState)

    targetKeyRef.current = requestTargetKey
    activeRequestRef.current += 1
    abortRef.current?.abort()
    abortRef.current = null
    contextSnapshotRef.current = null
    previousWeeksRef.current = []
    coachFeedbackRef.current = []
    messagesRef.current = []
    setMessages([])
    setError(null)
    setIsGenerating(false)
    setContextReady(false)

    if (!target.exact) {
      contextPromiseRef.current = {
        targetKey: requestTargetKey,
        promise: Promise.resolve({
          error: new Error(
            'Selecciona mesociclo, semana e inicio real del ciclo antes de usar el asistente.',
          ),
        }),
      }
      return undefined
    }

    let cancelled = false
    const promise = loadExactWeekContext(weekState)
      .then((snapshot) => {
        if (
          cancelled ||
          loadRunId !== contextLoadRunRef.current ||
          requestTargetKey !== targetKeyRef.current
        ) {
          return { stale: true }
        }
        contextSnapshotRef.current = snapshot
        previousWeeksRef.current = contextWeeksForSynthesis(
          snapshot.progressionWeeks,
        )
        coachFeedbackRef.current = snapshot.coachFeedback
        setContextReady(true)
        return { snapshot }
      })
      .catch((contextError) => {
        if (
          !cancelled &&
          loadRunId === contextLoadRunRef.current &&
          requestTargetKey === targetKeyRef.current
        ) {
          setError(
            contextError?.message ||
              'No se pudo verificar el contexto exacto de la semana.',
          )
          setContextReady(false)
        }
        return { error: contextError }
      })

    contextPromiseRef.current = {
      targetKey: requestTargetKey,
      promise,
    }

    return () => {
      cancelled = true
    }
  }, [targetKey])

  const sendMessage = useCallback(async (userText) => {
    setError(null)
    const requestTargetKey = targetKeyRef.current
    const requestSessionsKey = sessionsKeyRef.current
    const pendingContext = contextPromiseRef.current
    if (
      !pendingContext ||
      pendingContext.targetKey !== requestTargetKey
    ) {
      setError('El contexto de esta semana todavía no está preparado.')
      return
    }

    const loadedContext = await pendingContext.promise
    if (
      loadedContext?.stale ||
      requestTargetKey !== targetKeyRef.current ||
      requestSessionsKey !== sessionsKeyRef.current
    ) {
      return
    }
    if (loadedContext?.error || !loadedContext?.snapshot) {
      setError(
        loadedContext?.error?.message ||
          'No se pudo verificar el contexto exacto de la semana.',
      )
      return
    }
    if (!libraryReadyRef.current) {
      setError(
        libraryErrorRef.current ||
          'Espera a que termine de cargar la biblioteca oficial EVO.',
      )
      return
    }

    const snapshot = loadedContext.snapshot
    if (
      snapshot.targetKey !== requestTargetKey ||
      contextSnapshotRef.current?.targetKey !== requestTargetKey
    ) {
      return
    }

    const requestId = ++requestRunRef.current
    activeRequestRef.current = requestId
    setIsGenerating(true)

    const requestWeekState = weekState
    let weekCtx
    try {
      weekCtx = await buildWeekContext(requestWeekState, snapshot)
    } catch (contextError) {
      if (
        isCurrentAgentRequest(
          requestId,
          requestTargetKey,
          activeRequestRef.current,
          targetKeyRef.current,
          requestSessionsKey,
          sessionsKeyRef.current,
        )
      ) {
        setError(
          contextError?.message ||
            'No se pudo verificar el contexto exacto de la semana.',
        )
        setIsGenerating(false)
      }
      return
    }
    if (
      !isCurrentAgentRequest(
        requestId,
        requestTargetKey,
        activeRequestRef.current,
        targetKeyRef.current,
        requestSessionsKey,
        sessionsKeyRef.current,
      )
    ) {
      return
    }
    let systemWithContext = SYSTEM_PROMPT
    const methodBlock = buildMethodPromptAppendix()
    if (methodBlock) {
      systemWithContext += `\n\n${methodBlock}`
    }
    const mesoProgrammingBlock = buildMesocycleProgrammingBlock({
      mesocycle: requestWeekState?.mesocycle,
      week: requestWeekState?.week,
      totalWeeks: requestWeekState?.totalWeeks,
      phase: requestWeekState?.phase,
    })
    if (mesoProgrammingBlock) {
      systemWithContext += `\n\n${mesoProgrammingBlock}`
    }
    // El Método EVO versionado y las decisiones manuales confirmadas son la única capa normativa.
    // Fuente de verdad: contrato versionado vía buildMethodPromptAppendix().
    if (libraryAppendRef.current) {
      systemWithContext += `\n\n${libraryAppendRef.current}`
    }

    const targetDay = resolveTargetDay(userText, requestWeekState)
    const synthesis = buildContextSynthesis({
      weekState: requestWeekState,
      exerciseLibraryRows: libraryRowsRef.current,
      previousWeeks: previousWeeksRef.current,
      coachFeedback: coachFeedbackRef.current,
      targetDay,
    })
    if (synthesis) {
      systemWithContext += `\n\n${synthesis}`
    }

    const newMessages = [
      ...messagesRef.current,
      { role: 'user', content: userText },
    ]
    messagesRef.current = newMessages
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
      if (
        !isCurrentAgentRequest(
          requestId,
          requestTargetKey,
          activeRequestRef.current,
          targetKeyRef.current,
          requestSessionsKey,
          sessionsKeyRef.current,
        )
      ) {
        return
      }

      const updated = [
        ...newMessages,
        { role: 'assistant', content: assistantContent },
      ]
      messagesRef.current = updated
      setMessages(updated)
      setIsGenerating(false)
      return assistantContent
    } catch (err) {
      if (
        !isCurrentAgentRequest(
          requestId,
          requestTargetKey,
          activeRequestRef.current,
          targetKeyRef.current,
          requestSessionsKey,
          sessionsKeyRef.current,
        )
      ) {
        return
      }
      if (err.name === 'AbortError') {
        setIsGenerating(false)
        return
      }
      setError(err.message)
      setIsGenerating(false)
    }
  }, [weekState])

  const stopGeneration = useCallback(() => {
    activeRequestRef.current += 1
    abortRef.current?.abort()
    setIsGenerating(false)
  }, [])

  const clearMessages = useCallback(() => {
    messagesRef.current = []
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
    contextReady,
  }
}
