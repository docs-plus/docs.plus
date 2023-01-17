import { useState, useRef } from 'react';
import { redirect, Link, useNavigate } from "react-router-dom";
import { Doc } from '../components/icons/Icons';
import { useAuth } from '../contexts/Auth'
import GitHubButton from 'react-github-btn'
import { useEffect } from 'react';

const IntroPage = () => {
  const padNameRef = useRef()

  const createARandomPad = () => {
    const randPadName = (Math.random() + 1).toString(36).substring(2);
    window.location = `/${ randPadName }`
    return redirect(`/${ randPadName }`)
  }

  const enterToPad = () => {
    const padName = padNameRef.current.value
    if (padName.length === 0) return
    window.location = `/${ padName }`
    return redirect(`/${ padName }`)
  }

  const handleKeyDown = event => {
    if (event.key === 'Enter') {
      enterToPad()
    }
  };

  const { signInWithOtp, signIn, signOut, user } = useAuth()

  useEffect(() => {
    if (user?.id && user?.email) {
      // console.log(user, "=-=-=-=-=-=- >>>>>")
      // return navigate('/s/profile')
    }
  }, [user])

  const SignUp = async () => {
    // const { data, error } = await signInWithOtp({
    //   email: 'marzban98@gmail.com',
    //   options: {
    //     emailRedirectTo: `${ window.location.origin }/pad1`
    //   }
    // })
    // console.log("=-=-=-=-", data, error, user)
  }
  const navigate = useNavigate()


  return (
    <div className='h-screen max-w-5xl m-auto flex flex-col justify-center align-middle p-4'>
      <div className="flex flex-wrap sm:justify-center">
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
        <div className="sm:w-1/2 p-2 w-full justify-self-center flex justify-center ">
          <div className=' p-5 w-96 sm:border sm:rounded flex justify-center flex-col align-middle'>
            <div className='flex flex-col items-center justify-center  text-gray-800'>
              {user?.id && user.email && <div className='text-lg font-semibold mb-6 text-center'>
                <p className=''>Continue As: </p>
                <p className=' text-sm'>{user?.email}</p>
              </div>}
              <button onClick={createARandomPad} className="px-3 w-full py-2 border rounded">New Pad</button>
              <label className='text-center w-full mt-6 text-gray-500 block mb-1'>or Create/Open a Pad with the name:</label>
              <div className='flex flex-row w-full'>
                <input className='p-1 w-full rounded-l border' ref={padNameRef} type="text" id="padName" onKeyDown={handleKeyDown} />
                <button className='border px-3 py-2 rounded border-l-0 rounded-l-none' onClick={enterToPad}>Enter</button>
              </div>
            </div>
            {!user && !user?.id && !user?.email && <div>
              <div className="flex items-center justify-center mt-8 ">
                <div className="w-full bg-gray-200 h-1"></div>
                <div className="text-center px-2 font-medium text-gray-400">OR</div>
                <div className="w-full bg-gray-200 h-1"></div>
              </div>
              <div className='flex flex-col  items-center justify-center mt-6 '>
                <label className='text-center w-full mb-4 font-bold block text-gray-900'>Sign up and owned the pads</label>
                <button className="px-3 w-full py-2 border rounded" onClick={() => navigate("/auth/signup")}>Signup</button>
              </div>
              <p className='mt-4 font-medium text-sm'>
                Already have an account? <Link to="/auth/login">Log In</Link>
              </p>
            </div>}
          </div>
        </div>
        <div className='border-t mt-6 w-full flex align-middle p-2'>
          <p className=' font-normal text-sm text-gray-700 leading-8'>
            Start exploring our open-source project on <a rel='_blanck' href='https://github.com/docs-plus/docs.plus'> GitHub</a>, Join our <a rel='_blanck' href='https://github.com/docs-plus/docs.plus/discussions'>Discussions</a> and help make it even better.
          </p>
          <div className='ml-auto  flex align-middle '>
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
  );
}

export default IntroPage;
