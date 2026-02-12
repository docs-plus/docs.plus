import { updateUser } from '@api'
import { showPWAInstallPrompt } from '@components/pwa'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import SearchableSelect from '@components/ui/SearchableSelect'
import Select from '@components/ui/Select'
import Toggle from '@components/ui/Toggle'
import { usePlatformDetection } from '@hooks/usePlatformDetection'
import { usePushNotifications } from '@hooks/usePushNotifications'
import { useAuthStore } from '@stores'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { LuBell, LuClock, LuInfo, LuMail, LuSmartphone, LuTriangleAlert } from 'react-icons/lu'

import type { NotificationPreferences } from '../types'

interface ToggleRowProps {
  id: string
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

// Get user's browser timezone
const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

// Get all supported timezones
const getAllTimezones = (): string[] => {
  try {
    // Modern browsers support this
    return Intl.supportedValuesOf('timeZone')
  } catch {
    // Fallback for older browsers
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Sao_Paulo',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Moscow',
      'Asia/Dubai',
      'Asia/Kolkata',
      'Asia/Singapore',
      'Asia/Shanghai',
      'Asia/Tokyo',
      'Asia/Seoul',
      'Australia/Sydney',
      'Pacific/Auckland'
    ]
  }
}

const ALL_TIMEZONES = getAllTimezones()

// Friendly names for common timezones (searchable aliases)
const TIMEZONE_ALIASES: Record<string, string> = {
  // Middle East
  'Asia/Dubai': 'UAE, United Arab Emirates',
  'Asia/Riyadh': 'Saudi Arabia',
  'Asia/Qatar': 'Qatar',
  'Asia/Kuwait': 'Kuwait',
  'Asia/Bahrain': 'Bahrain',
  'Asia/Muscat': 'Oman',
  'Asia/Tehran': 'Iran',
  'Asia/Jerusalem': 'Israel',
  'Asia/Amman': 'Jordan',
  'Asia/Beirut': 'Lebanon',
  // Asia
  'Asia/Kolkata': 'India',
  'Asia/Shanghai': 'China',
  'Asia/Tokyo': 'Japan',
  'Asia/Seoul': 'South Korea',
  'Asia/Singapore': 'Singapore',
  'Asia/Hong_Kong': 'Hong Kong',
  'Asia/Bangkok': 'Thailand',
  'Asia/Jakarta': 'Indonesia',
  'Asia/Manila': 'Philippines',
  'Asia/Kuala_Lumpur': 'Malaysia',
  'Asia/Karachi': 'Pakistan',
  'Asia/Dhaka': 'Bangladesh',
  'Asia/Ho_Chi_Minh': 'Vietnam',
  // Europe
  'Europe/London': 'UK, United Kingdom, Britain',
  'Europe/Paris': 'France',
  'Europe/Berlin': 'Germany',
  'Europe/Rome': 'Italy',
  'Europe/Madrid': 'Spain',
  'Europe/Amsterdam': 'Netherlands',
  'Europe/Brussels': 'Belgium',
  'Europe/Zurich': 'Switzerland',
  'Europe/Vienna': 'Austria',
  'Europe/Stockholm': 'Sweden',
  'Europe/Oslo': 'Norway',
  'Europe/Copenhagen': 'Denmark',
  'Europe/Helsinki': 'Finland',
  'Europe/Warsaw': 'Poland',
  'Europe/Prague': 'Czech Republic',
  'Europe/Athens': 'Greece',
  'Europe/Istanbul': 'Turkey',
  'Europe/Moscow': 'Russia',
  'Europe/Dublin': 'Ireland',
  'Europe/Lisbon': 'Portugal',
  // Americas
  'America/New_York': 'USA Eastern, New York',
  'America/Chicago': 'USA Central, Chicago',
  'America/Denver': 'USA Mountain, Denver',
  'America/Los_Angeles': 'USA Pacific, California',
  'America/Toronto': 'Canada Eastern',
  'America/Vancouver': 'Canada Pacific',
  'America/Mexico_City': 'Mexico',
  'America/Sao_Paulo': 'Brazil',
  'America/Buenos_Aires': 'Argentina',
  'America/Lima': 'Peru',
  'America/Bogota': 'Colombia',
  'America/Santiago': 'Chile',
  // Africa
  'Africa/Cairo': 'Egypt',
  'Africa/Lagos': 'Nigeria',
  'Africa/Johannesburg': 'South Africa',
  'Africa/Nairobi': 'Kenya',
  'Africa/Casablanca': 'Morocco',
  // Oceania
  'Australia/Sydney': 'Australia Eastern',
  'Australia/Melbourne': 'Australia, Melbourne',
  'Australia/Perth': 'Australia Western',
  'Pacific/Auckland': 'New Zealand'
}

