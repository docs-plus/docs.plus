import { useState } from 'react'
import { MdSecurity, MdInfo } from 'react-icons/md'
import { useAuthStore } from '@stores'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import * as toast from '@components/toast'

interface SecurityContentProps {
  onBack?: () => void
}

const SecurityContent = ({ onBack: _onBack }: SecurityContentProps) => {
  const user = useAuthStore((state) => state.profile)
  const [showChangeEmail, setShowChangeEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')

  const handleChangeEmail = () => {
    toast.Warning('This feature is temporarily unavailable.')
  }

  return (
    <div className="space-y-4">
      {/* Email Section */}
      <section className="bg-base-100 rounded-2xl p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <MdSecurity size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Account Email</h2>
        </div>
        <p className="text-base-content/60 mb-4 text-xs sm:text-sm">
          The email address associated with your docs.plus account.
        </p>

        <div className="space-y-3">
          {/* Current email display */}
          <TextInput
            label="Current Email"
            labelPosition="floating"
            type="email"
            placeholder="Current Email"
            value={user?.email || ''}
            disabled
          />

          {/* Change email section */}
          {!showChangeEmail ? (
            <Button
              onClick={() => setShowChangeEmail(true)}
              btnStyle="outline"
              size="sm"
              className="border-base-300 text-base-content hover:border-base-content/30 hover:bg-base-200">
              Change Email
            </Button>
          ) : (
            <div className="space-y-3">
              <TextInput
                label="New Email"
                labelPosition="floating"
                type="email"
                placeholder="New Email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />

              <div className="flex gap-2">
                <Button
                  onClick={handleChangeEmail}
                  variant="primary"
                  size="sm"
                  className="font-semibold">
                  Save
                </Button>
                <Button
                  onClick={() => {
                    setShowChangeEmail(false)
                    setNewEmail('')
                  }}
                  variant="ghost"
                  size="sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Info notice */}
      <div className="bg-base-200 flex items-start gap-3 rounded-xl p-4">
        <MdInfo size={20} className="text-primary mt-0.5 shrink-0" />
        <div>
          <p className="text-base-content text-sm font-semibold">Security Notice</p>
          <p className="text-base-content/60 mt-0.5 text-xs sm:text-sm">
            Changing your email will require verification through both your old and new email
            addresses.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SecurityContent
