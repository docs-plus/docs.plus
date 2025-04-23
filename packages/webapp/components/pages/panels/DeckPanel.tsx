import { DocsPlus } from '@icons'
import Button from '@components/ui/Button'
import slugify from 'slugify'
import { useState, useContext, KeyboardEvent, ChangeEvent } from 'react'
import { TabsContext } from '@components/ui/Tabs/Tabs'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { useStore, useAuthStore } from '@stores'
import Input from '@components/ui/Input'

interface DeckPanelProps {
  hostname: string
}

type TargetType = 'random' | { type: string }

const DeckPanel = ({ hostname }: DeckPanelProps) => {
  const user = useAuthStore((state) => state.profile)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

  const [loadingDoc, setLoadingDoc] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [documentName, setDocumentName] = useState<string>('')
  // @ts-ignore - TabsContext has a setActiveTab property
  const { setActiveTab } = useContext(TabsContext)

  const validateDocName = (docSlug: string): [string | null, string] => {
    const slug = slugify(docSlug, { lower: true, strict: true })
    let errorMessage = null

    if (docSlug.length < 3 || docSlug.length > 30) {
      errorMessage = 'Document name must be 3 to 30 characters'
    } else if (docSlug !== slug) {
      errorMessage = 'Only lowercase letters, numbers and dashes are allowed'
    }

    return [errorMessage, slug]
  }

  const enterToPad = (target: TargetType) => {
    setLoadingDoc(true)
    let docSlug = documentName

    if (target === 'random') {
      docSlug = (Math.random() + 1).toString(36).substring(2)
    }

    const [error, slug] = validateDocName(docSlug)
    if (error) {
      setError(error)
      setLoadingDoc(false)
      return
    }

    window.location.href = `/${slug}`
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      enterToPad({ type: 'keydown' })
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDocumentName(e.target.value)
    setError(null)
  }

  return (
    <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
      <div className="w-full px-4 md:w-1/2">
        <div className="p-2 md:p-4">
          <div className="flex flex-row items-end antialiased">
            <DocsPlus className="mr-2 md:mr-3" size={38} aria-hidden="true" />
            <span className="text-2xl font-bold antialiased md:text-4xl">docs.plus</span>
          </div>
          <h2 className="mt-2 font-semibold text-gray-400 antialiased md:mt-3">
            Get everyone on the same page
          </h2>
          <div className="mt-3 flex flex-col gap-1 md:mt-1 md:gap-2">
            <p>
              <span>+</span> A{' '}
              <a href="https://github.com/docs-plus" className="link link-primary no-underline">
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
      <div className="w-full px-4 pb-8 md:w-1/2 md:pb-0">
        <div className="flex w-full flex-col justify-center gap-3 rounded-md border border-gray-300 p-4 md:mx-auto md:max-w-sm md:gap-4 md:p-5">
          <button
            className="btn btn-neutral btn-block hidden md:block"
            onClick={() => enterToPad('random')}>
            Create a new Public Doc
          </button>

          <div className="divider my-1 hidden md:my-2 md:flex">OR</div>

          <Input
            required
            pattern="[a-z0-9\-]*"
            minLength={3}
            maxLength={30}
            title="Only lowercase letters, numbers or dash"
            value={documentName}
            inputMode="text"
            enterKeyHint="go"
            placeholder="Document name"
            className="validator w-full"
            label={`${hostname}/`}
            labelPosition="before"
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          {error && (
            <span className="validator-hint text-error md: !m-0 text-xs font-bold">
              Must be 3 to 30 characters containing only lowercase letters, numbers or dash
            </span>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={loadingDoc}
            onClick={() => enterToPad({ type: 'click' })}>
            Open Public Doc
          </button>

          {isAuthServiceAvailable && !user && (
            <p className="md: text-xs text-gray-400">
              {`Don't have an account yet? `}
              <button
                className="text-docsy font-bold antialiased"
                onClick={() => setActiveTab('sign-in')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default DeckPanel
