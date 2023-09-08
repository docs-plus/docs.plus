import dynamic from 'next/dynamic'
import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'
import { Avatar } from '@components/Avatar'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})

const ProfileSection = ({ user }) => {
  return (
    <div className="mr-2 ml-5 sm:flex hidden">
      <Dialog>
        <DialogTrigger>
          {user ? (
            <Avatar width={24} height={24} className="rounded-full shadow-md border w-11 h-11" />
          ) : (
            'Signin'
          )}
        </DialogTrigger>
        <DialogContent>
          <ControlCenter />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ProfileSection
