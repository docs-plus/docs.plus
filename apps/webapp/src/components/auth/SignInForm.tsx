import { signInWithOAuth } from '@api'
import { announceSignedInProfile } from '@components/auth/applySignedInProfile'
import * as toast from '@components/toast'
import { Avatar } from '@components/ui/Avatar'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import TextInput from '@components/ui/TextInput'
import { Provider } from '@supabase/supabase-js'
import { supabaseClient } from '@utils/supabase'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { LuMail } from 'react-icons/lu'

import {
  completeGooglePopupSignIn,
  googleOAuthOptions,
  openGoogleAuthPopup
} from './googlePopupSignIn'
import {
  forgetSignedInAccount,
  type LastSignedInAccount,
  readSignedInAccount
} from './lastSignedInAccount'
import { usePasskeyAutofill } from './usePasskeyAutofill'

interface SignInFormProps {
  /** Post-auth return URL (pathname+search); when set the OAuth/magic-link redirect lands here. */
  returnTo?: string
  onClose: () => void
  /** Sheet/dialog host already draws the title and close. */
  embedded?: boolean
}

const SignInForm = ({ returnTo, onClose, embedded = false }: SignInFormProps) => {
  const router = useRouter()
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [googleBusy, setGoogleBusy] = useState(false)
  const [emailBusy, setEmailBusy] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  // Read after mount, never during render: localStorage does not exist on the
  // server, and reading it inline would make the markup differ on hydration.
  const [lastAccount, setLastAccount] = useState<LastSignedInAccount | null>(null)
  useEffect(() => setLastAccount(readSignedInAccount()), [])

  const useAnotherAccount = () => {
    forgetSignedInAccount()
    setLastAccount(null)
  }

  usePasskeyAutofill(() => router.reload())

  const isAnyLoading = googleBusy || emailBusy

  const handleOAuthSignIn = async (provider: Provider) => {
    // Opened first, synchronously. Any `await` before this makes the popup
    // programmatic, and the browser blocks it. Null means no popup is available
    // (mobile, or a blocker), so auth-js redirects this tab instead.
    const popup = openGoogleAuthPopup()
    setGoogleBusy(true)

    try {
      const authCallbackURL = returnTo ? new URL(returnTo, location.origin) : new URL(location.href)

      const response = await signInWithOAuth({
        provider,
        options: googleOAuthOptions(authCallbackURL.href, Boolean(popup), lastAccount?.email)
      })

      if (!popup) return

      const url = response?.data?.url
      if (!url) {
        popup.close()
        toast.Error('Could not start Google sign-in. Please try again.')
        return
      }
      popup.location.href = url

      const outcome = await completeGooglePopupSignIn(popup)
      if (outcome === 'dismissed') return
      if (outcome === 'signed-in') {
        toast.Success('Signed in')
        onClose()
        return
      }
      announceSignedInProfile(outcome)
    } catch (error) {
      popup?.close()
      console.error('Authentication error:', error)
      toast.Error('Authentication error: ' + error)
    } finally {
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
      const res = await fetch('/api/validate-email', {
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

  const closeButton = embedded ? null : (
    <CloseButton onClick={onClose} className="-mr-1 min-h-11 min-w-11 md:min-h-8 md:min-w-8" />
  )

  const googleButton = (
    <Button
      variant="neutral"
      btnStyle="outline"
      shape="block"
      className="min-h-12 font-semibold"
      onClick={() => handleOAuthSignIn('google')}
      loading={googleBusy}
      disabled={isAnyLoading}
      startIcon={<FcGoogle className="size-5" />}>
      {lastAccount ? `Continue as ${lastAccount.name}` : 'Continue with Google'}
    </Button>
  )

  const emailForm = (
    <form
      onSubmit={handleSignInWithEmail}
      className="border-base-300 flex flex-col gap-2.5 border-t pt-4">
      <TextInput
        label="Email"
        labelPosition="above"
        labelClassName="text-base-content/60"
        type="email"
        inputMode="email"
        enterKeyHint="send"
        name="email"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        placeholder="mail@site.com"
        autoComplete="username webauthn"
        className="min-h-11 text-base"
        value={magicLinkEmail}
        onChange={(e) => setMagicLinkEmail(e.target.value)}
        disabled={isAnyLoading}
        error={Boolean(emailError)}
        helperText={emailError}
      />

      <Button
        variant="primary"
        shape="block"
        className="min-h-11"
        loading={emailBusy}
        disabled={isAnyLoading}
        type="submit">
        Send magic link
      </Button>

      <p className="text-base-content/60 text-xs">We will email a link. No password.</p>
    </form>
  )

  if (emailSent) {
    return (
      <>
        {closeButton ? <div className="mb-2 flex justify-end">{closeButton}</div> : null}
        <div
          className="flex flex-col items-center justify-center py-2 text-center motion-safe:animate-[doc-region-in_200ms_ease-out_both]"
          role="status">
          <div className="bg-base-200 mb-3 flex size-12 items-center justify-center rounded-full">
            <LuMail size={20} className="text-base-content/40" />
          </div>
          <h2 className="text-base-content text-lg font-semibold">Check your email</h2>
          <p className="text-base-content/70 mt-2 text-sm">
            We sent a link to
            <br />
            <span className="text-primary font-semibold">{magicLinkEmail}</span>
          </p>
        </div>
      </>
    )
  }

  if (lastAccount) {
    return (
      <>
        {closeButton ? <div className="mb-1 flex justify-end">{closeButton}</div> : null}
        <div className="flex flex-col items-center pb-5 text-center">
          <Avatar
            face={{
              id: lastAccount.id,
              avatar_url: lastAccount.avatarUrl,
              avatar_updated_at: lastAccount.avatarUpdatedAt,
              display_name: lastAccount.name
            }}
            alt={lastAccount.name}
            size="2xl"
            edge="none"
            clickable={false}
            className="mb-3.5 size-[6.5rem]"
          />
          <h2 className="text-base-content text-2xl font-semibold tracking-tight">
            {lastAccount.name}
          </h2>
          <p className="text-base-content/60 mt-1 text-sm">{lastAccount.email}</p>
          <button
            type="button"
            className="text-base-content/60 hover:text-base-content mt-1 min-h-11 text-sm"
            onClick={useAnotherAccount}
            disabled={isAnyLoading}>
            Not you?
          </button>
          <div className="mt-4 w-full">{googleButton}</div>
        </div>
        {emailForm}
      </>
    )
  }

  return (
    <>
      {embedded ? null : (
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-base-content text-lg font-semibold">Sign in</h2>
          {closeButton}
        </div>
      )}
      <div className="flex flex-col gap-4">
        {googleButton}
        {emailForm}
      </div>
    </>
  )
}

export default SignInForm
