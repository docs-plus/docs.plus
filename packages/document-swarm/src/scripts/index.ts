import type { SwarmScript, SwarmScriptName } from '../types.ts'
import { academyScript } from './academy.ts'
import { chatScript } from './chat.ts'
import { proseScript } from './prose.ts'
import { taskListScript } from './taskList.ts'

/** Round-robin order and the pool the orchestrator draws from. */
export const SWARM_SCRIPTS: SwarmScript[] = [proseScript, taskListScript, academyScript, chatScript]

/** Relative draw weights for Shuffle assignment (heavier = more common). */
export const SCRIPT_WEIGHTS: Record<SwarmScriptName, number> = {
  prose: 4,
  'task-list': 3,
  academy: 2,
  chat: 3
}

/** Resolves a script by name; the `never` default flags any unhandled variant at compile time. */
export function getSwarmScript(name: SwarmScriptName): SwarmScript {
  switch (name) {
    case 'prose':
      return proseScript
    case 'task-list':
      return taskListScript
    case 'academy':
      return academyScript
    case 'chat':
      return chatScript
    default: {
      const unreachable: never = name
      throw new Error(`Unknown swarm script: ${String(unreachable)}`)
    }
  }
}
