// Sentry 11 sends cookies and request bodies when dataCollection is omitted.
// This object keeps the v10 baseline.
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
    response: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] }
  },
  httpBodies: [] as (
    'incomingRequest' | 'outgoingRequest' | 'incomingResponse' | 'outgoingResponse'
  )[],
  urlQueryParams: { deny: ['forwarded', '-ip', 'remote-', 'via', '-user'] },
  genAI: { inputs: false, outputs: false },
  mcp: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  graphQL: { document: false, variables: false }
}
