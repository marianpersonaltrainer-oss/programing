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
import { getCoachExerciseLibrary } from '../lib/supabase.js'
import { buildGeneratorLibraryBlock } from '../utils/buildGeneratorLibraryContext.js'
import { explainAnthropicFetchFailure } from '../utils/explainAnthropicFetchFailure.js'
import { parseAnthropicProxyBody, isAnthropicProxyFailure } from '../utils/parseAnthropicProxyBody.js'

export function useAgent(weekState) {
  const [messages, setMessages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const [libraryAppend, setLibraryAppend] = useState('')
  const abortRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    getCoachExerciseLibrary()
      .then((rows) => {
        if (!cancelled) setLibraryAppend(buildGeneratorLibraryBlock(rows))
      })
      .catch(() => {
        if (!cancelled) setLibraryAppend('')
      })
    return () => {
      cancelled = true
    }
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
    if (weekCtx) {
      systemWithContext += `\n\n════════════════════════════════════════\nCONTEXTO ACTUAL\n════════════════════════════════════════\n\n${weekCtx}`
    }
    if (libraryAppend) {
      systemWithContext += `\n\n${libraryAppend}`
    }

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
        throw new Error(data?.error?.message || `Error ${response.status}`)
      }
      const assistantContent = data.content?.[0]?.text || ''

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
  }
}
