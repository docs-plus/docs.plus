import { ChunkLoadFallback } from '@components/ChunkLoadFallback'
import { Modal, ModalBody, ModalClose, ModalContent } from '@components/ui/Dialog'
import { selectIsSignedIn, useAuthStore } from '@stores'
import dynamic, { type DynamicOptionsLoadingProps } from 'next/dynamic'
import { createContext, useContext } from 'react'

import SettingsPanelSkeleton from './SettingsPanelSkeleton'
import type { TabType } from './types'

// next/dynamic gives `loading` only its own props, so a context carries the tab.
const SkeletonTabContext = createContext<TabType | undefined>(undefined)

function SettingsPanelLoading(props: DynamicOptionsLoadingProps) {
  const skeleton = <SettingsPanelSkeleton defaultTab={useContext(SkeletonTabContext)} />
  const fallback = <ChunkLoadFallback {...props} skeleton={skeleton} />
  if (!props.error) return fallback
  // Every close button sits in the failed chunk, and a phone takeover has no backdrop.
  return (
    <ModalBody>
      <ModalClose />
      {fallback}
    </ModalBody>
  )
}

const SettingsPanel = dynamic(() => import('./SettingsPanel'), {
  loading: SettingsPanelLoading
})

/** Settings opens on its skeleton while auth still answers. Signed out, it stays shut. */
export const selectSettingsMayOpen: typeof selectIsSignedIn = (state) =>
  state.loading || selectIsSignedIn(state)

export interface SettingsTakeoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Undefined opens the panel on its own default tab, `profile`. */
  defaultTab?: TabType
}

/**
 * The one modal shell around the user-account `SettingsPanel`. Four mounts built their own
 * and disagreed on width, on the accessible name, and on the signed-in gate.
 */
export function SettingsTakeover({ open, onOpenChange, defaultTab }: SettingsTakeoverProps) {
  const user = useAuthStore((state) => state.profile)
  const mayOpen = useAuthStore(selectSettingsMayOpen)

  // The gate lives here so no mount can forget it. A session that ends must take the panel
  // down with it. `EditorToolbar` used to leave a signed-out shell up, showing the literal
  // "User" over a Documents pane that told the reader to sign in.
  if (!mayOpen) return null

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {/* `5xl` because Documents is the only full-width tab and wants the room; every other
          tab caps at `max-w-2xl` and just centers, so the extra width costs it nothing.
          `aria-label` is the sole accessible name — the panel's `<h2>` is not a `ModalHeading`. */}
      <ModalContent size="5xl" mobileTakeover aria-label="Settings" className="p-0">
        {user ? (
          <SkeletonTabContext.Provider value={defaultTab}>
            <SettingsPanel defaultTab={defaultTab} onClose={() => onOpenChange(false)} />
          </SkeletonTabContext.Provider>
        ) : (
          <SettingsPanelSkeleton defaultTab={defaultTab} />
        )}
      </ModalContent>
    </Modal>
  )
}
