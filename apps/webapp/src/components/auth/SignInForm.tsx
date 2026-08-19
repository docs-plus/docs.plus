import { signInWithOAuth } from '@api'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import TextInput from '@components/ui/TextInput'
import { useAsyncRequest } from '@hooks/useAsyncRequest'
import { Provider } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import { browserSupportsPasskeys, toPasskeyOutcome } from '@utils/passkey'
import { supabaseClient } from '@utils/supabase'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { FcGoogle } from 'react-icons/fc'
import { LuKeyRound, LuMail, LuSparkles } from 'react-icons/lu'

interface SignInFormProps {
  /** Visual variant - 'card' adds border/padding, 'inline' has none */
  variant?: 'card' | 'inline'
  /** Show header with title and close button */
  showHeader?: boolean
  title?: string
  subtitle?: string
  /** Callback when close button clicked (header only) */
  onClose?: () => void
  className?: string
  /** Post-auth return URL (pathname+search); when set the OAuth/magic-link redirect lands here instead of the current location. */
  returnTo?: string
}

const SignInForm = ({
  variant = 'card',
  showHeader = false,
  title = 'Sign in to continue',
  subtitle = 'Join the conversation',
  onClose,
  className = '',
  returnTo
}: SignInFormProps) => {
  const router = useRouter()
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [highlightEmailInput, setHighlightEmailInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [btnSubmitText, setBtnSubmitText] = useState('Send magic link')
  const [emailSent, setEmailSent] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [showPasskey, setShowPasskey] = useState(false)

  useEffect(() => setShowPasskey(browserSupportsPasskeys()), [])

  const {
    loading: googleLoading,
    request,
    setLoading: setGoogleLoading
  } = useAsyncRequest(signInWithOAuth, null, false)

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      const authCallbackURL = returnTo ? new URL(returnTo, location.origin) : new URL(location.href)

      await request({
        provider,
        options: {
          redirectTo: authCallbackURL.href,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          },
          scopes:
            'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        }
      })
      setGoogleLoading(true)
    } catch (error) {
      console.error('Authentication error:', error)
      toast.Error('Authentication error: ' + error)
    }
  }

  const { mutateAsync, isPending } = useMutation({
    mutationFn: (email: string) =>
      fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      }).then(async (res) => {
        if (!res.ok) {
          setHighlightEmailInput(true)
          console.error('Invalid email')
        }
        return res.json()
      }),
    onError: (error: Error) => {
      setEmailError(error.message)
      setHighlightEmailInput(true)
      console.error('Failed to validate email:', error)
    },
    onSuccess: () => {
      setEmailError('')
      setHighlightEmailInput(false)
    }
  })

  const handleSignInWithEmail = async (e: React.FormEvent) => {
    e.preventDefault()

    if (magicLinkEmail.length === 0) return

    const { isValid } = await mutateAsync(magicLinkEmail)
    if (!isValid) {
      setBtnSubmitText('Send magic link')
      return
    }

    setLoading(true)
    setBtnSubmitText('Sending magic link')

    // Preserve the full return context (deep-link / open_heading_chat params) exactly
    // like the OAuth path above. The env is an optional base override; without it we
    // use this origin, so a build that misses the arg cannot send "undefined" to Auth.
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
    }

    setLoading(false)
    setBtnSubmitText('Magic link sent!')
    setEmailSent(true)
  }

  // onAuthStateChange deliberately ignores SIGNED_IN, so the session that
  // signInWithPasskey returns never reaches the profile fetch on its own.
  // Reloading is the same escape hatch Google One Tap uses.
  const handlePasskeySignIn = async () => {
    setPasskeyLoading(true)
    try {
      const { error } = await supabaseClient.auth.signInWithPasskey()
      if (!error) {
        router.reload()
        return
      }
      const outcome = toPasskeyOutcome(error, 'Could not sign in with a passkey.')
      if (outcome.status === 'error') toast.Error(outcome.message)
    } finally {
      setPasskeyLoading(false)
    }
  }

  const isAnyLoading = isPending || loading || googleLoading || passkeyLoading

  const containerClasses = variant === 'card' ? 'bg-base-100 rounded-box p-5 shadow-lg sm:p-6' : ''

  return (
    <div className={`flex flex-col ${containerClasses} ${className}`}>
      {showHeader && (
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base-content text-xl font-bold">{title}</h2>
            <p className="text-base-content/60 mt-1 text-sm">{subtitle}</p>
          </div>
          {onClose && <CloseButton onClick={onClose} className="-mt-1 -mr-1" />}
        </div>
      )}

      {!emailSent && (
        <div className="space-y-4">
          <Button
            className="btn btn-block border-base-300 bg-base-100 text-base-content hover:border-base-300 hover:bg-base-200 rounded-box h-11 border font-semibold transition-colors sm:h-12"
            onClick={() => handleOAuthSignIn('google')}
            loading={googleLoading}
            disabled={isAnyLoading}
            startIcon={<FcGoogle className="size-5" />}>
            Continue with Google
          </Button>

          {showPasskey && (
            <Button
              className="btn btn-block border-base-300 bg-base-100 text-base-content hover:border-base-300 hover:bg-base-200 rounded-box h-11 border font-semibold transition-colors sm:h-12"
              onClick={handlePasskeySignIn}
              loading={passkeyLoading}
              disabled={isAnyLoading}
              startIcon={<LuKeyRound className="text-primary size-5" />}>
              Continue with a passkey
            </Button>
          )}

          <div className="divider text-base-content/40 text-xs sm:text-sm">OR</div>

          <form onSubmit={handleSignInWithEmail} className="space-y-4">
            <TextInput
              labelPosition="floating"
              type="email"
              placeholder="mail@site.com"
              value={magicLinkEmail}
              onChange={(e) => setMagicLinkEmail(e.target.value)}
              disabled={isAnyLoading}
              error={highlightEmailInput}
              helperText={emailError}
            />

            <Button
              variant="primary"
              shape="block"
              className="rounded-box h-11 font-semibold sm:h-12"
              loading={isPending || loading}
              disabled={isAnyLoading}
              type="submit">
              {btnSubmitText}
            </Button>

            <div className="bg-base-200 text-base-content/80 rounded-box flex items-start gap-2 p-3 text-xs sm:text-sm">
              <LuSparkles size={16} className="text-primary mt-0.5 shrink-0" />
              <span>We'll email you a magic link for a password-free sign in</span>
            </div>
          </form>
        </div>
      )}

      {emailSent && (
        <div className="bg-base-200 rounded-box flex flex-col items-center justify-center p-6 text-center motion-safe:animate-[doc-region-in_200ms_ease-out_both] sm:p-8">
          <div className="bg-primary/10 mb-4 flex size-16 items-center justify-center rounded-full">
            <LuMail size={28} className="text-primary" />
          </div>
          <h3 className="text-base-content mb-2 text-lg font-bold">Check Your Email!</h3>
          <p className="text-base-content/80 text-sm">
            We emailed a magic link to <br />
            <span className="text-primary font-semibold">{magicLinkEmail}</span>
          </p>
          <p className="text-base-content/60 mt-2 text-sm">Click the link to log in or sign up.</p>
        </div>
      )}
    </div>
  )
}

export default SignInForm
