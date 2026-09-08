import { updateNotificationPreferences } from '@api'
import { showPWAInstallPrompt } from '@components/pwa'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import Select from '@components/ui/Select'
import Toggle from '@components/ui/Toggle'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { usePushNotifications } from '@hooks/usePushNotifications'
import { useAuthStore } from '@stores'
import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LuBell, LuClock, LuInfo, LuMail, LuSmartphone, LuTriangleAlert } from 'react-icons/lu'

import type { EmailFrequency, NotificationPreferences } from '../types'
import { getBrowserTimezone, TIME_OPTIONS } from '../utils/timezoneOptions'
import SettingsCard from './SettingsCard'
import TimezoneSelect from './TimezoneSelect'

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

const EMAIL_FREQUENCY_OPTIONS: { value: EmailFrequency; label: string; help: string }[] = [
  {
    value: 'immediate',
    label: 'Immediately (after 15 min if unread)',
    help: 'Chat mail waits 15 minutes if you have not read it. Document changes still go in the next digest.'
  },
  {
    value: 'daily',
    label: 'Daily digest (9 AM)',
    help: 'One email at 9:00 AM in the timezone below.'
  },
  {
    value: 'weekly',
    label: 'Weekly digest (Mondays)',
    help: 'One email on Mondays at 9:00 AM in the timezone below.'
  },
  { value: 'never', label: 'Never', help: 'No notification emails.' }
]

function emailFrequencyOption(value: EmailFrequency | undefined) {
  return EMAIL_FREQUENCY_OPTIONS.find((row) => row.value === (value ?? 'daily'))!
}

