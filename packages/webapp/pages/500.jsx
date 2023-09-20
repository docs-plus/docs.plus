import Link from 'next/link'
import { useRouter } from 'next/router'

function Custom500() {
  const router = useRouter()
  const { error } = router.query

  return (
    <div className="h-screen w-full m-auto flex flex-col justify-center items-center p-4 bg-gray-100">
      <div className="p-4 w-2/6 text-center bg-white shadow-xl rounded-lg">
        <h1 className="text-2xl font-bold mb-4">Oops! Something went wrong. (500)</h1>
        <p className="text-red-600 mb-4">{error || 'An unexpected error occurred.'}</p>
        <Link href="/">Return to Home</Link>
      </div>
    </div>
  )
}

export default Custom500
