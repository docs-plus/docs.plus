#!/usr/bin/env bun
/** Protect this checkout's .next output while allowing servers in other clones. */
import { $ } from 'bun'
import { realpathSync } from 'fs'
import { resolve, sep } from 'path'

async function processDirectory(pid: number): Promise<string | null> {
  try {
    if (process.platform === 'linux') return realpathSync(`/proc/${pid}/cwd`)
    const result = await $`lsof -a -p ${pid} -d cwd -Fn`.quiet().nothrow()
    const directory = result.stdout
      .toString()
      .split('\n')
      .find((line) => line.startsWith('n'))
    return directory ? realpathSync(directory.slice(1)) : null
  } catch {
    // The process may exit between ps and this lookup. The caller verifies that case.
    return null
  }
}

export async function nextServerConflict(
  root = resolve(import.meta.dir, '..')
): Promise<string | null> {
  const canonicalRoot = realpathSync(root)
  const processes = await $`ps -ax -o pid=,command=`.quiet().nothrow()
  if (processes.exitCode !== 0) return 'Cannot inspect running Next servers safely'

  for (const line of processes.stdout.toString().split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/)
    if (!match) continue
    const launch = match[2].match(/\bnext\s+(dev|start)\b(.*)$/)
    if (!launch) continue
    const pid = Number(match[1])
    const directory = await processDirectory(pid)
    if (directory === canonicalRoot || directory?.startsWith(`${canonicalRoot}${sep}`)) {
      return `Next server ${pid} is using this checkout; stop it before building its .next output`
    }
    // Also cover `next dev /absolute/app/path` launched from another directory.
    if (
      [root, canonicalRoot].some((path) => {
        const escaped = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        return new RegExp(`${escaped}(?:[/\\s"']|$)`).test(match[2])
      })
    ) {
      return `Next server ${pid} references this checkout; stop it before building its .next output`
    }
    if (!directory) {
      const alive = await $`ps -p ${pid} -o pid=`.quiet().nothrow()
      if (alive.exitCode === 0) return `Cannot determine the checkout used by Next server ${pid}`
      continue
    }
    // Next accepts a positional app directory relative to the launcher's cwd.
    // ps renders argv as text; unknown/ambiguous positional paths fail closed.
    const args = launch[2].match(/"[^"]*"|'[^']*'|\S+/g) ?? []
    const optionsWithValue = new Set([
      '-p',
      '--port',
      '-H',
      '--hostname',
      '--keepAliveTimeout',
      '--experimental-https-key',
      '--experimental-https-cert',
      '--experimental-https-ca',
      '--experimental-upload-trace'
    ])
    let positionalOnly = false
    const directories: string[] = []
    for (let index = 0; index < args.length; index++) {
      const argument = args[index].replace(/^(["'])(.*)\1$/, '$2')
      if (!positionalOnly && argument === '--') {
        positionalOnly = true
        continue
      }
      if (!positionalOnly && optionsWithValue.has(argument)) {
        index++
        continue
      }
      if (!positionalOnly && argument.startsWith('-')) continue
      directories.push(argument)
    }
    if (directories.length > 1)
      return `Cannot resolve ambiguous app arguments for Next server ${pid}`
    for (const argument of directories) {
      let appDirectory: string
      try {
        appDirectory = realpathSync(resolve(directory, argument))
      } catch {
        return `Cannot resolve the app directory used by Next server ${pid}`
      }
      if (appDirectory === canonicalRoot || appDirectory.startsWith(`${canonicalRoot}${sep}`)) {
        return `Next server ${pid} targets this checkout; stop it before building its .next output`
      }
    }
  }
  return null
}

if (import.meta.main) {
  const conflict = await nextServerConflict()
  if (conflict) {
    console.error(conflict)
    process.exit(1)
  }
}
