import { Link, redirect, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from '../components/icons/Icons'
import { useAuth } from '../contexts/Auth'

const SignUp = () => {
  const { signInWithOtp, signIn, signOut, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const emailRef = useRef()
  const navigate = useNavigate();


  useEffect(() => {
    if (user && user?.id && user?.email) {
      return navigate('/dashboard')
    }
  }, [user])


  const signInWithEmail = async () => {
    setLoading(true)
    if (user && user?.id && user?.email) {
      return navigate('/dashboard')
    }

    const { data, error } = await signInWithOtp({
      email: 'marzban98@gmail.com',
      options: {
        emailRedirectTo: `${ window.location.origin }/dashboard`
      }
    })
    setLoading(false)

    if (!error && !data.user) {
      return navigate('/auth/checkEmail')
    }

    if (error) {
      alert(error)
    }

  }

  return (
    <div>
      <div className='h-screen max-w-5xl m-auto flex flex-col justify-center align-middle p-4'>
        <div className=" p-2 w-full justify-self-center flex justify-center">
          <div className=' p-5 w-96 sm:border sm:rounded'>

            <div className='flex justify-between align-middle content-baseline mb-8 '>
              <div className='flex flex-row items-center'>
                <div className='flex flex-row items-center'>
                  <Link to="/" className=' '>
                    <div className='padLog rounded-md border p-2'>
                      <ArrowLeft fill='blue' />
                    </div>
                  </Link>
                </div>
              </div>
              <p className='text-center leading-8	 text-lg w-full font-bold block text-gray-900'>Sign up and owned the pads</p>
            </div>

            <div className="flex flex-row w-full">
              <button className="border px-3 py-2 rounded-l border-r-0">Email:</button>
              <input className="p-1 w-full rounded-r border" ref={emailRef} type="email" id="email" />
            </div>

            <div className='flex flex-col  items-center justify-center mt-6 '>
              <button className="px-3 w-full py-2 border rounded" onClick={signInWithEmail} disabled={loading} >
                {loading ? "Loading..." : "Sign Up"}
              </button>
            </div>

            <div className="flex items-center justify-center mt-6">
              <div className="w-20 bg-gray-600 border border-blue-700"></div>
              <div className="text-center px-4 font-normal text-gray-900">Or continue with</div>
              <div className="w-20 bg-gray-600 border border-blue-700"></div>
            </div>

            <div className="flex items-center justify-center mt-6">
              <button className="px-2 w-1/3 py-1 border rounded mx-1 disabled:bg-slate-300 disabled:text-gray-500 disabled:font-normal" disabled>Google</button>
              <button className="px-2 w-1/3 py-1 border rounded mx-1 disabled:bg-slate-300 disabled:text-gray-500 disabled:font-normal" disabled>Twitter</button>
              <button className="px-2 w-1/3 py-1 border rounded mx-1 disabled:bg-slate-300 disabled:text-gray-500 disabled:font-normal" disabled>Github</button>
            </div>

            <p className='mt-6 font-medium text-sm text-gray-500'>
              Already have an account? <Link to="/auth/login">Log In</Link>
            </p>

          </div>
        </div>
      </div >
    </div >
  );
}

export default SignUp;