const ToggleRow = ({ id, label, description, checked, onChange, disabled }: ToggleRowProps) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0 flex-1">
      <label
        htmlFor={id}
        className={`text-base-content text-sm font-medium ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
        {label}
      </label>
      <p className="text-base-content/60 mt-0.5 text-xs">{description}</p>
    </div>
    <Toggle
      id={id}
      variant="primary"
      size="sm"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      className="mt-0.5"
    />
  </div>
)

// Shown on iOS Safari (not PWA): push requires "Add to Home Screen".
interface IOSPWANoticeProps {
  iosSupportsWebPush: boolean
}

const IOSPWANotice = ({ iosSupportsWebPush }: IOSPWANoticeProps) => {
  if (!iosSupportsWebPush) {
    // iOS < 16.4 — push is not available at all
    return (
      <div className="border-base-300 bg-base-200 rounded-box border p-4">
        <div className="flex items-start gap-3">
          <LuInfo size={20} className="text-base-content/60 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-base-content text-sm font-medium">Not available on this device</p>
            <p className="text-base-content/60 mt-1 text-xs">
              Push notifications require iOS 16.4 or later. Update your device to enable this
              feature.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // iOS ≥ 16.4 but not in PWA mode — guide user to install
  return (
    <div className="border-primary/20 bg-primary/5 rounded-box border p-4">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 mt-0.5 shrink-0 rounded-full p-1.5">
          <LuSmartphone size={18} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-base-content text-sm font-medium">Add to Home Screen to enable</p>
          <p className="text-base-content/60 mt-1 text-xs leading-relaxed">
            On iOS, push notifications only work when the app is installed on your home screen. Add
            docs.plus to your home screen to receive notifications.
          </p>
          <Button
            onClick={() => showPWAInstallPrompt()}
            variant="primary"
            btnStyle="soft"
            size="sm"
            startIcon={LuSmartphone}
            className="mt-3">
            Add to Home Screen
          </Button>
        </div>
      </div>
    </div>
  )
}

const NotificationsSection = () => {
  const profileData = useAuthStore((state) => state.profile?.profile_data)

  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  // iOS in Safari (not PWA) — push won't work, show install guidance
  const isIOSBrowser = platform === 'ios' && !isPWAInstalled

  const { isSupported, isSubscribed, isLoading, permission, error, subscribe, unsubscribe } =
    usePushNotifications()

  const [preferences, setPreferences] = useState<NotificationPreferences>(() => ({
    push_mentions: true,
    push_replies: true,
    push_reactions: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: getBrowserTimezone(),
    email_enabled: false,
    email_mentions: true,
    email_replies: true,
    email_reactions: false,
    email_content_changes: true,
    email_frequency: 'daily'
  }))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profileData) {
      const saved = (profileData as Record<string, unknown>)
        .notification_preferences as NotificationPreferences
      if (saved) {
        setPreferences((prev) => ({ ...prev, ...saved }))
      }
    }
  }, [profileData])

  // Accumulate multi-key patches across rapid toggles. `debounce` is
  // trailing-only and keeps the LAST call's args, so a per-call patch
  // would drop earlier keys. The buffer merges everything and clears on
  // flush.
  const pendingPatchRef = useRef<Partial<NotificationPreferences>>({})

  const flushPreferences = useMemo(
    () =>
      debounce(async () => {
        const patch = pendingPatchRef.current
        if (Object.keys(patch).length === 0) return
        pendingPatchRef.current = {}
        setSaving(true)
        try {
          const { error } = await updateNotificationPreferences(patch)
          if (error) toast.Error('Failed to save preferences')
        } catch {
          toast.Error('Failed to save preferences')
        } finally {
          setSaving(false)
        }
      }, 500),
    []
  )

  // Closing the panel or switching tabs unmounts this section, so a patch
  // still inside the 500 ms window must leave now. `cancel()` dropped it,
  // and local state had already moved, so nothing looked wrong.
  useEffect(
    () => () => {
      flushPreferences.flush()
    },
    [flushPreferences]
  )

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean | string) => {
    const patch: Partial<NotificationPreferences> = {
      [key]: value
    } as Partial<NotificationPreferences>

    if (key === 'email_enabled' && value === true && preferences.email_bounce_info) {
      patch.email_bounce_info = null
    }

    // Daily and weekly 9:00 AM use this timezone. Quiet Hours is the only
    // other writer, so an email-only user would otherwise stay on UTC.
    const needsTimezone =
      (key === 'email_enabled' && value === true) ||
      (key === 'email_frequency' && (value === 'daily' || value === 'weekly'))
    if (needsTimezone && !preferences.timezone) {
      patch.timezone = getBrowserTimezone()
    }

    setPreferences((prev) => {
      // Strip the null sentinel locally so the banner hides; the RPC's
      // JSONB merge writes `null` server-side which we treat as cleared.
      const next = { ...prev, ...patch }
      if (patch.email_bounce_info === null) delete next.email_bounce_info
      return next
    })
    Object.assign(pendingPatchRef.current, patch)
    flushPreferences()
  }

  const handleClearBounceAndEnable = () => {
    handlePreferenceChange('email_enabled', true)
  }

  const handlePushChange = async (checked: boolean) => {
    if (checked) {
      const result = await subscribe()
      switch (result) {
        case 'success':
          toast.Success('Push notifications enabled')
          break
        case 'denied':
          toast.Error('Notifications blocked. Please enable in browser settings.')
          break
        case 'dismissed':
          // User closed the browser permission prompt without choosing
          // Don't show toast - they made a conscious choice
          break
        case 'error':
          toast.Error(error || 'Failed to enable notifications')
          break
      }
    } else {
      const success = await unsubscribe()
      if (success) {
        toast.Success('Push notifications disabled')
      }
    }
  }

  const isPushBlocked = permission === 'denied'
  const isPushEnabled = isSubscribed && !isPushBlocked

  // iOS keeps this switch in the Settings app, outside the browser.
  const blockedDescription =
    platform === 'ios'
      ? 'Blocked. On iOS this setting lives in the Settings app, under docs.plus.'
      : 'Blocked. This setting lives in the browser site settings, reached from the address bar.'

  return (
    <div className="space-y-4 motion-safe:animate-[doc-content-in_180ms_ease-out_both]">
      <SettingsCard>
        <div className="mb-3 flex items-center gap-2">
          <LuBell size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Push Notifications</h2>
        </div>

        {isIOSBrowser ? (
          <IOSPWANotice iosSupportsWebPush={iosSupportsWebPush} />
        ) : (
          <div className="divide-base-300 divide-y">
            <ToggleRow
              id="push-notifications"
              label="Enable push notifications"
              description={
                isPushBlocked
                  ? blockedDescription
                  : isSupported
                    ? 'Get notified about mentions, replies, and reactions.'
                    : 'Push notifications are not supported in this browser.'
              }
              checked={isPushEnabled}
              onChange={handlePushChange}
              disabled={isLoading || !isSupported || isPushBlocked}
            />

            {isPushEnabled && (
              <>
                <ToggleRow
                  id="push-mentions"
                  label="Mentions"
                  description="When someone mentions you with @"
                  checked={preferences.push_mentions ?? true}
                  onChange={(checked) => handlePreferenceChange('push_mentions', checked)}
                  disabled={saving}
                />
                <ToggleRow
                  id="push-replies"
                  label="Replies"
                  description="When someone replies to your message"
                  checked={preferences.push_replies ?? true}
                  onChange={(checked) => handlePreferenceChange('push_replies', checked)}
                  disabled={saving}
                />
                <ToggleRow
                  id="push-reactions"
                  label="Reactions"
                  description="When someone reacts to your message"
                  checked={preferences.push_reactions ?? true}
                  onChange={(checked) => handlePreferenceChange('push_reactions', checked)}
                  disabled={saving}
                />
              </>
            )}
          </div>
        )}
      </SettingsCard>

      {isPushEnabled && (
        <SettingsCard>
          <div className="mb-3 flex items-center gap-2">
            <LuClock size={20} className="text-primary" />
            <h2 className="text-base-content text-base font-semibold">Quiet Hours</h2>
          </div>

          <div className="divide-base-300 divide-y">
            <ToggleRow
              id="quiet-hours"
              label="Enable quiet hours"
              description="Pause notifications during specific hours"
              checked={preferences.quiet_hours_enabled ?? false}
              onChange={(checked) => handlePreferenceChange('quiet_hours_enabled', checked)}
              disabled={saving}
            />

            {preferences.quiet_hours_enabled && (
              <>
                <div className="flex items-center gap-3 py-3">
                  <Select
                    id="quiet-start"
                    label="From"
                    labelPosition="above"
                    value={preferences.quiet_hours_start || '22:00'}
                    onChange={(val) => handlePreferenceChange('quiet_hours_start', val)}
                    options={TIME_OPTIONS}
                    disabled={saving}
                    wrapperClassName="flex-1"
                  />
                  <Select
                    id="quiet-end"
                    label="To"
                    labelPosition="above"
                    value={preferences.quiet_hours_end || '08:00'}
                    onChange={(val) => handlePreferenceChange('quiet_hours_end', val)}
                    options={TIME_OPTIONS}
                    disabled={saving}
                    wrapperClassName="flex-1"
                  />
                </div>
                <div className="py-3">
                  <TimezoneSelect
                    value={preferences.timezone || getBrowserTimezone()}
                    onChange={(tz) => handlePreferenceChange('timezone', tz)}
                    disabled={saving}
                  />
                </div>
              </>
            )}
          </div>
        </SettingsCard>
      )}

      <SettingsCard>
        <div className="mb-3 flex items-center gap-2">
          <LuMail size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Email Notifications</h2>
        </div>

        {preferences.email_bounce_info && (
          <div className="border-warning/30 bg-warning/10 rounded-box mb-3 border p-4">
            <div className="flex items-start gap-3">
              <LuTriangleAlert size={20} className="text-warning mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-base-content text-sm font-medium">Email delivery failed</p>
                <p className="text-base-content/70 mt-1 text-xs">
                  We couldn't deliver emails to{' '}
                  <span className="font-medium">{preferences.email_bounce_info.email}</span>. Your
                  email notifications have been paused.
                </p>
                <p className="text-base-content/50 mt-1 text-xs">
                  Update your email address or re-enable to try again.
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    onClick={handleClearBounceAndEnable}
                    disabled={saving}
                    variant="warning"
                    btnStyle="soft"
                    size="xs">
                    Re-enable
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="divide-base-300 divide-y">
          <ToggleRow
            id="email-notifications"
            label="Enable email notifications"
            description="Receive notifications via email when you're away from the app."
            checked={preferences.email_enabled ?? false}
            onChange={(checked) => handlePreferenceChange('email_enabled', checked)}
            disabled={saving}
          />

          {preferences.email_enabled && (
            <>
              <ToggleRow
                id="email-mentions"
                label="Mentions"
                description="When someone mentions you with @"
                checked={preferences.email_mentions ?? true}
                onChange={(checked) => handlePreferenceChange('email_mentions', checked)}
                disabled={saving}
              />
              <ToggleRow
                id="email-replies"
                label="Replies"
                description="When someone replies to your message"
                checked={preferences.email_replies ?? true}
                onChange={(checked) => handlePreferenceChange('email_replies', checked)}
                disabled={saving}
              />
              <ToggleRow
                id="email-reactions"
                label="Reactions"
                description="When someone reacts to your message"
                checked={preferences.email_reactions ?? false}
                onChange={(checked) => handlePreferenceChange('email_reactions', checked)}
                disabled={saving}
              />
              <ToggleRow
                id="email-content-changes"
                label="Document changes"
                description="When a document you follow is edited. These always arrive in a digest, never as a 15-minute ping."
                checked={preferences.email_content_changes ?? true}
                onChange={(checked) => handlePreferenceChange('email_content_changes', checked)}
                disabled={saving}
              />

              <div className="space-y-3 py-3">
                <Select
                  id="email-frequency"
                  label="Email frequency"
                  labelPosition="above"
                  value={emailFrequencyOption(preferences.email_frequency).value}
                  onChange={(val) => handlePreferenceChange('email_frequency', val)}
                  options={EMAIL_FREQUENCY_OPTIONS}
                  disabled={saving}
                  helperText={emailFrequencyOption(preferences.email_frequency).help}
                  wrapperClassName="max-w-xs"
                />
                {(preferences.email_frequency === 'daily' ||
                  preferences.email_frequency === 'weekly') && (
                  <TimezoneSelect
                    value={preferences.timezone || getBrowserTimezone()}
                    onChange={(tz) => handlePreferenceChange('timezone', tz)}
                    disabled={saving}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </SettingsCard>
    </div>
  )
}

export default NotificationsSection
