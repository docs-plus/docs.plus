import { DocsPlus } from '@icons'
import Button from '@components/ui/Button'
import slugify from 'slugify'
import { useState, useContext } from 'react'
import { TabsContext } from '@components/ui/Tabs/Tabs'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { useStore, useAuthStore } from '@stores'

const DeckPanel = ({ hostname }) => {
  const user = useAuthStore((state) => state.profile)

  const [loadingDoc, setLoadingDoc] = useState(false)
  const [error, setError] = useState(null)
  const { setActiveTab } = useContext(TabsContext)
  const [documentName, setDocumentName] = useState('')
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

  // slugify the docNameRef
  const validateDocName = (docSlug) => {
    const slug = slugify(docSlug, { lower: true, strict: true })
    let errorMessage = null

    if (docSlug.length <= 0 || docSlug !== slug) {
      errorMessage = 'Only lowercase letters, numbers and dashes are allowed'

      return [errorMessage, slug]
    }

    return [errorMessage, slug]
  }

  const enterToPad = (target) => {
    setLoadingDoc(true)
    let docSlug = documentName

    if (target === 'random') docSlug = (Math.random() + 1).toString(36).substring(2)

    const [error, slug] = validateDocName(docSlug)
    if (error) {
      setError(error)
      setLoadingDoc(false)
      return
    }

    window.location = `/${slug}`
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      enterToPad(event)
    }
  }

  return (
    <>
      <div className="sm:mx-auto sm:w-1/2">
        <div className="p-4">
          <div className="flex flex-row items-end antialiased">
            <DocsPlus className="mr-3" size="58" />
            <span className="text-4xl font-bold antialiased">docs.plus</span>
          </div>
          <h2 className="mt-3 font-semibold text-gray-400 antialiased">
            Get everyone on the same page
          </h2>
          <div className="mt-5 leading-7 ">
            <p>
              <span>+</span> A{' '}
              <a href="https://github.com/docs-plus" className="link link-primary no-underline">
                {' '}
                free &amp; open source
              </a>{' '}
              project by{' '}
              <a href="https://newspeak.house" className="link link-primary no-underline">
                Newspeak House
              </a>
            </p>
            <p>
              <span>+</span> Enquiries to{' '}
              <a
                href="https://www.twitter.com/docsdotplus"
                className="link link-primary no-underline">
                @docsdotplus
              </a>{' '}
              or{' '}
              <a href="mailto:ed@newspeak.house" className="link link-primary no-underline">
                ed@newspeak.house
              </a>
            </p>
            <p>
              <span>+</span> Found a bug? Help us out by{' '}
              <a
                href="https://github.com/docs-plus/docs.plus/issues"
                className="link link-primary no-underline">
                reporting it
              </a>
              .{' '}
            </p>
            <p>
              <span>+</span>{' '}
              <a href="https://www.patreon.com/docsplus" className="link link-primary no-underline">
                Back us on Patreon
              </a>{' '}
              to help us pay for hosting &amp; development
            </p>
            <p>
              <span>+</span> Kindly seed funded by{' '}
              <a href="https://www.grantfortheweb.org" className="link link-primary no-underline">
                Grant for Web
              </a>{' '}
              &amp;{' '}
              <a href="https://www.nesta.org.uk" className="link link-primary no-underline">
                Nesta
              </a>
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 flex w-full justify-end sm:mt-0 sm:w-1/2">
        <div className="flex w-full flex-col justify-center rounded-md border p-5 sm:w-96 sm:border">
          <div className="flex flex-col  text-gray-800">
            {/* <p className="text-lg antialiased mb-8  text-gray-700 font-bold">
              {`Let's have a collaborative journey!`}
            </p> */}

            <Button className="btn-neutral text-white" onClick={() => enterToPad('random')}>
              Create a new Public Doc
            </Button>

            <div className="divider text-gray-400">OR</div>

            <div className="flex w-full flex-col">
              <div className="font-mono flex w-full flex-col align-middle text-sm sm:flex-row">
                <p className="rounded py-2 leading-6 sm:rounded-l sm:rounded-r-none sm:border sm:border-r-0 sm:px-2">
                  {hostname}
                </p>

                <InputOverlapLabel
                  className=" font-mono w-full  sm:rounded-l-none"
                  value={documentName}
                  label="Document Name"
                  id="padName"
                  inputMode="text"
                  enterKeyHint="Go"
                  type="text"
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-700">
                  *Only lowercase letters, numbers and dashes are allowed
                </p>
              )}
              <Button
                className="btn-primary mt-2 text-white"
                loading={loadingDoc}
                onClick={enterToPad}>
                Open Public Doc
              </Button>
            </div>

            {isAuthServiceAvailable && !user && (
              <div>
                <p className="mt-4 text-sm text-gray-400">
                  {`Don't have an account yet? `}
                  <button
                    className="font-bold text-docsy antialiased"
                    onClick={() => setActiveTab('sign-in')}>
                    Sign in
                  </button>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default DeckPanel
