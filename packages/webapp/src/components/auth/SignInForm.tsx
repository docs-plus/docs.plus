import { signInWithOAuth } from '@api'
import * as toast from '@components/toast'
import Button from '@components/ui/Button'
import CloseButton from '@components/ui/CloseButton'
import TextInput from '@components/ui/TextInput'
import { useSupabase } from '@hooks/useSupabase'
import { GoogleGIcon } from '@icons'
import { Provider } from '@supabase/supabase-js'
import { useMutation } from '@tanstack/react-query'
import { createClient } from '@utils/supabase/component'
import { useState } from 'react'
import { LuMail, LuSparkles } from 'react-icons/lu'

interface SignInFormProps {
  /** Visual variant - 'card' adds border/padding, 'inline' has none */
  variant?: 'card' | 'inline'
  /** Show header with title and close button */
  showHeader?: boolean
  /** Custom header title */
  title?: string
  /** Custom header subtitle */
  subtitle?: string
  /** Callback when close button clicked (header only) */
  onClose?: () => void
  /** Additional class names */
  className?: string
}

const SignInForm = ({
  variant = 'card',
  showHeader = false,
  title = 'Sign in to continue',
  subtitle = 'Join the conversation',
  onClose,
  className = ''
}: SignInFormProps) => {
  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [highlightEmailInput, setHighlightEmailInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [btnSubmitText, setBtnSubmitText] = useState('Send magic link')
  const [emailSent, setEmailSent] = useState(false)

  const supabaseClient = createClient()
  const {
    loading: googleLoading,
    request,
    setLoading: setGoogleLoading
  } = useSupabase(signInWithOAuth, null, false)

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      const authCallbackURL = new URL(location.href)

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

  const { mutateAsync, isLoading } = useMutation(
    (email: string) =>
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
    {
      onError: (error: Error) => {
        setEmailError(error.message)
        setHighlightEmailInput(true)
        console.error('Failed to validate email:', error)
      },
      onSuccess: () => {
        setEmailError('')
        setHighlightEmailInput(false)
      }
    }
  )

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

    const pathname = window.location.pathname.split('/')
    pathname.shift()
    const redirectPathname = pathname.join('/')

    const { error } = await supabaseClient.auth.signInWithOtp({
      email: magicLinkEmail,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT + redirectPathname
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

  const isAnyLoading = isLoading || loading || googleLoading

  // Card variant adds its own container styling
  const containerClasses = variant === 'card' ? 'bg-base-100 rounded-box p-5 shadow-lg sm:p-6' : ''

  return (
    <div className={`flex flex-col ${containerClasses} ${className}`}>
      {/* Header - integrated into the same container */}
      {showHeader && (
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-base-content text-xl font-bold">{title}</h2>
            <p className="text-base-content/60 mt-1 text-sm">{subtitle}</p>
          </div>
          {onClose && <CloseButton onClick={onClose} className="-mt-1 -mr-1" />}
        </div>
      )}

      {/* Sign in form */}
      {!emailSent && (
        <div className="space-y-4">
          {/* Google OAuth button */}
          <Button
            className="btn btn-block border-base-300 bg-base-100 text-base-content hover:border-base-300 hover:bg-base-200 h-11 rounded-xl border font-semibold transition-colors sm:h-12"
            onClick={() => handleOAuthSignIn('google')}
            loading={googleLoading}
            disabled={isAnyLoading}
            startIcon={<GoogleGIcon className="size-5" />}>
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="divider text-base-content/40 text-xs sm:text-sm">OR</div>

          {/* Email form */}
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
              className="h-11 rounded-xl font-semibold sm:h-12"
              loading={isLoading || loading}
              disabled={isAnyLoading}
              type="submit">
              {btnSubmitText}
            </Button>

            {/* Hint box */}
            <div className="bg-base-200 text-base-content/80 flex items-start gap-2 rounded-xl p-3 text-xs sm:text-sm">
              <LuSparkles size={16} className="text-primary mt-0.5 shrink-0" />
              <span>We'll email you a magic link for a password-free sign in</span>
            </div>
          </form>
        </div>
      )}

      {/* Email sent confirmation */}
      {emailSent && (
        <div className="bg-base-200 flex flex-col items-center justify-center rounded-xl p-6 text-center sm:p-8">
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
