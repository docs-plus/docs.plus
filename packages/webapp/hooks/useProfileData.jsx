import { useState, useEffect } from 'react'
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'

const useProfileData = () => {
  const user = useUser()
  const supabaseClient = useSupabaseClient()

  const [loadingProfileData, setLoadingProfileData] = useState(false)
  const [profileData, setProfileData] = useState(null)
  const [profileFetchingError, setProfileFetchingError] = useState(null)

  useEffect(() => {
    if (!user) return // prevent running if user is null
    setLoadingProfileData(true)

    const fetchProfile = async () => {
      const { data, error } = await supabaseClient.from('profiles').select().eq('id', user.id).single()
      if (error) {
        setProfileFetchingError(error)
      } else {
        setProfileData(data)
      }
      setLoadingProfileData(false)
    }
    fetchProfile()
  }, [user, supabaseClient]) // include user and supabaseClient as dependencies

  return {
    loadingProfileData,
    profileData,
    profileFetchingError
  }
}

export default useProfileData
