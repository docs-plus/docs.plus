import { GoogleGIcon, Sparkles, OpenEnvelope } from '@icons'
import { useState } from 'react'
import Button from '@components/ui/Button'
import { useMutation } from '@tanstack/react-query'
import InputOverlapLabel from '@components/ui/InputOverlapLabel'
import { signInWithOAuth } from '@api'
import { useSupabase } from '@hooks/useSupabase'
import { Provider } from '@supabase/supabase-js'
import * as toast from '@components/toast'
import { createClient } from '@utils/supabase/component'

const SignInForm = ({ ...props }) => {
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

  // Handle authentication with OAuth
  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      const currentUrl = new URL(location.href)
      const authCallbackURL = new URL(`${currentUrl.origin}${currentUrl.pathname}`)

      currentUrl.searchParams.forEach((value, key) => {
        authCallbackURL.searchParams.append(key, value)
      })

      await request({
        provider,
        options: {
          redirectTo: authCallbackURL.href
        }
      })
      setGoogleLoading(true)

      // set loading true untile the redirect to login
    } catch (error) {
      console.error('Authentication error:', error)
      toast.Error('Authentication error:' + error)
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
    <div {...props}>
      <div className={`${!emailSent && 'border p-5'} rounded-md`}>
        <div className={`${emailSent ? 'hidden' : 'block'}`}>
          {/* <p className="text-base antialiased text-center font-bold">
            Your journey with Docs.plus begins now!
          </p> */}

          <div className="mt-6 flex flex-col items-center justify-center">
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
          <div className="mt-6 flex w-full flex-col items-center justify-center">
            <form onSubmit={signInWithEmail}>
              {/* <input type="email" placeholder="Enter your Email" /> */}

              <InputOverlapLabel
                className={` ${highlightEmailInput ? 'border-red-600' : ''}`}
                label="Enter your Email"
                value={magicLinkEmail}
                onChange={(e: any) => setMagicLinkEmail(e.target.value)}
              />

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
  )
}

export default SignInForm
