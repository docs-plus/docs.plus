import { DocsPlus, GoogleGIcon, Sparkles, OpenEnvelope } from '@icons'
import { useUser, useSupabaseClient } from '@supabase/auth-helpers-react'
import { useState, useRef, useContext, useEffect, useCallback } from 'react'
import Button from '../../../components/Button'
import { useMutation } from '@tanstack/react-query'
import InputOverlapLabel from '../../../components/InputOverlapLabel'

const SingInForm = ({ children, ...props }) => {
  const supabaseClient = useSupabaseClient()
  const user = useUser()

  const [magicLinkEmail, setMagicLinkEmail] = useState('')
  const [emailError, setEmailError] = useState('')
  const [highlightEmailInput, setHighlightEmailInput] = useState(false)
  const [loading, setLoading] = useState(false)
  const [btnSubmitText, setBtnSubmitText] = useState('Send magic link')
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const signInWithGoogle = async () => {
    setGoogleLoading(true)
    const { data, error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      redirectTo: process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT
    })
    if (error) console.error(error)
    // setGoogleLoading(false)
  }

  const { mutateAsync, isLoading, data } = useMutation(
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
      onError: (error) => {
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

  const signInWithEmail = async (e) => {
    e.preventDefault()

    if (magicLinkEmail.length === 0) return

    const { isValid } = await mutateAsync(magicLinkEmail)
    if (!isValid) {
      setBtnSubmitText('Send magic link')
      return
    }

    setLoading(true)
    setBtnSubmitText('Sending magic link')
    const { data, error } = await supabaseClient.auth.signInWithOtp({
      email: magicLinkEmail,
      options: {
        emailRedirectTo: process.env.NEXT_PUBLIC_SUPABASE_OTP_EMAIL_REDIRECT
      }
    })

    setLoading(false)
    setBtnSubmitText('Magic link sent!')
    setEmailSent(true)
  }

  return (
    <div {...props}>
      <div className={`${!emailSent && 'border  p-5'} rounded-md`}>
        <div className={`${emailSent ? 'hidden' : 'block '}`}>
          <p className="text-base antialiased text-center font-bold">Your journey with Docs.plus begins now!</p>
          <div className="flex flex-col items-center justify-center mt-6 ">
            <Button
              className="px-3 flex align-baseline justify-center w-full py-2 border rounded"
              onClick={() => signInWithGoogle()}
              loading={googleLoading}
              Icon={GoogleGIcon}>
              Continue with Google
            </Button>
          </div>
          <div className="flex items-center justify-center mt-8 ">
            <div className="w-full bg-gray-200 h-0 border"></div>
            <div className="text-center px-2 font-medium text-gray-400 antialiased">OR</div>
            <div className="w-full bg-gray-200 h-0 border"></div>
          </div>
          <div className="flex flex-col w-full  items-center justify-center mt-6 ">
            <form onSubmit={signInWithEmail}>
              {/* <input type="email" placeholder="Enter your Email" /> */}

              <InputOverlapLabel
                className={`  ${highlightEmailInput ? 'border-red-600' : ''}`}
                label="Enter your Email"
                value={magicLinkEmail}
                onChange={(e) => setMagicLinkEmail(e.target.value)}
              />

              {emailError && <p className="mt-2 text-red-600">{emailError}</p>}
              <Button
                className=" text-black border ml-auto mt-4 w-full px-3 py-2 rounded"
                loading={isLoading || loading}
                onClick={signInWithEmail}>
                {btnSubmitText}
              </Button>
              <p className="mt-4 bg-gray-100 flex p-3 pt-4 text-sm text-gray-500 rounded drop-shadow-md">
                <span className="mr-2">
                  <Sparkles fill="#888" size={21} />
                </span>
                We'll email you a magic link for a password-free sign in
              </p>
            </form>
          </div>
        </div>
        <div
          className={`${
            emailSent ? 'block' : 'hidden'
          } bg-slate-200 text-center py-8 px-16 flex flex-col justify-center items-center p-3 pt-4 text-base text-gray-500 rounded-md drop-shadow-sm border`}>
          <div>
            <OpenEnvelope fill="black" size={40} className="mb-4" />
          </div>
          <p className="font-bold text-base mb-3"> Check Your Email!</p>
          <p className="font-normal text-sm">
            We emailed a magic link to <br />
            <b className="text-blue-500">{magicLinkEmail}</b>
          </p>
          <p className="font-normal text-sm">Click the Link to log in or Sign up.</p>
        </div>
      </div>
    </div>
  )
}

export default SingInForm
