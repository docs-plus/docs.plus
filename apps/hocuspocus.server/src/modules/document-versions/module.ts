import type { Hono } from 'hono'

import { createInternalApp } from './http/internalApp'
import { createRouter } from './http/router'
import { createVersionOps } from './infra/versionOps'
import { createWsVersionsClient } from './infra/wsVersionsClient'
import type { InitDeps, InitWsOpsDeps, VersionOps } from './types'

export interface InitResult {
  router: Hono
}

export interface InitWsOpsResult {
  app: Hono
  /** Also handed to the stateless WS handler, which drives the ops in-process. */
  ops: VersionOps
}

export const init = (deps: InitDeps): InitResult => {
  const wsVersions = createWsVersionsClient({
    baseUrl: deps.wsOpsBaseUrl,
    serviceRoleKey: deps.serviceRoleKey,
    logger: deps.logger
  })

  return {
    router: createRouter({
      prisma: deps.prisma,
      logger: deps.logger,
      verifyServiceRole: deps.verifyServiceRole,
      getOwnerProfiles: deps.getOwnerProfiles,
      wsVersions
    })
  }
}

/**
 * Checkpoints and restores have to run where the live Y.Doc is. The
 * stateless history op calls the same `ops` directly.
 */
export const initWsOps = (deps: InitWsOpsDeps): InitWsOpsResult => {
  const ops = createVersionOps({
    hocuspocus: deps.hocuspocus,
    prisma: deps.prisma,
    logger: deps.logger
  })

  return {
    app: createInternalApp({ verifyServiceRole: deps.verifyServiceRole, ops, logger: deps.logger }),
    ops
  }
}
