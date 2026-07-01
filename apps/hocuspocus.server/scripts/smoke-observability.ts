/**
 * Manual smoke test for the GlitchTip capture pipeline.
 *
 * Proves that `captureUnknown` — the funnel every wired site calls
 * (REST/WS/worker process handlers, gateway init, BullMQ worker/queue/DLQ) —
 * reaches GlitchTip end-to-end. Delivery here proves delivery at every site,
 * since they all funnel through this one function.
 *
 * Run against a dev/staging DSN, never production:
 *   GLITCHTIP_DSN=<dev-dsn> bun scripts/smoke-observability.ts
 * Optional GIT_HASH=<sha> / SENTRY_ROLE=<role> verify release + serverName tags.
 * Then open the GlitchTip project and search issues for the printed marker.
 */
async function main() {
  if (!process.env.GLITCHTIP_DSN) {
    console.error(
      'GLITCHTIP_DSN is required.\n' +
        'Run: GLITCHTIP_DSN=<dev-dsn> bun scripts/smoke-observability.ts'
    )
    process.exit(1)
  }

  // Mark these as non-prod, attributable events. instrument.ts defaults
  // environment to 'production' when NODE_ENV is unset — override so smoke
  // runs never land in the production bucket.
  process.env.NODE_ENV ||= 'development'
  process.env.SENTRY_ROLE ||= 'smoke-test'

  // Import AFTER env is set: instrument.ts calls Sentry.init at module load.
  const { captureUnknown, flushObservability } = await import('../src/lib/instrument')

  const marker = `obs-smoke-${new Date().toISOString()}`
  const surfaces = [
    'rest: process handlers + gateway-init .catch (index.ts)',
    'ws: process handlers + shutdown (hocuspocus.server.ts)',
    'worker: uncaughtException/unhandledRejection (hocuspocus.worker.ts)',
    'queue: worker.on(error) + Queue.on(error) + DLQ final attempt (lib/queue.ts)'
  ]

  console.log(
    `\nInit: environment=${process.env.NODE_ENV} serverName=${process.env.SENTRY_ROLE} ` +
      `release=${process.env.GIT_HASH || '(unset)'}`
  )
  console.log(`Marker: ${marker}\n`)

  for (const surface of surfaces) {
    const eventId = captureUnknown(new Error(`[${marker}] ${surface}`))
    console.log(`  captured ${eventId} — ${surface}`)
  }

  const delivered = await flushObservability(5000)
  if (delivered) {
    console.log(`\n✅ Flushed to GlitchTip. Search the project's issues for "${marker}".`)
    process.exit(0)
  }
  console.error(
    '\n❌ flush() timed out — events did NOT reach GlitchTip. Check DSN, network, or ingest.'
  )
  process.exit(1)
}

void main()
