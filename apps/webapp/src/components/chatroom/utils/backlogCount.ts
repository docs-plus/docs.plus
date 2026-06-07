/** max(persisted unread, session arrivals while scrolled away) — TOC, banner, jump chip */
export function backlogCount(unread: number, sessionNew: number): number {
  return Math.max(unread, sessionNew)
}
