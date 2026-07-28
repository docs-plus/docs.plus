export interface InternalHopRequest {
  baseUrl: string
  /** Path segments, encoded here so no caller can forget to escape an id. */
  path: string[]
  body: unknown
  serviceRoleKey: string | null
  requestId?: string
  timeoutMs: number
}

/**
 * `ok` is a completed round trip at any status, not a successful operation —
 * every hop maps status to its own outcome vocabulary.
 */
export type InternalHopResult =
  { ok: true; status: number; body: unknown } | { ok: false; url: string; error: unknown }

/**
 * POST JSON from the REST process to the WS process's internal listener.
 * Transport hygiene only: bearer, timeout, request-id forwarding and an
 * always-drained body. Status mapping and logging stay with the caller, which
 * knows what a 404 or a 422 means for its own operation.
 */
export const internalHop = async (request: InternalHopRequest): Promise<InternalHopResult> => {
  const base = request.baseUrl.replace(/\/+$/, '')
  const url = `${base}/${request.path.map(encodeURIComponent).join('/')}`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${request.serviceRoleKey ?? ''}`,
        ...(request.requestId ? { 'x-request-id': request.requestId } : {})
      },
      body: JSON.stringify(request.body),
      signal: AbortSignal.timeout(request.timeoutMs)
    })
  } catch (error) {
    return { ok: false, url, error }
  }

  // Drain before branching, always: a bodyLimit 413 is not JSON, and an
  // unconsumed body holds the keep-alive socket out of the pool under a storm.
  const raw = await response.text().catch(() => '')
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    body = undefined
  }

  return { ok: true, status: response.status, body }
}
