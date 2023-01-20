import { useState, useRef, useContext } from 'react';
import { redirect, Link, useNavigate } from "react-router-dom";
import { Doc } from '../components/icons/Icons';
import { useAuth, AuthContext } from '../contexts/Auth'
import GitHubButton from 'react-github-btn'
import { useEffect } from 'react';
import Button from '../components/Button';
import slugify from 'slugify'

const IntroPage = () => {
  const docNameRef = useRef()
  const navigate = useNavigate()
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [error, setError] = useState(null)

  const { signInWithOtp, signIn, signOut, user, profile } = useAuth()

  console.log(user, profile)


  // slugify the docNameRef
  const validateDocName = (docSlug) => {
    const slug = slugify(docSlug, { lower: true, strict: true })
    console.log(slug)
    if (docSlug.length <= 0 || docSlug !== slug) {
      setError('Only lowercase letters, numbers and dashes are allowed')
      return [false, slug]
    }
    return [true, slug]
  }

  const enterToPad = (target) => {
    setLoadingDoc(true)
    let docSlug = docNameRef.current.value
    if (target === 'random') docSlug = (Math.random() + 1).toString(36).substring(2);

    const [error, slug] = validateDocName(docSlug)
    if (!error) {
      setLoadingDoc(false)
      return
    }


    if (!user) return navigate(`/g/${ slug }`)

    // check if profile has a namespace
    if (!profile?.doc_namespace) {
      return navigate("/auth/username_needed")
    }

    navigate(`/${ profile?.doc_namespace }/${ slug }`)


  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      enterToPad(event)
    }
  };

  return (
    <div className=' w-full bg-slate-100 sm:h-screen h-full flex flex-col sm:justify-center sm:align-middle p-4'>
      <div className="bg-white flex flex-wrap sm:justify-center max-w-5xl sm:m-auto p-6 py-10 pb-2 rounded-md shadow">
        <div className="sm:w-1/2 sm:mx-auto ">
          <div className='p-4'>
            <h1 className='flex flex-row items-end'> <Doc size="58" className="mr-3" /> Docs Plus</h1>
            <h2 className='mt-3 text-gray-500 font-semibold'>Get Everyone one the Same Page</h2>
            <div className='mt-5'>
              <p><span>+</span> A <a href="https://github.com/nwspk/docs.plus">free &amp; open source</a> project by <a href="https://newspeak.house">Newspeak House</a></p>
              <p><span>+</span> Check out our <a href="demo">demo page</a>!</p>
              <p><span>+</span> Enquiries to <a href="https://www.twitter.com/docsdotplus">@docsdotplus</a> or <a href="mailto:ed@newspeak.house">ed@newspeak.house</a></p>
              <p><span>+</span> <a href="https://www.patreon.com/docsplus">Back us on Patreon</a> to help us pay for hosting &amp; development</p>
              <p><span>+</span> See our progress &amp; roadmap on <a href="https://trello.com/b/RUlI6aWC/docsplus">Trello</a> </p>
              <p><span>+</span> Want to report a bug? Interested in contributing? Have a look at our <a href="https://github.com/nwspk/docs.plus/blob/main/CONTRIBUTING.md">contributing guidelines</a>. </p>
              <p><span>+</span> Kindly seed funded by <a href="https://www.grantfortheweb.org">Grant for Web</a> &amp; <a href="https://www.nesta.org.uk">Nesta</a></p>
            </div>
          </div>
        </div>
        <div className="sm:w-1/2 p-2 w-full  mt-2 sm:mt-0 flex justify-end">
          <div className=' p-5 sm:w-[24rem] w-full border sm:border sm:rounded flex justify-center flex-col align-middle'>
            <div className='flex flex-col items-center justify-center  text-gray-800'>
              {user && <div className=' flex justify-between w-full mb-10'>
                <button className='border rounded-md py-1 px-3' onClick={() => signOut()}>Signout</button>
                <Link className='border rounded-md py-1 px-3' to="/dashboard">Dashboard</Link>
              </div>}
              {user?.id && user.email &&
                <div className='w-full text-sm font-semibold flex text-left flex-row justify-start items-center mb-2 '>
                  <p className=''>Continue As:  </p>
                  <p className='ml-2 font-bold text-blue-600'>{profile?.display_name || user?.email}</p>
                </div>}
              <button onClick={() => enterToPad('random')} className="px-3 w-full py-2 border rounded">New Doc</button>
              <label className='text-center w-full mt-6 text-gray-500 block mb-1'>or Create/Open a Doc with the name:</label>

              <div className='flex flex-col  w-full'>
                <div className='flex flex-row w-full font-mono text-sm align-middle'>
                  <p className='px-2 py-2 leading-6 rounded-l border border-r-0  rounded-r-none'>docs.plus/{profile?.doc_namespace ? profile?.doc_namespace : "g"}/</p>
                  <input className='p-1 w-full rounded-l-none border font-mono' ref={docNameRef} type="text" id="padName" onKeyDown={handleKeyDown} />
                </div>
                {error && <p className='text-red-700 text-sm mt-2'>*Only lowercase letters, numbers and dashes are allowed</p>}
                <Button className='border ml-auto mt-2 w-full px-3 py-2 rounded text-black' loading={loadingDoc} onClick={enterToPad}>Enter</Button>
              </div>

            </div>
            {!user && !user?.id && !user?.email && <div>
              <div className="flex items-center justify-center mt-8 ">
                <div className="w-full bg-gray-200 h-1"></div>
                <div className="text-center px-2 font-medium text-gray-400">OR</div>
                <div className="w-full bg-gray-200 h-1"></div>
              </div>
              <div className='flex flex-col  items-center justify-center mt-6 '>
                <label className='text-center w-full mb-4 font-bold block text-gray-900'>Sign up and owned the docs</label>
                <button className="px-3 w-full py-2 border rounded" onClick={() => navigate("/auth/signup")}>Signup</button>
              </div>
              <p className='mt-4 font-medium text-sm'>
                Already have an account? <Link to="/auth/login">Log In</Link>
              </p>
            </div>}
          </div>
        </div>

        <div className="flex w-full flex-wrap md:flex-no-wrap border-t mt-8">
          <div className="w-full md:w-3/4 p-2 ">
            <p className=' font-normal text-sm text-gray-700 leading-8 text-center sm:text-left'>
              Start exploring our open-source project on <a rel='_blanck' href='https://github.com/docs-plus/docs.plus'> GitHub</a>, Join our <a rel='_blanck' href='https://github.com/docs-plus/docs.plus/discussions'>Discussions</a> and help make it even better.
            </p>
          </div>
          <div className="w-full md:w-1/4 p-2">
            <div className='ml-auto flex align-middle justify-around sm:justify-end '>
              <div className='mr-3'>
                <GitHubButton href="https://github.com/docs-plus/docs.plus" data-color-scheme="no-preference: light; light: light; dark: dark;" data-size="large" data-show-count="true" aria-label="Star docs-plus/docs.plus on GitHub">Star</GitHubButton>
              </div>
              <div>
                <GitHubButton href="https://github.com/docs-plus/docs.plus/discussions" data-color-scheme="no-preference: light; light: light; dark: dark;" data-size="large" aria-label="Discuss docs-plus/docs.plus on GitHub">Discuss</GitHubButton>
              </div>
            </div>
          </div>
        </div>

      </div >
    </div >
  );
}

export default IntroPage;
