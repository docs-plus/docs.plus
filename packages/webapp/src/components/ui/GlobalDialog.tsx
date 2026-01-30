import { useStore } from '@stores'

import { Modal, ModalContent } from './Dialog'

export function GlobalDialog() {
  const {
    globalDialog: { config, content, isOpen },
    closeDialog
  } = useStore()

  const handleOpenChange = (open: boolean) => {
    if (!open && config.dismissible !== false) {
      closeDialog()
    }
  }

  return (
    <Modal open={isOpen} onOpenChange={handleOpenChange}>
      <ModalContent size={config.size} className={config.className}>
        {content}
      </ModalContent>
    </Modal>
  )
}
