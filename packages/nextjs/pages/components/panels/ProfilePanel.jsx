import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import Button from '../../../components/Button'

const ProfilePanel = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()

  const signOut = async () => {
    const { error } = await supabaseClient.auth.signOut()
    window.location = '/'
  }

  return (
    <>
      <p>Profile panel</p>
      <br />
      <hr />
      <Button onClick={signOut}>Sign-out</Button>
    </>
  )
}

export default ProfilePanel
