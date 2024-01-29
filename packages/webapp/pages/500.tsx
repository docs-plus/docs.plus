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
    <div className="flex items-center justify-center h-screen bg-gray-200 p-6">
      <div className="max-w-lg w-full bg-white rounded-lg shadow-xl p-8 space-y-6">
        <h1 className="text-3xl font-bold text-gray-800">Oops! Something went wrong.</h1>
        <p className="text-red-600 text-lg">
          {error || 'An unexpected error occurred. Please try again later.'}
        </p>
        <div className="flex justify-between items-center">
          <Link href="/" className="text-blue-600 hover:text-blue-800 transition duration-300">
            Return to Home
          </Link>
          <button
            onClick={handleBack}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
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
