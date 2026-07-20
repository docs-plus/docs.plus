import { insertTaskList, pressEnter } from '../pad/actions.ts'
import { openWriteTarget } from '../pad/writeTarget.ts'
import type { SwarmScript } from '../types.ts'

/** Adds a short checklist under the actor's Write Target via the `[] ` input rule. */
export const taskListScript: SwarmScript = {
  name: 'task-list',
  run: async (ctx) => {
    const { page, writeTarget } = ctx
    await openWriteTarget(page, writeTarget)
    await pressEnter(page)
    await insertTaskList(page, ['Capture the goal', 'Draft the first pass', 'Invite a review'])
  }
}
