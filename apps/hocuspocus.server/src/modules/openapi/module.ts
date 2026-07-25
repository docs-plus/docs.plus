import type { Hono } from 'hono'

import { buildOpenApiDocument } from './domain/document'
import { createRouter } from './http/router'
import type { OpenApiServer } from './types'

export interface InitDeps {
  /** `servers` entries. A relative `/` keeps Try-it-out on whichever origin served `/docs`. */
  servers: OpenApiServer[]
  version: string
}

export interface InitResult {
  router: Hono
}

/** Builds the document eagerly so a malformed spec surfaces at wiring time, not on request. */
export const init = (deps: InitDeps): InitResult => ({
  router: createRouter({ document: buildOpenApiDocument(deps) })
})
