import { useState, KeyboardEvent, ChangeEvent } from 'react'
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
import {
  LuGithub,
  LuMessageCircle,
  LuUsers,
  LuGlobe,
  LuGraduationCap,
  LuRocket,
  LuCalendar,
  LuBuilding2
} from 'react-icons/lu'
import { FaDiscord } from 'react-icons/fa'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'

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
  const isAuthServiceAvailable = useStore((state) => state.settings.isAuthServiceAvailable)
  const keyboardHeight = useStore((state) => state.keyboardHeight)

  const [documentName, setDocumentName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)

  // Initialize keyboard tracking for iOS
  useVirtualKeyboard()

  const navigateToDocument = (name?: string) => {
    setIsLoading(true)
    let docSlug = name || documentName

    if (!docSlug) {
      docSlug = (Math.random() + 1).toString(36).substring(2)
    }

    let sanitizedSlug = slugify(docSlug, { lower: true, strict: true })

    if (sanitizedSlug.length < 3) {
      sanitizedSlug = sanitizedSlug.padEnd(3, 'x')
    } else if (sanitizedSlug.length > 30) {
      sanitizedSlug = sanitizedSlug.substring(0, 30)
    }

    router.push(`/${sanitizedSlug}`)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && documentName) {
      navigateToDocument()
    }
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setDocumentName(e.target.value)
  }

  return (
    <>
      <HeadSeo />

      <div
        className="flex flex-col bg-gradient-to-b from-slate-50 to-slate-100"
        style={{ minHeight: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh' }}>
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-4 py-2 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <DocsPlus size={28} className="sm:size-8" />
            <span className="text-lg font-bold text-slate-800 sm:text-2xl">docs.plus</span>
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
                    className="size-9 rounded-full border-2 border-white shadow-md sm:size-10"
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
        <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-4 sm:py-12">
          <div className="w-full max-w-2xl">
            {/* Hero Section */}
            <div className="mb-3 text-center sm:mb-8">
              <h1 className="mb-1 text-2xl font-bold text-slate-800 sm:mb-2 sm:text-4xl md:text-5xl">
                Get everyone on the same page
              </h1>
              <p className="text-sm text-slate-500 sm:text-base">
                <span className="hidden sm:inline">
                  Free, open-source collaborative documents for
                </span>
                <span className="sm:hidden">Open-source docs for</span>{' '}
                <span className="text-rotate inline-block h-6 overflow-hidden align-middle text-sm font-semibold sm:h-7 sm:text-base">
                  <span className="flex flex-col items-center">
                    <span className="flex h-6 items-center gap-1 rounded-full bg-blue-50 px-2 text-blue-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuUsers className="size-3.5 sm:size-4" />
                      teams
                    </span>
                    <span className="flex h-6 items-center gap-1 rounded-full bg-violet-50 px-2 text-violet-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuGlobe className="size-3.5 sm:size-4" />
                      communities
                    </span>
                    <span className="flex h-6 items-center gap-1 rounded-full bg-emerald-50 px-2 text-emerald-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuGraduationCap className="size-3.5 sm:size-4" />
                      classrooms
                    </span>
                    <span className="flex h-6 items-center gap-1 rounded-full bg-amber-50 px-2 text-amber-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuRocket className="size-3.5 sm:size-4" />
                      projects
                    </span>
                    <span className="flex h-6 items-center gap-1 rounded-full bg-rose-50 px-2 text-rose-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuCalendar className="size-3.5 sm:size-4" />
                      meetups
                    </span>
                    <span className="flex h-6 items-center gap-1 rounded-full bg-teal-50 px-2 text-teal-600 sm:h-7 sm:gap-1.5 sm:px-3">
                      <LuBuilding2 className="size-3.5 sm:size-4" />
                      organizations
                    </span>
                  </span>
                </span>
              </p>
            </div>

            {/* Action Card */}
            <div className="rounded-2xl bg-white p-4 shadow-xl shadow-slate-200/50 sm:p-8">
              {/* Quick Create */}
              <Button
                className="btn btn-primary btn-block mb-4 h-11 rounded-xl text-base font-semibold sm:mb-6 sm:h-12"
                onClick={() => navigateToDocument()}
                disabled={isLoading}>
                {isLoading ? <Loading size="sm" /> : 'Create New Document'}
              </Button>

              {/* Divider */}
              <div className="mb-4 flex items-center gap-3 sm:mb-6 sm:gap-4">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs text-slate-400 sm:text-sm">or open existing</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Document Name Input */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <div className="flex-1">
                  <Input
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
                  />
                </div>
                <Button
                  className="btn btn-neutral h-11 rounded-xl px-6 sm:h-auto"
                  onClick={() => navigateToDocument()}
                  disabled={isLoading || !documentName}>
                  Open
                </Button>
              </div>
            </div>

            {/* Info Links */}
            <div className="mt-4 space-y-1 text-center text-xs text-slate-500 sm:mt-10 sm:space-y-2 sm:text-sm">
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
        <footer className="flex shrink-0 items-center justify-center gap-3 px-4 py-3 text-sm text-slate-500 sm:gap-4 sm:py-6">
          {/* GitHub group */}
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/docs-plus/docs.plus"
              className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-white transition-colors hover:bg-slate-700 sm:px-4 sm:py-2 sm:text-sm">
              <LuGithub size={16} />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/docs-plus/docs.plus/discussions"
              className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3 py-1.5 text-xs transition-colors hover:bg-slate-100 sm:px-4 sm:py-2 sm:text-sm">
              <LuMessageCircle size={16} />
              <span>Discuss</span>
            </a>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-slate-300" />

          {/* Discord */}
          <a
            href="https://discord.com/invite/25JPG38J59"
            className="flex items-center gap-1.5 rounded-full bg-[#5865F2] px-3 py-1.5 text-xs text-white transition-colors hover:bg-[#4752C4] sm:px-4 sm:py-2 sm:text-sm">
            <FaDiscord size={16} />
            <span>Discord</span>
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
        <Modal asAChild={false} id="modal_signin" isOpen={isSignInOpen} setIsOpen={setIsSignInOpen}>
          <TabLayout name="sign-in" footer={false} className="w-full p-6 sm:w-[28rem] sm:p-6">
            <SignInPanel />
          </TabLayout>
        </Modal>
      )}
    </>
  )
}

export default HomePage
