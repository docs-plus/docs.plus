import { useStore } from '@stores'

import { Modal, ModalContent } from './Dialog'

export function GlobalDialog() {
  const config = useStore((state) => state.globalDialog.config)
  const content = useStore((state) => state.globalDialog.content)
  const isOpen = useStore((state) => state.globalDialog.isOpen)
  const closeDialog = useStore((state) => state.closeDialog)

  const handleOpenChange = (open: boolean) => {
    if (!open && config.dismissible !== false) {
      closeDialog()
    }
  }

  return (
    <Modal open={isOpen} onOpenChange={handleOpenChange}>
      <ModalContent size={config.size} align={config.align} className={config.className}>
        {content}
      </ModalContent>
    </Modal>
  )
}
