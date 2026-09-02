import type { Hono } from 'hono'

import { createComputeDocumentChanges } from './domain/computeDocumentChanges'
import { createRouter } from './http/router'
import type { InitDeps } from './types'

export interface InitResult {
  router: Hono
}

export const init = (deps: InitDeps): InitResult => ({
  router: createRouter({
    compute: createComputeDocumentChanges({
      prisma: deps.prisma,
      logger: deps.logger,
      getOwnerProfiles: deps.getOwnerProfiles
    }),
    logger: deps.logger,
    verifyServiceRole: deps.verifyServiceRole
  })
})
