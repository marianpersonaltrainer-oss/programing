export const OPENAI_STRUCTURED_DEFAULT_TIMEOUT_MS = 75_000
export const OPENAI_STRUCTURED_MAX_TIMEOUT_MS = 90_000

export const OPENAI_STRUCTURED_ERROR_CODES = Object.freeze({
  INVALID_REQUEST: 'invalid_request',
  PROVIDER_HTTP: 'provider_http_error',
  INVALID_PROVIDER_BODY: 'invalid_provider_body',
  EMPTY_TEXT: 'empty_structured_output',
  INVALID_OUTPUT: 'invalid_structured_output',
  TIMEOUT: 'upstream_timeout',
  ABORTED: 'request_aborted',
  NETWORK: 'provider_network_error',
})

const RETRIABLE_PROVIDER_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504])

export class OpenAiStructuredRequestError extends Error {
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
    this.name = 'OpenAiStructuredRequestError'
    this.code = code || OPENAI_STRUCTURED_ERROR_CODES.NETWORK
    this.status = Number(status) || 502
    this.providerRequestId = providerRequestId || null
    this.retriable = Boolean(retriable)
    if (details !== undefined) this.details = details
  }
}

export function isOpenAiStructuredRequestError(error) {
  return error instanceof OpenAiStructuredRequestError
}

export function normalizeOpenAiStructuredTimeoutMs(timeoutMs) {
  const parsed = Number(timeoutMs)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return OPENAI_STRUCTURED_DEFAULT_TIMEOUT_MS
  }
  return Math.min(Math.floor(parsed), OPENAI_STRUCTURED_MAX_TIMEOUT_MS)
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

export function extractOpenAiProviderRequestId(response, data) {
  return (
    readHeader(response, 'x-request-id') ||
    readHeader(response, 'request-id') ||
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
  return `OpenAI HTTP ${status}`
}

function assertRequestInput({ apiKey, model, messages, schema, fetchImpl }) {
  const problems = []
  if (!String(apiKey || '').trim()) problems.push('apiKey')
  if (!String(model || '').trim()) problems.push('model')
  if (!Array.isArray(messages) || messages.length === 0) problems.push('messages')
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) problems.push('schema')
  if (typeof fetchImpl !== 'function') problems.push('fetchImpl')
  if (!problems.length) return

  throw new OpenAiStructuredRequestError(
    `Petición Structured Outputs incompleta: ${problems.join(', ')}.`,
    {
      code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_REQUEST,
      status: 400,
      retriable: false,
      details: { fields: problems },
    },
  )
}

function safeSchemaName(value) {
  const normalized = String(value || 'evo_structured_output')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 64)
  return normalized || 'evo_structured_output'
}

function buildInput(system, messages) {
  return [
    ...(system === undefined
      ? []
      : [{ role: 'system', content: String(system) }]),
    ...messages,
  ]
}

function extractOutputText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim()
  }
  const blocks = []
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') {
        blocks.push(content.text)
      }
    }
  }
  return blocks.join('\n').trim()
}

function extractRefusal(data) {
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'refusal' && typeof content.refusal === 'string') {
        return content.refusal.trim() || 'refusal'
      }
    }
  }
  return ''
}

/**
 * Cliente puro para una petición OpenAI Responses API con Structured Outputs.
 *
 * No lee variables de entorno, no escribe logs ni activa OpenAI por sí mismo.
 * El proveedor efectivo sigue decidiéndose fuera de este adaptador.
 */
