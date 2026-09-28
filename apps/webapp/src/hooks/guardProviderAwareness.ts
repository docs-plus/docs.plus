import type { HocuspocusProvider } from '@hocuspocus/provider'

type AwarenessUpdateHandler = HocuspocusProvider['boundAwarenessUpdateHandler']

const CURSOR_FIELD = 'cursor'

/**
 * Two upstream bugs send cursor frames nobody uses. Delete each guard when its fix lands.
 * `@tiptap/y-tiptap` 3.0.6+ re-sends an unchanged cursor after every remote edit (y-tiptap#55).
 * `@hocuspocus/provider` 3.x sends back awareness it just received (fixed in 4.5.0, hocuspocus#1129).
 */
export const guardProviderAwareness = (provider: HocuspocusProvider): void => {
  const awareness = provider.awareness
  if (!awareness) return

  // Peers drop an identical state (no awareness 'change'), so the frame is only traffic.
  // The 15 s renew goes through setLocalState, so this never starves it.
  const setLocalStateField = awareness.setLocalStateField.bind(awareness)
  awareness.setLocalStateField = (field, value) => {
    if (
      field === CURSOR_FIELD &&
      JSON.stringify(awareness.getLocalState()?.[field] ?? null) === JSON.stringify(value ?? null)
    ) {
      return
    }
    setLocalStateField(field, value)
  }

  // Reassign the bound handler so the provider's own destroy() removes the guarded one.
  const sendAwarenessUpdate = provider.boundAwarenessUpdateHandler
  const sendLocalAwarenessUpdate: AwarenessUpdateHandler = (changes, origin) => {
    if (origin === provider) return
    sendAwarenessUpdate(changes, origin)
  }
  awareness.off('update', sendAwarenessUpdate)
  provider.boundAwarenessUpdateHandler = sendLocalAwarenessUpdate
  awareness.on('update', sendLocalAwarenessUpdate)
}
