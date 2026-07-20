import { SCRIPT_WEIGHTS, SWARM_SCRIPTS } from '../scripts/index.ts'
import type { RunOptions, SwarmScript } from '../types.ts'

// Shuffle expands the weight map into a flat pool once, then draws uniformly — so
// SCRIPT_WEIGHTS governs frequency without per-draw arithmetic.
function buildWeightedPool(): SwarmScript[] {
  const pool: SwarmScript[] = []
  for (const script of SWARM_SCRIPTS) {
    for (let i = 0; i < SCRIPT_WEIGHTS[script.name]; i++) pool.push(script)
  }
  return pool
}

/**
 * Per-actor script source. Default is deterministic round-robin over SWARM_SCRIPTS
 * (offset by actor index so actors don't march in lockstep); Shuffle draws
 * weighted-at-random from SCRIPT_WEIGHTS.
 */
export function makeScriptPicker(options: RunOptions, offset = 0): () => SwarmScript {
  const fallback = SWARM_SCRIPTS[0]
  if (!fallback) throw new Error('No Swarm Scripts are registered.')

  if (options.shuffle) {
    const pool = buildWeightedPool()
    return () => pool[Math.floor(Math.random() * pool.length)] ?? fallback
  }

  let index = offset
  return () => SWARM_SCRIPTS[index++ % SWARM_SCRIPTS.length] ?? fallback
}
