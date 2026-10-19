#!/usr/bin/env bun
/**
 * Grant allowlist agreement. Each role allowlist is hand-written in several SQL files that must
 * stand alone: check-grants.sql is pasted into prod, and each migration applies by itself.
 * This reads every copy and fails when two disagree. It never writes SQL.
 */

import { readFile } from 'fs/promises'
import { join } from 'path'

import { seedScriptFiles } from './generate-seed.ts'

const read = async (path: string) =>
  (await readFile(join(import.meta.dir, path), 'utf-8')).replace(/--[^\n]*/g, '')

/** Names in the first capture group of `re`. A missing anchor or an empty list throws. */
function names(label: string, text: string, re: RegExp, item = /'(\w+)'/g): Set<string> {
  const block = re.exec(text)?.[1] ?? ''
  const out = new Set([...block.matchAll(item)].map((m) => m[1]))
  if (out.size === 0) throw new Error(`${label}: list not found. Update check-grant-allowlists.ts.`)
  return out
}

/** `internal` function names granted to `role` by `grant execute on function internal.x(...)`. */
function internalGrants(label: string, sql: string, role: string): Set<string> {
  const re = /grant execute on function internal\.(\w+)\([^)]*\)\s+to\s+([\w\s,]+);/gi
  const out = new Set<string>()
  for (const [, fn, roles] of sql.matchAll(re)) {
    if (roles.split(',').some((r) => r.trim().toLowerCase() === role)) out.add(fn)
  }
  if (out.size === 0)
    throw new Error(`${label}: no grants found. Update check-grant-allowlists.ts.`)
  return out
}

/** Tables in every `grant select [(cols)] on [table] public.a, ... to <roles incl. anon>`. */
function anonTableGrants(label: string, sql: string): Set<string> {
  const re = /grant\s+select\s+(?:\([^)]*\)\s*)?on\s+(?:table\s+)?([^;]*?)\s+to\s+([^;]+);/gi
  const out = new Set<string>()
  for (const [stmt, targets, roles] of sql.matchAll(re)) {
    if (!roles.split(/[\s,]+/).some((r) => r.toLowerCase() === 'anon')) continue
    const tables = [...targets.matchAll(/public\.(\w+)/gi)].map((m) => m[1])
    // A form this cannot read, such as ON ALL TABLES, must fail, not pass silently.
    if (tables.length === 0) throw new Error(`${label}: cannot read "${stmt}".`)
    for (const t of tables) out.add(t)
  }
  if (out.size === 0)
    throw new Error(`${label}: no grants found. Update check-grant-allowlists.ts.`)
  return out
}

/** `public.users` columns in every `grant select (cols) on [table] public.users to <roles incl. anon>`. */
function anonUsersColumns(label: string, sql: string): Set<string> {
  const re = /grant\s+select\s+\(([^)]*)\)\s*on\s+(?:table\s+)?public\.users\s+to\s+([^;]+);/gi
  const out = new Set<string>()
  for (const [, cols, roles] of sql.matchAll(re)) {
    if (!roles.split(/[\s,]+/).some((r) => r.toLowerCase() === 'anon')) continue
    for (const c of cols.match(/\w+/g) ?? []) out.add(c)
  }
  if (out.size === 0) throw new Error(`${label}: list not found. Update check-grant-allowlists.ts.`)
  return out
}

const arr = (name: string) => new RegExp(String.raw`${name} text\[\] := array\[([^\]]*)\]`, 'i')
const unnest = (schema: string) =>
  new RegExp(String.raw`select '${schema}', unnest\(array\[([^\]]*)\]\)`)

