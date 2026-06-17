import type { Editor } from '@tiptap/core'

import type { MediaLoadingShellOption } from './loading/types'
import type { ReplaceUrlPopoverFactory } from './toolbar/replaceUrl'
import type { MediaToolbarIconsResolver } from './toolbar/resolveIcon'
import type { MediaActionContext, MediaActionsResolver, MediaToolbarFactory } from './toolbar/types'

export const HYPER_MULTIMEDIA_KIT_EXTENSION_NAME = 'HyperMultimediaKit'

/** Single source of truth for the kit's storage shape — read via `getKitStorage`. */
export interface HyperMultimediaKitStorage {
  mediaToolbar?: MediaToolbarFactory
  /** Matches the real stored value (`boolean | factory`), not a bare boolean. */
  loadingShell?: MediaLoadingShellOption
  mediaActions?: MediaActionsResolver
  /** Swap toolbar/menu SVG markup by icon key without replacing toolbar factories. */
  mediaToolbarIcons?: MediaToolbarIconsResolver
  replaceUrlPopover?: ReplaceUrlPopoverFactory
  isUploadedMedia?: (ctx: MediaActionContext) => boolean
}

/** Typed accessor that replaces the ad-hoc `editor.storage as Record<...>` casts. */
export function getKitStorage(editor: Editor): HyperMultimediaKitStorage {
  return (
    (editor.storage as Record<string, HyperMultimediaKitStorage | undefined>)[
      HYPER_MULTIMEDIA_KIT_EXTENSION_NAME
    ] ?? {}
  )
}