// Format time for display (24h to 12h with AM/PM)
const formatTimeDisplay = (time: string): string => {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
}

// Common time presets for quiet hours (every 30 min) — SelectOption format
const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 48 }, (_, i) => {
  const hours = String(Math.floor(i / 2)).padStart(2, '0')
  const minutes = i % 2 === 0 ? '00' : '30'
  const value = `${hours}:${minutes}`
  return { value, label: formatTimeDisplay(value) }
})

// Email frequency options
const EMAIL_FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'immediate', label: 'Immediately (after 15 min if unread)' },
  { value: 'daily', label: 'Daily digest (9 AM)' },
  { value: 'weekly', label: 'Weekly digest (Mondays)' },
  { value: 'never', label: 'Never' }
]

// Get timezone offset string
const getTimezoneOffset = (tz: string): string => {
  try {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'shortOffset'
    })
    const parts = formatter.formatToParts(now)
    return parts.find((p) => p.type === 'timeZoneName')?.value || ''
  } catch {
    return ''
  }
}

// Format timezone for display - shows friendly name if available
const formatTimezoneLabel = (tz: string): string => {
  const alias = TIMEZONE_ALIASES[tz]
  const cityName = tz.replace(/_/g, ' ')

  if (alias) {
    // Show primary alias (first part before comma) with city
    const primaryAlias = alias.split(',')[0].trim()
    // Avoid duplication if alias is same as city
    if (cityName.includes(primaryAlias)) {
      return cityName
    }
    return `${primaryAlias} (${cityName})`
  }
  return cityName
}

// Get searchable text for a timezone (includes all aliases)
const getTimezoneSearchText = (tz: string): string => {
  const parts = [tz, tz.replace(/_/g, ' ')]
  const alias = TIMEZONE_ALIASES[tz]
  if (alias) {
    parts.push(alias)
  }
  return parts.join(' ').toLowerCase()
}

// Timezone Select Component
interface TimezoneSelectProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

