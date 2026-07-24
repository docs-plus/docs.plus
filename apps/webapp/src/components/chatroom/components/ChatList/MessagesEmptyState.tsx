/**
 * Virtuoso `EmptyPlaceholder` slot: shown only when the list has zero
 * items. No external context needed — Virtuoso owns the data check.
 */
export const MessagesEmptyState = () => (
  <div className="flex h-full items-center justify-center">
    <div className="badge badge-soft badge-primary">No messages yet!</div>
  </div>
)
