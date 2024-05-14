import { TabPanel } from '@components/ui/Tabs/Tabs'
import { twMerge } from 'tailwind-merge'
import dynamic from 'next/dynamic'

const DashboardLayout = dynamic(() => import('@pages/document/layouts/DashboardLayout'))

type TabLayoutProps = {
  name: string
  children: React.ReactNode
  className?: string
  footer?: boolean
}

const TabLayout = ({ name, children, className, footer }: TabLayoutProps) => {
  return (
    <TabPanel
      name={name}
      className={twMerge(
        `flex flex-wrap p-2 pb-2 sm:m-auto sm:justify-center sm:p-6 sm:py-6 sm:pb-2`,
        className
      )}>
      <DashboardLayout footer={footer}>{children}</DashboardLayout>
    </TabPanel>
  )
}

export default TabLayout
