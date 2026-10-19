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

/**
 * Pele counts error lines from the diagram header, not from the frontmatter, `%%{init}%%`
 * or comment lines above it. Provisional: probed on the sampled types only. Agentflow is
 * skipped, because its metadata errors already include them, so its other errors stay short.
 */
function leadingLines(source: string): number {
  const lines = source.split(/\r?\n|\r/)
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++
  if (lines[i]?.trim() === '---') {
    i++
    while (i < lines.length && lines[i].trim() !== '---') i++
    i++
  }
  for (; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('%%{')) {
      while (i < lines.length && !lines[i].includes('}%%')) i++
    } else if (line !== '' && !line.startsWith('%%')) {
      break
    }
  }
  return Math.min(i, lines.length)
}

// Pele's own comment pass. It also drops blank lines just above a comment.
const COMMENT = /^\s*%%(?!{)[^\n]+\n?/gm

/** Pele also skips interior comment lines, so walk the kept lines from the header. Eventmodeling keeps them. */
function sourceLine(source: string, line: number, type: DiagramType | null): number {
  const start = leadingLines(source)
  if (type === 'eventmodeling') return start + line
  const body = source
    .split(/\r?\n|\r/)
    .slice(start)
    .join('\n')
  const lines = body.replace(COMMENT, (m) => '\0\n'.repeat(m.split('\n').length - 1)).split('\n')
  let kept = 0
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== '\0' && ++kept === line) return start + i + 1
  }
  return start + line
}

function toError(
  mod: PeleModule,
  err: unknown,
  source: string,
  type: DiagramType | null,
  limits: Required<MermaidLimits>
): MermaidError {
  if (!(err instanceof mod.PeleError)) {
    return { code: 'render', message: String(err), line: 0, column: 0 }
  }
  if (err.code === 'limit') {
    return { code: 'limit', message: limitMessage(source, err.message, limits), line: 0, column: 0 }
  }
  const line = err.line > 0 && type !== 'agentflow' ? sourceLine(source, err.line, type) : err.line
  return {
    code: err.code,
    // Only the first token: later `line N` text is the echoed source.
    message:
      line !== err.line
        ? err.message.replace(new RegExp(`\\b(line) ${err.line}\\b`, 'i'), `$1 ${line}`)
        : err.message,
    line: Math.max(line, 0),
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
        error: toError(mod, failure, source, type, limits),
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
