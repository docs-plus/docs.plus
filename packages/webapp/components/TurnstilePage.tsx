import React, { useState, useEffect, useRef } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useStore } from '@stores'
import Config from '@config'
import { SiCloudflare } from 'react-icons/si'
import axios from 'axios'

interface TurnstilePageProps {
  showTurnstile: boolean
}

const TurnstilePage: React.FC<TurnstilePageProps> = ({ showTurnstile }) => {
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
    <div className="flex size-full h-dvh flex-col items-center justify-center">
      {error && (
        <div className="flex flex-col items-center">
          <p className="mb-4 text-red-600"> {error}</p>

          <button className="btn btn-primary btn-sm text-white" onClick={retryHandler}>
            Retry
          </button>
        </div>
      )}

      {!error && (
        <div className="flex flex-row items-center">
          <span>Quick security check in progress</span>
          <span className="loading loading-dots loading-xs ml-2 mt-2"></span>
        </div>
      )}
      <Turnstile
        ref={ref}
        siteKey={Config.app.turnstile.siteKey}
        onSuccess={handleVerification}
        onError={handleError}
        onExpire={handleError}
      />
      <div className="absolute bottom-4 right-4 flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
        <SiCloudflare size={20} className="mr-2 text-[#f38020]" />
        Security by Cloudflare
      </div>
    </div>
  )
}

export default TurnstilePage
