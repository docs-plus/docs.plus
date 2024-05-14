import Link from 'next/link'
import { useRouter } from 'next/router'

function Custom500() {
  const router = useRouter()
  const { error } = router.query

  // Function to navigate back
  const handleBack = () => {
    router.back()
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gray-200 p-6">
      <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-gray-800">Oops! Something went wrong.</h1>
        <p className="text-lg text-red-600">
          {error || 'An unexpected error occurred. Please try again later.'}
        </p>
        <div className="flex items-center justify-between">
          <Link href="/" className="text-blue-600 transition duration-300 hover:text-blue-800">
            Return to Home
          </Link>
          <button
            onClick={handleBack}
            className="rounded bg-blue-500 px-4 py-2 font-bold text-white hover:bg-blue-700"
            // Replace false with a condition to check if the server is fixed
            disabled={false}>
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
}

export default Custom500
