import type { PrismaClient } from '@prisma/client'
import type { Hono } from 'hono'
import type { Logger } from 'pino'

import { createRouter } from './http/router'

export interface InitDeps {
  prisma: PrismaClient
  logger: Logger
  /**
   * Origin the media route answers on. Without one, imported images are dropped
   * and DOCX export embeds none, since it is also the export fetch allowlist.
   */
  mediaPublicBaseUrl: string | null
}

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => ({ router: createRouter(deps) })
