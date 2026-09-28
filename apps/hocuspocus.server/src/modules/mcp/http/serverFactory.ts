import type { AuthInfo, McpServerFactory } from '@modelcontextprotocol/server'
import { McpServer } from '@modelcontextprotocol/server'

import { registerChatTools } from '../tools/chatTools'
import { registerDocumentTools } from '../tools/documentTools'
import { createToolContext } from '../tools/toolContext'
import type { Caller, ServerFactoryDeps } from '../types'

// The SDK hands the factory whatever the route verified. A missing subject is
// a wiring fault, so it fails loudly rather than running a tool as nobody.
const callerFrom = (authInfo: AuthInfo | undefined): Caller => {
  const sub = authInfo?.extra?.sub
  if (!authInfo || typeof sub !== 'string')
    throw new Error('MCP request reached tools unauthenticated')
  const email = authInfo.extra?.email
  return {
    sub,
    email: typeof email === 'string' ? email : undefined,
    isAnonymous: authInfo.extra?.isAnonymous === true,
    clientId: authInfo.clientId
  }
}

/** One fresh server per request, as `createMcpHandler` requires. */
export const createServerFactory =
  (deps: ServerFactoryDeps): McpServerFactory =>
  ({ authInfo }) => {
    const context = createToolContext(deps, callerFrom(authInfo))
    const server = new McpServer({ name: 'docs.plus', version: deps.version })
    registerDocumentTools(server, deps, context)
    registerChatTools(server, deps, context)
    return server
  }
