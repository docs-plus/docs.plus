const recentlyReadIds = new Set<string>()

/** Skip duplicate realtime badge decrements for reads initiated in this panel. */
export function trackClientRead(notificationId: string) {
  recentlyReadIds.add(notificationId)
  setTimeout(() => recentlyReadIds.delete(notificationId), 5000)
}

export function wasClientRead(notificationId: string) {
  return recentlyReadIds.has(notificationId)
}
