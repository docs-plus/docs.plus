import type { Page } from 'playwright'

export type SwarmMode = 'demo' | 'stress'
export type Contention = 'low' | 'high'
export type SwarmScriptName = 'prose' | 'task-list' | 'academy' | 'chat'

export type ActorRecord = {
  email: string
  password: string
  userId: string
  displayName: string
}

export type RunOptions = {
  mode: SwarmMode
  users: number
  url: string
  durationMs: number | null // null ⇒ until-stopped
  shuffle: boolean
  contention: Contention
  force: boolean
  headed: boolean
  rampMs: number
  actorsFile: string
}

/**
 * Opaque Write Target handle. Constructed only via `assignWriteTarget`; scripts call
 * `openWriteTarget` and never read heading labels or Contention.
 */
export type WriteTarget = {
  readonly __brand: 'WriteTarget'
}

/** Per-turn handle for a Swarm Script — no RunOptions, report, or heading labels. */
export type ScriptContext = {
  page: Page
  actor: ActorRecord
  writeTarget: WriteTarget
}

/** Counters a script may return; the Swarm Run folds them into the Swarm Report. */
export type ScriptOutcome = {
  chatSent?: number
}

export type SwarmScript = {
  name: SwarmScriptName
  run: (ctx: ScriptContext) => Promise<ScriptOutcome | void>
}

export type SwarmReportCounters = {
  joinsOk: number
  joinsFail: number
  scriptOk: number
  scriptFail: number
  chatSent: number
  hardFailures: number
}
