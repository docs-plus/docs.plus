/** The Unread tab's count. The panel and its loader both read it for Mark all read. */
export const unreadCountOf = (tabs: readonly { label: string; count?: number }[]): number =>
  tabs.find((tab) => tab.label === 'Unread')?.count ?? 0
