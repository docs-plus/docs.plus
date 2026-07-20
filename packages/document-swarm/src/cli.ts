#!/usr/bin/env bun
import { provision } from './actors/provision.ts'
import { parseProvisionOptions, parseRunOptions } from './config.ts'
import { runSwarm } from './run/orchestrator.ts'

const USAGE = `document-swarm — seeded multi-actor bot for docs.plus pads (local/stage only)

Usage:
  document-swarm provision [--count <n>] [--actors-file <path>] [--force]
  document-swarm run --url <doc-url> [--mode demo|stress] [--users <n>]
                     [--duration <5m|30s|1h>] [--until-stopped]
                     [--contention low|high] [--shuffle]
                     [--headed|--headless] [--ramp <ms>] [--actors-file <path>] [--force]

Modes:
  demo    headed, until-stopped, low contention (watch a live pad)
  stress  headless, bounded duration, high contention, exit code from Swarm Report

Safety:
  Only local + stage hosts are allowed; production URLs are refused.
  Actor caps: local 20, stage 10 (override with --force).

Env (from ../../.env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, and a REST base (SERVER_RESTAPI_URL / NEXT_PUBLIC_RESTAPI_URL).`

function wantsHelp(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

async function main(argv: string[]): Promise<number> {
  const [subcommand, ...rest] = argv

  if (!subcommand || subcommand === 'help' || wantsHelp([subcommand ?? ''])) {
    console.log(USAGE)
    return subcommand ? 0 : 1
  }

  switch (subcommand) {
    case 'provision':
      if (wantsHelp(rest)) return (console.log(USAGE), 0)
      await provision(parseProvisionOptions(rest))
      return 0
    case 'run':
      if (wantsHelp(rest)) return (console.log(USAGE), 0)
      // runSwarm resolves to its exit code — non-zero when the Swarm Report has hard failures.
      return await runSwarm(parseRunOptions(rest))
    default:
      console.error(`Unknown command: "${subcommand}"\n\n${USAGE}`)
      return 1
  }
}

// Known refusals (host/cap/target/usage) surface as a one-line message + exit 1,
// never a stack trace — this is an operator tool, not a library.
main(process.argv.slice(2))
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
