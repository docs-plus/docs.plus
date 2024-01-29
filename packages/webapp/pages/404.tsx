import Link from 'next/link'
export default function Custom404() {
  return (
    <div className="h-screen w-full m-auto flex flex-col justify-center items-center p-4 bg-gray-100">
      <div className="p-4 w-2/6 text-center bg-white shadow-xl rounded-lg">
        <p className="text-center text-lg">Oops! You seem to be lost. 404 </p>
        <p className="text-center mt-4">
          <Link href="/">Home</Link>
        </p>
      </div>
    </div>
  )
}
