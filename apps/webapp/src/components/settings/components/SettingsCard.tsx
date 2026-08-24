import { twMerge } from 'tailwind-merge'

interface SettingsCardProps {
  children: React.ReactNode
  className?: string
}

const SettingsCard = ({ children, className }: SettingsCardProps) => (
  <section
    className={twMerge('bg-base-100 border-base-300 rounded-box border p-4 sm:p-6', className)}>
    {children}
  </section>
)

export default SettingsCard
