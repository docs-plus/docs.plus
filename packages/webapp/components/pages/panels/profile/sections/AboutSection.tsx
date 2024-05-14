import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import TextAreaOvelapLabel from '@components/ui/TextAreaOvelapLabel'
import { useAuthStore } from '@stores'

const AboutSection = () => {
  const user = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  const handelUserDescription = (event: any) => {
    const description = event.target.value
    if (!user || !description) return
    // @ts-ignore
    setProfile({ ...user, description })
  }

  const handelUSerCompany = (event: any) => {
    const company = event.target.value
    if (!user || !company) return
    setProfile({ ...user, company })
  }

  const handelUserJobTitle = (event: any) => {
    const jobTitle = event.target.value
    if (!user || !jobTitle) return
    setProfile({ ...user, job_title: jobTitle })
  }

  return (
    <div className="flex flex-col">
      <TextAreaOvelapLabel
        label="About"
        className="mt-4"
        // @ts-ignore
        value={user?.description}
        onChange={handelUserDescription}
      />
      <InputOverlapLabel
        label="Company"
        className="mt-4"
        value={user?.company || ''}
        onChange={handelUSerCompany}
      />
      <InputOverlapLabel
        label="Job Title"
        className="mt-4"
        value={user?.job_title || ''}
        onChange={handelUserJobTitle}
      />
    </div>
  )
}

export default AboutSection
