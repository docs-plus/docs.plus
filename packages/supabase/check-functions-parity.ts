#!/usr/bin/env bun
/**
 * Script–migration function parity. Fails when a function lives in both trees and its
 * effective scripts/ body differs from its newest migrations/ body. A later DROP is a drop.
 * Migration-only functions print as info: prod-only RPCs and one-shot helpers live there.
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

/** Text after the balanced parenthesis that opens at `from`. */
function afterParens(stmt: string, from: number): string {
  let depth = 0
  for (let i = from; i < stmt.length; i++) {
    if (stmt[i] === '(') depth++
    else if (stmt[i] === ')' && --depth === 0) return stmt.slice(i + 1).trim()
  }
  return ''
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
      if (def) def.alters.push(afterParens(stmt, alter[0].length - 1))
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

  for (const line of migrationOnly.sort()) console.log(`info  ${line}`)
  if (drift.length > 0) {
    for (const line of drift.sort()) console.error(`FAIL  drift  ${line}`)
    console.error(`\n${drift.length} function(s) differ. Mirror the newest migration in scripts/.`)
    process.exit(1)
  }
  const shared = [...migrations].filter(([key, mig]) => mig && scripts.get(key)).length
  console.log(`PASS  ${shared} shared functions match their newest migration.`)
}

if (import.meta.main) await main()
