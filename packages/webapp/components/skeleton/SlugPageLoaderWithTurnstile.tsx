import { useStore } from '@stores'
import { SiCloudflare } from 'react-icons/si'
import { Turnstile } from '@marsidev/react-turnstile'
import { useState, useRef, useCallback } from 'react'
import Config from '@config'
import { SlugPageLoader } from './SlugPageLoader'

type Props = {
  showTurnstile: boolean
}

type TurnstileState =
  | 'loading' // Widget is loading
  | 'ready' // Widget ready for interaction
  | 'solving' // User is solving the challenge
  | 'verifying' // Verifying with our API
  | 'success' // Verification complete
  | 'error' // Error occurred
  | 'expired' // Token expired
  | 'unsupported' // Browser doesn't support Turnstile

const TurnstileModal = ({ showTurnstile }: Props) => {
  const [state, setState] = useState<TurnstileState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const ref = useRef<any>(null)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  const handleLoad = useCallback(() => {
    setState('ready')
    setError(null)
  }, [])

  const handleBeforeInteractive = useCallback(() => {
    setState('solving')
  }, [])

  const handleVerification = useCallback(
    async (token: string | null) => {
      if (!token || state === 'verifying') return

      setState('verifying')
      setError(null)

      try {
        const response = await fetch(Config.app.turnstile.verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          signal: AbortSignal.timeout(15000)
        })

        const data = await response.json()

        if (data.success) {
          setState('success')
          setWorkspaceSetting('isTurnstileVerified', true)

          // TODO: I do not have any solution to reload the page without reloading the whole app
          window.location.reload()
        } else {
          throw new Error(data.message || 'Verification failed')
        }
      } catch (err) {
        let errorMessage = 'Verification failed. Please try again.'

        if (err instanceof Error) {
          if (err.name === 'TimeoutError') {
            errorMessage = 'Verification timed out. Please try again.'
          } else if (err.message.includes('fetch')) {
            errorMessage = 'Network error. Please check your connection.'
          } else {
            errorMessage = err.message
          }
        }

        setState('error')
        setError(errorMessage)
        console.error('Turnstile verification error:', err)
      }
    },
    [state, setWorkspaceSetting]
  )

  const handleError = useCallback((errorCode: string) => {
    console.error('Turnstile widget error:', errorCode)
    setState('error')
    setError('Captcha failed to load. Please refresh the page.')
  }, [])

  const handleExpire = useCallback(() => {
    setState('expired')
    setError('Verification expired. Please try again.')
  }, [])

  const handleUnsupported = useCallback(() => {
    setState('unsupported')
    setError('Your browser does not support this security feature.')
  }, [])

  const handleRetry = useCallback(() => {
    setState('loading')
    setError(null)
    setRetryCount((prev) => prev + 1)
    ref.current?.reset()
  }, [])

  // Get display text and loading state based on current state
  const getStateInfo = () => {
    switch (state) {
      case 'loading':
        return { text: 'Loading security check', showSpinner: true }
      case 'ready':
        return { text: 'Complete security check', showSpinner: false }
      case 'solving':
        return { text: 'Solving challenge', showSpinner: true }
      case 'verifying':
        return { text: 'Verifying', showSpinner: true }
      case 'success':
        return { text: 'Verified', showSpinner: false }
      case 'error':
      case 'expired':
      case 'unsupported':
        return { text: 'Security check failed', showSpinner: false }
      default:
        return { text: 'Security check', showSpinner: false }
    }
  }

  const { text, showSpinner } = getStateInfo()

  if (!Config.app.turnstile.siteKey) {
    return (
      <div className="fixed inset-0 bottom-0 z-30 flex items-center justify-center bg-red-50/40 backdrop-blur-sm">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-700">Configuration Error</h2>
          <p className="mt-2 text-red-600">Turnstile site key is not configured.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-0 z-10 flex w-auto items-center rounded-lg bg-gray-100 px-4 py-1 text-sm text-gray-700 md:left-4">
      <Turnstile
        key={retryCount}
        ref={ref}
        siteKey={Config.app.turnstile.siteKey}
        onLoad={handleLoad}
        onBeforeInteractive={handleBeforeInteractive}
        onSuccess={handleVerification}
        onError={handleError}
        onExpire={handleExpire}
        onUnsupported={handleUnsupported}
      />

      <div className="flex w-full items-center justify-center gap-1">
        <span className={`flex ${error && 'hidden md:flex'} justify-center gap-1`}>
          <SiCloudflare size={20} className="mr-2 text-[#f38020]" />
          Security by Cloudflare
        </span>

        {/* Show current state */}
        {!error && (
          <>
            <div className="divider divider-horizontal m-0 w-0 py-1"></div>
            <span className="text-xs font-normal text-gray-400">{text}</span>
            {showSpinner && <span className="loading loading-dots loading-xs"></span>}
          </>
        )}

        {/* Error state */}
        {error && (
          <>
            <div className="divider divider-horizontal m-0 hidden w-0 py-1 md:flex"></div>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={handleRetry}
              disabled={state === 'verifying'}
              className={`btn btn-sm btn-ghost btn-error btn-dash h-5 md:h-auto`}>
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const SlugPageLoaderWithTurnstile = ({ showTurnstile }: Props) => {
  return (
    <div className="h-full">
      <TurnstileModal showTurnstile={showTurnstile} />
      <SlugPageLoader />
    </div>
  )
}
