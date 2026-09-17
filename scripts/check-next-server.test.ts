import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { nextServerConflict } from './check-next-server'

const fixture = mkdtempSync(join(tmpdir(), 'next-checkout-guard-'))
const checkout = join(fixture, 'repo')
const otherCheckout = join(fixture, 'repo-other')
mkdirSync(checkout)
mkdirSync(otherCheckout)
const probe = join(fixture, 'server-probe.ts')
writeFileSync(probe, 'setInterval(() => {}, 1000)\n')
afterAll(() => rmSync(fixture, { recursive: true, force: true }))

// Real process discovery, without starting Next, binding ports or touching .next.
// Trailing arguments reproduce the command signature inspected by the guard.
async function withServer(
  directory: string,
  check: () => Promise<void>,
  args: string[] = [],
  command: 'dev' | 'start' = 'dev'
) {
  const child = Bun.spawn([process.execPath, probe, 'next', command, ...args], {
    cwd: directory,
    stdout: 'ignore',
    stderr: 'ignore'
  })
  try {
    await check()
  } finally {
    child.kill()
    await child.exited
  }
}

test('blocks a server using this checkout before its output can be rebuilt', async () => {
  await withServer(checkout, async () => {
    expect(await nextServerConflict(checkout)).toContain('using this checkout')
  })
})

test('allows a running server in another clone with a shared path prefix', async () => {
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toBeNull()
  })
})

test('allows an unrelated production server with a keep-alive timeout', async () => {
  await withServer(
    otherCheckout,
    async () => {
      expect(await nextServerConflict(checkout)).toBeNull()
    },
    ['--keepAliveTimeout', '60000'],
    'start'
  )
})

test('blocks a relative checkout target after a keep-alive timeout', async () => {
  await withServer(
    otherCheckout,
    async () => {
      expect(await nextServerConflict(checkout)).toContain('targets this checkout')
    },
    ['--keepAliveTimeout', '60000', '../repo'],
    'start'
  )
})

test('blocks a relative checkout target after --inspect', async () => {
  await withServer(
    otherCheckout,
    async () => {
      expect(await nextServerConflict(checkout)).toContain('targets this checkout')
    },
    ['--inspect', '../repo'],
    'start'
  )
})

test('blocks a server launched from an app subdirectory', async () => {
  const app = join(checkout, 'apps', 'webapp')
  mkdirSync(app, { recursive: true })
  await withServer(app, async () => {
    expect(await nextServerConflict(checkout)).toContain('using this checkout')
  })
})

test('blocks an explicit app path launched from a different checkout', async () => {
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('references this checkout')
  }, [checkout])
})

test('blocks a relative app path launched from another checkout', async () => {
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('targets this checkout')
  }, ['-p', '3211', '../repo/apps/webapp'])
})

test('fails closed when the observed app path cannot be resolved', async () => {
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('Cannot resolve the app directory')
  }, ['../missing-app'])
})

test('blocks an app reached through an absolute symlink alias', async () => {
  const alias = join(fixture, 'alias')
  symlinkSync(checkout, alias)
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('targets this checkout')
  }, [alias])
})

test('resolves dash-prefixed app directories after the option delimiter', async () => {
  symlinkSync(checkout, join(otherCheckout, '-app'))
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('targets this checkout')
  }, ['--', '-app'])
})

test('fails closed on multiple positional app paths in the process listing', async () => {
  mkdirSync(join(otherCheckout, 'first'))
  mkdirSync(join(otherCheckout, 'second'))
  await withServer(otherCheckout, async () => {
    expect(await nextServerConflict(checkout)).toContain('Cannot resolve ambiguous app arguments')
  }, ['first', 'second'])
})
