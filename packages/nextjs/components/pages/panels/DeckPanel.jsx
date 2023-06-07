import { DocsPlus, GoogleGIcon, Sparkles } from '@icons/Icons'
import Button from '../../../components/Button'
import slugify from 'slugify'
import { useUser } from '@supabase/auth-helpers-react'
import { useState, useRef, useContext, useEffect, useCallback } from 'react'
import { TabsContext } from '../../../components/Tabs/Tabs'
import { useEditorStateContext } from '../../../context/EditorContext'
import InputOverlapLabel from '../../../components/InputOverlapLabel'

const DeckPanel = ({ hostname }) => {
  const user = useUser()
  const { isAuthServiceAvailable } = useEditorStateContext()
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [error, setError] = useState(null)
  const { setActiveTab } = useContext(TabsContext)
  const [documentName, setDocumentName] = useState('')

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
      <div className="sm:w-1/2 sm:mx-auto">
        <div className="p-4">
          <div className="flex flex-row items-end antialiased">
            {' '}
            <DocsPlus className="mr-3" size="58" /> <span className="font-bold text-4xl antialiased">Docs plus</span>
          </div>
          <h2 className="mt-3 text-gray-400 font-semibold antialiased">Get everyone on the same page</h2>
          <div className="mt-5 leading-7 ">
            <p>
              <span>+</span>A <a href="https://github.com/docs-plus">free &amp; open source</a> project by{' '}
              <a href="https://newspeak.house">Newspeak House</a>
            </p>
            <p>
              <span>+</span> Enquiries to <a href="https://www.twitter.com/docsdotplus">@docsdotplus</a> or{' '}
              <a href="mailto:ed@newspeak.house">ed@newspeak.house</a>
            </p>
            <p>
              <span>+</span> Found a bug? Help us out by{' '}
              <a href="https://github.com/docs-plus/docs.plus/issues">reporting it</a>.{' '}
            </p>
            <p>
              <span>+</span> <a href="https://www.patreon.com/docsplus">Back us on Patreon</a> to help us pay for
              hosting &amp; development
            </p>
            <p>
              <span>+</span> Kindly seed funded by <a href="https://www.grantfortheweb.org">Grant for Web</a> &amp;{' '}
              <a href="https://www.nesta.org.uk">Nesta</a>
            </p>
          </div>
        </div>
      </div>
      <div className="sm:w-1/2 w-full mt-6 sm:mt-0 flex justify-end">
        <div className="p-5 sm:w-[24rem] w-full border sm:border rounded-md flex flex-col">
          <div className="flex flex-col  text-gray-800">
            <p className="text-lg antialiased mb-8 text-center font-bold">Let's have a collaborative journey!</p>

            <button className="px-3 w-full py-2 border rounded" onClick={() => enterToPad('random')}>
              Create a new public doc
            </button>

            <div className="flex items-center justify-center my-6 ">
              <div className="w-full bg-gray-200 h-0 border"></div>
              <div className="text-center px-2 font-medium text-gray-400 antialiased">OR</div>
              <div className="w-full bg-gray-200 h-0 border"></div>
            </div>

            <div className="flex flex-col w-full">
              <div className="flex flex-col sm:flex-row w-full font-mono text-sm align-middle">
                <p className="sm:px-2 py-2 leading-6 rounded sm:rounded-l sm:border sm:border-r-0 sm:rounded-r-none">
                  {hostname}
                </p>

                <InputOverlapLabel
                  className=" w-full sm:rounded-l-none  font-mono"
                  value={documentName}
                  label="Document Name"
                  id="padName"
                  type="text"
                  onChange={(e) => setDocumentName(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
              </div>
              {error && (
                <p className="text-red-700 text-sm mt-2">*Only lowercase letters, numbers and dashes are allowed</p>
              )}
              <Button
                className=" text-black border ml-auto mt-2 w-full px-3 py-2 rounded"
                loading={loadingDoc}
                onClick={enterToPad}>
                Open public doc
              </Button>
            </div>
            {isAuthServiceAvailable && !user && (
              <div>
                <p className="text-gray-400 text-sm mt-4">
                  Don't have an account yet?{' '}
                  <button className="font-bold text-docsy antialiased" onClick={() => setActiveTab('sign-in')}>
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
