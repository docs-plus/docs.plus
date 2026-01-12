import { useState, useRef, useCallback, KeyboardEvent, ChangeEvent } from 'react'
import { useRouter } from 'next/router'
import slugify from 'slugify'
import dynamic from 'next/dynamic'
import HeadSeo from '@components/HeadSeo'
import { DocsPlus } from '@components/icons/Icons'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import Input from '@components/ui/Input'
import Loading from '@components/ui/Loading'
import Modal from '@components/ui/Modal'
import TabLayout from '../TabLayout'
import { useAuthStore, useStore } from '@stores'
import { LuGithub, LuMessageCircle } from 'react-icons/lu'

const SignInPanel = dynamic(() => import('@pages/panels/SignInPanel'), {
  loading: () => <Loading />
})
const ProfilePanel = dynamic(() => import('@pages/panels/profile/ProfilePanel'), {
  loading: () => <Loading />
})

interface HomePageProps {
  hostname: string
}

const HomePage = ({ hostname }: HomePageProps) => {
  const router = useRouter()
  const user = useAuthStore((state) => state.profile)
  const { isAuthServiceAvailable } = useStore((state) => state.settings)

  const [documentName, setDocumentName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const navigateToDocument = useCallback(
    (name?: string) => {
      setIsLoading(true)
      let docSlug = name || documentName

      if (!docSlug) {
        // Generate random slug
        docSlug = (Math.random() + 1).toString(36).substring(2)
      }

      // Sanitize the slug
      let sanitizedSlug = slugify(docSlug, { lower: true, strict: true })

      if (sanitizedSlug.length < 3) {
        sanitizedSlug = sanitizedSlug.padEnd(3, 'x')
      } else if (sanitizedSlug.length > 30) {
        sanitizedSlug = sanitizedSlug.substring(0, 30)
      }

      router.push(`/${sanitizedSlug}`)
    },
    [documentName, router]
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && documentName) {
      navigateToDocument()
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDocumentName(e.target.value)
  }

  // Scroll input into view when focused (mobile keyboard fix)
  const handleInputFocus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 300)
  }, [])

  return (
    <>
      <HeadSeo />

      <div className="flex min-h-[100dvh] flex-col bg-gradient-to-b from-slate-50 to-slate-100">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <DocsPlus size={32} />
            <span className="text-xl font-bold text-slate-800 sm:text-2xl">docs.plus</span>
          </div>

          {isAuthServiceAvailable && (
            <div className="flex items-center gap-2">
              {user ? (
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="transition-transform hover:scale-105">
                  <Avatar
                    src={user.avatar_url}
                    avatarUpdatedAt={user.avatar_updated_at}
                    id={user.id}
                    alt={user.display_name}
                    clickable={false}
                    className="size-10 rounded-full border-2 border-white shadow-md"
                  />
                </button>
              ) : (
                <Button
                  className="btn btn-primary btn-sm rounded-full px-4"
                  onClick={() => setIsSignInOpen(true)}>
                  Sign in
                </Button>
              )}
            </div>
          )}
        </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:py-12">
          <div className="w-full max-w-2xl">
            {/* Hero Section */}
            <div className="mb-8 text-center sm:mb-12">
              <h1 className="mb-3 text-3xl font-bold text-slate-800 sm:text-4xl md:text-5xl">
                Get everyone on the same page
              </h1>
              <p className="text-base text-slate-500 sm:text-lg">
                Free, open-source collaborative documents for teams
              </p>
            </div>

            {/* Action Card */}
            <div className="rounded-2xl bg-white p-6 shadow-xl shadow-slate-200/50 sm:p-8">
              {/* Quick Create */}
              <Button
                className="btn btn-primary btn-block mb-6 h-12 rounded-xl text-base font-semibold"
                onClick={() => navigateToDocument()}
                disabled={isLoading}>
                {isLoading ? <Loading size="sm" /> : 'Create New Document'}
              </Button>

              {/* Divider */}
              <div className="mb-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-sm text-slate-400">or open existing</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Document Name Input */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Input
                    ref={inputRef}
                    required
                    pattern="[a-z0-9\-]*"
                    minLength={3}
                    maxLength={30}
                    title="Only lowercase letters, numbers or dash"
                    value={documentName}
                    inputMode="text"
                    enterKeyHint="go"
                    placeholder="document-name"
                    className="w-full"
                    label={`${hostname}/`}
                    labelPosition="before"
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    onFocus={handleInputFocus}
                  />
                </div>
                <Button
                  className="btn btn-neutral h-12 rounded-xl px-6 sm:h-auto"
                  onClick={() => navigateToDocument()}
                  disabled={isLoading || !documentName}>
                  Open
                </Button>
              </div>
            </div>

            {/* Info Links */}
            <div className="mt-8 space-y-2 text-center text-sm text-slate-500 sm:mt-10">
              <p>
                A{' '}
                <a
                  href="https://github.com/docs-plus"
                  className="font-medium text-blue-600 hover:underline">
                  free & open source
                </a>{' '}
                project by{' '}
                <a
                  href="https://newspeak.house"
                  className="font-medium text-blue-600 hover:underline">
                  Newspeak House
                </a>
              </p>
              <p>
                Seed funded by{' '}
                <a
                  href="https://www.grantfortheweb.org"
                  className="font-medium text-blue-600 hover:underline">
                  Grant for Web
                </a>{' '}
                &{' '}
                <a
                  href="https://www.nesta.org.uk"
                  className="font-medium text-blue-600 hover:underline">
                  Nesta
                </a>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-center gap-4 px-4 py-6 text-sm text-slate-500">
          <a
            href="https://github.com/docs-plus/docs.plus"
            className="flex items-center gap-1.5 rounded-full bg-slate-800 px-4 py-2 text-white transition-colors hover:bg-slate-700">
            <LuGithub size={18} />
            <span>Star on GitHub</span>
          </a>
          <a
            href="https://github.com/docs-plus/docs.plus/discussions"
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-4 py-2 transition-colors hover:bg-slate-100">
            <LuMessageCircle size={18} />
            <span>Discuss</span>
          </a>
        </footer>
      </div>

      {/* Profile Modal */}
      {user && (
        <Modal
          asAChild={false}
          id="modal_profile"
          isOpen={isProfileOpen}
          setIsOpen={setIsProfileOpen}>
          <TabLayout name="profile" className="h-full max-h-[94%] max-w-[64rem]">
            <ProfilePanel />
          </TabLayout>
        </Modal>
      )}

      {/* Sign In Modal */}
      {isAuthServiceAvailable && !user && (
        <Modal
          asAChild={false}
          id="modal_signin"
          isOpen={isSignInOpen}
          setIsOpen={setIsSignInOpen}>
          <TabLayout name="sign-in" footer={false} className="w-full p-6 sm:w-[28rem] sm:p-6">
            <SignInPanel />
          </TabLayout>
        </Modal>
      )}
    </>
  )
}

export default HomePage
