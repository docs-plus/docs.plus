import { openHeadingChat, sendChatLines } from '../pad/chatroom.ts'
import { openWriteTarget } from '../pad/writeTarget.ts'
import type { ScriptContext, ScriptOutcome, SwarmScript } from '../types.ts'

function pickChatLines(ctx: ScriptContext): string[] {
  const pool = [
    `Hi from ${ctx.actor.displayName} — joining this section.`,
    'Live edits are flowing in, this is looking good.',
    'Anyone want to co-author the next paragraph?'
  ]
  const count = 2 + Math.floor(Math.random() * 2) // 2 or 3
  return pool.slice(0, count)
}

/** Opens the Write Target's heading chat and sends 2–3 messages. */
export const chatScript: SwarmScript = {
  name: 'chat',
  run: async (ctx): Promise<ScriptOutcome> => {
    const { page, writeTarget } = ctx
    const { tocId } = await openWriteTarget(page, writeTarget)
    await openHeadingChat(page, tocId)
    const chatSent = await sendChatLines(page, pickChatLines(ctx))
    return { chatSent }
  }
}
