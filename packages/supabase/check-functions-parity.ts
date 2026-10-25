#!/usr/bin/env bun
/**
 * Script–migration function parity. Fails when a function lives in both trees and its
 * effective scripts/ body differs from its newest migrations/ body. A later DROP is a drop.
 * Migration-only functions print as info: prod-only RPCs and one-shot helpers live there.
 * It also fails when the four Private clauses in scripts/10-0-func-helpers.sql differ.
 */

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'

import { seedScriptFiles } from './generate-seed.ts'

type Definition = { sql: string; alters: string[]; file: string }
/** `schema.name` → its last definition in tree order, or null after a DROP. Overloads share a key. */
type Tree = Map<string, Definition | null>

const DOLLAR_TAG = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/
/** The function body: the first dollar-quoted string, closed by the same tag. */
const DOLLAR_BODY = /(\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$)[\s\S]*?\1/

/** Splits SQL into statements, drops comments, folds whitespace and keyword case. */
function statements(sql: string): string[] {
  const out: string[] = []
  let cur = ''
  let gap = false
  let dollar: string | null = null
  // A space survives only between two word characters, so `f(a, b)` equals `f(a,b)`.
  const push = (text: string) => {
    if (gap && /[\w"'$]$/.test(cur) && /^[\w"'$]/.test(text)) cur += ' '
    cur += text
    gap = false
  }
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]
    const tag = ch === '$' ? DOLLAR_TAG.exec(sql.slice(i, i + 64))?.[0] : undefined
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i)
      i = end === -1 ? sql.length : end - 1
      gap = true
    } else if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      i = end === -1 ? sql.length : end + 1
      gap = true
    } else if (ch === "'" || ch === '"') {
      const escaped = ch === "'" && /[eE]/.test(sql[i - 1] ?? '') && !/\w/.test(sql[i - 2] ?? '')
      let j = i + 1
      while (j < sql.length) {
        if (escaped && sql[j] === '\\') j += 2
        else if (sql[j] === ch && sql[j + 1] === ch) j += 2
        else if (sql[j] === ch) break
        else j++
      }
      push(sql.slice(i, j + 1))
      i = j
    } else if (tag) {
      if (dollar === null) dollar = tag
      else if (dollar === tag) dollar = null
      push(tag)
      i += tag.length - 1
    } else if (ch === ';' && dollar === null) {
      if (cur) out.push(cur)
      cur = ''
      gap = false
    } else if (/\s/.test(ch)) {
      gap = true
    } else {
      push(ch.toLowerCase())
    }
  }
  if (cur) out.push(cur)
  return out
}

const NAME = String.raw`((?:"?\w+"?\.)?"?\w+"?)`
const CREATE_RE = new RegExp(String.raw`^create(?: or replace)? function ${NAME}`)
const ALTER_RE = new RegExp(String.raw`^alter function ${NAME}\s?\(`)
const DROP_RE = /^drop function(?: if exists)? (.+)$/

function keyOf(name: string): string {
  const bare = name.replaceAll('"', '')
  return bare.includes('.') ? bare : `public.${bare}`
}

/** Index of the parenthesis that closes the one opening at `from`, or -1. */
function closeParen(stmt: string, from: number): number {
  let depth = 0
  for (let i = from; i < stmt.length; i++) {
    if (stmt[i] === '(') depth++
    else if (stmt[i] === ')' && --depth === 0) return i
  }
  return -1
}

/** Replays statements in order; CREATE OR REPLACE resets attributes, as Postgres does. */
function replay(tree: Tree, file: string, sql: string): void {
  for (const stmt of statements(sql)) {
    const create = CREATE_RE.exec(stmt)
    if (create) {
      const key = keyOf(create[1])
      const normalised = `create function ${key}${stmt.slice(create[0].length)}`
      tree.set(key, { sql: normalised, alters: [], file })
      continue
    }
    const alter = ALTER_RE.exec(stmt)
    if (alter) {
      const def = tree.get(keyOf(alter[1]))
      const close = closeParen(stmt, alter[0].length - 1)
      if (def) def.alters.push(close === -1 ? '' : stmt.slice(close + 1).trim())
      continue
    }
    const drop = DROP_RE.exec(stmt)
    if (drop) {
      for (const target of drop[1].split(/,(?![^(]*\))/)) {
        const name = /^"?[\w."]+/.exec(target.trim())?.[0]
        if (name) tree.set(keyOf(name), null)
      }
    }
  }
}

const VALUE = String.raw`(?:'[^']*'|[\w"$]+)`
const ATTR_RE = new RegExp(
  String.raw`\b(?:security (definer|invoker)|set (\w+)(?:=| to )(${VALUE}(?:,${VALUE})*)|language (\w+))`,
  'g'
)

/**
 * Inline `security definer` / `set k=v` / `language x` and the same clauses in a later
 * ALTER FUNCTION are one attribute set, so `create ... security definer` equals
 * `create ...; alter function ... security definer`.
 */
