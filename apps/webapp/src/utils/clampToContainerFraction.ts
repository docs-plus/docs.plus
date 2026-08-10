/**
 * Scale a margin tuned for a full-height pad down to a short container, keeping the
 * tuned value as the ceiling. The pad viewport shrinks to the document floor when the
 * chat pane expands. A fixed band then covers the whole container, so every candidate
 * matches and the scroll branches fight. A quarter leaves at least half the container
 * between the top and bottom bands. Sign is preserved for negative bands.
 */
export const clampToContainerFraction = (
  px: number,
  containerHeight: number,
  fraction = 0.25
): number => Math.sign(px) * Math.min(Math.abs(px), Math.floor(containerHeight * fraction))
