import { recordContributor } from '../lib/contributors'
import type { StoreDocumentContext } from '../types'

// onChange is the only hook that sees which connection produced an update.
// Redis- and direct-connection-origin updates arrive with an empty context and
// are correctly skipped: those are the version's trigger, not its contributors.
export const contributorsExtension = {
  async onChange({
    document,
    context
  }: {
    document: object
    context: StoreDocumentContext
  }): Promise<void> {
    recordContributor(document, context)
  }
}
