import { extractAnthropicTextBlocks } from '../../src/utils/extractAnthropicTextBlocks.js'

export const ANTHROPIC_STRUCTURED_DEFAULT_TIMEOUT_MS = 75_000
export const ANTHROPIC_STRUCTURED_MAX_TIMEOUT_MS = 90_000

export const ANTHROPIC_STRUCTURED_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  PROVIDER_HTTP: 'provider_http_error',
  INVALID_PROVIDER_BODY: 'invalid_provider_body',
  EMPTY_TEXT: 'empty_structured_output',
  INVALID_OUTPUT: 'invalid_structured_output',
  TIMEOUT: 'upstream_timeout',
  ABORTED: 'request_aborted',
  NETWORK: 'provider_network_error',
})

const RETRIABLE_PROVIDER_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529])

export class AnthropicStructuredRequestError extends Error {
  constructor(
    message,
    {
      code,
      status = 502,
      providerRequestId = null,
      retriable = false,
      cause,
      details,
    } = {},
  ) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'AnthropicStructuredRequestError'
    this.code = code || ANTHROPIC_STRUCTURED_ERROR_CODES.NETWORK
    this.status = Number(status) || 502
    this.providerRequestId = providerRequestId || null
    this.retriable = Boolean(retriable)
    if (details !== undefined) this.details = details
  }
}

export function isAnthropicStructuredRequestError(error) {
  return error instanceof AnthropicStructuredRequestError
}

export function normalizeAnthropicStructuredTimeoutMs(timeoutMs) {
  const parsed = Number(timeoutMs)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return ANTHROPIC_STRUCTURED_DEFAULT_TIMEOUT_MS
  }
  return Math.min(Math.floor(parsed), ANTHROPIC_STRUCTURED_MAX_TIMEOUT_MS)
}

function readHeader(response, name) {
  if (typeof response?.headers?.get === 'function') {
    return response.headers.get(name)
  }
  const headers = response?.headers
  if (!headers || typeof headers !== 'object') return null
  const target = String(name).toLowerCase()
  const entry = Object.entries(headers).find(([key]) => String(key).toLowerCase() === target)
  return entry ? entry[1] : null
}

export function extractAnthropicProviderRequestId(response, data) {
  return (
    readHeader(response, 'request-id') ||
    readHeader(response, 'x-request-id') ||
    data?.request_id ||
    data?.id ||
    null
  )
}

function providerErrorMessage(data, status) {
  const nested = data?.error?.message
  if (typeof nested === 'string' && nested.trim()) return nested.trim()
  if (typeof data?.error === 'string' && data.error.trim()) return data.error.trim()
  if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
  return `Anthropic HTTP ${status}`
}

function assertRequestInput({ apiKey, model, messages, schema, fetchImpl }) {
  const problems = []
  if (!String(apiKey || '').trim()) problems.push('apiKey')
  if (!String(model || '').trim()) problems.push('model')
  if (!Array.isArray(messages) || messages.length === 0) problems.push('messages')
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) problems.push('schema')
  if (typeof fetchImpl !== 'function') problems.push('fetchImpl')
  if (!problems.length) return

  throw new AnthropicStructuredRequestError(
    `Petición Structured Outputs incompleta: ${problems.join(', ')}.`,
    {
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_REQUEST,
      status: 400,
      retriable: false,
      details: { fields: problems },
    },
  )
}

/**
 * Cliente puro para una única petición Anthropic Structured Outputs.
 *
 * No lee variables de entorno, no escribe logs ni conoce HTTP/Vercel/Supabase.
 * Esto permite que el handler decida autenticación y persistencia, y que esta
 * operación tenga pruebas funcionales deterministas.
 */
