import { pressEnter, toggleBold, toggleItalic, typeText } from '../pad/actions.ts'
import { openWriteTarget } from '../pad/writeTarget.ts'
import type { SwarmScript } from '../types.ts'

/** Types a short paragraph under the actor's Write Target with one bold and one italic run. */
export const proseScript: SwarmScript = {
  name: 'prose',
  run: async (ctx) => {
    const { page, writeTarget } = ctx
    await openWriteTarget(page, writeTarget)
    await pressEnter(page)

    await typeText(page, 'The room is drafting this section together in real time. ')
    await toggleBold(page)
    await typeText(page, 'Shared intent')
    await toggleBold(page)
    await typeText(page, ' shapes the paragraph, while ')
    await toggleItalic(page)
    await typeText(page, 'a quieter aside')
    await toggleItalic(page)
    await typeText(
      page,
      ' keeps the tone human. Every keystroke lands live for collaborators to follow.'
    )
  }
}
