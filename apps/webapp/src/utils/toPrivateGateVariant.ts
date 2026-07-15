export type PrivateGateVariant = 'sign-in-required' | 'access-denied'

/** Map REST `access` hint (+ session) to the PrivateDocumentGate CTA variant. */
export function toPrivateGateVariant(args: {
  access?: string | null
  hasSession: boolean
}): PrivateGateVariant {
  if (args.access === 'denied') return 'access-denied'
  if (args.access === 'sign-in-required') return 'sign-in-required'
  return args.hasSession ? 'access-denied' : 'sign-in-required'
}
