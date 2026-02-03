/**
 * ProfileShowcase Component
 * =========================
 * Showcase page for Profile & Account Management features.
 */

import { Avatar } from '@components/ui'
import Head from 'next/head'
import { useState } from 'react'
import { FaDiscord, FaGithub, FaGoogle } from 'react-icons/fa'
import {
  MdAccountCircle,
  MdCheck,
  MdDelete,
  MdDevices,
  MdEdit,
  MdEmail,
  MdHistory,
  MdInfo,
  MdLanguage,
  MdLink,
  MdLock,
  MdLogout,
  MdNotifications,
  MdPalette,
  MdPhotoCamera,
  MdSecurity,
  MdVisibility,
  MdVisibilityOff,
  MdWarning
} from 'react-icons/md'

import { ShowcaseLayout } from './layouts'

// Demo data
const CONNECTED_APPS = [
  { name: 'Google', icon: FaGoogle, connected: true, email: 'john@gmail.com' },
  { name: 'GitHub', icon: FaGithub, connected: true, email: 'johndoe' },
  { name: 'Discord', icon: FaDiscord, connected: false, email: null }
]

const ACTIVE_SESSIONS = [
  { device: 'MacBook Pro', location: 'San Francisco, CA', current: true, lastActive: 'Now' },
  { device: 'iPhone 15', location: 'San Francisco, CA', current: false, lastActive: '2 hours ago' },
  {
    device: 'Chrome on Windows',
    location: 'New York, NY',
    current: false,
    lastActive: '3 days ago'
  }
]

type SettingsSection = 'profile' | 'account' | 'security' | 'preferences' | 'connections'

