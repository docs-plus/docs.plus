import { twMerge } from 'tailwind-merge'

const TabSection = ({ name, description, children, className }) => {
  return (
    <div className={twMerge(`flex flex-col p-4 antialiased`, className)}>
      <p className="text-lg font-bold">{name}</p>
      <p className="text-gray-400 text-sm">{description}</p>
      {children}
    </div>
  )
}

export default TabSection
