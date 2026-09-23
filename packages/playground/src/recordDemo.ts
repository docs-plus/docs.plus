import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { type Browser, chromium, type Page } from 'playwright'

declare global {
  interface Window {
    _editor?: { commands: { setContent(content: string): void } }
    __cursor(x: number, y: number): void
    __cursorPress(down: boolean): void
  }
}

export type Theme = 'light' | 'dark'
export type Marks = Record<string, number>

export interface DemoCursor {
  moveTo(x: number, y: number, steps?: number, stepMs?: number): Promise<void>
  show(): Promise<void>
  down(): Promise<void>
  up(): Promise<void>
  click(): Promise<void>
  dblclick(): Promise<void>
}

export interface DemoContext {
  page: Page
  cursor: DemoCursor
  /** Records a named time on the raw video. `start` and `end` bound the GIF. */
  mark(name: string): void
  sleep(ms: number): Promise<void>
}

export interface RecordDemoOptions {
  /** Playground URL, for example `http://127.0.0.1:5173/`. */
  url: string
  /** Package root; GIFs land in `<packageRoot>/assets/demo-<theme>.gif`. */
  packageRoot: string
  viewportHeight?: number
  /** Force this width/height ratio on the crop, centred on the playground card. */
  aspect?: number
  fps?: number
  colors?: number
  dither?: string
  /** Raw-video seconds to drop, for example a slow loading shell. */
  cut?: (marks: Marks) => [number, number]
  story(ctx: DemoContext): Promise<void>
}

const WIDTH = 900
const PAD = 20
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

// Headless video draws no pointer, so the page gets one the story moves by hand.
const CURSOR_INIT = `window.addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div')
  c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.5 15 L11.5 22 L14.5 20.7 L11.6 14 L17.5 14 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>'
  Object.assign(c.style, { position: 'fixed', left: '0px', top: '0px', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-4px,-2px)', transition: 'transform 80ms', opacity: '0' })
  document.body.appendChild(c)
  window.__cursor = (x, y) => { c.style.opacity = '1'; c.style.left = x + 'px'; c.style.top = y + 'px' }
  window.__cursorPress = (down) => { c.style.transform = down ? 'translate(-4px,-2px) scale(0.85)' : 'translate(-4px,-2px)' }
})`

function makeCursor(page: Page): DemoCursor {
  let pos = { x: WIDTH - 40, y: 40 }
  const paint = (x: number, y: number): Promise<void> =>
    page.evaluate(([a, b]) => window.__cursor(a, b), [x, y])
  const press = (down: boolean): Promise<void> =>
    page.evaluate((d) => window.__cursorPress(d), down)
  return {
    async moveTo(x, y, steps = 12, stepMs = 12) {
      const from = { ...pos }
      for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
        const cx = from.x + (x - from.x) * e
        const cy = from.y + (y - from.y) * e
        await page.mouse.move(cx, cy)
        await paint(cx, cy)
        await sleep(stepMs)
      }
      pos = { x, y }
    },
    show: () => paint(pos.x, pos.y),
    async down() {
      await press(true)
      await page.mouse.down()
    },
    async up() {
      await page.mouse.up()
      await press(false)
    },
    async click() {
      await this.down()
      await sleep(70)
      await this.up()
    },
    dblclick: () => page.mouse.dblclick(pos.x, pos.y)
  }
}

function ffmpeg(args: string[]): void {
  const run = spawnSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' })
  if (run.error)
    throw new Error('ffmpeg not found. Install it, for example with `brew install ffmpeg`.')
  if (run.status !== 0) throw new Error(`ffmpeg exited with ${run.status}`)
}

async function recordTheme(
  browser: Browser,
  theme: Theme,
  opts: RecordDemoOptions,
  work: string
): Promise<void> {
  const height = opts.viewportHeight ?? 540
  const dir = join(work, theme)
  const context = await browser.newContext({
    viewport: { width: WIDTH, height },
    colorScheme: theme,
    recordVideo: { dir, size: { width: WIDTH, height } }
  })
  await context.addInitScript(CURSOR_INIT)
  const page = await context.newPage()
  const t0 = Date.now()
  const marks: Marks = {}
  // The card can grow or shrink during a story, so crop to its box at every mark.
  const boxes: Promise<{ x: number; y: number; w: number; h: number }>[] = []
  const measure = (): void => {
    boxes.push(
      page.evaluate(() => {
        const r = document.querySelector('main')!.getBoundingClientRect()
        return { x: r.x, y: r.y, w: r.width, h: r.height }
      })
    )
  }
  await page.goto(opts.url)
  await page.waitForFunction(() => typeof window._editor === 'object')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => window._editor!.commands.setContent('<p></p>'))
  const mark = (n: string): void => {
    marks[n] = (Date.now() - t0) / 1000
    measure()
  }
  await opts.story({ page, cursor: makeCursor(page), mark, sleep })
  const all = await Promise.all(boxes)
  const top = Math.min(...all.map((r) => r.y))
  const card = {
    x: Math.min(...all.map((r) => r.x)),
    y: top,
    w: Math.max(...all.map((r) => r.x + r.w)) - Math.min(...all.map((r) => r.x)),
    h: Math.max(...all.map((r) => r.y + r.h)) - top
  }
  const video = page.video()!
  await context.close()
  const webm = await video.path()

  if (marks.start == null || marks.end == null)
    throw new Error('The story must mark("start") and mark("end").')
  const w = Math.round(card.w + 2 * PAD)
  const h = Math.round(opts.aspect ? w / opts.aspect : card.h + 2 * PAD)
  const y = Math.max(0, Math.min(height - h, Math.round(card.y + card.h / 2 - h / 2)))
  let filters = `crop=${w}:${h}:${Math.round(card.x - PAD)}:${y},fps=${opts.fps ?? 15},`
  if (opts.cut) {
    const [a, b] = opts.cut(marks).map((s) => (s - marks.start).toFixed(3))
    filters += `select='not(between(t,${a},${b}))',setpts=N/FRAME_RATE/TB,`
  }
  filters += 'scale=640:-1:flags=lanczos'
  const input = ['-ss', String(marks.start), '-t', (marks.end - marks.start).toFixed(3), '-i', webm]
  const palette = join(work, `palette-${theme}.png`)
  const out = resolve(opts.packageRoot, 'assets', `demo-${theme}.gif`)
  ffmpeg([
    ...input,
    '-vf',
    `${filters},palettegen=max_colors=${opts.colors ?? 256}:stats_mode=diff`,
    palette
  ])
  ffmpeg([
    ...input,
    '-i',
    palette,
    '-lavfi',
    `${filters}[x];[x][1:v]paletteuse=dither=${opts.dither ?? 'sierra2_4a'}:diff_mode=rectangle`,
    '-loop',
    '0',
    out
  ])
  console.warn(`${out}: ${statSync(out).size} bytes`)
}

/** Records the story in light and dark, then writes `assets/demo-light.gif` and `assets/demo-dark.gif`. */
export async function recordDemo(opts: RecordDemoOptions): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), 'demo-gif-'))
  const browser = await chromium.launch()
  try {
    for (const theme of ['light', 'dark'] as const) await recordTheme(browser, theme, opts, work)
  } finally {
    await browser.close()
    rmSync(work, { recursive: true, force: true })
  }
}
