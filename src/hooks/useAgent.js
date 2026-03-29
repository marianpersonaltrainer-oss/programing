/**
 * Agente de chat del dashboard (Marian): programación por días con SYSTEM_PROMPT.
 * Una llamada a `/api/anthropic` por cada mensaje del usuario (historial completo en `messages`).
 * Modelo: sonnet — misma ruta que ExcelGeneratorModal; ver `API_COSTS.md`.
 */
import { useState, useCallback, useRef } from 'react'
import { SYSTEM_PROMPT } from '../constants/systemPrompt.js'
import { buildWeekContextMessage } from '../utils/buildWeekContext.js'
import { getMethodText } from '../components/MethodPanel/MethodPanel.jsx'
import { AI_CONFIG } from '../constants/config.js'

export function useAgent(weekState) {
  const [messages, setMessages] = useState([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const sendMessage = useCallback(async (userText) => {
    setError(null)
    setIsGenerating(true)

    const weekCtx = buildWeekContextMessage(weekState)
    const methodText = getMethodText().trim()
    let systemWithContext = SYSTEM_PROMPT
    if (methodText) {
      systemWithContext += `\n\n════════════════════════════════════════\nMÉTODO Y REGLAS PERMANENTES DE EVO (Tu método)\n════════════════════════════════════════\n\n${methodText}`
    }
    if (weekCtx) {
      systemWithContext += `\n\n════════════════════════════════════════\nCONTEXTO ACTUAL\n════════════════════════════════════════\n\n${weekCtx}`
    }

    const newMessages = [
      ...messages,
      { role: 'user', content: userText },
    ]
    setMessages(newMessages)

    try {
      const controller = new AbortController()
      abortRef.current = controller

      // Modelo: sonnet — generación y edición de programación (SYSTEM_PROMPT + contexto semanal).
      const response = await fetch('/api/anthropic', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: AI_CONFIG.model,
          max_tokens: AI_CONFIG.maxTokens,
          system: systemWithContext,
          messages: newMessages,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData?.error?.message || `Error ${response.status}`)
      }

      const data = await response.json()
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
  }, [messages, weekState])

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
