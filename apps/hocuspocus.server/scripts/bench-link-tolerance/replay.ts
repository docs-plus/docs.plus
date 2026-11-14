/**
 * Applies the current knee, void and A/A rules to saved session lines. Not product code.
 * Usage: bun replay.ts [--pool] <scenario.jsonl> [more.jsonl ...]. Prints one JSON object.
 * Sessions compare only inside one fact group (same bench tree, source, runtime, backend and
 * arm); a mixed group is refused with the facts that differ. --pool rebuilds per-lane
 * quantiles from requests.csv.gz across the sessions of a group, to reach n >= 2000 per lane.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import {
  betweenSessions,
  factKeyOf,
  MIN_N_P95,
  MIN_N_P99,
  pairSummary,
  seriesKnees,
  VOID_RULES_VERSION,
  voidReasonsOf
} from './analysis'

type Any = any
type Session = { file: string; header: Any; steps: Any[]; footer: Any | null }

const readSessions = (path: string): Session[] => {
  const sessions: Session[] = []
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue
    const obj = JSON.parse(line)
    if (obj.type === 'session') sessions.push({ file: path, header: obj, steps: [], footer: null })
    else if (obj.type === 'step') sessions.at(-1)?.steps.push(obj)
    else if (obj.type === 'footer') {
      const current = sessions.at(-1)
      if (current) current.footer = obj
    }
  }
  return sessions
}

/** Re-applies the void rules to steps that carry their inputs; older steps keep their flag. */
const revalidate = (step: Any) => {
  if (step.voidRulesVersion !== VOID_RULES_VERSION)
    return { ...step, revalidated: false, revalidateNote: 'old step format: saved flag kept' }
  const reasons = voidReasonsOf(step)
  return { ...step, valid: reasons.length === 0, voidReasons: reasons, revalidated: true }
}

const sessionView = (x: Session) => {
  const voidReasons = x.footer
    ? [...(x.footer.voidReasons ?? [])]
    : ['no footer: the session did not finish']
  const valid = x.footer?.valid === true && voidReasons.length === 0
  const steps = x.steps.map(revalidate)
  const changed = steps.filter((s, i) => s.revalidated && s.valid !== x.steps[i].valid)
  const series = [...new Set(steps.map((s) => s.series))]
  const ramp = steps.filter((s) => !s.prime)
  return {
    session: x.header.session,
    file: x.file,
    benchTree: x.header.facts?.benchTree,
    redisBackend: x.header.redis?.backend,
    valid,
    voidReasons,
    stepsWhoseValidityChanged: changed.map(
      (s) => `${s.label}: ${s.voidReasons.join('; ') || 'now valid'}`
    ),
    knees: valid
      ? Object.fromEntries(
          series.map((name) => [
            name,
            seriesKnees(
              name,
              steps.filter((s) => s.series === name)
            )
          ])
        )
      : 'session void: knees not read',
    aa: x.header.scenario === 'aa' && ramp.length >= 2 ? pairSummary(ramp[0], ramp[1]) : undefined,
    steps
  }
}

/** Groups by the full fact set; prints how groups differ so nobody pools across them. */
const groupByFacts = (sessions: Session[]) => {
  const groups = new Map<string, { facts: Any; sessions: Session[] }>()
  for (const x of sessions) {
    const facts = factKeyOf(x.header)
    const key = JSON.stringify(facts)
    const g = groups.get(key) ?? { facts, sessions: [] }
    g.sessions.push(x)
    groups.set(key, g)
  }
  return [...groups.values()]
}

const differingFacts = (groups: { facts: Any }[]) => {
  if (groups.length < 2) return []
  return Object.keys(groups[0].facts).filter((k) =>
    groups.some((g) => JSON.stringify(g.facts[k]) !== JSON.stringify(groups[0].facts[k]))
  )
}

/** Per label and lane: in-window latencies pooled across the sessions of one fact group. */
const pooledTails = (sessions: Session[]) => {
  const pools = new Map<string, number[]>()
  for (const x of sessions) {
    for (const step of x.steps) {
      if (!step.valid || step.prime) continue
      const path = join(dirname(x.file), step.files?.requests ?? '')
      if (!step.files?.requests || !existsSync(path)) continue
      const text = new TextDecoder().decode(Bun.gunzipSync(readFileSync(path)))
      const [head, ...rows] = text.trim().split('\n')
      const col = Object.fromEntries(head.split(',').map((c, i) => [c, i]))
      for (const row of rows) {
        const f = row.split(',')
        if (f[col.inWindow] !== '1' || f[col.err] !== '') continue
        const key = `${step.label} | ${f[col.lane]}`
        const list = pools.get(key) ?? []
        list.push(Number(f[col.latencyMs]))
        pools.set(key, list)
      }
    }
  }
  const q = (xs: number[], p: number) => xs[Math.min(xs.length - 1, Math.floor(p * xs.length))]
  return Object.fromEntries(
    [...pools].map(([key, xs]) => {
      xs.sort((a, b) => a - b)
      const metric = xs.length >= MIN_N_P99 ? 'p99' : xs.length >= MIN_N_P95 ? 'p95' : 'p50'
      return [
        key,
        {
          n: xs.length,
          p50: Math.round(q(xs, 0.5) * 100) / 100,
          p95: Math.round(q(xs, 0.95) * 100) / 100,
          p99: Math.round(q(xs, 0.99) * 100) / 100,
          tail: metric === 'p99' ? 'measured' : `not measured (n ${xs.length} < ${MIN_N_P99})`
        }
      ]
    })
  )
}

const argv = process.argv.slice(2)
const pool = argv.includes('--pool')
const files = argv.filter((a) => !a.startsWith('--'))
const sessions = files.flatMap(readSessions)
const groups = groupByFacts(sessions)
console.log(
  JSON.stringify(
    {
      files,
      sessions: sessions.map((x) => {
        const { steps: _steps, ...rest } = sessionView(x)
        return rest
      }),
      factGroups: groups.map((g) => {
        const valid = g.sessions.filter((x) => x.footer?.valid === true)
        return {
          facts: g.facts,
          sessions: g.sessions.map((x) => x.header.session),
          validSessions: valid.map((x) => x.header.session),
          betweenSessions: betweenSessions(
            new Map(valid.map((x) => [String(x.header.session), sessionView(x).steps]))
          ),
          pooledTails: pool ? pooledTails(valid) : undefined
        }
      }),
      // Facts that split the groups: never pool or compare sessions across them.
      mixedFacts: differingFacts(groups)
    },
    null,
    1
  )
)
