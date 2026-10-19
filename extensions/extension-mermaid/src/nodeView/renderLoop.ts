import type { DiagramRenderer } from '../renderer/types'
import type { MermaidSnapshot, MermaidState } from '../types'
import { crashMarker } from './crashMarker'

const RENDER_DELAY_MS = 300
const IDLE_DELAY_MS = 1000

// Blocks stuck on a load error. A block that loads after its own load error retries the others.
const awaitingLoad = new Set<() => void>()

function retryAwaitingLoad(): void {
  const blocks = [...awaitingLoad]
  awaitingLoad.clear()
  for (const retry of blocks) retry()
}

export interface RenderLoopOptions {
  source: string
  /** Called on the first draw, and again after an empty source destroyed the renderer. */
  createRenderer: () => DiagramRenderer
  /** `durationMs` is set on `ready` and `error` only. */
  publish: (snapshot: MermaidSnapshot, durationMs: number | null) => void
}

export interface RenderLoop {
  /** `empty` or `loading`, for the first paint. It is never published. */
  readonly initial: MermaidState
  sourceChanged: (source: string) => void
  becameVisible: () => void
  retry: () => void
  destroy: () => void
}

/**
 * Turns source edits into snapshots. Nothing draws before the block is first visible.
 * A redraw runs 300 ms after the last edit. An error waits until 1000 ms after the last
 * edit, so it never flashes per keystroke; an idle block shows it at once.
 */
export function createRenderLoop(options: RenderLoopOptions): RenderLoop {
  let source = options.source
  let state: MermaidState = source.trim() === '' ? 'empty' : 'loading'
  let renderer: DiagramRenderer | null = null
  let pendingError: { snapshot: MermaidSnapshot; durationMs: number } | null = null
  let idle = true
  let visible = false
  let destroyed = false
  let runId = 0
  let renderTimer: ReturnType<typeof setTimeout> | undefined
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  function publish(snapshot: MermaidSnapshot, durationMs: number | null): void {
    pendingError = null
    state = snapshot.state
    options.publish(snapshot, durationMs)
  }

  async function render(): Promise<void> {
    if (destroyed || !visible) return
    const run = ++runId
    const current = source

    if (current.trim() === '') {
      renderer?.destroy()
      renderer = null
      if (state !== 'empty') publish({ state: 'empty', error: null, diagramType: null }, null)
      return
    }
    if (crashMarker.has(current)) {
      publish({ state: 'skipped', error: null, diagramType: null }, null)
      return
    }

    const active = (renderer ??= options.createRenderer())
    const loadError = await active.prepare(current)
    // A newer edit whose render has not started yet makes this run stale too.
    if (destroyed || run !== runId || current !== source) return
    if (loadError) {
      awaitingLoad.add(start)
      publish({ state: 'load-error', error: loadError, diagramType: null }, null)
      return
    }
    awaitingLoad.delete(start)
    if (state === 'load-error') retryAwaitingLoad()

    // Set before the synchronous draw: a frozen tab keeps the key, so the next load skips it.
    const clear = crashMarker.set(current)
    let outcome
    try {
      outcome = active.draw(current)
    } finally {
      clear()
    }

    const { error, diagramType, durationMs } = outcome
    if (outcome.state === 'ready') {
      publish({ state: 'ready', error: null, diagramType }, durationMs)
    } else if (idle) {
      publish({ state: 'error', error, diagramType }, durationMs)
    } else {
      pendingError = { snapshot: { state: 'error', error, diagramType }, durationMs }
    }
  }

  function start(): void {
    render().catch((err: unknown) => console.error(err))
  }

  function onIdle(): void {
    idle = true
    const pending = pendingError
    if (pending) publish(pending.snapshot, pending.durationMs)
  }

  return {
    initial: state,
    sourceChanged(next) {
      source = next
      idle = false
      pendingError = null
      clearTimeout(idleTimer)
      idleTimer = setTimeout(onIdle, IDLE_DELAY_MS)
      clearTimeout(renderTimer)
      renderTimer = setTimeout(start, RENDER_DELAY_MS)
    },
    becameVisible() {
      visible = true
      start()
    },
    retry: start,
    destroy() {
      destroyed = true
      awaitingLoad.delete(start)
      clearTimeout(renderTimer)
      clearTimeout(idleTimer)
      renderer?.destroy()
    }
  }
}
