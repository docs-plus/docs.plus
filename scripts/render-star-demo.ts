import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseArgs } from 'node:util'

type Theme = 'light' | 'dark'
type OutputFormat = 'webp' | 'gif'

interface DemoMeta {
  durationMs: number
  fps: number
  width: number
  height: number
  zoomWindows?: [number, number][]
}

interface CapturedFrame {
  path: string
  durationMs: number
  ms: number
}

interface PlaywrightPage {
  on(event: 'pageerror', handler: (err: unknown) => void): void
  on(event: 'console', handler: (msg: { type(): string; text(): string }) => void): void
  goto(url: string): Promise<void>
  addStyleTag(options: { content: string }): Promise<void>
  evaluate<T, A = undefined>(fn: (arg: A) => T, arg?: A): Promise<T>
  screenshot(options: {
    path?: string
    type: 'png'
    omitBackground?: boolean
    animations?: 'disabled'
  }): Promise<Uint8Array>
}

interface PlaywrightContext {
  newPage(): Promise<PlaywrightPage>
  close(): Promise<void>
}

interface PlaywrightBrowser {
  newContext(options: {
    viewport: { width: number; height: number }
    deviceScaleFactor: number
  }): Promise<PlaywrightContext>
  close(): Promise<void>
}

interface PlaywrightModule {
  chromium: {
    launch(): Promise<PlaywrightBrowser>
  }
}

interface CliConfig {
  stars: number
  forks: number
  watching: number
  themes: Theme[]
  format: OutputFormat
  fps: number
  quality: number
  zoomQuality: number
  width: number
  maxKb: number
  outDir: string
  source: string
}

const REPO_ROOT = resolve(import.meta.dir, '..')

function printHelp(): void {
  console.log(`Usage: bun scripts/render-star-demo.ts [options]

Options:
  --stars <n>          Starting star count (default: 99)
  --forks <n>          Fork count in header and sidebar (default: 17)
  --watching <n>       Watching count in header and sidebar (default: 6)
  --theme <mode>       both | light | dark (default: both)
  --format <fmt>       webp | gif (default: webp)
  --fps <n>            Capture frame rate (default: 20)
  --quality <n>        WebP quality for static and UI frames (default: 86)
  --zoom-quality <n>   WebP quality for camera zoom frames (default: 70)
  --width <px>         Output pixel width (default: 800)
  --max-kb <kb>        Fail if any output file exceeds this KB cap (default: 500)
  --out-dir <dir>      Output directory (default: .github/assets)
  --source <file>      Source HTML path (default: .github/assets/star-demo.source.html)
  -h, --help           Show this help`)
}

function parsePositiveInt(raw: string, flag: string, allowZero = false): number {
  const parsed = Number.parseInt(raw, 10)
  const min = allowZero ? 0 : 1
  if (!Number.isFinite(parsed) || parsed < min) {
    throw new Error(`Invalid ${flag} value: ${raw}`)
  }
  return parsed
}

function parseCli(): CliConfig {
  const { values } = parseArgs({
    options: {
      stars: { type: 'string', default: '99' },
      forks: { type: 'string', default: '17' },
      watching: { type: 'string', default: '6' },
      theme: { type: 'string', default: 'both' },
      format: { type: 'string', default: 'webp' },
      fps: { type: 'string', default: '20' },
      quality: { type: 'string', default: '86' },
      'zoom-quality': { type: 'string', default: '70' },
      width: { type: 'string', default: '800' },
      'max-kb': { type: 'string', default: '500' },
      'out-dir': { type: 'string', default: '.github/assets' },
      source: { type: 'string', default: '.github/assets/star-demo.source.html' },
      help: { type: 'boolean', short: 'h', default: false }
    },
    strict: true
  })

  if (values.help) {
    printHelp()
    process.exit(0)
  }

  const themes: Theme[] =
    values.theme === 'both'
      ? ['light', 'dark']
      : values.theme === 'light' || values.theme === 'dark'
        ? [values.theme]
        : (() => {
            throw new Error(`Invalid --theme value: ${values.theme}`)
          })()

  const format: OutputFormat =
    values.format === 'webp' || values.format === 'gif'
      ? values.format
      : (() => {
          throw new Error(`Invalid --format value: ${values.format}`)
        })()

  return {
    stars: parsePositiveInt(values.stars, '--stars', true),
    forks: parsePositiveInt(values.forks, '--forks', true),
    watching: parsePositiveInt(values.watching, '--watching', true),
    themes,
    format,
    fps: parsePositiveInt(values.fps, '--fps'),
    quality: parsePositiveInt(values.quality, '--quality'),
    zoomQuality: parsePositiveInt(values['zoom-quality'], '--zoom-quality'),
    width: parsePositiveInt(values.width, '--width'),
    maxKb: parsePositiveInt(values['max-kb'], '--max-kb'),
    outDir: resolve(REPO_ROOT, values['out-dir']),
    source: resolve(REPO_ROOT, values.source)
  }
}

