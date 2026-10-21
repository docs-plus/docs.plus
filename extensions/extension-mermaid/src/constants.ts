import type { MermaidLimits } from './types'

export const MERMAID_LANGUAGE = 'mermaid'

/**
 * Measured on a real iPhone and Android phone (2026-10-21, #522): the highest level where
 * every test source drew within 200 ms p99 on both. Android set characters, both set edges.
 */
export const DEFAULT_LIMITS: Required<MermaidLimits> = { characters: 10000, edges: 250 }
