import { useState } from 'react'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Button from '@components/ui/Button'
import ShareModal from './ShareModal'
import { PrivateShare } from '@icons'

const ShareModalSection = () => {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        Icon={PrivateShare}
        onClick={() => setOpen(true)}
        className="bg-docsy mt-0 ml-6 hidden w-28 font-light text-white drop-shadow-sm transition-all hover:bg-indigo-500 sm:flex">
        Share
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent>
          <ShareModal />
        </ModalContent>
      </Modal>
    </>
  )
}

export default ShareModalSection
