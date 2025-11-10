import React from 'react'
import Button from '@components/ui/Button'
import { LuLogOut } from 'react-icons/lu'
import { useSignOut } from '../hooks/useSignOut'

const SignOutButton = () => {
  const { isLoading: loading, handleSignOut } = useSignOut()

  return (
    <Button
      onClick={handleSignOut}
      className="join-item btn-block mt-auto flex items-center justify-center"
      loading={loading}>
      <LuLogOut size={18} className="mr-auto" />
      <span className="-ml-[24px] mr-auto">Sign-out</span>
    </Button>
  )
}

export default SignOutButton
