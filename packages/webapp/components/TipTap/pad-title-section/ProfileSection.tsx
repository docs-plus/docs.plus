import dynamic from 'next/dynamic'
import { Dialog, DialogTrigger, DialogContent } from '@components/ui/Dialog'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})

const ProfileSection = () => {
  const user = useAuthStore((state) => state.profile)

  return (
    <div className="mr-2 ml-5 sm:flex hidden">
      <Dialog>
        <DialogTrigger asChild={true}>
          {user ? (
            <Avatar
              id={user.id}
              src={user.avatar_url}
              width={24}
              height={24}
              className="rounded-full shadow-xl border w-11 h-11"
            />
          ) : (
            <Button id="btn_signin">Signin</Button>
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