function ensureDependencies(config: CliConfig): PlaywrightModule {
  if (!existsSync(config.source)) {
    throw new Error(`Source HTML not found: ${config.source}`)
  }

  if (config.format === 'webp' && !Bun.which('img2webp')) {
    throw new Error('Missing encoder: img2webp. Install webp first: brew install webp')
  }
  if (config.format === 'gif' && !Bun.which('ffmpeg')) {
    throw new Error('Missing encoder: ffmpeg. Install ffmpeg first: brew install ffmpeg')
  }

  // Reuse the workspace Playwright package instead of adding a root devDependency.
  const requireFromPlayground = createRequire(
    resolve(REPO_ROOT, 'packages/playground/package.json')
  )
  return requireFromPlayground('playwright') as PlaywrightModule
}

function encodeWebp(
  frames: CapturedFrame[],
  outPath: string,
  quality: number,
  zoomQuality: number,
  zoomWindows: [number, number][],
  workDir: string
): void {
  const argsPath = join(workDir, 'img2webp-args.txt')
  const lines = ['-loop', '0', '-mixed', '-min_size', '-sharp_yuv']

  for (const frame of frames) {
    const isZoom = zoomWindows.some(([start, end]) => frame.ms >= start && frame.ms < end)
    const frameQuality = isZoom ? zoomQuality : quality
    lines.push('-q', String(frameQuality), '-m', '4', '-d', String(frame.durationMs), frame.path)
  }
  lines.push('-o', outPath)

  writeFileSync(argsPath, `${lines.join('\n')}\n`, 'utf8')
  const result = Bun.spawnSync(['img2webp', argsPath], { stdio: ['ignore', 'inherit', 'inherit'] })
  if (result.exitCode !== 0) {
    throw new Error(`img2webp failed with exit code ${result.exitCode}`)
  }
}

