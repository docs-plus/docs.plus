import { useRouter } from 'next/router'

const Custom404 = () => {
  const router = useRouter()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Page Not Found</h2>
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
            <div className="text-sm text-red-700">
              <p className="font-medium">Error: 404</p>
              <p className="mt-1">Details: The page you're looking for doesn't exist.</p>
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

export default Custom404
