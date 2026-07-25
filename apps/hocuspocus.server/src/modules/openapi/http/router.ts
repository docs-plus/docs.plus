import { Hono } from 'hono'

import type { OpenApiDocument } from '../types'
import { renderSwaggerUiPage } from './swaggerUi'

export const SPEC_PATH = '/openapi.json'
export const DOCS_PATH = '/docs'

export interface RouterDeps {
  document: OpenApiDocument
}

export const createRouter = (deps: RouterDeps): Hono => {
  const router = new Hono()
  // Serialized once: the document is immutable for the process lifetime, and
  // this also sidesteps `c.json`'s structural JSON constraint on the interface.
  const specBody = JSON.stringify(deps.document)
  const page = renderSwaggerUiPage(SPEC_PATH)

  router.get(SPEC_PATH, (c) =>
    c.body(specBody, 200, { 'Content-Type': 'application/json; charset=utf-8' })
  )
  router.get(DOCS_PATH, (c) => c.html(page))

  return router
}
