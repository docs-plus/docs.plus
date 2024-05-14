import Link from 'next/link'
export default function Custom404() {
  return (
    <div className="m-auto flex h-screen w-full flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-2/6 rounded-lg bg-white p-4 text-center shadow-xl">
        <p className="text-center text-lg">Oops! You seem to be lost. 404 </p>
        <p className="mt-4 text-center">
          <Link href="/">Home</Link>
        </p>
      </div>
    </div>
  )
}
