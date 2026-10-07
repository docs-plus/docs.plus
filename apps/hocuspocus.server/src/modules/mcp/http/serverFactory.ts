import type { AuthInfo, McpServerFactory } from '@modelcontextprotocol/server'
import { McpServer } from '@modelcontextprotocol/server'

import { registerChatTools } from '../tools/chatTools'
import { registerDocumentTools } from '../tools/documentTools'
import { createToolContext } from '../tools/toolContext'
import type { Caller, ServerFactoryDeps } from '../types'

// Without it, claude.ai and ChatGPT fell back to a browser, whose session is not the
// person's, so a document made there had another owner.
const INSTRUCTIONS =
  "These tools find, read, create and edit the person's docs.plus documents and their chat, signed in as this person. A browser session is not signed in as them, so a document made there is not theirs. To start a new document, call create_document; the person owns what it makes. To change one, read the section with read_document first, then edit only what must change: replace_text for words inside a paragraph, edit_blocks to insert, replace or remove whole blocks at a numbered position."

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
    const server = new McpServer(
      {
        name: 'docs.plus',
        title: 'docs.plus',
        version: deps.version,
        websiteUrl: deps.appUrl,
        description: 'Find, read, create and edit your docs.plus documents and their chat.'
      },
      {
        instructions: INSTRUCTIONS,
        // The tool set never changes. The SDK default (true) invites a
        // subscriptions/listen stream that would never carry a message.
        capabilities: { tools: { listChanged: false } }
      }
    )
    registerDocumentTools(server, deps, context)
    registerChatTools(server, deps, context)
    return server
  }
