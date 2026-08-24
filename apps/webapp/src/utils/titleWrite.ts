export const plainTitle = (value: string): string => value.replace(/<[^>]*>/g, '')

export function parseDocTitlePayload(payload: string): string | null {
  try {
    const msg = JSON.parse(payload) as { type?: unknown; state?: { title?: unknown } }
    if (msg.type !== 'docTitle' || typeof msg.state?.title !== 'string') return null
    return plainTitle(msg.state.title)
  } catch {
    return null
  }
}

export function sendDocTitleStateless(
  sender: { sendStateless: (payload: string) => void } | null | undefined,
  title: string
): void {
  sender?.sendStateless(JSON.stringify({ type: 'docTitle', state: { title: plainTitle(title) } }))
}