export async function requestAnthropicStructuredOutput({
  apiKey,
  model,
  messages,
  schema,
  system,
  maxTokens = 5_500,
  timeoutMs = ANTHROPIC_STRUCTURED_DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  signal,
  parseOutput = JSON.parse,
  anthropicVersion = '2023-06-01',
}) {
  assertRequestInput({ apiKey, model, messages, schema, fetchImpl })

  const boundedTimeoutMs = normalizeAnthropicStructuredTimeoutMs(timeoutMs)
  if (signal?.aborted) {
    throw new AnthropicStructuredRequestError('La petición a Anthropic fue cancelada.', {
      code: ANTHROPIC_STRUCTURED_ERROR_CODES.ABORTED,
      status: 499,
      retriable: false,
      cause: signal.reason,
    })
  }

  const controller = new AbortController()
  let timedOut = false
  let externallyAborted = false
  let rejectDeadline
  const deadline = new Promise((_resolve, reject) => {
    rejectDeadline = reject
  })
  const abortFromCaller = () => {
    externallyAborted = true
    controller.abort(signal?.reason)
    rejectDeadline(signal?.reason instanceof Error ? signal.reason : new Error('request_aborted'))
  }

  if (signal) {
    signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
    rejectDeadline(new Error('upstream_timeout'))
  }, boundedTimeoutMs)

  let response
  let rawBody = ''
  let data
  let providerRequestId = null

  try {
    response = await Promise.race([
      fetchImpl('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': String(apiKey).trim(),
          'anthropic-version': anthropicVersion,
        },
        body: JSON.stringify({
          model: String(model).trim(),
          max_tokens: Math.max(1, Math.floor(Number(maxTokens) || 5_500)),
          system: system === undefined ? undefined : String(system),
          messages,
          output_config: {
            format: {
              type: 'json_schema',
              schema,
            },
          },
        }),
        signal: controller.signal,
      }),
      deadline,
    ])

    providerRequestId = extractAnthropicProviderRequestId(response, null)

    try {
      rawBody = await Promise.race([response.text(), deadline])
      data = rawBody ? JSON.parse(rawBody) : null
    } catch (cause) {
      // El presupuesto cubre también la lectura del cuerpo. Si el abort ocurrió
      // aquí, debe conservarse como timeout/cancelación y no degradarse a JSON inválido.
      if (timedOut || externallyAborted || signal?.aborted) throw cause
      throw new AnthropicStructuredRequestError(
        'Anthropic devolvió un cuerpo HTTP que no es JSON válido.',
        {
          code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_PROVIDER_BODY,
          status:
            Number(response?.status) >= 400
              ? Number(response.status)
              : 502,
          providerRequestId,
          retriable: false,
          cause,
          details: { preview: String(rawBody || '').slice(0, 200) },
        },
      )
    }

    providerRequestId = extractAnthropicProviderRequestId(response, data)

    if (!response?.ok) {
      const status = Number(response?.status) || 502
      throw new AnthropicStructuredRequestError(providerErrorMessage(data, status), {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
        status,
        providerRequestId,
        retriable: RETRIABLE_PROVIDER_STATUSES.has(status),
        details: {
          providerType:
            typeof data?.error?.type === 'string' ? data.error.type : null,
        },
      })
    }

    const assistantText = extractAnthropicTextBlocks(data)
    if (!assistantText) {
      throw new AnthropicStructuredRequestError(
        'Anthropic no devolvió ningún bloque de texto estructurado.',
        {
          code: ANTHROPIC_STRUCTURED_ERROR_CODES.EMPTY_TEXT,
          status: 502,
          providerRequestId,
          retriable: true,
        },
      )
    }

    let output
    try {
      output = parseOutput(assistantText)
    } catch (cause) {
      throw new AnthropicStructuredRequestError(
        'El texto de Structured Outputs no contiene JSON válido.',
        {
          code: ANTHROPIC_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
          status: 502,
          providerRequestId,
          retriable: false,
          cause,
          details: { preview: assistantText.slice(0, 200) },
        },
      )
    }

    return {
      output,
      assistantText,
      providerRequestId,
      model: data?.model || String(model).trim(),
      usage: data?.usage || null,
      stopReason: data?.stop_reason || null,
    }
  } catch (error) {
    if (isAnthropicStructuredRequestError(error)) throw error

    if (timedOut) {
      throw new AnthropicStructuredRequestError(
        `Anthropic no respondió en ${boundedTimeoutMs} ms.`,
        {
          code: ANTHROPIC_STRUCTURED_ERROR_CODES.TIMEOUT,
          status: 504,
          providerRequestId,
          retriable: true,
          cause: error,
          details: { timeoutMs: boundedTimeoutMs },
        },
      )
    }

    if (externallyAborted || signal?.aborted) {
      throw new AnthropicStructuredRequestError('La petición a Anthropic fue cancelada.', {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.ABORTED,
        status: 499,
        providerRequestId,
        retriable: false,
        cause: error,
      })
    }

    throw new AnthropicStructuredRequestError(
      error?.message || 'No se pudo contactar con Anthropic.',
      {
        code: ANTHROPIC_STRUCTURED_ERROR_CODES.NETWORK,
        status: 502,
        providerRequestId,
        retriable: true,
        cause: error,
      },
    )
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener?.('abort', abortFromCaller)
  }
}
