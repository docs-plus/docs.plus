type PauseScope = ParentNode | 'feed' | null

/** Pause media in a lightbox root, the whole document, or feed tiles only. */
export function pauseChatMediaElements(scope: PauseScope = document): void {
  if (scope == null) return

  const nodes =
    scope === 'feed'
      ? document.querySelectorAll('[data-chat-media] video, [data-chat-media] audio')
      : scope.querySelectorAll('video, audio')

  nodes.forEach((el) => {
    if (el instanceof HTMLMediaElement) el.pause()
  })
}
