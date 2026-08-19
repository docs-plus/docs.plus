import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import TextInput from '@components/ui/TextInput'
import type { PasskeyListItem } from '@supabase/supabase-js'
import type { PasskeyOutcome } from '@utils/passkey'
import { useState } from 'react'
import { LuKeyRound, LuPencil, LuTrash2 } from 'react-icons/lu'

import { usePasskeys } from '../hooks/usePasskeys'
import SettingsCard from './SettingsCard'

const formatDate = (value?: string) =>
  value ? new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null

interface PasskeyRowProps {
  passkey: PasskeyListItem
  busy: boolean
  onRename: (friendlyName: string) => void
  onRemove: () => void
}

const PasskeyRow = ({ passkey, busy, onRename, onRemove }: PasskeyRowProps) => {
  const [draftName, setDraftName] = useState<string | null>(null)
  const label = passkey.friendly_name || 'Passkey'
  const lastUsed = formatDate(passkey.last_used_at)
  const added = formatDate(passkey.created_at)

  if (draftName !== null) {
    return (
      <li className="border-base-300 flex flex-wrap items-center gap-2 border-t py-3 first:border-t-0">
        <TextInput
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          maxLength={120}
          placeholder="Passkey name"
          className="min-w-0 flex-1"
          disabled={busy}
        />
        <Button
          variant="primary"
          size="sm"
          loading={busy}
          disabled={busy || draftName.trim().length === 0}
          onClick={() => {
            onRename(draftName.trim())
            setDraftName(null)
          }}>
          Save
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => setDraftName(null)}>
          Cancel
        </Button>
      </li>
    )
  }

  return (
    <li className="border-base-300 flex items-center gap-3 border-t py-3 first:border-t-0">
      <LuKeyRound size={18} className="text-base-content/50 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base-content truncate text-sm font-medium">{label}</p>
        <p className="text-base-content/50 text-xs">
          {lastUsed ? `Last used ${lastUsed}` : added ? `Added ${added}` : 'Never used'}
        </p>
      </div>
      <Button
        variant="ghost"
        shape="square"
        size="sm"
        disabled={busy}
        aria-label={`Rename ${label}`}
        tooltip="Rename"
        onClick={() => setDraftName(label)}>
        <LuPencil size={16} />
      </Button>
      <Button
        variant="ghost"
        shape="square"
        size="sm"
        loading={busy}
        disabled={busy}
        aria-label={`Remove ${label}`}
        tooltip="Remove"
        className="text-error"
        onClick={onRemove}>
        <LuTrash2 size={16} />
      </Button>
    </li>
  )
}

const announce = async (action: Promise<PasskeyOutcome>, success: string) => {
  const outcome = await action
  switch (outcome.status) {
    case 'ok':
      toast.Success(success)
      return
    case 'cancelled':
      return
    case 'error':
      toast.Error(outcome.message)
      return
    default: {
      const unreachable: never = outcome
      return unreachable
    }
  }
}

const PasskeysCard = () => {
  const { passkeys, loading, registering, busyId, unavailable, register, rename, remove } =
    usePasskeys()

  if (unavailable) return null

  return (
    <SettingsCard>
      <div className="mb-3 flex items-center gap-2">
        <LuKeyRound size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">Passkeys</h2>
      </div>
      <p className="text-base-content/60 mb-3 text-xs sm:text-sm">
        Sign in with your fingerprint, face, screen lock, or a security key. No password and no
        email link.
      </p>

      {loading ? (
        <div className="skeleton h-14 w-full" />
      ) : passkeys.length > 0 ? (
        <ul className="mb-4">
          {passkeys.map((passkey) => (
            <PasskeyRow
              key={passkey.id}
              passkey={passkey}
              busy={busyId === passkey.id}
              onRename={(friendlyName) =>
                void announce(rename(passkey.id, friendlyName), 'Passkey renamed')
              }
              onRemove={() => void announce(remove(passkey.id), 'Passkey removed')}
            />
          ))}
        </ul>
      ) : (
        <p className="text-base-content/50 mb-4 text-xs sm:text-sm">No passkeys yet.</p>
      )}

      <Button
        variant="primary"
        btnStyle="soft"
        size="sm"
        loading={registering}
        disabled={registering}
        startIcon={LuKeyRound}
        onClick={() => void announce(register(), 'Passkey added')}>
        Add a passkey
      </Button>
    </SettingsCard>
  )
}

export default PasskeysCard
