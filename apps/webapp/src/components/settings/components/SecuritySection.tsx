import TextInput from '@components/ui/TextInput'
import { useAuthStore } from '@stores'
import { LuShield } from 'react-icons/lu'

import SettingsCard from './SettingsCard'

const SecuritySection = () => {
  const email = useAuthStore((state) => state.profile?.email)

  return (
    <div className="space-y-4">
      <SettingsCard>
        <div className="mb-3 flex items-center gap-2">
          <LuShield size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Account Email</h2>
        </div>
        <p className="text-base-content/60 mb-3 text-xs sm:text-sm">
          The email address associated with your docs.plus account. Email changes are not yet
          supported; contact support if you need to update it.
        </p>

        <TextInput
          label="Current Email"
          labelPosition="floating"
          type="email"
          placeholder="Current Email"
          value={email || ''}
          disabled
        />
      </SettingsCard>
    </div>
  )
}

export default SecuritySection
