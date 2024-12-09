import GitHubButton from 'react-github-btn'

const Footer = () => {
  return (
    <div className="md:flex-no-wrap flex w-full flex-wrap border-t md:mt-8">
      <div className="w-full p-2 pl-0 md:w-3/4">
        <p className="text-center text-sm font-normal leading-8 text-gray-700 sm:text-left">
          Start exploring our <span className="font-bold underline antialiased">open-source</span>{' '}
          project on
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
      <div className="w-full p-2 pr-0 md:w-1/4">
        <div className="ml-auto flex justify-around align-middle sm:justify-end">
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
  )
}

export default function DashboardLayout({ children, footer = true }: any) {
  return (
    <>
      {children} {footer && <Footer />}
    </>
  )
}
