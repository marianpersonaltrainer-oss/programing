const DEFAULT_HEARTBEAT_MS = 2500

/**
 * Respuesta JSON transmitida con latidos (HTTP 200) para no cortar proxies.
 * El cuerpo final incluye ok/errorStatus; el cliente debe interpretar errorStatus.
 */
export function startJsonStream(res, { requestId, heartbeatMs = DEFAULT_HEARTBEAT_MS } = {}) {
  let heartbeat = null
  let closed = false

  const clearHeartbeat = () => {
    if (heartbeat) {
      clearInterval(heartbeat)
      heartbeat = null
    }
  }

  const closeWith = (payload) => {
    if (closed) return
    closed = true
    clearHeartbeat()
    try {
      res.end(JSON.stringify({ requestId, ...payload }))
    } catch {
      /* cliente cerró */
    }
  }

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
    ...(requestId ? { 'X-Request-Id': requestId } : {}),
  })
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  heartbeat = setInterval(() => {
    try {
      res.write(' ')
    } catch {
      clearHeartbeat()
    }
  }, heartbeatMs)

  return {
    finishSuccess(body) {
      closeWith({ ok: true, ...body })
    },
    finishError(errorStatus, body = {}) {
      closeWith({
        ok: false,
        errorStatus: Number(errorStatus) || 502,
        ...body,
      })
    },
  }
}
