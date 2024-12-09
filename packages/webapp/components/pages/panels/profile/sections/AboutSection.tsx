import TextAreaOvelapLabel from '@components/ui/TextAreaOvelapLabel'
import { useAuthStore } from '@stores'
import { Profile } from '@types'

const AboutSection = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const handelUserDescription = (event: any) => {
    const bio = event.target.value
    if (!user || !bio) return
    const newProfile_data = {
      ...((user?.profile_data as Profile) ?? {}),
      bio
    }
    setProfile({ ...user, profile_data: newProfile_data })
  }

  return (
    <div className="flex flex-col">
      <TextAreaOvelapLabel
        label="Bio"
        className="mt-4"
        value={user?.profile_data?.bio}
        onChange={handelUserDescription}
      />
    </div>
  )
}

export default AboutSection
