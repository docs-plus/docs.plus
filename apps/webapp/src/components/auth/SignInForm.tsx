import { signInWithOAuth } from '@api'
import { PageCardIdentity, PageCardIdentityRow } from '@components/PageCard'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import { Banner } from '@components/ui/Banner'
import Button from '@components/ui/Button'
import { FieldHelp } from '@components/ui/FieldHelp'
import TextInput from '@components/ui/TextInput'
import { supabaseClient } from '@utils/supabase'
import { twMerge } from '@utils/twMerge'
import { type ReactNode, useEffect, useState } from 'react'
import { FcGoogle } from 'react-icons/fc'

import {
  forgetSignedInAccount,
  type LastSignedInAccount,
  readSignedInAccount
} from './lastSignedInAccount'
import { describeEmailLinkError } from './signInErrors'

/** Production Auth refuses a second link to one address inside this window. */
const RESEND_COOLDOWN_S = 60

/** Seconds left until `until` (epoch ms), ticking once a second while above zero. */
function useSecondsLeft(until: number) {
  // The clock is read at render, so a new `until` counts from the real now.
  const [, setTick] = useState(0)
  const left = Math.max(0, Math.ceil((until - Date.now()) / 1000))
  useEffect(() => {
    if (left === 0) return
    const id = window.setTimeout(() => setTick((n) => n + 1), 1000)
    return () => window.clearTimeout(id)
  }, [left, until])
  return left
}

/** What a host frames: the dialog puts `back` in its footer strip, the sheet in its body. */
interface SignInParts {
  sent: boolean
  title: string
  description?: ReactNode
  body?: ReactNode
  back?: ReactNode
}

interface SignInFormProps {
  /** Post-auth return URL (pathname+search); the OAuth and email-link sign-ins land here. */
  returnTo?: string
  /** Sheet host: taller touch targets for the buttons and the field. */
  touch?: boolean
  children: (parts: SignInParts) => ReactNode
}

