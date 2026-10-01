import { signInWithOAuth } from '@api'
import { PageCardIdentity, PageCardIdentityRow } from '@components/PageCard'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
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

/** What a host frames: the dialog puts `back` in its footer strip, the sheet in its body. */
interface SignInParts {
  sent: boolean
  title: string
  description?: ReactNode
  body?: ReactNode
  back?: ReactNode
}

interface SignInFormProps {
  /** Post-auth return URL (pathname+search); when set the OAuth/magic-link redirect lands here. */
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
      toast.Error('Authentication error: ' + error)
      setGoogleBusy(false)
    }
  }

  const handleSignInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (magicLinkEmail.length === 0) {
      setEmailError('Enter your email.')
      return
    }

    setEmailBusy(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_RESTAPI_URL}/email/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: magicLinkEmail })
      })
      const data = (await res.json()) as { isValid?: boolean }
      if (!data.isValid) {
        setEmailError('Enter a valid email.')
        return
      }

      setEmailError('')

      // Preserve the full return context (deep-link / open_heading_chat params)
      // like the OAuth path. The env is an optional base override; without it we
      // use this origin, so a build that misses the arg cannot send "undefined".
      const redirectBase =
        process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT || window.location.origin
      const returnPath = returnTo ?? window.location.pathname + window.location.search

      const { error } = await supabaseClient.auth.signInWithOtp({
        email: magicLinkEmail,
        options: {
          emailRedirectTo: new URL(returnPath, redirectBase).href
        }
      })

      if (error) {
        console.error(error)
        toast.Error('Error signing in with email: ' + error.message)
        return
      }

      setEmailSent(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enter a valid email.'
      setEmailError(message)
      console.error('Failed to validate email:', error)
    } finally {
      setEmailBusy(false)
    }
  }

  if (emailSent) {
    return children({
      sent: true,
      title: 'Check your email',
      description: (
        <>
          We sent a link to{' '}
          <span className="text-base-content font-semibold [overflow-wrap:anywhere]">
            {magicLinkEmail}
          </span>
          .
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

  const buttonHeight = touch ? 'min-h-12' : undefined

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
            helperText={emailError || 'We will email a link. No password.'}
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
