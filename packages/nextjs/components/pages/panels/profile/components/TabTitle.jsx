import { twMerge } from 'tailwind-merge'

const TabTitle = ({ children, className }) => {
  return (
    <h2 className={twMerge(`text-2xl font-bold pb-2 pl-4 border-b antialiased hover:subpixel-antialiased`, className)}>
      {children}
    </h2>
  )
}

export default TabTitle
