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
          className="hover:bg-indigo-500 transition-all bg-docsy hidden sm:flex mt-0 drop-shadow-sm font-light ml-6 text-white w-28">
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
