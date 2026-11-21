import type { Prisma } from '../generated/prisma/client'

/**
 * Every writer that appends head + 1 takes this first, inside its transaction (#704).
 * FOR UPDATE alone lets two writers read the same head under READ COMMITTED, and the
 * second then fails with P2002. It also locks nothing when no row exists yet. Types
 * only, so REST can import it without the Redis socket in `queue.ts`.
 */
export const lockDocumentStore = async (
  tx: Prisma.TransactionClient,
  documentId: string
): Promise<void> => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('doc-store:' || ${documentId}))`
}
