const PREFIX = 'docsy:composer-format-toolbar:'

/** Whether the formatting toolbar is expanded for this channel this tab session. */
export function readFormattingToolbarExpanded(
  workspaceId: string,
  channelId: string
): boolean | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${workspaceId}:${channelId}`)
    if (raw === null) return null
    return raw === '1'
  } catch {
    return null
  }
}

export function writeFormattingToolbarExpanded(
  workspaceId: string,
  channelId: string,
  expanded: boolean
): void {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(`${PREFIX}${workspaceId}:${channelId}`, expanded ? '1' : '0')
  } catch {
    // Private mode / quota — ignore; UI still toggles in memory.
  }
}
