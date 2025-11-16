import { IoCloseSharp } from 'react-icons/io5'
import { GoogleGIcon, Sparkles, OpenEnvelope } from '@icons'
import { useState } from 'react'
import Button from '@components/ui/Button'
import { useMutation } from '@tanstack/react-query'
import { signInWithOAuth } from '@api'
import { useSupabase } from '@hooks/useSupabase'
import { Provider } from '@supabase/supabase-js'
import * as toast from '@components/toast'
import { createClient } from '@utils/supabase/component'
import { useStore } from '@stores'

export const SignInDialog = () => {
  const closeDialog = useStore((state) => state.closeDialog)
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
            prompt: 'consent',
          },
          scopes: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile'
        }
      })
      setGoogleLoading(true)
    } catch (error) {
      console.error('Authentication error:', error)
      toast.Error('Authentication error: ' + error)
    }
  }

  const { mutateAsync, isLoading } = useMutation(
    (email) =>
      fetch('/api/validate-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      }).then(async (res) => {
        if (!res.ok) {
          setHighlightEmailInput(true)
          console.error('Invalid email')
        }
        return res.json()
      }),
    {
      onError: (error: any) => {
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

  const signInWithEmail = async (e: any) => {
    e.preventDefault()

    if (magicLinkEmail.length === 0) return

    //@ts-ignore
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
      toast.Error('Error signin with email: ' + error.message)
    }

    setLoading(false)
    setBtnSubmitText('Magic link sent!')
    setEmailSent(true)
  }

  return (
    <div className="flex max-h-[80vh] flex-col">
      {/* Header */}
      <div className="sticky top-0 mb-6 border-b border-gray-200 bg-white p-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Sign in to continue</h2>
            <p className="text-sm text-gray-500">Join the conversation</p>
          </div>
          <button className="btn btn-square btn-sm" onClick={closeDialog}>
            <IoCloseSharp size={24} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pt-0">
        <div className={``}>
          <div className={`${emailSent ? 'hidden' : 'block'}`}>
            <div className="flex flex-col items-center justify-center">
              <Button
                className="btn-block"
                onClick={() => handleOAuthSignIn('google')}
                loading={googleLoading}
                disabled={googleLoading || loading}
                Icon={GoogleGIcon}>
                Continue with Google
              </Button>
            </div>

            <div className="divider text-gray-400">OR</div>

            <div className="flex w-full flex-col items-center justify-center">
              <form onSubmit={signInWithEmail} className="w-full">
                <label className="floating-label">
                  <span>Enter your Email</span>
                  <input
                    className={`${highlightEmailInput} input input-md w-full`}
                    type="text"
                    placeholder="mail@site.com"
                    value={magicLinkEmail}
                    onChange={(e: any) => setMagicLinkEmail(e.target.value)}
                  />
                </label>

                {emailError && <p className="mt-2 text-red-600">{emailError}</p>}

                <Button
                  className="btn-neutral btn-block mt-4 text-white"
                  loading={isLoading || loading}
                  disabled={isLoading || loading || googleLoading}
                  onClick={signInWithEmail}>
                  {btnSubmitText}
                </Button>

                <p className="mt-4 flex rounded bg-gray-100 p-3 pt-4 text-sm text-gray-500 drop-shadow-md">
                  <span className="mr-2">
                    <Sparkles fill="#888" size={21} />
                  </span>
                  {`We'll email you a magic link for a password-free sign in`}
                </p>
              </form>
            </div>
          </div>

          <div
            className={`${
              emailSent ? 'block' : 'hidden'
            } flex flex-col items-center justify-center rounded-md border bg-slate-200 p-3 px-16 py-8 pt-4 text-center text-base text-gray-500 drop-shadow-sm`}>
            <div>
              <OpenEnvelope fill="black" size={40} className="mb-4" />
            </div>
            <p className="mb-3 text-base font-bold"> Check Your Email!</p>
            <p className="text-sm font-normal">
              We emailed a magic link to <br />
              <b className="text-blue-500">{magicLinkEmail}</b>
            </p>
            <p className="text-sm font-normal">Click the Link to log in or Sign up.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
