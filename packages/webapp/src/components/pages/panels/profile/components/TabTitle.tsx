import { RiArrowRightSLine } from 'react-icons/ri'

const TabTitle = ({ children, className, goBack, title }: any) => {
  return (
    <div className="flex w-full flex-row items-center border-b border-gray-300 py-2 md:px-4">
      {goBack && (
        <button onClick={goBack} className="btn btn-ghost mr-2 flex items-center md:hidden">
          <RiArrowRightSLine size={22} className="rotate-180" />
        </button>
      )}
      <h2 className={`text-2xl font-bold antialiased hover:subpixel-antialiased`}>{title}</h2>
      {children}
    </div>
  )
}

export default TabTitle
