import { updateNotificationPreferences } from '@api'
import { showPWAInstallPrompt } from '@components/pwa'
import * as toast from '@components/toast'
import { Banner } from '@components/ui/Banner'
import Button from '@components/ui/Button'
import { EmptyState } from '@components/ui/EmptyState'
import Select from '@components/ui/Select'
import { ToggleRow } from '@components/ui/ToggleRow'
import { ToggleRowSkeleton } from '@components/ui/ToggleRowSkeleton'
import {
  notificationPreferencesKey,
  useNotificationPreferences
} from '@hooks/useNotificationPreferences'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { usePushNotifications } from '@hooks/usePushNotifications'
import { useAuthStore } from '@stores'
import { useQueryClient } from '@tanstack/react-query'
import type { EmailFrequency, NotificationPreferences } from '@types'
import debounce from 'lodash/debounce'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LuBell, LuClock, LuMail, LuSmartphone } from 'react-icons/lu'

import { NotificationsSkeleton } from '../SettingsPanelSkeleton'
import { registerPendingPreferenceFlush } from '../utils/pendingPreferenceWrites'
import { getBrowserTimezone, TIME_OPTIONS } from '../utils/timezoneOptions'
import SettingsCard, { SettingsCardHeader } from './SettingsCard'
import TimezoneSelect from './TimezoneSelect'

// Mirrors the worker fallback in `07-5-email-notifications-pgmq.sql`.
const DEFAULT_EMAIL_FREQUENCY: EmailFrequency = 'daily'

const EMAIL_FREQUENCY_OPTIONS: {
  value: EmailFrequency
  label: string
  help: string
  hint?: string
}[] = [
  {
    value: 'immediate',
    label: 'Immediately (after 15 min if unread)',
    help: 'Chat mail waits 15 minutes if you have not read it. Document changes still go in the next digest.'
  },
  {
    value: 'daily',
    label: 'Daily digest (9 AM)',
    hint: 'Default',
    help: 'One email at 9:00 AM in your time zone.'
  },
  {
    value: 'weekly',
    label: 'Weekly digest (Mondays)',
    help: 'One email on Mondays at 9:00 AM in your time zone.'
  },
  { value: 'never', label: 'Never', help: 'No notification emails.' }
]

// Time zone and Email frequency share one field width, so their edges line up.
const FIELD_WIDTH_CLASS = 'max-w-xs'

function emailFrequencyOption(value: EmailFrequency) {
  return EMAIL_FREQUENCY_OPTIONS.find((row) => row.value === value)!
}

// Shown on iOS Safari (not PWA): push requires "Add to Home Screen".
interface IOSPWANoticeProps {
  iosSupportsWebPush: boolean
}

const IOSPWANotice = ({ iosSupportsWebPush }: IOSPWANoticeProps) => {
  if (!iosSupportsWebPush) {
    // iOS < 16.4 — push is not available at all
    return (
      <Banner tone="info" role="note" title="Not available on this device">
        <p>
          Push notifications require iOS 16.4 or later. Update your device to enable this feature.
        </p>
      </Banner>
    )
  }

  // iOS ≥ 16.4 but not in PWA mode — guide user to install
  return (
    <Banner
      tone="info"
      role="note"
      icon={LuSmartphone}
      title="Add to Home Screen to enable"
      actions={
        <Button variant="quiet" onClick={() => showPWAInstallPrompt()}>
          Add to Home Screen
        </Button>
      }>
      <p>
        On iOS, push notifications only work when the app is installed on your home screen. Add
        docs.plus to your home screen to receive notifications.
      </p>
    </Banner>
  )
}

// Mirrors the SQL fallbacks. `timezone` stays out: a missing one must read as missing.
const DEFAULT_PREFERENCES = {
  push_mentions: true,
  push_replies: true,
  push_reactions: true,
  quiet_hours_enabled: false,
  quiet_hours_start: '22:00',
  quiet_hours_end: '08:00',
  email_enabled: false,
  email_mentions: true,
  email_replies: true,
  email_reactions: false,
  email_content_changes: true,
  email_frequency: DEFAULT_EMAIL_FREQUENCY
} satisfies NotificationPreferences