async function main(): Promise<void> {
  const lint = await read('scripts/29-lint-hardening.sql')
  const guard = await read('scripts/check-grants.sql')
  const rls = await read('scripts/13-RLS.sql')
  const m000 = await read('migrations/20261014121000_revoke_internal_helper_execute.sql')
  const m100 = await read(
    'migrations/20261014121100_close_self_gated_and_trigger_function_grants.sql'
  )
  const m200 = await read('migrations/20261014121200_revoke_anon_default_table_privileges.sql')
  const seedFiles = await seedScriptFiles()
  const scripts = (await Promise.all(seedFiles.map((f) => read(`scripts/${f}`)))).join('\n')
  const lint3 = /FROM anon;([\s\S]*?)REVOKE ALL ON public\.admin_users/.exec(lint)?.[1] ?? ''

  const lists = {
    '29 §6 user_facing_names': names('29 §6', lint, arr('user_facing_names')),
    'check-grants public definer arm': names('check-grants public', guard, unnest('public')),
    '121100 signed_in': names('121100 signed_in', m100, arr('signed_in')),
    '121100 service_only': names('121100 service_only', m100, arr('service_only')),
    '29 §3 anon tables': anonTableGrants('29 §3', lint3),
    '121200 grant select': anonTableGrants('121200 grant', m200),
    '121200 read_ok': names('121200 read_ok', m200, arr('read_ok')),
    'check-grants anon_read_ok': names(
      'check-grants anon_read_ok',
      guard,
      /anon_read_ok\(t\) as \(values([\s\S]*?)anon_definer_ok/
    ),
    '29 §3 users columns': anonUsersColumns('29 §3 users', lint3),
    '121200 users columns': anonUsersColumns('121200 users', m200),
    'check-grants hidden columns': names(
      'check-grants hidden',
      guard,
      /from unnest\(array\[([^\]]*)\]\) as c/
    ),
    'scripts internal anon': internalGrants('scripts anon', scripts, 'anon'),
    'scripts internal authenticated': internalGrants(
      'scripts authenticated',
      scripts,
      'authenticated'
    ),
    'scripts internal service_role': internalGrants(
      'scripts service_role',
      scripts,
      'service_role'
    ),
    '121000 anon_ok': names('121000 anon_ok', m000, arr('anon_ok')),
    '121000 authenticated_ok': names('121000 authenticated_ok', m000, arr('authenticated_ok')),
    '121000 service_ok': names('121000 service_ok', m000, arr('service_ok')),
    '13-RLS internal anon': internalGrants('13-RLS anon', rls, 'anon'),
    '13-RLS internal authenticated': internalGrants('13-RLS authenticated', rls, 'authenticated'),
    'check-grants anon_definer_ok': names(
      'check-grants anon_definer_ok',
      guard,
      /anon_definer_ok\([\s\S]*?\) as \(values([\s\S]*?)\)\),/,
      /\('internal', '(\w+)'/g
    ),
    'check-grants internal definer arm': names('check-grants internal', guard, unnest('internal'))
  }
  type List = keyof typeof lists

  const rules: [List, 'equal to' | 'a subset of' | 'disjoint from', List][] = [
    ['29 §6 user_facing_names', 'equal to', 'check-grants public definer arm'],
    // #318 closes only part of §6 on prod; the rest keep their grants.
    ['121100 signed_in', 'a subset of', '29 §6 user_facing_names'],
    ['121100 service_only', 'disjoint from', '29 §6 user_facing_names'],
    ['29 §3 anon tables', 'equal to', '121200 grant select'],
    ['29 §3 anon tables', 'equal to', '121200 read_ok'],
    ['29 §3 anon tables', 'equal to', 'check-grants anon_read_ok'],
    ['29 §3 users columns', 'equal to', '121200 users columns'],
    ['check-grants hidden columns', 'disjoint from', '29 §3 users columns'],
    ['scripts internal anon', 'equal to', '121000 anon_ok'],
    ['scripts internal authenticated', 'equal to', '121000 authenticated_ok'],
    ['scripts internal service_role', 'equal to', '121000 service_ok'],
    // check-grants judges definer helpers only, and 13-RLS grants exactly those.
    ['13-RLS internal anon', 'equal to', 'check-grants anon_definer_ok'],
    ['13-RLS internal authenticated', 'equal to', 'check-grants internal definer arm']
  ]

  const failures: string[] = []
  for (const [left, relation, right] of rules) {
    const a = lists[left]
    const b = lists[right]
    const onlyLeft = [...a].filter((x) => !b.has(x))
    const onlyRight = [...b].filter((x) => !a.has(x))
    const both = [...a].filter((x) => b.has(x))
    const bad =
      relation === 'disjoint from'
        ? both.length > 0
        : onlyLeft.length > 0 || (relation === 'equal to' && onlyRight.length > 0)
    if (!bad) continue
    const detail =
      relation === 'disjoint from'
        ? `in both: ${both}`
        : relation === 'a subset of'
          ? `only left: ${onlyLeft}`
          : `only left: ${onlyLeft}  only right: ${onlyRight}`
    failures.push(`${left} must be ${relation} ${right}\n    ${detail}`)
  }

  if (failures.length > 0) {
    for (const line of failures) console.error(`FAIL  ${line}`)
    console.error(`\n${failures.length} allowlist pair(s) disagree. Change every copy together.`)
    process.exit(1)
  }
  const copies = Object.keys(lists).length
  console.log(`PASS  ${rules.length} allowlist pairs agree across ${copies} copies.`)
}

if (import.meta.main) await main()
