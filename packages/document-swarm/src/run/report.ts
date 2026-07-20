import type { RunOptions, ScriptOutcome, SwarmReportCounters } from '../types.ts'

export function createReportCounters(): SwarmReportCounters {
  return {
    joinsOk: 0,
    joinsFail: 0,
    scriptOk: 0,
    scriptFail: 0,
    chatSent: 0,
    hardFailures: 0
  }
}

/** Folds a Script Outcome into the Swarm Report counters. */
export function foldScriptOutcome(
  report: SwarmReportCounters,
  outcome: ScriptOutcome | void
): void {
  if (!outcome) return
  if (typeof outcome.chatSent === 'number' && outcome.chatSent > 0) {
    report.chatSent += outcome.chatSent
  }
}

// A hard failure is an actor that never joined or hit an unrecoverable error. One
// documented rule for both modes: any hard failure fails the run. Stress uses this
// as its pass/fail signal; per-script hiccups (scriptFail) do not fail the run.
export function reportExitCode(report: SwarmReportCounters): number {
  return report.hardFailures > 0 ? 1 : 0
}

/** End-of-run operator summary — the Swarm Report. */
export function printSwarmReport(
  report: SwarmReportCounters,
  options: RunOptions,
  elapsedMs: number
): void {
  const lines = [
    '',
    '── Swarm Report ─────────────────────',
    `mode         ${options.mode}`,
    `actors       ${options.users}`,
    `elapsed      ${(elapsedMs / 1000).toFixed(1)}s`,
    `joins        ${report.joinsOk} ok / ${report.joinsFail} failed`,
    `scripts      ${report.scriptOk} ok / ${report.scriptFail} failed`,
    `chat sent    ${report.chatSent}`,
    `hard fails   ${report.hardFailures}`,
    `verdict      ${report.hardFailures > 0 ? 'FAIL' : 'PASS'}`,
    '─────────────────────────────────────'
  ]
  console.log(lines.join('\n'))
}
