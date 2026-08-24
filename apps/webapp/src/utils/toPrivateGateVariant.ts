export type PrivateGateVariant = 'sign-in-required' | 'access-denied' | 'check-unavailable'

/** A degraded backend answers 503 `AUTH_UNAVAILABLE`; a Traefik 503 carries no code. */
export function isAuthUnavailable(args: { status?: number; code?: string }): boolean {
  return args.status === 503 && args.code === 'AUTH_UNAVAILABLE'
}

export function toPrivateGateVariant(args: {
  access?: string | null
  status?: number
  code?: string
  hasSession: boolean
}): PrivateGateVariant {
  // A degraded backend never decided access, and the caller always had a session, so a
  // sign-in CTA would be dead. Its own variant is the only honest answer.
  if (isAuthUnavailable(args)) return 'check-unavailable'
  if (args.access === 'denied') return 'access-denied'
  if (args.access === 'sign-in-required') return 'sign-in-required'
  return args.hasSession ? 'access-denied' : 'sign-in-required'
}
