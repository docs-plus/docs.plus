import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import type { User } from '@supabase/supabase-js'
import type { IconType } from 'react-icons'
import { FcGoogle } from 'react-icons/fc'
import { LuKeyRound, LuMail, LuPlug, LuShield } from 'react-icons/lu'

import { useConnectedApps } from '../hooks/useConnectedApps'
import type { TabType } from '../types'
import SettingsCard from './SettingsCard'

interface SignInMethod {
  provider: string
  name: string
  icon: IconType
  note: (user: User) => string
}

// Fixed order; providers not listed here are not shown.
const SIGN_IN_METHODS: SignInMethod[] = [
  {
    provider: 'google',
    name: 'Google',
    icon: FcGoogle,
    note: (user) => {
      const google = user.identities?.find((identity) => identity.provider === 'google')
      const email = google?.identity_data?.email ?? user.email
      return email ? `Connected to ${email}` : 'Connected'
    }
  },
  {
    provider: 'email',
    name: 'Email link',
    icon: LuMail,
    note: () => 'We email you a link each time you sign in.'
  }
]

const userProviders = (user: User | null): Set<string> => {
  if (!user) return new Set()
  const fromIdentities = user.identities?.map((identity) => identity.provider) ?? []
  const providers = fromIdentities.length ? fromIdentities : (user.app_metadata?.providers ?? [])
  return new Set<string>(providers)
}

// The store keeps the signed-in Supabase user under `session`.
const useAuthUser = () => useAuthStore((state) => state.session) as User | null

const AccountEmailCard = () => {
  // The profile query leaves out `email` (column grant), so read the auth user.
  const email = useAuthUser()?.email

  return (
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <LuShield size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">Account email</h2>
      </div>
      <p className="text-base-content/60 mb-3 text-xs sm:text-sm">
        The email address of your docs.plus account.
      </p>

      <TextInput
        label="Current email"
        labelPosition="floating"
        type="email"
        placeholder="Current email"
        value={email || ''}
        disabled
      />
    </SettingsCard>
  )
}

const SignInMethodsCard = () => {
  const user = useAuthUser()
  const providers = userProviders(user)
  const methods = SIGN_IN_METHODS.filter((method) => providers.has(method.provider))

  return (
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <LuKeyRound size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">How you sign in</h2>
      </div>
      {user && methods.length > 0 && (
        <ul className="border-base-300 rounded-box divide-base-300 mb-3 divide-y border">
          {methods.map((method) => {
            const Icon = method.icon
            return (
              <li key={method.provider} className="flex items-center gap-3 p-3 sm:p-4">
                <span
                  aria-hidden
                  className="bg-base-200 rounded-field text-base-content/70 flex size-9 shrink-0 items-center justify-center">
                  <Icon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-base-content text-sm font-semibold">{method.name}</p>
                  <p className="text-base-content/60 mt-0.5 truncate text-xs">
                    {method.note(user)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-base-content/60 text-xs sm:text-sm">
        docs.plus does not use passwords. Sign in with Google or an email link.
      </p>
    </SettingsCard>
  )
}

const AppsWithAccessCard = ({ onSelectTab }: { onSelectTab?: (tab: TabType) => void }) => {
  const { data: apps, isPending, isError } = useConnectedApps()

  let status: React.ReactNode
  if (isPending) {
    status = <span aria-hidden className="skeleton rounded-field block h-4 w-48" />
  } else if (isError) {
    status = 'Could not load your connected apps.'
  } else if (apps.length === 0) {
    status = 'No AI apps can use your account.'
  } else {
    status = `${apps.length} AI ${apps.length === 1 ? 'app' : 'apps'} can use your account.`
  }

  return (
    <SettingsCard>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[12rem] flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <LuPlug size={20} className="text-primary" />
            <h2 className="text-base-content text-base font-semibold">Apps with access</h2>
          </div>
          <div aria-busy={isPending} className="text-base-content/60 text-xs sm:text-sm">
            {status}
          </div>
        </div>
        {onSelectTab && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectTab('connected-apps')}
            className="border-base-300 shrink-0 border">
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
