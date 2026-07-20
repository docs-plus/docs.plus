/**
 * Swarm Target preflight: confirm the target document exists, is public, and is
 * editable before the swarm opens a single browser context against it.
 */

export class SwarmTargetRefusedError extends Error {}

export type SwarmTargetPreflightResult = {
  documentId: string
  slug: string
  isPrivate: boolean
  readOnly: boolean
}

type DocumentsApiResponse = {
  data?: {
    documentId?: string
    isPrivate?: boolean
    readOnly?: boolean
    deletedAt?: string | null
  }
}

function resolveRestApiBase(targetUrl: URL): string {
  const envBase = process.env.SERVER_RESTAPI_URL || process.env.NEXT_PUBLIC_RESTAPI_URL
  if (envBase) return envBase.replace(/\/$/, '')

  // Local dev heuristic: REST runs on :4000, mounted at `/api` (index.ts uses
  // `app.route('/api/documents', …)`). Only used when the env base is unset.
  const hostname = targetUrl.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://${hostname}:4000/api`
  }

  throw new SwarmTargetRefusedError(
    'Could not resolve a REST API base URL for the Swarm Target. Set SERVER_RESTAPI_URL or ' +
      'NEXT_PUBLIC_RESTAPI_URL in the environment.'
  )
}

function extractSlug(targetUrl: URL): string {
  const slug = targetUrl.pathname.split('/').filter(Boolean)[0]
  if (!slug) {
    throw new SwarmTargetRefusedError(
      `Swarm Target URL has no document slug: "${targetUrl.toString()}"`
    )
  }
  return slug
}

/** GETs `{api}/documents/{slug}`; refuses missing, private, read-only, or soft-deleted targets. */
export async function preflightSwarmTarget(rawUrl: string): Promise<SwarmTargetPreflightResult> {
  const targetUrl = new URL(rawUrl)
  const slug = extractSlug(targetUrl)
  const apiBase = resolveRestApiBase(targetUrl)
  const requestUrl = `${apiBase}/documents/${encodeURIComponent(slug)}`

  let response: Response
  try {
    response = await fetch(requestUrl, { headers: { 'Content-Type': 'application/json' } })
  } catch (error) {
    throw new SwarmTargetRefusedError(
      `Network error while preflighting Swarm Target "${slug}" at ${requestUrl}: ` +
        (error instanceof Error ? error.message : String(error))
    )
  }

  if (response.status === 404) {
    throw new SwarmTargetRefusedError(`Swarm Target "${slug}" was not found (404).`)
  }
  if (response.status === 403) {
    throw new SwarmTargetRefusedError(
      `Swarm Target "${slug}" refused access (403) — it may be Private.`
    )
  }
  if (!response.ok) {
    throw new SwarmTargetRefusedError(
      `Swarm Target "${slug}" preflight failed: ${response.status} ${response.statusText}`
    )
  }

  const body = (await response.json()) as DocumentsApiResponse
  const data = body?.data
  if (!data?.documentId) {
    throw new SwarmTargetRefusedError(`Swarm Target "${slug}" preflight returned no document data.`)
  }
  if (data.isPrivate) {
    throw new SwarmTargetRefusedError(
      `Swarm Target "${slug}" is Private — the swarm requires a public document.`
    )
  }
  if (data.readOnly) {
    throw new SwarmTargetRefusedError(
      `Swarm Target "${slug}" is Read-only — the swarm requires an editable document.`
    )
  }
  if (data.deletedAt) {
    throw new SwarmTargetRefusedError(`Swarm Target "${slug}" is soft-deleted.`)
  }

  return {
    documentId: data.documentId,
    slug,
    isPrivate: Boolean(data.isPrivate),
    readOnly: Boolean(data.readOnly)
  }
}
