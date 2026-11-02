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
import { createVersionRead } from './versionRead'

/** The chat and version reads behind every card. One set per process, so their guards are shared. */
let reads: CardReads | null = null

/** `resolveCard` with this process's reads and font check: the route and the slug read share it. */
export const resolveStoredCard = (args: {
  prisma: PrismaClient
  row: CardSourceRow | null
  query: CardQuery
  kinds: ReadonlySet<CardKind>
}): Promise<CardResult> => {
  reads ??= { chat: createChatRead(), version: createVersionRead(args.prisma) }
  return resolveCard({ row: args.row, query: args.query, kinds: args.kinds, reads, isDrawable })
}
