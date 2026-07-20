import type { Contention, RunOptions, SwarmMode } from './types.ts'

export type ProvisionOptions = {
  count: number
  actorsFile: string
  force: boolean
}

const DEFAULT_ACTORS_FILE = 'actors.json'
const DEFAULT_PROVISION_COUNT = 20
const DEFAULT_RUN_USERS = 5
const DEFAULT_RAMP_MS = 1000
const DEFAULT_STRESS_DURATION_MS = 5 * 60 * 1000

const DURATION_UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000
}

function readFlag(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(`--${name}`)
  return index === -1 ? undefined : argv[index + 1]
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`)
}

function parsePositiveInt(raw: string | undefined, flagName: string, fallback: number): number {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`--${flagName} must be a positive integer, got "${raw}"`)
  }
  return value
}

/** Parses durations like `5m`, `30s`, `1h`, or a bare millisecond count. */
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(ms|s|m|h)?$/.exec(value.trim())
  if (!match)
    throw new Error(`Invalid duration value: "${value}" (expected e.g. "5m", "30s", "1h")`)
  const amount = Number(match[1])
  const unit = match[2] ?? 'ms'
  return amount * DURATION_UNIT_MS[unit]
}

export function parseProvisionOptions(argv: string[]): ProvisionOptions {
  return {
    count: parsePositiveInt(readFlag(argv, 'count'), 'count', DEFAULT_PROVISION_COUNT),
    actorsFile: readFlag(argv, 'actors-file') ?? DEFAULT_ACTORS_FILE,
    force: hasFlag(argv, 'force')
  }
}

function parseSwarmMode(argv: string[]): SwarmMode {
  const mode = readFlag(argv, 'mode') ?? 'demo'
  if (mode !== 'demo' && mode !== 'stress') {
    throw new Error(`--mode must be "demo" or "stress", got "${mode}"`)
  }
  return mode
}

function parseContention(argv: string[], mode: SwarmMode): Contention {
  const contention = readFlag(argv, 'contention') ?? (mode === 'demo' ? 'low' : 'high')
  if (contention !== 'low' && contention !== 'high') {
    throw new Error(`--contention must be "low" or "high", got "${contention}"`)
  }
  return contention
}

function parseDurationOption(argv: string[], mode: SwarmMode): number | null {
  if (hasFlag(argv, 'until-stopped')) return null

  const durationFlag = readFlag(argv, 'duration')
  if (durationFlag) return parseDurationMs(durationFlag)

  // Demo defaults until-stopped; Stress defaults to a bounded run.
  return mode === 'demo' ? null : DEFAULT_STRESS_DURATION_MS
}

function parseHeaded(argv: string[], mode: SwarmMode): boolean {
  if (hasFlag(argv, 'headed')) return true
  if (hasFlag(argv, 'headless')) return false
  // Demo defaults headed (watchable); Stress defaults headless.
  return mode === 'demo'
}

export function parseRunOptions(argv: string[]): RunOptions {
  const mode = parseSwarmMode(argv)

  const url = readFlag(argv, 'url')
  if (!url) throw new Error('--url is required (the Swarm Target URL)')

  return {
    mode,
    users: parsePositiveInt(readFlag(argv, 'users'), 'users', DEFAULT_RUN_USERS),
    url,
    durationMs: parseDurationOption(argv, mode),
    shuffle: hasFlag(argv, 'shuffle'),
    contention: parseContention(argv, mode),
    force: hasFlag(argv, 'force'),
    headed: parseHeaded(argv, mode),
    rampMs: parsePositiveInt(readFlag(argv, 'ramp'), 'ramp', DEFAULT_RAMP_MS),
    actorsFile: readFlag(argv, 'actors-file') ?? DEFAULT_ACTORS_FILE
  }
}
