import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'
import Button from '@components/ui/Button'
import ShareModal from './ShareModal'
import { PrivateShare } from '@icons'

const ShareModalSection = () => {
  return (
    <Dialog>
      <DialogTrigger asChild={true}>
        <Button
          Icon={PrivateShare}
          className="ml-6 mt-0 hidden w-28 bg-docsy font-light text-white drop-shadow-sm transition-all hover:bg-indigo-500 sm:flex">
          Share
        </Button>
      </DialogTrigger>
      <DialogContent>
        <ShareModal />
      </DialogContent>
    </Dialog>
  )
}

export default ShareModalSection