function encodeGif(frames: CapturedFrame[], outPath: string, workDir: string): void {
  const concatPath = join(workDir, 'frames.ffconcat')
  const palettePath = join(workDir, 'palette.png')
  const lines = ['ffconcat version 1.0']

  for (const frame of frames) {
    lines.push(`file '${frame.path}'`)
    lines.push(`duration ${(frame.durationMs / 1000).toFixed(4)}`)
  }
  lines.push(`file '${frames[frames.length - 1].path}'`)

  writeFileSync(concatPath, `${lines.join('\n')}\n`, 'utf8')

  const paletteRun = Bun.spawnSync(
    [
      'ffmpeg',
      '-v',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-vf',
      'palettegen=stats_mode=diff',
      palettePath
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  )
  if (paletteRun.exitCode !== 0) {
    throw new Error(`ffmpeg palettegen failed with exit code ${paletteRun.exitCode}`)
  }

  const gifRun = Bun.spawnSync(
    [
      'ffmpeg',
      '-v',
      'error',
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      concatPath,
      '-i',
      palettePath,
      '-lavfi',
      'paletteuse=dither=sierra2_4a:diff_mode=rectangle',
      '-loop',
      '0',
      outPath
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  )
  if (gifRun.exitCode !== 0) {
    throw new Error(`ffmpeg paletteuse failed with exit code ${gifRun.exitCode}`)
  }
}

async function renderTheme(
  browser: PlaywrightBrowser,
  theme: Theme,
  config: CliConfig,
  workDir: string
): Promise<void> {
  const height = Math.round((config.width * 640) / 1200)
  const themeDir = join(workDir, theme)
  mkdirSync(themeDir, { recursive: true })

  const context = await browser.newContext({
    viewport: { width: config.width, height },
    deviceScaleFactor: 1
  })
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (err) => errors.push(String(err)))
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })

  try {
    const query = new URLSearchParams({
      capture: '1',
      theme,
      stars: String(config.stars),
      forks: String(config.forks),
      watching: String(config.watching)
    })
    await page.goto(`${pathToFileURL(config.source).href}?${query.toString()}`)
    await page.evaluate(() => document.fonts.ready)

    if (config.width !== 1200) {
      const scale = config.width / 1200
      await page.addStyleTag({
        content: `
          html.is-capture, html.is-capture body, html.is-capture .card-shell {
            width: ${config.width}px;
            height: ${height}px;
          }
          html.is-capture .card-scaler {
            transform: scale(${scale});
          }
        `
      })
    }

    const meta = await page.evaluate(() => {
      return (window as unknown as { __demoMeta: DemoMeta }).__demoMeta
    })

    const tickMs = Math.round(1000 / config.fps)
    const frames: CapturedFrame[] = []
    let prevPng: Uint8Array | null = null
    let prevHash: bigint | number | null = null
    let totalTicks = 0

    for (let ms = 0; ms < meta.durationMs; ms += tickMs) {
      const stepDuration = Math.min(tickMs, meta.durationMs - ms)
      totalTicks += 1

      await page.evaluate((t) => {
        const w = window as unknown as { __renderFrame(ms: number): void }
        w.__renderFrame(t)
      }, ms)
      await page.evaluate(
        () =>
          new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
      )

      const png = await page.screenshot({
        type: 'png',
        omitBackground: true,
        animations: 'disabled'
      })
      const hash = Bun.hash(png)

      // Merge identical consecutive static frames so holds cost one frame without timing drift.
      if (prevPng && prevHash === hash && Buffer.compare(prevPng, png) === 0 && frames.length > 0) {
        frames[frames.length - 1].durationMs += stepDuration
        continue
      }

      const framePath = join(themeDir, `f-${String(frames.length).padStart(4, '0')}.png`)
      writeFileSync(framePath, png)
      frames.push({ path: framePath, durationMs: stepDuration, ms })
      prevPng = png
      prevHash = hash
    }

    if (errors.length > 0) {
      throw new Error(`Page errors in ${theme} capture: ${errors.join('; ')}`)
    }

    mkdirSync(config.outDir, { recursive: true })
    const outPath = join(config.outDir, `star-demo-${theme}.${config.format}`)
    if (config.format === 'webp') {
      encodeWebp(
        frames,
        outPath,
        config.quality,
        config.zoomQuality,
        meta.zoomWindows ?? [],
        themeDir
      )
    } else {
      encodeGif(frames, outPath, themeDir)
    }

    const sizeBytes = statSync(outPath).size
    const sizeKb = sizeBytes / 1024
    const totalMs = frames.reduce((sum, item) => sum + item.durationMs, 0)
    console.log(
      `${outPath}: ${sizeKb.toFixed(1)} KB (${frames.length}/${totalTicks} frames, ${totalMs} ms)`
    )

    if (sizeKb > config.maxKb) {
      throw new Error(
        `Output exceeds ${config.maxKb} KB (${sizeKb.toFixed(1)} KB). Lower --quality or --width.`
      )
    }
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  const config = parseCli()
  const playwright = ensureDependencies(config)
  const workDir = mkdtempSync(join(tmpdir(), 'star-demo-'))

  let browser: PlaywrightBrowser
  try {
    browser = await playwright.chromium.launch()
  } catch (err) {
    rmSync(workDir, { recursive: true, force: true })
    throw new Error(
      `Failed to launch browser (${String(err)}). Run: bun --filter @docs.plus/playground exec playwright install chromium`
    )
  }

  try {
    for (const theme of config.themes) {
      await renderTheme(browser, theme, config, workDir)
    }
  } finally {
    await browser.close()
    rmSync(workDir, { recursive: true, force: true })
  }
}

await main()