function fingerprint(def: Definition): string {
  const attrs = new Map([['security', 'invoker']])
  const take = (text: string) =>
    text.replace(ATTR_RE, (_, security, key, value, language) => {
      if (security) attrs.set('security', security)
      else if (key) attrs.set(`set ${key}`, value)
      else attrs.set('language', language)
      return ' '
    })
  const open = DOLLAR_BODY.exec(def.sql)
  const head = open
    ? def.sql.slice(0, open.index) + def.sql.slice(open.index + open[0].length)
    : def.sql
  const rest = take(head).replace(/ +/g, ' ').trim()
  // An ALTER clause the regex does not know (`stable`, `cost`, `owner to`) stays in, so it fails loudly.
  const unknown = def.alters
    .map((clause) => take(clause).replace(/ +/g, ' ').trim())
    .filter(Boolean)
  const sorted = [...attrs].sort(([a], [b]) => a.localeCompare(b))
  return [rest, open?.[0] ?? '', ...sorted.map(([k, v]) => `${k}=${v}`), ...unknown].join('\n')
}

/**
 * The four copies of the Private `document_access` clause (10-0-func-helpers.sql), with the
 * document and user expressions each copy uses. A drift opens Private chat to non-owners.
 */
const PRIVATE_COPIES: [string, string, string][] = [
  ['internal.can_open_document', 'p_document_id', 'p_user_id'],
  ['internal.is_workspace_member', 'p_workspace_id', 'auth.uid()'],
  ['internal.is_channel_member', 'c.workspace_id', 'auth.uid()'],
  ['internal.can_read_channel', 'c.workspace_id', 'auth.uid()']
]
const PRIVATE_OPEN = 'not exists(select 1 from public.document_access da where'

/** Every Private clause in a normalized body, with its document and user expressions masked. */
function privateClauses(sql: string, doc: string, user: string): string[] {
  const out: string[] = []
  for (let i = sql.indexOf(PRIVATE_OPEN); i !== -1; i = sql.indexOf(PRIVATE_OPEN, i + 1)) {
    const close = closeParen(sql, i + 'not exists'.length)
    const block = close === -1 ? sql.slice(i) : sql.slice(i, close + 1)
    out.push(block.replaceAll(doc, '<doc>').replaceAll(user, '<user>'))
  }
  return out
}

/** Failure lines when the four Private clauses are not one identical clause. */
function privateClauseDrift(scripts: Tree): string[] {
  const failures: string[] = []
  const [reference] = PRIVATE_COPIES[0]
  let expected: string | undefined
  for (const [key, doc, user] of PRIVATE_COPIES) {
    const def = scripts.get(key)
    const blocks = def ? privateClauses(def.sql, doc, user) : []
    if (!def) failures.push(`${key} is missing from scripts/`)
    else if (blocks.length !== 1)
      failures.push(`${key} has ${blocks.length} Private clauses, not 1`)
    else if (key === reference) expected = blocks[0]
    else if (expected !== undefined && blocks[0] !== expected)
      failures.push(`${key} differs from ${reference}`)
  }
  return failures
}

async function buildTree(dir: string, files: string[]): Promise<Tree> {
  const tree: Tree = new Map()
  for (const file of files) replay(tree, file, await readFile(join(dir, file), 'utf-8'))
  return tree
}

async function main(): Promise<void> {
  const root = import.meta.dir
  const migrationsDir = join(root, 'migrations')
  const migrationFiles = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort()
  const scripts = await buildTree(join(root, 'scripts'), await seedScriptFiles())
  const migrations = await buildTree(migrationsDir, migrationFiles)

  const drift: string[] = []
  const migrationOnly: string[] = []
  for (const [key, mig] of migrations) {
    const script = scripts.get(key)
    if (!mig) continue
    if (!script) {
      const label = script === null ? 'dropped-in-scripts' : 'migration-only'
      migrationOnly.push(`${label}  ${key}  (${mig.file})`)
      continue
    }
    if (fingerprint(script) !== fingerprint(mig)) {
      drift.push(`${key}\n    script     ${script.file}\n    migration  ${mig.file}`)
    }
  }

  const privateDrift = privateClauseDrift(scripts)

  for (const line of migrationOnly.sort()) console.log(`info  ${line}`)
  if (drift.length > 0) {
    for (const line of drift.sort()) console.error(`FAIL  drift  ${line}`)
    console.error(`\n${drift.length} function(s) differ. Mirror the newest migration in scripts/.`)
  }
  if (privateDrift.length > 0) {
    for (const line of privateDrift) console.error(`FAIL  private-clause  ${line}`)
    console.error('\nKeep the four Private clauses in 10-0-func-helpers.sql identical.')
  }
  if (drift.length > 0 || privateDrift.length > 0) process.exit(1)
  const shared = [...migrations].filter(([key, mig]) => mig && scripts.get(key)).length
  console.log(`PASS  ${shared} shared functions match their newest migration.`)
  console.log(`PASS  ${PRIVATE_COPIES.length} Private clauses match.`)
}

if (import.meta.main) await main()
