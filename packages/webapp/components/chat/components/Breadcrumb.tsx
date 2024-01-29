import { useChatStore } from '@stores'

const Breadcrumb = () => {
  const { headingPath } = useChatStore((state) => state.chatRoom)

  if (!headingPath.length) return null

  return (
    <nav className="flex" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1">
        {headingPath.map((heading: any, index: number) => {
          return (
            <li key={index} aria-current={headingPath.length - 1 === index ? 'page' : undefined}>
              <div className="flex items-center">
                {index === 0 ? (
                  <svg
                    className="w-3 h-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 16 20">
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 5v10M3 5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm9-10v.4A3.6 3.6 0 0 1 8.4 9H6.61A3.6 3.6 0 0 0 3 12.605M14.458 3a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="rtl:rotate-180 w-3 h-3 text-gray-400 mx-1"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 6 10">
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="m1 9 4-4-4-4"
                    />
                  </svg>
                )}
                {headingPath.length - 1 === index ? (
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    {heading.text}
                  </span>
                ) : (
                  <a
                    href={heading.url}
                    target="_blank"
                    className="ms-1 text-sm font-medium text-gray-700 hover:text-blue-600 md:ms-2 dark:text-gray-400 dark:hover:text-white">
                    {heading.text}
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

export default Breadcrumb
