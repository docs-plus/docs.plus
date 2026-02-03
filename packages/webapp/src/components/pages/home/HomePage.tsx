import HeadSeo from '@components/HeadSeo'
import { DocsPlus } from '@components/icons/Icons'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import { Modal, ModalContent } from '@components/ui/Dialog'
import Loading from '@components/ui/Loading'
import TextInput from '@components/ui/TextInput'
import TypingText from '@components/ui/TypingText'
import useVirtualKeyboard from '@hooks/useVirtualKeyboard'
import { useAuthStore, useStore } from '@stores'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/router'
import { ChangeEvent, KeyboardEvent, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import {
  LuBuilding2,
  LuCalendar,
  LuGithub,
  LuGlobe,
  LuGraduationCap,
  LuMessageCircle,
  LuRocket,
  LuUsers
} from 'react-icons/lu'
import slugify from 'slugify'

const SignInForm = dynamic(() => import('@components/auth/SignInForm'), {
  loading: () => <Loading />
})
const ProfilePanel = dynamic(() => import('@components/profile/ProfilePanel'), {
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
        className="bg-base-200 flex flex-col"
        style={{ minHeight: keyboardHeight > 0 ? `calc(100dvh - ${keyboardHeight}px)` : '100dvh' }}>
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <DocsPlus size={28} className="sm:size-10" />
            <span className="text-base-content text-lg font-bold sm:text-2xl">docs.plus</span>
          </div>

          {isAuthServiceAvailable && (
            <div className="flex items-center gap-2">
              {user ? (
                <button
                  type="button"
                  className="tooltip tooltip-bottom cursor-pointer transition-transform hover:scale-105"
                  onClick={() => setIsProfileOpen(true)}
                  data-tip="Profile">
                  <Avatar
                    src={user.avatar_url}
                    avatarUpdatedAt={user.avatar_updated_at}
                    id={user.id}
                    alt={user.display_name}
                    clickable={false}
                    size="lg"
                    className="border-base-300 border shadow-md"
                  />
                </button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-selector px-5 font-semibold"
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
            <div className="mb-6 text-center sm:mb-10">
              <h1 className="text-base-content mb-2 text-3xl font-bold sm:mb-3 sm:text-5xl md:text-6xl">
                Get everyone on the same page
              </h1>
              <p className="text-base-content/60 text-sm sm:text-lg">
                <span className="hidden sm:inline">
                  Free, open-source collaborative documents for
                </span>
                <span className="sm:hidden">Open-source docs for</span>{' '}
                <TypingText
                  texts={[
                    { text: 'teams', icon: <LuUsers size={14} />, className: 'text-blue-600' },
                    {
                      text: 'communities',
                      icon: <LuGlobe size={14} />,
                      className: 'text-violet-600'
                    },
                    {
                      text: 'classrooms',
                      icon: <LuGraduationCap size={14} />,
                      className: 'text-emerald-600'
                    },
                    { text: 'projects', icon: <LuRocket size={14} />, className: 'text-amber-600' },
                    { text: 'meetups', icon: <LuCalendar size={14} />, className: 'text-rose-600' },
                    {
                      text: 'organizations',
                      icon: <LuBuilding2 size={14} />,
                      className: 'text-teal-600'
                    }
                  ]}
                  className="font-semibold"
                  minWidth="130px"
                  typingSpeed={80}
                  deletingSpeed={40}
                  delayAfterTyping={2000}
                />
              </p>
            </div>

            {/* Action Card */}
            <div className="rounded-box bg-base-100 p-5 shadow-xl sm:p-8">
              {/* Quick Create */}
              <Button
                variant="primary"
                shape="block"
                size="lg"
                className="mb-6 text-base font-bold shadow-sm sm:mb-8"
                onClick={() => navigateToDocument()}
                disabled={isLoading}
                loading={isLoading}>
                Create New Document
              </Button>

              {/* Divider */}
              <div className="mb-6 flex items-center gap-3 sm:mb-8 sm:gap-4">
                <div className="bg-base-300 h-px flex-1" />
                <span className="text-base-content/40 text-xs sm:text-sm">or open existing</span>
                <div className="bg-base-300 h-px flex-1" />
              </div>

              {/* Document Name Input */}
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <TextInput
                  wrapperClassName="flex-1"
                  label={`${hostname}/`}
                  type="text"
                  required
                  pattern="[a-z0-9\-]*"
                  minLength={3}
                  maxLength={30}
                  title="Only lowercase letters, numbers or dash"
                  value={documentName}
                  inputMode="text"
                  enterKeyHint="go"
                  placeholder="document-name"
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  containerClassName="w-full"
                />
                <Button
                  variant="neutral"
                  className="px-6"
                  onClick={() => navigateToDocument()}
                  disabled={isLoading || !documentName}>
                  Open
                </Button>
              </div>
            </div>

            {/* Info Links */}
            <div className="text-base-content/50 mt-8 space-y-1 text-center text-xs sm:mt-12 sm:space-y-2 sm:text-sm">
              <p>
                A{' '}
                <a
                  href="https://github.com/docs-plus"
                  className="text-primary font-medium hover:underline">
                  free & open source
                </a>{' '}
                project by{' '}
                <a
                  href="https://newspeak.house"
                  className="text-primary font-medium hover:underline">
                  Newspeak House
                </a>
              </p>
              <p>
                Seed funded by{' '}
                <a
                  href="https://www.grantfortheweb.org"
                  className="text-primary font-medium hover:underline">
                  Grant for Web
                </a>{' '}
                &{' '}
                <a
                  href="https://www.nesta.org.uk"
                  className="text-primary font-medium hover:underline">
                  Nesta
                </a>
              </p>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="text-base-content/60 flex shrink-0 items-center justify-center gap-3 px-4 py-4 text-sm sm:gap-6 sm:py-8">
          {/* GitHub group */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/docs-plus/docs.plus"
              className="bg-neutral text-neutral-content hover:bg-neutral/90 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors sm:text-sm">
              <LuGithub size={16} />
              <span>GitHub</span>
            </a>
            <a
              href="https://github.com/docs-plus/docs.plus/discussions"
              className="border-base-300 text-base-content hover:bg-base-200 flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors sm:text-sm">
              <LuMessageCircle size={16} />
              <span>Discuss</span>
            </a>
          </div>

          {/* Divider */}
          <div className="bg-base-300 h-6 w-px" />

          {/* Discord */}
          <a
            href="https://discord.com/invite/25JPG38J59"
            className="flex items-center gap-2 rounded-full bg-[#5865F2] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#4752C4] sm:text-sm">
            <FaDiscord size={16} />
            <span>Discord</span>
          </a>
        </footer>
      </div>

      {/* Profile Modal */}
      {user && (
        <Modal open={isProfileOpen} onOpenChange={setIsProfileOpen}>
          <ModalContent size="4xl" className="overflow-hidden rounded-2xl p-0">
            <ProfilePanel onClose={() => setIsProfileOpen(false)} />
          </ModalContent>
        </Modal>
      )}

      {/* Sign In Modal */}
      {isAuthServiceAvailable && !user && (
        <Modal open={isSignInOpen} onOpenChange={setIsSignInOpen}>
          <ModalContent size="sm" className="overflow-hidden p-0">
            <SignInForm variant="card" showHeader onClose={() => setIsSignInOpen(false)} />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}

export default HomePage
