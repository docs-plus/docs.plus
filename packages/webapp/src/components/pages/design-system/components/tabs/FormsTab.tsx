/**
 * FormsTab Component
 * ===================
 * Form components showcase with validation demos.
 */

import { useState } from 'react'
import {
  MdAccountCircle,
  MdCheck,
  MdEmail,
  MdLock,
  MdVisibility,
  MdVisibilityOff
} from 'react-icons/md'

import { PLAN_OPTIONS } from '../../constants/demoData'
import { useDesignSystem } from '../../context/DesignSystemContext'

export const FormsTab = () => {
  const { showPassword, setShowPassword } = useDesignSystem()
  const [email, setEmail] = useState('invalid-email')
  const [emailTouched, setEmailTouched] = useState(false)
  const [name, setName] = useState('John Doe')

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <div className="animate-in fade-in mx-auto max-w-2xl space-y-6 duration-300">
      {/* Account Form */}
      <fieldset className="fieldset border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <legend className="fieldset-legend bg-primary text-primary-content rounded-lg px-3 py-1 text-sm font-semibold">
          Account Information
        </legend>

        <div className="space-y-4">
          <div className="form-control w-full">
            <label className="label" htmlFor="fullName">
              <span className="label-text font-medium">Full Name</span>
              <span className="label-text-alt text-base-content/50">Required</span>
            </label>
            <div className="relative">
              <MdAccountCircle
                className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                size={20}
                aria-hidden="true"
              />
              <input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className={`input input-bordered w-full pl-10 transition-all ${name.length >= 2 ? 'input-success' : ''}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-describedby="nameHelp"
              />
              {name.length >= 2 && (
                <MdCheck
                  className="text-success animate-in zoom-in absolute top-1/2 right-3 -translate-y-1/2 duration-200"
                  size={20}
                />
              )}
            </div>
            <label className="label" id="nameHelp">
              <span
                className={`label-text-alt flex items-center gap-1 transition-colors ${name.length >= 2 ? 'text-success' : 'text-base-content/50'}`}>
                {name.length >= 2 ? (
                  <>
                    <MdCheck size={14} /> Valid name format
                  </>
                ) : (
                  'Enter your full name'
                )}
              </span>
            </label>
          </div>

          <div className="form-control w-full">
            <label className="label" htmlFor="email">
              <span className="label-text font-medium">Email Address</span>
            </label>
            <div className="relative">
              <MdEmail
                className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                size={20}
                aria-hidden="true"
              />
              <input
                id="email"
                type="email"
                placeholder="email@example.com"
                className={`input input-bordered w-full pl-10 transition-all ${emailTouched ? (isEmailValid ? 'input-success' : 'input-error') : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                aria-describedby="emailError"
                aria-invalid={emailTouched && !isEmailValid}
              />
              {emailTouched && isEmailValid && (
                <MdCheck
                  className="text-success animate-in zoom-in absolute top-1/2 right-3 -translate-y-1/2 duration-200"
                  size={20}
                />
              )}
            </div>
            <label className="label" id="emailError">
              {emailTouched && !isEmailValid && (
                <span className="label-text-alt text-error animate-in fade-in duration-200">
                  Please enter a valid email address
                </span>
              )}
              {emailTouched && isEmailValid && (
                <span className="label-text-alt text-success animate-in fade-in duration-200">
                  Email looks good!
                </span>
              )}
            </label>
          </div>

          <div className="form-control w-full">
            <label className="label" htmlFor="password">
              <span className="label-text font-medium">Password</span>
              <span className="label-text-alt text-base-content/50">Min 8 characters</span>
            </label>
            <div className="relative">
              <MdLock
                className="text-base-content/40 absolute top-1/2 left-3 -translate-y-1/2"
                size={20}
                aria-hidden="true"
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="input input-bordered w-full pr-10 pl-10"
                defaultValue="password123"
              />
              <button
                type="button"
                className="text-base-content/40 hover:text-base-content absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="form-control w-full">
              <label className="label" htmlFor="role">
                <span className="label-text font-medium">Role</span>
              </label>
              <select id="role" className="select select-bordered w-full">
                <option>Admin</option>
                <option>Editor</option>
                <option>Viewer</option>
              </select>
            </div>

            <div className="form-control w-full">
              <label className="label" htmlFor="timezone">
                <span className="label-text font-medium">Timezone</span>
              </label>
              <select id="timezone" className="select select-bordered w-full">
                <option>UTC-8 (Pacific)</option>
                <option>UTC-5 (Eastern)</option>
                <option>UTC+0 (GMT)</option>
              </select>
            </div>
          </div>
        </div>
      </fieldset>

      {/* Preferences */}
      <fieldset className="fieldset border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <legend className="fieldset-legend bg-secondary text-secondary-content rounded-lg px-3 py-1 text-sm font-semibold">
          Preferences
        </legend>

        <div className="space-y-4">
          <label className="hover:bg-base-200 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors">
            <div>
              <span className="font-medium">Email Notifications</span>
              <p className="text-base-content/60 text-sm">Receive updates via email</p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              defaultChecked
              aria-label="Email notifications"
            />
          </label>

          <div className="divider my-0"></div>

          <label className="hover:bg-base-200 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors">
            <div>
              <span className="font-medium">Dark Mode</span>
              <p className="text-base-content/60 text-sm">Use dark theme</p>
            </div>
            <input type="checkbox" className="toggle toggle-secondary" aria-label="Dark mode" />
          </label>

          <div className="divider my-0"></div>

          <label className="hover:bg-base-200 flex cursor-pointer items-center justify-between rounded-lg p-2 transition-colors">
            <div>
              <span className="font-medium">Two-Factor Auth</span>
              <p className="text-base-content/60 text-sm">Enhanced security</p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-accent"
              aria-label="Two-factor authentication"
            />
          </label>
        </div>
      </fieldset>

      {/* Radio Group */}
      <fieldset className="fieldset border-base-300 bg-base-100 rounded-2xl border p-6 shadow-sm">
        <legend className="fieldset-legend bg-accent text-accent-content rounded-lg px-3 py-1 text-sm font-semibold">
          Plan Selection
        </legend>

        <div className="space-y-3">
          {PLAN_OPTIONS.map((plan) => (
            <label
              key={plan.id}
              className="border-base-300 hover:border-primary hover:bg-primary/5 flex cursor-pointer items-center gap-4 rounded-lg border p-4 transition-all">
              <input
                type="radio"
                name="plan"
                className="radio radio-primary"
                defaultChecked={plan.id === 'pro'}
              />
              <div className="flex-1">
                <div className="font-medium">{plan.name}</div>
                <div className="text-base-content/60 text-sm">{plan.desc}</div>
              </div>
              <div className="text-primary font-semibold">{plan.price}</div>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost transition-colors">Cancel</button>
        <button className="btn btn-primary gap-2 transition-transform hover:scale-105">
          <MdCheck size={18} aria-hidden="true" /> Save Changes
        </button>
      </div>
    </div>
  )
}
