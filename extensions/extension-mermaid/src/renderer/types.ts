import type { MermaidError, MermaidOptions } from '../types'

export type RendererOptions = Pick<MermaidOptions, 'images' | 'limits' | 'sanitize' | 'zoom'>

export interface RenderOutcome {
  state: 'ready' | 'error'
  /** Null on `ready`. */
  error: MermaidError | null
  /** The type detected for this source. */
  diagramType: string | null
  /** Pele plus sanitize, around the synchronous call. */
  durationMs: number
}

export interface DiagramRenderer {
  /** Imports `pele/lazy` and the source's type chunk. Never rejects; a failed import gives `{ code: 'load', ... }`. */
  prepare(source: string): Promise<MermaidError | null>
  /** Synchronous Pele mount or update. Call only after `prepare` resolved null. */
  draw(source: string): RenderOutcome
  /** Destroys the Pele mount and clears the diagram host. */
  destroy(): void
}
