import { useStore } from '@stores'
import { SiCloudflare } from 'react-icons/si'
import { Turnstile } from '@marsidev/react-turnstile'
import axios from 'axios'
import { useState, useRef, useEffect } from 'react'
import Config from '@config'
type Props = {
  showTurnstile: boolean
}
import { SlugPageLoader } from './SlugPageLoader'

const TurnstileModal = ({ showTurnstile }: Props) => {
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<any>(null)
  const setWorkspaceSetting = useStore((state) => state.setWorkspaceSetting)

  useEffect(() => {
    setWorkspaceSetting('isTurnstileVerified', !showTurnstile)
  }, [showTurnstile, setWorkspaceSetting])

  const handleVerification = async (token: string | null) => {
    if (!token) return

    try {
      const response = await axios.post(
        Config.app.turnstile.verifyUrl,
        { token },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      const data = response.data

      if (data.success) {
        setWorkspaceSetting('isTurnstileVerified', true)
        window.location.reload()
      } else {
        setError('Verification failed. Please try again.')
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        console.error('Verification error:', err.response?.data || err.message)
      } else {
        console.error('Verification error:', err)
      }
      setError('An error occurred during verification. Please try again.')
    }
  }

  const handleError = (error: string) => {
    setError(error)
  }

  if (!Config.app.turnstile.siteKey) {
    return <p>Error: Turnstile site key is not set.</p>
  }

  const retryHandler = () => {
    window.location.reload()
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-20 flex size-full h-dvh flex-col items-center justify-center">
      {error && (
        <div className="rounded-md p-6 py-2 drop-shadow-md backdrop-blur-md">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Cloudflare Verification Failed
            </h2>
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
              <div className="text-sm text-red-700">
                <p className="mt-1">Details: {error}</p>
              </div>
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={retryHandler}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <Turnstile
        ref={ref}
        siteKey={Config.app.turnstile.siteKey}
        onSuccess={handleVerification}
        onError={handleError}
        onExpire={handleError}
      />
      <div className="fixed bottom-4 left-4 flex w-fit items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 md:right-4">
        <SiCloudflare size={20} className="mr-2 text-[#f38020]" />
        Security by Cloudflare
        <span className="loading loading-dots loading-xs ml-2 mt-2"></span>
      </div>
    </div>
  )
}

export const SlugPageLoaderWithTurnstile = ({ showTurnstile }: Props) => {
  return (
    <div>
      <TurnstileModal showTurnstile={showTurnstile} />
      <SlugPageLoader />
    </div>
  )
}
