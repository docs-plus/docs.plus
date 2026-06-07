const TRACKING_PARAM_PREFIXES = ['utm_'] as const
const TRACKING_PARAM_NAMES = new Set([
  '_hsenc',
  'fbclid',
  'gclid',
  'igshid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  'mkt_tok',
  'msclkid',
  'ref_src',
  'ttclid',
  'yclid'
])

const isTrackingParam = (name: string): boolean => {
  if (TRACKING_PARAM_NAMES.has(name)) return true
  return TRACKING_PARAM_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/**
 * Strip known tracking params and normalize cosmetic differences (hostname
 * case, default ports). Returns the input unchanged on parse failure — the
 * SSRF stage immediately after will reject malformed input on its own.
 */
export const canonicalize = (rawUrl: string): string => {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return rawUrl
  }

  const params = parsed.searchParams
  for (const name of [...params.keys()]) {
    if (isTrackingParam(name)) params.delete(name)
  }

  parsed.hostname = parsed.hostname.toLowerCase()

  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = ''
  }

  // WHATWG URL preserves a dangling "?" when searchParams is empty.
  // Strip it so canonical output is collision-free for cache keys.
  return parsed.searchParams.size === 0
    ? parsed.toString().replace(/\?(?=#|$)/, '')
    : parsed.toString()
}