const TimezoneSelect = ({ value, onChange, disabled }: TimezoneSelectProps) => {
  // Memoize timezone options with search text
  const timezoneOptions = useMemo(
    () =>
      ALL_TIMEZONES.map((tz) => ({
        value: tz,
        label: formatTimezoneLabel(tz),
        description: `${getTimezoneOffset(tz)}${TIMEZONE_ALIASES[tz] ? ` · ${TIMEZONE_ALIASES[tz]}` : ''}`,
        searchText: getTimezoneSearchText(tz)
      })),
    []
  )

  return (
    <SearchableSelect
      label="Timezone"
      value={value}
      onChange={onChange}
      options={timezoneOptions}
      placeholder="Select timezone..."
      searchPlaceholder="Search timezones..."
      disabled={disabled}
      maxHeight={300}
      emptyMessage="No timezone found"
    />
  )
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

// --- iOS PWA Notice ---
// Shown when iOS user is in Safari (not PWA) and push requires "Add to Home Screen"

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

// --- Main Component ---

const NotificationsSection = () => {
  const profile = useAuthStore((state) => state.profile)
  const setProfile = useAuthStore((state) => state.setProfile)

  // Platform detection (iOS PWA requirements)
  const { platform, isPWAInstalled, iosSupportsWebPush } = usePlatformDetection()

  // iOS in Safari (not PWA) — push won't work, show install guidance
  const isIOSBrowser = platform === 'ios' && !isPWAInstalled

  // Push notification state
  const { isSupported, isSubscribed, isLoading, permission, error, subscribe, unsubscribe } =
    usePushNotifications()

  // Local preferences state - detect browser timezone on init
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => ({
    // Push defaults
    push_mentions: true,
    push_replies: true,
    push_reactions: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    timezone: getBrowserTimezone(),
    // Email defaults
    email_enabled: false,
    email_mentions: true,
    email_replies: true,
    email_reactions: false,
    email_frequency: 'daily'
  }))
  const [saving, setSaving] = useState(false)

  // Load preferences from profile
  useEffect(() => {
    if (profile?.profile_data) {
      const saved = (profile.profile_data as Record<string, unknown>)
        .notification_preferences as NotificationPreferences
      if (saved) {
        setPreferences((prev) => ({ ...prev, ...saved }))
      }
    }
  }, [profile?.profile_data])

  // Save preferences to profile
  const savePreferences = useCallback(
    async (newPrefs: NotificationPreferences) => {
      if (!profile?.id) return

      setSaving(true)
      try {
        const updatedProfileData = {
          ...(profile.profile_data || {}),
          notification_preferences: newPrefs
        }

        const { error } = await updateUser(profile.id, {
          profile_data: updatedProfileData
        })

        if (error) {
          toast.Error('Failed to save preferences')
        } else {
          setProfile({ ...profile, profile_data: updatedProfileData })
        }
      } catch {
        toast.Error('Failed to save preferences')
      } finally {
        setSaving(false)
      }
    },
    [profile, setProfile]
  )

  // Handle preference change — clears bounce info when user re-enables email
  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean | string) => {
    const newPrefs = { ...preferences, [key]: value }

    // Clear bounce info when user explicitly enables email
    if (key === 'email_enabled' && value === true && newPrefs.email_bounce_info) {
      delete newPrefs.email_bounce_info
    }

    setPreferences(newPrefs)
    savePreferences(newPrefs)
  }

  // Handle re-enable from bounce banner: clear bounce info + enable email
  const handleClearBounceAndEnable = () => {
    const newPrefs = { ...preferences, email_enabled: true }
    delete newPrefs.email_bounce_info
    setPreferences(newPrefs)
    savePreferences(newPrefs)
  }

  // Handle push toggle
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
          // Show the actual error from the hook
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

  return (
    <div className="space-y-4">
      {/* Push Notifications */}
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <LuBell size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Push Notifications</h2>
        </div>

        {/* iOS Safari: show install-as-app guidance instead of toggle */}
        {isIOSBrowser ? (
          <IOSPWANotice iosSupportsWebPush={iosSupportsWebPush} />
        ) : (
          <div className="divide-base-300 divide-y">
            <ToggleRow
              id="push-notifications"
              label="Enable push notifications"
              description={
                isPushBlocked
                  ? 'Blocked by browser. Enable in browser settings.'
                  : isSupported
                    ? 'Get notified about mentions, replies, and reactions.'
                    : 'Push notifications are not supported in this browser.'
              }
              checked={isPushEnabled}
              onChange={handlePushChange}
              disabled={isLoading || !isSupported || isPushBlocked}
            />

            {/* Notification type preferences - only show when push is enabled */}
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
      </section>

      {/* Quiet Hours */}
      {isPushEnabled && (
        <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
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
        </section>
      )}

      {/* Email Notifications */}
      <section className="bg-base-100 rounded-box p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex items-center gap-2">
          <LuMail size={20} className="text-primary" />
          <h2 className="text-base-content text-base font-semibold">Email Notifications</h2>
        </div>

        {/* Bounce warning banner */}
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

          {/* Email type preferences - only show when email is enabled */}
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

              {/* Email frequency */}
              <div className="py-3">
                <Select
                  id="email-frequency"
                  label="Email frequency"
                  labelPosition="above"
                  value={preferences.email_frequency || 'daily'}
                  onChange={(val) => handlePreferenceChange('email_frequency', val)}
                  options={EMAIL_FREQUENCY_OPTIONS}
                  disabled={saving}
                  helperText="How often would you like to receive email notifications?"
                  wrapperClassName="max-w-xs"
                />
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

export default NotificationsSection
