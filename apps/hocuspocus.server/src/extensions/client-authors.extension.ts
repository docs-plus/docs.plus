import type { onChangePayload } from '@hocuspocus/server'

import { recordClientAuthors } from '../lib/client-authors'
import { prisma } from '../lib/prisma'

// onChange is the only hook that sees the update bytes and the socket that sent
// them together. Once the update merges, the clientID-to-user link is gone.
export const clientAuthorsExtension = {
  async onChange({
    document,
    documentName,
    context,
    update,
    transactionOrigin
  }: onChangePayload): Promise<void> {
    recordClientAuthors(prisma, { document, documentName, context, update, transactionOrigin })
  }
}
