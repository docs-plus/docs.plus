import TabTitle from './components/TabTitle'
import TabSection from './components/TabSection'

const SecurityTab = () => {
  return (
    <div className="border-l h-full">
      <TabTitle>Security</TabTitle>
      <TabSection
        name="Account email"
        description="The email address associated with your daily.dev account"></TabSection>
    </div>
  )
}

export default SecurityTab
