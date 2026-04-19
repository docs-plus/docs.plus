# link-metadata module

Self-contained link-unfurling service. Designed as a modular monolith so it can be lifted into a standalone microservice in a same-day mechanical move (see "Future extraction" below).

## Boundary rules (do not violate)

1. **Single bounded folder.** Code, tests, types, infra adapters all live here. Files outside this folder may only import from `./index.ts`.
2. **One public surface.** `index.ts` exports `{ init, type MetadataResponse, type ErrorResponse }`. Nothing else is consumable from outside.
3. **DI at the seam.** Module exports `init({ redis, logger })`. It does not call `getRedisClient()` or read env vars for infra clients.
4. **Framework-free domain.** Files under `domain/` import zero infra SDKs (no `hono`, no `ioredis`, no `metascraper`). `infra/` is the only place SDKs live. Domain↔infra contracts use tiny inline port types declared in `domain/types.ts`.
5. **Stable wire contract.** `http/schema.ts` (request) and `domain/types.ts` `MetadataResponse` / `ErrorResponse` (response) are the published contract. Additive changes only within v1.
6. **No shared mutable state.** No module-level singletons or top-level side effects. Adapters are constructed inside `init()` and held in closure.
7. **Tests live inside the module.** `__tests__/` rides with the folder during extraction.

ESLint enforces parts of rules 1 and 4 via `no-restricted-imports` in `packages/hocuspocus.server/eslint.config.js`.

## Future extraction (not v1 work)

1. `mv packages/hocuspocus.server/src/modules/link-metadata packages/link-metadata-service/src`
2. Copy `metascraper*`, `ioredis`, `hono`, `pino`, `zod` deps into the new package's `package.json`.
3. Add a 10-line `server.ts`:

   ```ts
   import { Hono } from 'hono'
   import Redis from 'ioredis'
   import pino from 'pino'
   import * as linkMetadata from './index'

   const metadata = linkMetadata.init({
     redis: new Redis(process.env.REDIS_URL!),
     logger: pino({ name: 'link-metadata' })
   })

   export default new Hono().route('/api/metadata', metadata.router)
   ```

4. Replace the host's import with the new package name.
5. Deploy as a separate process; route via Traefik path rule.

No domain code changes. No client changes (URL + response shape are identical).
