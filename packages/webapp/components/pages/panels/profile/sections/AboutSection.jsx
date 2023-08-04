import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import TextAreaOvelapLabel from '@components/ui/TextAreaOvelapLabel'

const AboutSection = ({ bio, setBio, company, setCompany, jobTitle, setJobTitle }) => {
  return (
    <div className="flex flex-col">
      <TextAreaOvelapLabel
        label="About"
        className="mt-4"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />
      <InputOverlapLabel
        label="Company"
        className="mt-4"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
      />
      <InputOverlapLabel
        label="Job Title"
        className="mt-4"
        value={jobTitle}
        onChange={(e) => setJobTitle(e.target.value)}
      />
    </div>
  )
}

export default AboutSection
