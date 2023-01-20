

import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from '../../components/icons/Icons'
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../supabase'
import slugify from 'slugify'
import { useAuth } from '../../contexts/Auth'


const AskForUsername = () => {
  const namespaceRef = useRef()
  const { signInWithOtp, signIn, signOut, signInWithOAuth, user } = useAuth()
  const navigate = useNavigate();


  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)


  // validade namespaceRef with slugify
  const validateNamespace = () => {
    const namespace = namespaceRef.current.value
    const slug = slugify(namespace, { lower: true, strict: true })
    console.log(slug, namespace, "=-=-=-=-=-")
    if (namespace.length <= 0 || namespace !== slug) {
      setError('Only lowercase letters, numbers and dashes are allowed')
      console.log("iim in loooeeeooororor")
      return [false, slug]
    }
    return [true, slug]
  }


  const supbmitNamespace = async () => {
    setLoading(true)
    setError(null)

    const [valid, slug] = validateNamespace()
    console.log(valid, slug)
    if (!valid) return setLoading(false)

    const { data: existNamespace, error: erorNamespace } = await supabase
      .from('users')
      .select('id')
      .eq('doc_namespace', slug)

    console.log(existNamespace, erorNamespace, error, existNamespace.length > 0)

    if (existNamespace.length > 0) {
      setError('This Namespace is already taken')
      setLoading(false)
      return
    }

    const { data, error: errorUpdateUser } = await supabase
      .from('users')
      .update({ doc_namespace: slug })
      .eq('id', user.id)

    console.log(data, errorUpdateUser, "=--==-=-=-=--=-=")

    if (errorUpdateUser) {
      alert(errorUpdateUser)
    }

    setLoading(false)
    navigate(`/`, { replace: true })
    window.location.reload();

  }

  return (

    <div className='bg-white shadow p-5 w-[30rem] rounded-md'>

      <div className='flex justify-between align-middle content-baseline mb-8 '>
        <div className='flex flex-row items-center'>
          <Link to="/" className=' '>
            <div className='padLog rounded-md border p-2'>
              <ArrowLeft fill='blue' />
            </div>
          </Link>
        </div>
        <p className='text-center leading-8	 text-lg w-full font-bold block text-gray-900'>Choose your Namespace as part of URL:</p>
      </div>

      <div className="flex flex-row w-full">
        <p className="border px-3 py-2 rounded-l border-r-0 font-mono text-base">docs.plus/</p>
        <input className="p-1 w-full rounded-r border" ref={namespaceRef} type="text" id="namespace" placeholder='adem_rw' />
      </div>

      {error && <p className='text-red-700 text-sm mt-2'>*{error}</p>}


      <div className='flex flex-col  items-center justify-center mt-6 '>

        <button type="button" onClick={supbmitNamespace} disabled={loading} className="w-full text-center flex justify-center items-center px-4 py-2 font-semibold leading-6  shadow rounded-md text-white bg-indigo-500 hover:bg-indigo-400 transition ease-in-out duration-150">
          {loading ? <>
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </> : "Continue"}




        </button>

      </div>


    </div>
  );
}

export default AskForUsername;