export const ProfileShowcase = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('John Doe')
  const [username, setUsername] = useState('johndoe')
  const [email] = useState('john@docs.plus')
  const [bio, setBio] = useState(
    'Product designer passionate about creating intuitive experiences.'
  )
  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    mentions: true,
    updates: false
  })

  const SIDEBAR_ITEMS = [
    { id: 'profile' as const, label: 'Profile', icon: MdAccountCircle },
    { id: 'account' as const, label: 'Account', icon: MdEmail },
    { id: 'security' as const, label: 'Security', icon: MdSecurity },
    { id: 'preferences' as const, label: 'Preferences', icon: MdPalette },
    { id: 'connections' as const, label: 'Connections', icon: MdLink }
  ]

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-8">
            {/* Avatar Section */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <h3 className="card-title text-base">Profile Picture</h3>
                <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
                  <div className="group relative">
                    <Avatar id="profile-avatar" size="2xl" clickable={false} />
                    <button
                      className="btn btn-circle btn-sm btn-primary absolute -right-1 -bottom-1 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Change profile picture">
                      <MdPhotoCamera size={16} />
                    </button>
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-base-content/70 text-sm">
                      Upload a photo to personalize your profile. Recommended size: 256x256px.
                    </p>
                    <div className="flex gap-2">
                      <button className="btn btn-primary btn-sm">Upload Photo</button>
                      <button className="btn btn-ghost btn-sm">Remove</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <h3 className="card-title text-base">Basic Information</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Full Name</span>
                    </label>
                    <div className="relative">
                      <MdAccountCircle
                        className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                        size={20}
                      />
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="input input-bordered w-full pl-10"
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Username</span>
                    </label>
                    <div className="relative">
                      <span className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2">
                        @
                      </span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="input input-bordered w-full pl-10"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Bio</span>
                    <span className="label-text-alt text-base-content/50">{bio.length}/160</span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered h-24"
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 160))}
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="card-actions mt-4 justify-end">
                  <button className="btn btn-ghost">Cancel</button>
                  <button className="btn btn-primary gap-2">
                    <MdCheck size={18} />
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'account':
        return (
          <div className="space-y-8">
            {/* Email */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <h3 className="card-title text-base">Email Address</h3>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="form-control flex-1">
                    <div className="relative">
                      <MdEmail
                        className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                        size={20}
                      />
                      <input
                        type="email"
                        value={email}
                        readOnly
                        className="input input-bordered bg-base-200 w-full pl-10"
                      />
                    </div>
                  </div>
                  <button className="btn btn-outline btn-sm gap-2">
                    <MdEdit size={16} />
                    Change Email
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="badge badge-success badge-sm gap-1">
                    <MdCheck size={12} />
                    Verified
                  </span>
                  <span className="text-base-content/50 text-xs">
                    Primary email for notifications
                  </span>
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <h3 className="card-title text-base">Password</h3>
                <p className="text-base-content/70 text-sm">
                  Set a strong password to protect your account.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Current Password</span>
                    </label>
                    <div className="relative">
                      <MdLock
                        className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                        size={20}
                      />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        className="input input-bordered w-full pr-10 pl-10"
                      />
                      <button
                        type="button"
                        className="text-base-content/40 absolute top-1/2 right-3 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">New Password</span>
                    </label>
                    <div className="relative">
                      <MdLock
                        className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                        size={20}
                      />
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="input input-bordered w-full pl-10"
                      />
                    </div>
                  </div>
                </div>
                <div className="card-actions mt-4 justify-end">
                  <button className="btn btn-primary">Update Password</button>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="card border-error/30 bg-error/5 border">
              <div className="card-body">
                <h3 className="card-title text-error text-base">
                  <MdWarning size={20} />
                  Danger Zone
                </h3>
                <p className="text-base-content/70 text-sm">
                  Once you delete your account, there is no going back. Please be certain.
                </p>
                <div className="card-actions mt-4">
                  <button className="btn btn-error btn-outline btn-sm gap-2">
                    <MdDelete size={16} />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )

      case 'security':
        return (
          <div className="space-y-8">
            {/* Two-Factor Auth */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="card-title text-base">Two-Factor Authentication</h3>
                    <p className="text-base-content/70 mt-1 text-sm">
                      Add an extra layer of security to your account.
                    </p>
                  </div>
                  <input type="checkbox" className="toggle toggle-primary" defaultChecked />
                </div>
                <div className="alert mt-4">
                  <MdInfo size={20} />
                  <span className="text-sm">
                    When enabled, you'll need to enter a code from your authenticator app.
                  </span>
                </div>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <h3 className="card-title text-base">Active Sessions</h3>
                  <button className="btn btn-ghost btn-sm text-error">
                    Sign out all other devices
                  </button>
                </div>
                <ul className="divide-base-300 mt-4 divide-y">
                  {ACTIVE_SESSIONS.map((session, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="bg-base-200 flex size-10 items-center justify-center rounded-lg">
                          <MdDevices size={20} className="text-base-content/60" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {session.device}
                            {session.current && (
                              <span className="badge badge-primary badge-sm ml-2">Current</span>
                            )}
                          </p>
                          <p className="text-base-content/60 text-xs">
                            {session.location} • {session.lastActive}
                          </p>
                        </div>
                      </div>
                      {!session.current && (
                        <button className="btn btn-ghost btn-sm text-error">Revoke</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Login History */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="flex items-center gap-2">
                  <MdHistory size={20} className="text-base-content/60" />
                  <h3 className="card-title text-base">Login History</h3>
                </div>
                <p className="text-base-content/70 text-sm">
                  View your recent login activity and detect suspicious access.
                </p>
                <button className="btn btn-outline btn-sm mt-4 w-fit">View Login History</button>
              </div>
            </div>
          </div>
        )

      case 'preferences':
        return (
          <div className="space-y-8">
            {/* Notifications */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="flex items-center gap-2">
                  <MdNotifications size={20} className="text-primary" />
                  <h3 className="card-title text-base">Notifications</h3>
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      key: 'email',
                      label: 'Email Notifications',
                      desc: 'Receive updates via email'
                    },
                    {
                      key: 'push',
                      label: 'Push Notifications',
                      desc: 'Browser push notifications'
                    },
                    { key: 'mentions', label: 'Mentions', desc: 'When someone mentions you' },
                    {
                      key: 'updates',
                      label: 'Product Updates',
                      desc: 'New features and announcements'
                    }
                  ].map((item) => (
                    <label
                      key={item.key}
                      className="hover:bg-base-200 flex cursor-pointer items-center justify-between rounded-lg p-3 transition-colors">
                      <div>
                        <p className="font-medium">{item.label}</p>
                        <p className="text-base-content/60 text-sm">{item.desc}</p>
                      </div>
                      <input
                        type="checkbox"
                        className="toggle toggle-primary"
                        checked={notifications[item.key as keyof typeof notifications]}
                        onChange={(e) =>
                          setNotifications({ ...notifications, [item.key]: e.target.checked })
                        }
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Language & Region */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="flex items-center gap-2">
                  <MdLanguage size={20} className="text-primary" />
                  <h3 className="card-title text-base">Language & Region</h3>
                </div>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Language</span>
                    </label>
                    <select className="select select-bordered">
                      <option>English (US)</option>
                      <option>Español</option>
                      <option>Français</option>
                      <option>Deutsch</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Timezone</span>
                    </label>
                    <select className="select select-bordered">
                      <option>Pacific Time (PT)</option>
                      <option>Eastern Time (ET)</option>
                      <option>Central European Time (CET)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      case 'connections':
        return (
          <div className="space-y-8">
            {/* Connected Apps */}
            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <h3 className="card-title text-base">Connected Accounts</h3>
                <p className="text-base-content/70 text-sm">
                  Manage third-party services connected to your account.
                </p>
                <ul className="mt-4 space-y-3">
                  {CONNECTED_APPS.map((app) => (
                    <li
                      key={app.name}
                      className="border-base-300 flex items-center justify-between rounded-xl border p-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-base-200 flex size-10 items-center justify-center rounded-lg">
                          <app.icon size={20} />
                        </div>
                        <div>
                          <p className="font-medium">{app.name}</p>
                          {app.connected ? (
                            <p className="text-success text-xs">Connected as {app.email}</p>
                          ) : (
                            <p className="text-base-content/50 text-xs">Not connected</p>
                          )}
                        </div>
                      </div>
                      {app.connected ? (
                        <button className="btn btn-ghost btn-sm">Disconnect</button>
                      ) : (
                        <button className="btn btn-primary btn-sm">Connect</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <>
      <Head>
        <title>Profile & Account | docs.plus Showcase</title>
      </Head>
      <ShowcaseLayout
        title="Profile & Account"
        description="Manage your profile, account settings, security, and preferences.">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full shrink-0 lg:w-64">
            <div className="lg:sticky lg:top-24">
              <ul className="menu bg-base-100 border-base-300 w-full gap-1 rounded-2xl border p-2">
                {SIDEBAR_ITEMS.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveSection(item.id)}
                      className={`gap-3 ${activeSection === item.id ? 'active' : ''}`}>
                      <item.icon size={20} />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>

              {/* Sign Out */}
              <div className="border-base-300 mt-4 border-t pt-4">
                <button className="btn btn-neutral btn-block gap-2">
                  <MdLogout size={18} />
                  Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="min-w-0 flex-1">{renderContent()}</div>
        </div>
      </ShowcaseLayout>
    </>
  )
}

export default ProfileShowcase
