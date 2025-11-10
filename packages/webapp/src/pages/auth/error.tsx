import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const AuthErrorPage = () => {
  const router = useRouter()
  const [errorDetails, setErrorDetails] = useState({
    error: '',
    errorCode: '',
    errorDescription: ''
  })

  useEffect(() => {
    if (router.isReady) {
      setErrorDetails({
        error: String(router.query.error || ''),
        errorCode: String(router.query.error_code || ''),
        errorDescription: String(router.query.error_description || '')
      })
    }
  }, [router.isReady, router.query])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Authentication Error
          </h2>
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-red-700">
              <p className="font-medium">Error: {errorDetails.error}</p>
              {errorDetails.errorCode && <p className="mt-1">Code: {errorDetails.errorCode}</p>}
              {errorDetails.errorDescription && (
                <p className="mt-1">Details: {errorDetails.errorDescription}</p>
              )}
            </div>
          </div>
          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Return to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthErrorPage
