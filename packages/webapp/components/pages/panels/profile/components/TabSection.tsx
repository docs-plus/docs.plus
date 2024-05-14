import { twMerge } from 'tailwind-merge'

const TabSection = ({ name, description, children, className }: any) => {
  return (
    <div className={twMerge(`flex flex-col p-4 antialiased`, className)}>
      <p className="text-lg font-bold">{name}</p>
      <p className="text-sm text-gray-400">{description}</p>
      {children}
    </div>
  )
}

export default TabSection
