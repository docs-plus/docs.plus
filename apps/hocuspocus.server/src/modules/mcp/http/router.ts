import { createMcpHandler, type McpServerFactory } from '@modelcontextprotocol/server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'

import { fail } from '../../../http/envelope'
import {
  createAuthenticate,
  createMetadataHandler,
  createOriginGate,
  createTransportHandler,
  type EndpointDeps,
  RESOURCE_METADATA_PATH
} from './controller'

// A tool's Markdown is capped at 64 KiB chars; UTF-8 and JSON escaping stay well
// inside 1 MiB. Without a cap, Bun buffers up to its 128 MiB default.
const MAX_MCP_BODY_BYTES = 1024 * 1024

export interface RouterDeps extends EndpointDeps {
  factory: McpServerFactory
}

export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  // Built per init, not per module: the handler holds no transport, and the
  // factory builds a fresh server and transport for every request.
  const handler = createMcpHandler(deps.factory)

  router.get(RESOURCE_METADATA_PATH, createMetadataHandler(deps))
  router.on(
    ['POST', 'GET', 'DELETE'],
    '/',
    createOriginGate(deps),
    bodyLimit({
      maxSize: MAX_MCP_BODY_BYTES,
      onError: (c) => fail(c, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
    }),
    createTransportHandler(createAuthenticate(deps), handler)
  )
  return router
}