const SignInForm = ({ returnTo, touch = false, children }: SignInFormProps) => {
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [focusEmail, setFocusEmail] = useState(false)
  // Set when Auth refused a send because a link to this address just left.
  const [sentNotice, setSentNotice] = useState('')
  const [resendError, setResendError] = useState('')
  const [resendAt, setResendAt] = useState(0)
  const resendIn = useSecondsLeft(resendAt)
  // Read after mount, never during render: localStorage does not exist on the
  // server, and reading it inline would make the markup differ on hydration.
  const [lastAccount, setLastAccount] = useState<LastSignedInAccount | null>(null)
  useEffect(() => setLastAccount(readSignedInAccount()), [])

  const useAnotherAccount = () => {
    forgetSignedInAccount()
    setLastAccount(null)
  }

  const returnToEmailStep = () => {
    setFocusEmail(true)
    setEmailSent(false)
    setSentNotice('')
    setResendError('')
  }

  const isAnyLoading = googleBusy || emailBusy

  const handleGoogleSignIn = async () => {
    // Full-tab only. Never `prompt: 'consent'` — that forces Google's
    // passkey challenge on every click.
    setGoogleBusy(true)

    try {
      const authCallbackURL = returnTo ? new URL(returnTo, location.origin) : new URL(location.href)
      const { error } = await signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authCallbackURL.href,
          ...(lastAccount?.email ? { queryParams: { login_hint: lastAccount.email } } : {}),
          scopes:
            'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        }
      })
      if (error) {
        toast.Error('Could not start Google sign-in. Please try again.')
        setGoogleBusy(false)
      }
    } catch (error) {
      console.error('Authentication error:', error)
      toast.Error("Couldn't start Google sign-in. Check your connection and try again.")
      setGoogleBusy(false)
    }
  }

  /** One send for the first link and every resend. `error` is the inline line, or ''. */
  const sendLink = async (email: string): Promise<{ sent: boolean; error: string }> => {
    // The mail links back here with `#token_hash=`, so keep the full return context
    // (deep-link / open_heading_chat params), like OAuth. The env is an optional base override.
    const redirectBase =
      process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT || window.location.origin
    const returnPath = returnTo ?? window.location.pathname + window.location.search

    let error: unknown
    try {
      ;({ error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: new URL(returnPath, redirectBase).href }
      }))
    } catch (thrown) {
      error = thrown
    }
    if (!error) {
      setSentNotice('')
      setResendAt(Date.now() + RESEND_COOLDOWN_S * 1000)
      setEmailSent(true)
      return { sent: true, error: '' }
    }

    console.warn('Sign-in link send failed:', error)
    const problem = describeEmailLinkError(error)
    if (problem.retryInSeconds) {
      // A link to this address left moments ago: show it as sent and count down.
      setSentNotice(problem.message)
      setResendAt(Date.now() + problem.retryInSeconds * 1000)
      setEmailSent(true)
      return { sent: false, error: '' }
    }
    return { sent: false, error: problem.message }
  }

  /** The house regex and an MX check; a failed check never blocks sign-in. */
  const looksDeliverable = async (email: string): Promise<boolean> => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_RESTAPI_URL}/email/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (!res.ok) return true
      const data = (await res.json()) as { isValid?: boolean }
      return data.isValid !== false
    } catch (error) {
      console.warn('Email check failed:', error)
      return true
    }
  }

  const handleSignInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    const email = magicLinkEmail.trim()
    if (email.length === 0) {
      setEmailError('Enter your email.')
      return
    }

    setEmailBusy(true)
    try {
      if (!(await looksDeliverable(email))) {
        setEmailError('Enter a valid email. Check the spelling after the @.')
        return
      }
      setEmailError((await sendLink(email)).error)
    } finally {
      setEmailBusy(false)
    }
  }

  const handleResend = async () => {
    setEmailBusy(true)
    try {
      const { sent, error } = await sendLink(magicLinkEmail.trim())
      setResendError(error)
      if (sent) toast.Success('New link sent. Check your inbox.')
    } finally {
      setEmailBusy(false)
    }
  }

  const buttonHeight = touch ? 'min-h-12' : undefined

  if (emailSent) {
    return children({
      sent: true,
      title: 'Check your email',
      description: (
        <>
          We sent a sign-in link to{' '}
          <span className="text-base-content font-semibold [overflow-wrap:anywhere]">
            {magicLinkEmail}
          </span>
          .
        </>
      ),
      body: (
        <>
          {sentNotice ? <Banner tone="info">{sentNotice}</Banner> : null}
          <ul className="text-base-content/70 flex list-disc flex-col gap-1 ps-5 text-sm">
            <li>The link works once, for 1 hour.</li>
            <li>It signs you in wherever it opens, even inside your mail app.</li>
            <li>No email after a minute? Check your spam folder.</li>
          </ul>
          {resendError ? <FieldHelp error>{resendError}</FieldHelp> : null}
          <Button
            shape="block"
            className={buttonHeight}
            onClick={handleResend}
            loading={emailBusy}
            disabled={emailBusy || resendIn > 0}>
            {resendIn > 0 ? `Send a new link in ${resendIn} s` : 'Send a new link'}
          </Button>
        </>
      ),
      // The pressed Send button unmounts here; without this, focus falls to `body`.
      back: (
        <Button variant="quiet" onClick={returnToEmailStep} autoFocus>
          Use a different email
        </Button>
      )
    })
  }

  return children({
    sent: false,
    title: 'Sign in',
    body: (
      <>
        {lastAccount ? (
          <PageCardIdentity>
            <PageCardIdentityRow
              leading={
                <Avatar
                  face={{
                    id: lastAccount.id,
                    avatar_url: lastAccount.avatarUrl,
                    avatar_updated_at: lastAccount.avatarUpdatedAt,
                    display_name: lastAccount.name
                  }}
                  alt=""
                  size="md"
                  edge="none"
                  clickable={false}
                  className="shrink-0"
                />
              }
              name={<bdi>{lastAccount.name}</bdi>}
              meta={lastAccount.email}
              action={
                <Button variant="quiet" onClick={useAnotherAccount} disabled={isAnyLoading}>
                  Not you?
                </Button>
              }
            />
          </PageCardIdentity>
        ) : null}

        {/* Google's own colours ride daisyUI's `--btn-*` vars, so its hover and disabled
            states still apply; a `bg-*` utility would beat both. */}
        <Button
          shape="block"
          className={twMerge(
            'border-google-stroke focus-visible:outline-primary font-medium [--btn-color:var(--color-google-fill)] [--btn-fg:var(--color-google-ink)]',
            buttonHeight
          )}
          onClick={handleGoogleSignIn}
          loading={googleBusy}
          disabled={isAnyLoading}
          startIcon={<FcGoogle className="size-[18px]" aria-hidden />}>
          Continue with Google
        </Button>

        <hr className="border-base-300" />

        <form onSubmit={handleSignInWithEmail} className="flex flex-col gap-4">
          <TextInput
            label="Email"
            labelPosition="above"
            type="email"
            inputMode="email"
            enterKeyHint="send"
            name="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="mail@site.com"
            autoComplete="username"
            autoFocus={focusEmail}
            // 16px text stops iOS Safari zooming on focus; iPadOS gets this dialog too.
            className={twMerge('text-base', touch && 'min-h-11')}
            value={magicLinkEmail}
            onChange={(e) => setMagicLinkEmail(e.target.value)}
            disabled={isAnyLoading}
            error={Boolean(emailError)}
            helperText={emailError || 'We will email you a sign-in link. No password.'}
          />

          <Button
            variant="primary"
            shape="block"
            className={buttonHeight}
            loading={emailBusy}
            disabled={isAnyLoading}
            type="submit">
            Send magic link
          </Button>
        </form>
      </>
    )
  })
}

export default SignInForm
