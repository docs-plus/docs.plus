import type { PrismaClient } from '../../../generated/prisma/client'
import type { CardKind, CardQuery } from '../domain/cardRequest'
import {
  type CardReads,
  type CardResult,
  type CardSourceRow,
  resolveCard
} from '../domain/resolveCard'
import { isDrawable } from './assets'
import { createChatRead } from './chatRead'
import { createMembersRead } from './membersRead'
import { createVersionRead } from './versionRead'

// One chat read and one members read per process: each memo, cap and single flight must be
// shared by every card.
let chat: CardReads['chat'] | null = null
let members: CardReads['members'] | null = null

/** `resolveCard` with this process's reads and font check: the route and the slug read share it. */
export const resolveStoredCard = (args: {
  prisma: PrismaClient
  row: CardSourceRow | null
  query: CardQuery
  kinds: ReadonlySet<CardKind>
}): Promise<CardResult> => {
  chat ??= createChatRead()
  members ??= createMembersRead()
  const reads = { chat, members, version: createVersionRead(args.prisma) }
  return resolveCard({ row: args.row, query: args.query, kinds: args.kinds, reads, isDrawable })
}
