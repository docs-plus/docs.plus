import Button from '@components/ui/Button'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import type { IconType } from 'react-icons'
import { FcGoogle } from 'react-icons/fc'
import { LuKeyRound, LuMail, LuPlugZap, LuShield } from 'react-icons/lu'

import { useConnectedApps } from '../hooks/useConnectedApps'
import type { TabType } from '../types'
import { appsWithAccessText } from '../utils/appsWithAccessText'
import { type SignInProvider, signInProvidersOf } from '../utils/signInProviders'
import SettingsCard, { SettingsCardHeader } from './SettingsCard'

interface SignInMethod {
  name: string
  icon: IconType
  note: (user: User) => string
}

const SIGN_IN_METHODS: Record<SignInProvider, SignInMethod> = {
  google: {
    name: 'Google',
    icon: FcGoogle,
    note: (user) => {
      const google = user.identities?.find((identity) => identity.provider === 'google')
      const email = google?.identity_data?.email ?? user.email
      return email ? `Connected to ${email}` : 'Connected'
    }
  },
  email: {
    name: 'Email link',
    icon: LuMail,
    note: () => 'We email you a link each time you sign in.'
  }
}

const AccountEmailCard = () => {
  const email = useAuthStore((s) => s.session?.email)
  if (!email) return null

  return (
    <SettingsCard>
      <SettingsCardHeader icon={LuShield} title="Account email" />
      <p className="text-base-content text-sm font-medium break-all">{email}</p>
    </SettingsCard>
  )
}

const SignInMethodsCard = () => {
  const user = useAuthStore((s) => s.session)
  const providers = signInProvidersOf(user)

  return (
    <SettingsCard>
      <SettingsCardHeader icon={LuKeyRound} title="How you sign in" />
      {user && providers.length > 0 && (
        <ul className="border-base-300 rounded-box divide-base-300 mb-3 divide-y border">
          {providers.map((provider) => {
            const method = SIGN_IN_METHODS[provider]
            const Icon = method.icon
            return (
              <li key={provider} className="flex items-center gap-3 p-3 sm:p-4">
                <span
                  aria-hidden
                  className="bg-base-200 rounded-field text-base-content/70 flex size-9 shrink-0 items-center justify-center">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base-content text-sm font-semibold">{method.name}</p>
                  <p className="text-meta text-base-content/60 mt-0.5 truncate">
                    {method.note(user)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-meta text-base-content/60">
        There are no passwords. Sign in with Google or an email link.
      </p>
    </SettingsCard>
  )
}

// Shown only when an app has access. Loading, failure and zero render nothing:
// the Connected apps tab owns the errors.
const AppsWithAccessCard = ({ onSelectTab }: { onSelectTab?: (tab: TabType) => void }) => {
  const { data: apps, isError } = useConnectedApps()
  if (isError || !apps?.length) return null

  return (
    <SettingsCard>
      <div className="flex flex-wrap items-center gap-3">
        <SettingsCardHeader
          icon={LuPlugZap}
          title="Apps with access"
          description={appsWithAccessText(apps.length)}
          className="mb-0 min-w-[12rem] flex-1"
        />
        {onSelectTab && (
          <Button
            variant="quiet"
            onClick={() => onSelectTab('connected-apps')}
            className="shrink-0">
            Review connected apps
          </Button>
        )}
      </div>
    </SettingsCard>
  )
}

const SecuritySection = ({ onSelectTab }: { onSelectTab?: (tab: TabType) => void }) => (
  <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
    <AccountEmailCard />
    <SignInMethodsCard />
    <AppsWithAccessCard onSelectTab={onSelectTab} />
  </div>
)

export default SecuritySection
