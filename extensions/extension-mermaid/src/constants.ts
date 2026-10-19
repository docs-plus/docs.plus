import type { MermaidLimits } from './types'

export const MERMAID_LANGUAGE = 'mermaid'

/**
 * Provisional. From a 6x CPU stand-in, not a phone. Characters is the highest level
 * where every grown fixture fits 200 ms p99. Edges comes from the flowchart row only.
 * The pair was never measured together. A real phone run is owed.
 */
export const DEFAULT_LIMITS: Required<MermaidLimits> = { characters: 15000, edges: 500 }
