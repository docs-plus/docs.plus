/**
 * Drives browser.ts in headless Chrome for Testing build 1254 through Playwright, one session per call.
 * Usage: NODE_ENV=production bun scripts/bench/drive.ts --label s1 --out <dir> [--ref main] [--runs 9]
 * Writes <out>/<label>.json: the browser.ts result plus a `drive` record (browser, load, times).
 */
/* eslint-disable no-console -- a CLI that prints its report */
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    ref: { type: 'string', default: 'main' },
    runs: { type: 'string', default: '9' },
    label: { type: 'string' },
    out: { type: 'string' }
  }
})
if (!values.label || !values.out) throw new Error('Pass --label <name> and --out <dir>.')

const PKG = join(import.meta.dir, '../..')
// Pinned, so a browser auto-update never changes a series. System Chrome is never used.
const CHROME = join(
  homedir(),
  'Library/Caches/ms-playwright/chromium-1254/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'
)
const PLAYWRIGHT = join(
  PKG,
  '../../node_modules/.bun/playwright@1.64.1/node_modules/playwright/index.mjs'
)
for (const path of [CHROME, PLAYWRIGHT]) if (!existsSync(path)) throw new Error(`Missing ${path}`)
const PAGE = 'http://127.0.0.1:5199'
const TIMEOUT_MS = 30 * 60_000

const sh = (command: string) => Bun.spawnSync(['sh', '-c', command]).stdout.toString().trim()
const loadAverage = () => sh('sysctl -n vm.loadavg')
if (sh('lsof -nP -iTCP:5199 -sTCP:LISTEN || true')) throw new Error('Port 5199 is busy.')

const out = resolve(values.out)
mkdirSync(out, { recursive: true })
const save = join(out, `${values.label}.json`)
const drive: Record<string, unknown> = {
  label: values.label,
  startedAt: new Date().toISOString(),
  loadAverageAtStart: loadAverage()
}

const bench = Bun.spawn(
  ['bun', 'scripts/bench/browser.ts', '--ref', values.ref!, '--runs', values.runs!, '--save', save],
  { cwd: PKG, env: { ...process.env, NODE_ENV: 'production' }, stdout: 'pipe', stderr: 'inherit' }
)
process.on('exit', () => bench.kill())
let stdout = ''
const ready = new Promise<void>((done, fail) => {
  ;(async () => {
    const decoder = new TextDecoder()
    for await (const chunk of bench.stdout) {
      stdout += decoder.decode(chunk)
      if (stdout.includes(`Open ${PAGE}`)) done()
    }
  })()
  bench.exited.then(() => fail(new Error(`browser.ts exited early:\n${stdout}`)))
})
await ready
drive.buildDoneAt = new Date().toISOString()

const { chromium } = await import(PLAYWRIGHT)
const browser = await chromium.launch({ headless: true, executablePath: CHROME })
drive.browserVersion = browser.version()
const page = await browser.newPage()
const pageErrors: string[] = []
page.on('pageerror', (error: Error) => pageErrors.push(String(error)))
await page.goto(PAGE, { waitUntil: 'domcontentloaded' })
drive.navigatedAt = new Date().toISOString()
await page.waitForFunction(
  () => /^(done|error)/.test(document.getElementById('status')?.textContent ?? ''),
  null,
  { polling: 1000, timeout: TIMEOUT_MS }
)
const status = await page.evaluate(() => document.getElementById('status')?.textContent)
await browser.close()
if (!status?.startsWith('done')) throw new Error(`Page ended with "${status}": ${pageErrors}`)
if ((await bench.exited) !== 0) throw new Error('browser.ts failed.')

drive.endedAt = new Date().toISOString()
drive.loadAverageAtEnd = loadAverage()
drive.pageErrors = pageErrors
const result = await Bun.file(save).json()
await Bun.write(save, JSON.stringify({ ...result, drive }, null, 1))
console.log(stdout)
console.log(`Saved ${save}`)
