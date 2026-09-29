import { useQuery } from '@tanstack/react-query'

import { mcpServerUrl } from '../utils/mcpServerUrl'

export type McpServerStatus = 'checking' | 'online' | 'offline' | 'unreachable'

// Never throws: `_app.tsx` reports every query error, and a down server is a state, not a bug.
// It proves only that this browser reached the MCP service, not that sign-in or the database work.
async function probe(): Promise<boolean> {
  try {
    const res = await fetch(`${mcpServerUrl()}/.well-known/oauth-protected-resource`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000)
    })
    if (!res.ok) return false
    const body = await res.json()
    return typeof body?.resource === 'string'
  } catch {
    return false
  }
}

export function useMcpServerStatus(): McpServerStatus {
  const { data, fetchStatus } = useQuery({
    queryKey: ['mcp-server-status'],
    queryFn: probe,
    staleTime: 60_000,
    // Poll only while down, so recovery shows without a reload.
    refetchInterval: (query) => (query.state.data === false ? 30_000 : false)
  })
  if (fetchStatus === 'paused') return 'offline'
  if (data === undefined) return 'checking'
  return data ? 'online' : 'unreachable'
}
