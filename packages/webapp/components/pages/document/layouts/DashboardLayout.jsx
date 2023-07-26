import GitHubButton from 'react-github-btn'

export default function DashboardLayout({ children }) {
  return (
    <>
      {children}
      <div className="flex w-full flex-wrap md:flex-no-wrap border-t mt-8">
        <div className="w-full md:w-3/4 p-2 pl-0">
          <p className=" font-normal text-sm text-gray-700 leading-8 text-center sm:text-left">
            Start exploring our <span className="font-bold antialiased underline">open-source</span> project
            on
            <a href="https://github.com/docs-plus/docs.plus" rel="_blanck">
              {' '}
              GitHub
            </a>
            , Join our{' '}
            <a href="https://github.com/docs-plus/docs.plus/discussions" rel="_blanck">
              discussions
            </a>{' '}
            and help make it even better!
          </p>
        </div>
        <div className="w-full md:w-1/4 p-2 pr-0">
          <div className="ml-auto flex align-middle justify-around sm:justify-end ">
            <div className="mr-3">
              <GitHubButton
                aria-label="Star docs-plus/docs.plus on GitHub"
                data-color-scheme="no-preference: light; light: light; dark: dark;"
                data-show-count="true"
                data-size="large"
                href="https://github.com/docs-plus/docs.plus">
                Star
              </GitHubButton>
            </div>
            <div>
              <GitHubButton
                aria-label="Discuss docs-plus/docs.plus on GitHub"
                data-color-scheme="no-preference: light; light: light; dark: dark;"
                data-size="large"
                href="https://github.com/docs-plus/docs.plus/discussions">
                Discuss
              </GitHubButton>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