export async function requestOpenAiStructuredOutput({
  apiKey,
  model,
  messages,
  schema,
  schemaName = 'evo_structured_output',
  system,
  maxTokens = 5_500,
  timeoutMs = OPENAI_STRUCTURED_DEFAULT_TIMEOUT_MS,
  fetchImpl = globalThis.fetch,
  signal,
  parseOutput = JSON.parse,
}) {
  assertRequestInput({ apiKey, model, messages, schema, fetchImpl })

  const boundedTimeoutMs = normalizeOpenAiStructuredTimeoutMs(timeoutMs)
  if (signal?.aborted) {
    throw new OpenAiStructuredRequestError('La petición a OpenAI fue cancelada.', {
      code: OPENAI_STRUCTURED_ERROR_CODES.ABORTED,
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

  if (signal) signal.addEventListener('abort', abortFromCaller, { once: true })
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
      fetchImpl('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${String(apiKey).trim()}`,
        },
        body: JSON.stringify({
          model: String(model).trim(),
          input: buildInput(system, messages),
          max_output_tokens: Math.max(1, Math.floor(Number(maxTokens) || 5_500)),
          store: false,
          text: {
            format: {
              type: 'json_schema',
              name: safeSchemaName(schemaName),
              strict: true,
              schema,
            },
          },
        }),
        signal: controller.signal,
      }),
      deadline,
    ])

    providerRequestId = extractOpenAiProviderRequestId(response, null)
    try {
      rawBody = await Promise.race([response.text(), deadline])
      data = rawBody ? JSON.parse(rawBody) : null
    } catch (cause) {
      if (timedOut || externallyAborted || signal?.aborted) throw cause
      throw new OpenAiStructuredRequestError(
        'OpenAI devolvió un cuerpo HTTP que no es JSON válido.',
        {
          code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_PROVIDER_BODY,
          status: Number(response?.status) >= 400 ? Number(response.status) : 502,
          providerRequestId,
          retriable: false,
          cause,
          details: { preview: String(rawBody || '').slice(0, 200) },
        },
      )
    }

    providerRequestId = extractOpenAiProviderRequestId(response, data)
    if (!response?.ok) {
      const status = Number(response?.status) || 502
      throw new OpenAiStructuredRequestError(providerErrorMessage(data, status), {
        code: OPENAI_STRUCTURED_ERROR_CODES.PROVIDER_HTTP,
        status,
        providerRequestId,
        retriable: RETRIABLE_PROVIDER_STATUSES.has(status),
        details: {
          providerType: typeof data?.error?.type === 'string' ? data.error.type : null,
        },
      })
    }

    const refusal = extractRefusal(data)
    if (refusal) {
      throw new OpenAiStructuredRequestError('OpenAI rechazó generar la salida solicitada.', {
        code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
        status: 422,
        providerRequestId,
        retriable: false,
        details: { providerType: 'refusal' },
      })
    }

    const assistantText = extractOutputText(data)
    if (!assistantText) {
      throw new OpenAiStructuredRequestError(
        'OpenAI no devolvió ningún bloque de texto estructurado.',
        {
          code: OPENAI_STRUCTURED_ERROR_CODES.EMPTY_TEXT,
          status: 502,
          providerRequestId,
          retriable: data?.status === 'incomplete',
          details: {
            providerType: data?.incomplete_details?.reason || data?.status || null,
          },
        },
      )
    }

    let output
    try {
      output = parseOutput(assistantText)
    } catch (cause) {
      throw new OpenAiStructuredRequestError(
        'El texto de Structured Outputs no contiene JSON válido.',
        {
          code: OPENAI_STRUCTURED_ERROR_CODES.INVALID_OUTPUT,
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
      stopReason: data?.incomplete_details?.reason || data?.status || null,
    }
  } catch (error) {
    if (isOpenAiStructuredRequestError(error)) throw error
    if (timedOut) {
      throw new OpenAiStructuredRequestError(
        `OpenAI no respondió en ${boundedTimeoutMs} ms.`,
        {
          code: OPENAI_STRUCTURED_ERROR_CODES.TIMEOUT,
          status: 504,
          providerRequestId,
          retriable: true,
          cause: error,
          details: { timeoutMs: boundedTimeoutMs },
        },
      )
    }
    if (externallyAborted || signal?.aborted) {
      throw new OpenAiStructuredRequestError('La petición a OpenAI fue cancelada.', {
        code: OPENAI_STRUCTURED_ERROR_CODES.ABORTED,
        status: 499,
        providerRequestId,
        retriable: false,
        cause: error,
      })
    }
    throw new OpenAiStructuredRequestError(
      error?.message || 'No se pudo contactar con OpenAI.',
      {
        code: OPENAI_STRUCTURED_ERROR_CODES.NETWORK,
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
