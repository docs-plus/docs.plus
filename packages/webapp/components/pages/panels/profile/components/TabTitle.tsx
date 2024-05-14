import { twMerge } from 'tailwind-merge'

const TabTitle = ({ children, className }: any) => {
  return (
    <h2
      className={twMerge(
        `border-b pb-2 pl-4 text-2xl font-bold antialiased hover:subpixel-antialiased`,
        className
      )}>
      {children}
    </h2>
  )
}

export default TabTitle