const NotificationsSection = () => {
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  // iOS in Safari (not PWA) — push won't work, show install guidance
  const isIOSBrowser = platform === 'ios' && !isPWAInstalled

  const {
    isSupported,
    isSubscribed,
    isLoading,
    isChecking,
    permission,
    error,
    subscribe,
    unsubscribe
  } = usePushNotifications()
  // Until the first check ends, the switch is a bone: a subscribed person would see it off, then on.

  const queryClient = useQueryClient()
  const { data: saved, isError, isFetching, refetch } = useNotificationPreferences()

  // Edits not yet confirmed by the server. They win over `saved`, so a refetch or
  // another client's signal never flips a toggle the person just moved.
  const [localEdits, setLocalEdits] = useState<Partial<NotificationPreferences>>({})
  const preferences = { ...DEFAULT_PREFERENCES, ...saved, ...localEdits }

  // `debounce` keeps only the last call's args, so rapid toggles merge here.
  const pendingPatchRef = useRef<Partial<NotificationPreferences>>({})

  const flushPreferences = useMemo(
    () =>
      debounce(async () => {
        const patch = pendingPatchRef.current
        if (Object.keys(patch).length === 0) return
        pendingPatchRef.current = {}
        try {
          const { data, error } = await updateNotificationPreferences(patch)
          if (error) throw error
          const key = notificationPreferencesKey(useAuthStore.getState().profile?.id)
          // A read that began before this commit would land stale on top; the echo refetches.
          await queryClient.cancelQueries({ queryKey: key })
          queryClient.setQueryData(key, (data ?? {}) as NotificationPreferences)
        } catch {
          toast.Error('Couldn’t save your notification settings.')
        }
        // Confirmed or rolled back, the saved copy now answers for these keys, unless edited again.
        setLocalEdits((prev) => {
          const next = { ...prev }
          for (const key of Object.keys(patch) as (keyof NotificationPreferences)[]) {
            if (next[key] === patch[key]) delete next[key]
          }
          return next
        })
      }, 500),
    [queryClient]
  )

  // Sign-out flushes through the registration. Closing the panel or switching tabs
  // unmounts this section, so a patch still inside the 500 ms window leaves then.
  // `cancel()` dropped it silently, because local state had already moved.
  useEffect(() => {
    const unregister = registerPendingPreferenceFlush(() => flushPreferences.flush())
    return () => {
      unregister()
      flushPreferences.flush()
    }
  }, [flushPreferences])

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean | string) => {
    const patch: Partial<NotificationPreferences> = {
      [key]: value
    } as Partial<NotificationPreferences>

    // `null` clears it server-side; the banner reads it as falsy.
    if (key === 'email_enabled' && value === true && preferences.email_bounce_info) {
      patch.email_bounce_info = null
    }

    // Quiet hours and the 9:00 AM digests read this timezone; the server falls back to UTC.
    const needsTimezone =
      (key === 'quiet_hours_enabled' && value === true) ||
      (key === 'email_enabled' && value === true) ||
      (key === 'email_frequency' && (value === 'daily' || value === 'weekly'))
    if (needsTimezone && !preferences.timezone) {
      patch.timezone = getBrowserTimezone()
    }

    setLocalEdits((prev) => ({ ...prev, ...patch }))
    Object.assign(pendingPatchRef.current, patch)
    flushPreferences()
  }

  const handlePushChange = async (checked: boolean) => {
    if (checked) {
      const result = await subscribe()
      switch (result) {
        case 'denied':
          // The toggle help line carries the fix; the toast only names the result.
          toast.Error('Notifications blocked')
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
      await unsubscribe()
    }
  }

  const isPushBlocked = permission === 'denied'
  const isPushEnabled = isSubscribed && !isPushBlocked

  // iOS keeps this switch in the Settings app, outside the browser.
  const blockedDescription =
    platform === 'ios'
      ? 'Blocked. On iOS this setting lives in the Settings app, under docs.plus.'
      : 'Blocked. This setting lives in the browser site settings, reached from the address bar.'

  const pushDescription = isPushBlocked
    ? blockedDescription
    : isSupported
      ? 'Get notified about mentions, replies, and reactions.'
      : 'Push notifications are not supported in this browser.'

  // Saved settings that read a timezone but hold none run on UTC. Write this browser's once.
  const repairedTimezoneRef = useRef(false)
  useEffect(() => {
    if (!saved || saved.timezone || repairedTimezoneRef.current) return
    const frequency = saved.email_frequency ?? DEFAULT_EMAIL_FREQUENCY
    const digest = saved.email_enabled && (frequency === 'daily' || frequency === 'weekly')
    if (!saved.quiet_hours_enabled && !digest) return
    repairedTimezoneRef.current = true
    handlePreferenceChange('timezone', getBrowserTimezone())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per loaded copy
  }, [saved])

  if (!saved) {
    if (!isError) {
      return (
        <NotificationsSkeleton
          pushNotice={
            isIOSBrowser ? <IOSPWANotice iosSupportsWebPush={iosSupportsWebPush} /> : undefined
          }
        />
      )
    }
    return (
      <SettingsCard>
        <EmptyState
          layout="inline"
          tone="error"
          title="Couldn’t load notification settings."
          onRetry={refetch}
          retrying={isFetching}
        />
      </SettingsCard>
    )
  }

  return (
    <div className="space-y-4">
      <SettingsCard>
        <SettingsCardHeader icon={LuBell} title="Push notifications" />

        {isIOSBrowser ? (
          <IOSPWANotice iosSupportsWebPush={iosSupportsWebPush} />
        ) : (
          <div className="divide-base-300 divide-y">
            {isChecking ? (
              <ToggleRowSkeleton label="Enable push notifications" description={pushDescription} />
            ) : (
              <ToggleRow
                id="push-notifications"
                label="Enable push notifications"
                description={pushDescription}
                checked={isPushEnabled}
                onChange={handlePushChange}
                disabled={isLoading || !isSupported || isPushBlocked}
              />
            )}

            <ToggleRow
              id="push-mentions"
              label="Mentions"
              description="When someone mentions you with @"
              checked={preferences.push_mentions}
              onChange={(checked) => handlePreferenceChange('push_mentions', checked)}
            />
            <ToggleRow
              id="push-replies"
              label="Replies"
              description="When someone replies to your message"
              checked={preferences.push_replies}
              onChange={(checked) => handlePreferenceChange('push_replies', checked)}
            />
            <ToggleRow
              id="push-reactions"
              label="Reactions"
              description="When someone reacts to your message"
              checked={preferences.push_reactions}
              onChange={(checked) => handlePreferenceChange('push_reactions', checked)}
            />
          </div>
        )}
      </SettingsCard>

      <SettingsCard>
        <TimezoneSelect
          value={preferences.timezone || getBrowserTimezone()}
          onChange={(tz) => handlePreferenceChange('timezone', tz)}
          wrapperClassName={FIELD_WIDTH_CLASS}
        />
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader icon={LuClock} title="Quiet hours" />

        <div className="divide-base-300 divide-y">
          <ToggleRow
            id="quiet-hours"
            label="Enable quiet hours"
            description="No push notifications or instant emails during these hours. The bell still shows them."
            checked={preferences.quiet_hours_enabled}
            onChange={(checked) => handlePreferenceChange('quiet_hours_enabled', checked)}
          />

          {preferences.quiet_hours_enabled && (
            <div className="flex items-center gap-3 py-3">
              <Select
                id="quiet-start"
                label="From"
                labelPosition="above"
                value={preferences.quiet_hours_start}
                onChange={(val) => handlePreferenceChange('quiet_hours_start', val)}
                options={TIME_OPTIONS}
                wrapperClassName="flex-1"
              />
              <Select
                id="quiet-end"
                label="To"
                labelPosition="above"
                value={preferences.quiet_hours_end}
                onChange={(val) => handlePreferenceChange('quiet_hours_end', val)}
                options={TIME_OPTIONS}
                wrapperClassName="flex-1"
              />
            </div>
          )}
        </div>
      </SettingsCard>

      <SettingsCard>
        <SettingsCardHeader icon={LuMail} title="Email notifications" />

        {preferences.email_bounce_info && (
          <Banner
            tone="warning"
            title="Email delivery failed"
            className="mb-3"
            actions={
              <Button variant="quiet" onClick={() => handlePreferenceChange('email_enabled', true)}>
                Re-enable
              </Button>
            }>
            <p>
              We couldn't deliver emails to{' '}
              <span className="font-medium">{preferences.email_bounce_info.email}</span>. Your email
              notifications have been paused.
            </p>
            <p>Re-enable to try again.</p>
          </Banner>
        )}

        <div className="divide-base-300 divide-y">
          <ToggleRow
            id="email-notifications"
            label="Enable email notifications"
            description="Receive notifications via email when you're away from the app."
            checked={preferences.email_enabled}
            onChange={(checked) => handlePreferenceChange('email_enabled', checked)}
          />

          {preferences.email_enabled && (
            <>
              {preferences.email_frequency !== 'never' && (
                <>
                  <ToggleRow
                    id="email-mentions"
                    label="Mentions"
                    description="When someone mentions you with @"
                    checked={preferences.email_mentions}
                    onChange={(checked) => handlePreferenceChange('email_mentions', checked)}
                  />
                  <ToggleRow
                    id="email-replies"
                    label="Replies"
                    description="When someone replies to your message"
                    checked={preferences.email_replies}
                    onChange={(checked) => handlePreferenceChange('email_replies', checked)}
                  />
                  <ToggleRow
                    id="email-reactions"
                    label="Reactions"
                    description="When someone reacts to your message"
                    checked={preferences.email_reactions}
                    onChange={(checked) => handlePreferenceChange('email_reactions', checked)}
                  />
                  <ToggleRow
                    id="email-content-changes"
                    label="Document changes"
                    description="When a document you follow is edited. These always arrive in a digest, never as a 15-minute ping."
                    checked={preferences.email_content_changes}
                    onChange={(checked) => handlePreferenceChange('email_content_changes', checked)}
                  />
                </>
              )}
              <div className="py-3">
                <Select
                  id="email-frequency"
                  label="Email frequency"
                  labelPosition="above"
                  value={emailFrequencyOption(preferences.email_frequency).value}
                  onChange={(val) => handlePreferenceChange('email_frequency', val)}
                  options={EMAIL_FREQUENCY_OPTIONS}
                  helperText={emailFrequencyOption(preferences.email_frequency).help}
                  wrapperClassName={FIELD_WIDTH_CLASS}
                />
              </div>
            </>
          )}
        </div>
      </SettingsCard>
    </div>
  )
}

export default NotificationsSection
