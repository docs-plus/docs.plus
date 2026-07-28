import { isSafeUrl } from '../../../lib/ssrf'

// The predicate is a shared network-safety primitive (push endpoints need it
// too), so it lives in lib/. safeFetch stays here: redirect-hop validation is
// this module's own fetch policy.
export { isSafeUrl }

const MAX_REDIRECT_HOPS = 5

/**
 * SSRF-aware fetch. Validates every redirect hop's Location against
 * `isSafeUrl` before following, so an attacker can't bounce an allowed
 * public URL to a loopback/link-local/metadata host mid-chain. Throws on
 * an unsafe hop or when the hop budget is exhausted; the caller's catch
 * turns that into a stage miss.
 */
export const safeFetch = async (url: string, init: RequestInit): Promise<Response> => {
  let current = url
  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop++) {
    if (!isSafeUrl(current)) throw new Error('SSRF: unsafe redirect target')

    const response = await fetch(current, { ...init, redirect: 'manual' })
    if (response.status < 300 || response.status >= 400) return response

    const location = response.headers.get('location')
    if (!location) return response
    // Drain the redirect response so its socket frees before the next hop.
    await response.body?.cancel().catch(() => {})
    current = new URL(location, current).toString()
  }
  throw new Error('SSRF: too many redirects')
}
