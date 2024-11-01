import { useRouter } from 'next/router'

function Custom500() {
  const router = useRouter()
  const { error } = router.query

  if (!error) {
    router.push('/')
    return null
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Server Error</h2>
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-red-700">
              <p className="font-medium">Error: 500</p>
              <p className="mt-1">
                Details: {error || 'An unexpected error occurred. Please try again later.'}
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-center space-x-4">
            <button
              onClick={() => router.push('/')}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Return to Home
            </button>
            <button
              onClick={() => router.back()}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Custom500
