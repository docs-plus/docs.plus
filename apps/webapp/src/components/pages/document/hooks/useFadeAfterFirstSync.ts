import { useStore } from '@stores'
import { useState } from 'react'

/**
 * A view that replaces first-sync bones plays no fade at the swap. So the fade is on
 * only when this mount comes after the first sync, for example on a return from history.
 */
export const useFadeAfterFirstSync = () =>
  useState(() => !useStore.getState().settings.editor.providerSyncing)
