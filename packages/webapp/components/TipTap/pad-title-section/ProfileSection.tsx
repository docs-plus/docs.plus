import dynamic from 'next/dynamic'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import Modal from '@components/ui/Modal'
import { useState } from 'react'

const ControlCenter = dynamic(() => import('@components/ControlCenter'), {
  loading: () => <div>Loading...</div>
})

const ProfileSection = () => {
  const user = useAuthStore((state) => state.profile)
  const [isModalOpen, setModalOpen] = useState(false)

  return (
    <div className="ml-5 mr-2 hidden sm:flex">
      {user ? (
        <Avatar
          onClick={() => setModalOpen(true)}
          id={user.id}
          src={user.avatar_url}
          avatarUpdatedAt={user.avatar_updated_at}
          width={24}
          height={24}
          className="size-11 cursor-pointer rounded-full border shadow-xl"
        />
      ) : (
        <Button id="btn_signin">Signin</Button>
      )}
      <Modal asAChild={false} id="modal_profile" isOpen={isModalOpen} setIsOpen={setModalOpen}>
        <ControlCenter defaultTab="profile" />
      </Modal>
    </div>
  )
}

export default ProfileSection
