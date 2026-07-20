import { type BrowserContext, chromium } from 'playwright'

import { loadActors } from '../actors/loadActors.ts'
import { applyActorSession } from '../actors/sessionInject.ts'
import { assertAllowedSwarmHost } from '../hostAllowlist.ts'
import { SwarmPadError, waitForPad } from '../pad/waitForPad.ts'
import { assignWriteTarget } from '../pad/writeTarget.ts'
import { preflightSwarmTarget } from '../targetPreflight.ts'
import type { ActorRecord, RunOptions, ScriptContext } from '../types.ts'
import { makeScriptPicker } from './assignScripts.ts'
import {
  createReportCounters,
  foldScriptOutcome,
  printSwarmReport,
  reportExitCode
} from './report.ts'

const FORCE_EXIT_MS = 5000
const SIGINT_EXIT_CODE = 130

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// Pacing between an actor's scripts: Demo reads like a person; Stress keeps the loop tight.
async function pace(page: import('playwright').Page, options: RunOptions): Promise<void> {
  const [min, max] = options.mode === 'demo' ? [1200, 3000] : [150, 500]
  await page.waitForTimeout(min + Math.floor(Math.random() * (max - min)))
}

/**
 * Runs a Swarm Run: gate the host/target, load actors, launch Chromium, ramp one
 * isolated context per actor, loop assigned Swarm Scripts until duration/Ctrl+C, then
 * print the Swarm Report. Resolves to the process exit code (130 on interrupt).
 */
export async function runSwarm(options: RunOptions): Promise<number> {
  // Safety gates run before a single browser launches.
  const hostKind = assertAllowedSwarmHost(options.url, options.users, options.force)
  const target = await preflightSwarmTarget(options.url)
  const actors = await loadActors(options.actorsFile, options.users)

  const report = createReportCounters()
  const startedAt = Date.now()

  // We own signal handling (Playwright's own handlers are disabled) so the first
  // Ctrl+C closes the browser immediately instead of racing a second handler.
  const browser = await chromium.launch({
    headless: !options.headed,
    handleSIGINT: false,
    handleSIGTERM: false,
    handleSIGHUP: false
  })

  let closed = false
  const closeBrowser = async (): Promise<void> => {
    if (closed) return
    closed = true
    await browser.close().catch(() => {})
  }

  let stopped = false
  let interrupted = false
  const stop = (): void => {
    stopped = true
  }

  // First signal: stop and close the browser NOW so in-flight actions reject and the
  // loops unwind (a graceful drain can hang on a stuck wait). Second signal or a 5s
  // timeout: hard-exit so a wedged run always dies.
  const onSignal = (signal: NodeJS.Signals): void => {
    if (interrupted) process.exit(SIGINT_EXIT_CODE)
    interrupted = true
    stopped = true
    console.log(`\nStopping swarm (${signal}) — closing browser…`)
    void closeBrowser()
    setTimeout(() => process.exit(SIGINT_EXIT_CODE), FORCE_EXIT_MS).unref()
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  const durationTimer = options.durationMs !== null ? setTimeout(stop, options.durationMs) : null

  const runActor = async (actor: ActorRecord, index: number): Promise<void> => {
    // Ramp: consecutive actors join `rampMs` apart so presence builds up, not all at once.
    await new Promise((resolve) => setTimeout(resolve, index * options.rampMs))
    if (stopped) return

    let context: BrowserContext | null = null
    try {
      context = await browser.newContext()
      await applyActorSession(context, actor, options.url)
      const page = await context.newPage()
      await page.goto(options.url, { waitUntil: 'domcontentloaded' })
      await waitForPad(page)
      report.joinsOk += 1

      const pickScript = makeScriptPicker(options, index)
      const writeTarget = assignWriteTarget(actor, options.contention)

      while (!stopped) {
        const script = pickScript()
        const ctx: ScriptContext = { page, actor, writeTarget }
        try {
          const outcome = await script.run(ctx)
          report.scriptOk += 1
          foldScriptOutcome(report, outcome)
        } catch (error) {
          if (stopped) break // teardown aborted the action — not a real failure
          report.scriptFail += 1
          console.warn(`[${actor.displayName}] script "${script.name}" failed: ${errMsg(error)}`)
        }
        if (stopped) break
        await pace(page, options)
      }
    } catch (error) {
      // A teardown-triggered abort (browser closed) is not a hard failure.
      if (!stopped) {
        report.joinsFail += 1
        report.hardFailures += 1
        const kind = error instanceof SwarmPadError ? 'pad' : 'join'
        console.error(`[${actor.displayName}] ${kind} failure: ${errMsg(error)}`)
      }
    } finally {
      await context?.close().catch(() => {})
    }
  }

  const window =
    options.durationMs === null
      ? 'until-stopped (Ctrl+C)'
      : `${Math.round(options.durationMs / 1000)}s`
  console.log(
    `Swarm ${options.mode} → "${target.slug}" (${hostKind}) — ${actors.length} actor(s), ` +
      `contention ${options.contention}${options.shuffle ? ', shuffle' : ''}, ${window}`
  )

  try {
    await Promise.all(actors.map((actor, index) => runActor(actor, index)))
  } finally {
    if (durationTimer) clearTimeout(durationTimer)
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    await closeBrowser()
  }

  printSwarmReport(report, options, Date.now() - startedAt)
  return interrupted ? SIGINT_EXIT_CODE : reportExitCode(report)
}
