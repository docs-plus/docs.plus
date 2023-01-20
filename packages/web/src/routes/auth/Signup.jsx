import { Link, redirect, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from 'react';
import { ArrowLeft } from '../../components/icons/Icons'
import { useAuth } from '../../contexts/Auth'
import Button from '../../components/Button';

const SignUp = () => {
  const { signInWithOtp, signInWithOAuth, signIn, signOut, user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [loadingGoogle, setLoadingGoogle] = useState(false)
  const [loadingGithub, setLoadingGithub] = useState(false)
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
      email: emailRef,
      options: {
        emailRedirectTo: `${ window.location.origin }/dashboard`
      }
    })
    setLoading(false)

    if (!error && !data.user) {
      return navigate('/auth/checkemail')
    }

    if (error) {
      alert(error)
    }

  }

  const btn_signInWithOAuth = async (provider) => {
    setLoading(true)
    if (provider === "google") setLoadingGoogle(true)
    else if (provider === "github") setLoadingGithub(true)
    if (user && user?.id && user?.email) {
      return navigate('/dashboard')
    }
    const { data, error } = signInWithOAuth({
      provider,
    })
    setLoading(false)
    console.log(data, error, "signInWithOAuth")
    if (!error && !data.user) {
      return navigate('/auth/checkemail')
    }
    if (error) {
      alert(error)
    }
  }

  return (
    <div className=' bg-white shadow p-5 w-96 rounded-md'>

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
        <p className='text-center leading-8	 text-lg w-full font-bold block text-gray-900'>Sign up and owned the docs</p>
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
        <div className="w-20 bg-gray-600 border border-gray-700"></div>
        <div className="text-center px-4 font-normal text-gray-700">OR Sign up With</div>
        <div className="w-20 bg-gray-600 border border-gray-700"></div>
      </div>



      <div className="flex items-center  justify-center mt-6">

        <Button onClick={() => btn_signInWithOAuth('google')} loading={loadingGoogle} type="button" className="text-white  w-1/2 justify-center bg-[#4285F4] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#4285F4]/55 mr-2 mb-2">
          <span className='text-white flex items-center'>
            <svg className="w-4 h-4 mr-2 -ml-1" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
            Google
          </span>
        </Button>

        <Button onClick={() => btn_signInWithOAuth('github')} loading={loadingGithub} type="button" className="text-white w-1/2 justify-center bg-[#24292F] hover:bg-[#24292F]/90 focus:ring-4 focus:outline-none focus:ring-[#24292F]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-gray-500 dark:hover:bg-[#050708]/30 mr-2 mb-2">
          <span className='text-white flex items-center'>
            <svg className="w-4 h-4 mr-2 -ml-1" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="github" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512"><path fill="currentColor" d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3 .3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5 .3-6.2 2.3zm44.2-1.7c-2.9 .7-4.9 2.6-4.6 4.9 .3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3 .7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3 .3 2.9 2.3 3.9 1.6 1 3.6 .7 4.3-.7 .7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3 .7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3 .7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z"></path></svg>
            Github
          </span>
        </Button>

      </div >

      <p className='mt-2 font-medium text-sm text-gray-500'>
        Already have an account? <Link to="/auth/login">Log In</Link>
      </p>

    </div >
  );
}











export default SignUp;
