/// <reference types="bun-types" />
// Failure modes: a broken diagram flashes per keystroke, and a slow
// prepare from an older run draws over a newer one. A fake DiagramRenderer
// stands in for Pele, so only the loop's timers and run order are under test.
import { afterEach, beforeEach, describe, expect, it, jest } from 'bun:test'

import type { DiagramRenderer, RenderOutcome } from '../../renderer/types'
import type { MermaidState } from '../../types'
import { createRenderLoop } from '../renderLoop'

const DURATION = 7

interface Published {
  state: MermaidState
  message: string | null
  durationMs: number | null
}

/** Sources that start with `broken` fail to draw. A held source's prepare waits for `release`. */
function setup(source: string, hold: (src: string) => boolean = () => false) {
  const draws: string[] = []
  const published: Published[] = []
  const waiting = new Map<string, () => void>()
  const renderer: DiagramRenderer = {
    prepare: (src) =>
      hold(src)
        ? new Promise((resolve) => waiting.set(src, () => resolve(null)))
        : Promise.resolve(null),
    draw(src): RenderOutcome {
      draws.push(src)
      return src.startsWith('broken')
        ? {
            state: 'error',
            error: { code: 'syntax', message: src, line: 1, column: 1 },
            diagramType: 'flowchart',
            durationMs: DURATION
          }
        : { state: 'ready', error: null, diagramType: 'flowchart', durationMs: DURATION }
    },
    destroy() {}
  }
  const loop = createRenderLoop({
    source,
    createRenderer: () => renderer,
    publish: (snapshot, durationMs) =>
      published.push({
        state: snapshot.state,
        message: snapshot.error?.message ?? null,
        durationMs
      })
  })
  const release = async (src: string): Promise<void> => {
    waiting.get(src)?.()
    await flush()
  }
  return { loop, draws, published, release }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve()
}

async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms)
  await flush()
}

beforeEach(() => {
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('render loop — error delay', () => {
  it('shows an error at once when the block is idle', async () => {
    const { loop, published } = setup('broken A')
    loop.becameVisible()
    await flush()
    expect(published).toEqual([{ state: 'error', message: 'broken A', durationMs: DURATION }])
  })

  it('holds an error until 1000 ms after the last edit', async () => {
    const { loop, draws, published } = setup('good')
    loop.becameVisible()
    await flush()
    loop.sourceChanged('broken A')

    await advance(300)
    expect(draws).toEqual(['good', 'broken A'])
    await advance(699)
    expect(published.map((p) => p.state)).toEqual(['ready'])

    await advance(1)
    expect(published[1]).toEqual({ state: 'error', message: 'broken A', durationMs: DURATION })
  })

  it('restarts the idle wait on each edit', async () => {
    const { loop, published } = setup('good')
    loop.becameVisible()
    await flush()
    loop.sourceChanged('broken A')
    await advance(700)
    loop.sourceChanged('broken B')

    await advance(999)
    expect(published.map((p) => p.state)).toEqual(['ready'])

    await advance(1)
    expect(published).toHaveLength(2)
    expect(published[1]).toEqual({ state: 'error', message: 'broken B', durationMs: DURATION })
  })

  it('drops a held error when the source changes again', async () => {
    const { loop, published, release } = setup('good', (src) => src === 'broken B')
    loop.becameVisible()
    await flush()
    loop.sourceChanged('broken A')
    await advance(700)
    loop.sourceChanged('broken B')

    await advance(1000)
    expect(published.map((p) => p.state)).toEqual(['ready'])

    await release('broken B')
    expect(published[1]).toEqual({ state: 'error', message: 'broken B', durationMs: DURATION })
  })
})

describe('render loop — stale runs', () => {
  it('never draws a run whose prepare finished after a newer run started', async () => {
    const { loop, draws, published, release } = setup('good A', () => true)
    loop.becameVisible()
    loop.sourceChanged('good B')
    await advance(300)

    await release('good B')
    await release('good A')
    expect(draws).toEqual(['good B'])
    expect(published).toEqual([{ state: 'ready', message: null, durationMs: DURATION }])
  })

  it('drops a run whose source changed before the next render started', async () => {
    const { loop, draws, published, release } = setup('good', (src) => src === 'broken A')
    loop.becameVisible()
    await flush()
    loop.sourceChanged('broken A')
    await advance(300)
    loop.sourceChanged('good B')

    await release('broken A')
    await advance(1000)
    expect(draws).toEqual(['good', 'good B'])
    expect(published.map((p) => p.state)).toEqual(['ready', 'ready'])
  })

  it('never draws after destroy', async () => {
    const { loop, draws, published, release } = setup('good A', () => true)
    loop.becameVisible()
    loop.destroy()

    await release('good A')
    expect(draws).toEqual([])
    expect(published).toEqual([])
  })
})

describe('render loop — load errors', () => {
  it('redraws every block stuck on a load error when one Try again loads', async () => {
    let online = false
    const states: Record<string, MermaidState[]> = { a: [], b: [] }
    const loops = Object.keys(states).map((name) =>
      createRenderLoop({
        source: `good ${name}`,
        createRenderer: () => ({
          prepare: () =>
            Promise.resolve(
              online ? null : { code: 'load' as const, message: 'offline', line: 0, column: 0 }
            ),
          draw: () => ({ state: 'ready', error: null, diagramType: 'flowchart', durationMs: 1 }),
          destroy() {}
        }),
        publish: (snapshot) => states[name].push(snapshot.state)
      })
    )
    for (const loop of loops) loop.becameVisible()
    await flush()
    expect(states).toEqual({ a: ['load-error'], b: ['load-error'] })

    online = true
    loops[0].retry()
    await flush()
    expect(states).toEqual({ a: ['load-error', 'ready'], b: ['load-error', 'ready'] })
    for (const loop of loops) loop.destroy()
  })
})
