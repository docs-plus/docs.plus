import { Modal, ModalContent } from '@components/ui/Dialog'
import { useAuthStore } from '@stores'
import dynamic from 'next/dynamic'

import SettingsPanelSkeleton from './SettingsPanelSkeleton'
import type { TabType } from './types'

const SettingsPanel = dynamic(() => import('./SettingsPanel'), {
  loading: () => <SettingsPanelSkeleton />
})

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

  // The gate lives here so no mount can forget it. A session that ends must take the panel
  // down with it. `EditorToolbar` used to leave a signed-out shell up, showing the literal
  // "User" over a Documents pane that told the reader to sign in.
  if (!user) return null

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      {/* `5xl` because Documents is the only full-width tab and wants the room; every other
          tab caps at `max-w-2xl` and just centers, so the extra width costs it nothing.
          `aria-label` is the sole accessible name — the panel's `<h2>` is not a `ModalHeading`. */}
      <ModalContent size="5xl" mobileTakeover aria-label="Settings" className="p-0">
        <SettingsPanel defaultTab={defaultTab} onClose={() => onOpenChange(false)} />
      </ModalContent>
    </Modal>
  )
}
