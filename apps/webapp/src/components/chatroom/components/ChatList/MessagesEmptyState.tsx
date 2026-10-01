/**
 * Virtuoso `EmptyPlaceholder` slot: shown only when the list has zero
 * items. No external context needed — Virtuoso owns the data check.
 */
export const MessagesEmptyState = () => (
  <div className="flex h-full items-center justify-center">
    {/* Plain primary on the soft fill is 4.08:1 in light; the ink token clears 5.9:1 in every theme. */}
    <div className="badge badge-soft badge-primary text-[var(--primary-ink)]">No messages yet!</div>
  </div>
)
