import type * as Pele from 'pele/lazy'
import type { DiagramType, Mounted, MountOptions } from 'pele/lazy'

import { DEFAULT_LIMITS } from '../constants'
import type { MermaidError, MermaidLimits } from '../types'
import { limitMessage } from './limitMessage'
import type { DiagramRenderer, RendererOptions, RenderOutcome } from './types'

type PeleModule = typeof Pele

let peleImport: Promise<PeleModule> | null = null

/** A rejected import clears the cache, so "Try again" imports again. */
function loadPele(): Promise<PeleModule> {
  peleImport ??= import('pele/lazy').catch((err: unknown) => {
    peleImport = null
    throw err
  })
  return peleImport
}

function detect(mod: PeleModule, source: string): DiagramType | null {
  try {
    return mod.detectType(source)
  } catch {
    return null
  }
}

// Pele 1.10.0 and later count error lines and columns in the source as written.
function toError(
  mod: PeleModule,
  err: unknown,
  source: string,
  limits: Required<MermaidLimits>
): MermaidError {
  if (!(err instanceof mod.PeleError)) {
    return { code: 'render', message: String(err), line: 0, column: 0 }
  }
  if (err.code === 'limit') {
    return { code: 'limit', message: limitMessage(source, err.message, limits), line: 0, column: 0 }
  }
  return {
    code: err.code,
    message: err.message,
    line: Math.max(err.line, 0),
    column: err.column
  }
}

function coarsePointer(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
}

export function createRenderer(target: HTMLElement, options: RendererOptions): DiagramRenderer {
  let pele: PeleModule | null = null
  let mounted: Mounted | undefined
  const limits: Required<MermaidLimits> = {
    characters: options.limits.characters ?? DEFAULT_LIMITS.characters,
    edges: options.limits.edges ?? DEFAULT_LIMITS.edges
  }

  // Built once and never passed to `update`, so the zoom instance survives.
  const mountOptions: MountOptions = {
    limit: limits.characters,
    maxEdges: limits.edges,
    outputLimit: 1000000,
    links: false,
    images: options.images,
    sanitize: options.sanitize ?? undefined,
    zoom: options.zoom === false || coarsePointer() ? false : 'auto',
    onRender(result) {
      // A throw here makes Pele rethrow, so this stays one guarded write.
      const svg = target.querySelector('svg.pele')
      if (svg && !svg.hasAttribute('aria-labelledby')) {
        svg.setAttribute('aria-label', `${result.type} diagram`)
      }
    }
  }

  return {
    async prepare(source) {
      try {
        pele = await loadPele()
        const type = detect(pele, source)
        // Mounting here would draw after Pele's own await, and that draw cannot be stopped.
        if (type) await pele.load(type)
        return null
      } catch (err) {
        return { code: 'load', message: String(err), line: 0, column: 0 }
      }
    },

    draw(source): RenderOutcome {
      const mod = pele
      if (!mod) throw new Error('draw() called before prepare()')
      const type = detect(mod, source)
      const start = performance.now()
      let failure: unknown
      try {
        // `update()` skips the draw on a connected zero-width host and keeps a stale error.
        if (mounted && target.isConnected && target.clientWidth === 0) {
          mounted.destroy()
          mounted = undefined
        }
        if (mounted) mounted.update(source)
        else mounted = mod.mount(target, source, mountOptions)
        failure = mounted.error
      } catch (err) {
        failure = err
      }
      const durationMs = performance.now() - start
      if (failure === undefined)
        return { state: 'ready', error: null, diagramType: type, durationMs }
      return {
        state: 'error',
        error: toError(mod, failure, source, limits),
        diagramType: type,
        durationMs
      }
    },

    destroy() {
      mounted?.destroy()
      mounted = undefined
      target.replaceChildren()
    }
  }
}
