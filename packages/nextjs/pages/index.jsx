import Head from 'next/head'
import { useState, useRef, useContext, useEffect } from 'react'
import HeadSeo from '../components/HeadSeo'
import Link from 'next/link'
import GitHubButton from 'react-github-btn'

import { DocsPlus } from '../components/icons/Icons'
import Button from '../components/Button'
import slugify from 'slugify'

import { useRouter } from 'next/router'

export default function Home({ hostname }) {
  // const { signInWithOtp, signIn, signOut, user, profile } = useAuth()
  const user = null
  const profile = null

  const router = useRouter()
  const docNameRef = useRef()
  const [loadingDoc, setLoadingDoc] = useState(false)
  const [error, setError] = useState(null)
  const [namespace, setNamespace] = useState(`${hostname}/`)

  // slugify the docNameRef
  const validateDocName = (docSlug) => {
    const slug = slugify(docSlug, { lower: true, strict: true })

    if (docSlug.length <= 0 || docSlug !== slug) {
      setError('Only lowercase letters, numbers and dashes are allowed')

      return [false, slug]
    }

    return [true, slug]
  }

  const enterToPad = (target) => {
    setLoadingDoc(true)
    let docSlug = docNameRef.current.value

    if (target === 'random')
      docSlug = (Math.random() + 1).toString(36).substring(2)

    const [error, slug] = validateDocName(docSlug)

    if (!error) {
      setLoadingDoc(false)
      return
    }

    // if (!user) return router.push(`/${slug}`, undefined, { shallow: true })

    // check if profile has a namespace
    // if (!profile?.doc_namespace) {
    //   return router.push('/auth/username_needed')
    // }
    window.location = `/${slug}`
    // router.push(`/${slug}`, null, { shallow: true })
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      enterToPad(event)
    }
  }

  useEffect(() => {
    setNamespace(`${location.host}/`)
  }, [])

  return (
    <div>
      <HeadSeo title="Docs Plus" description="Docs Plus application" />
      <div className="grid h-screen place-items-center w-full bg-slate-100 p-4">
        <div className="bg-white flex flex-wrap sm:justify-center max-w-5xl sm:m-auto p-2 sm:p-6 sm:py-10 pb-2 rounded-md shadow">
          <div className="sm:w-1/2 sm:mx-auto ">
            <div className="p-4">
              <div className="flex flex-row items-end">
                {' '}
                <DocsPlus className="mr-3" size="58" />{' '}
                <span className="text-5xl">docs plus</span>
              </div>
              <h2 className="mt-3 text-gray-500 font-semibold">
                Get everyone on the same page
              </h2>
              <div className="mt-5 leading-7 ">
                <p>
                  <span>+</span> A{' '}
                  <a href="https://github.com/docs-plus">
                    free &amp; open source
                  </a>{' '}
                  project by <a href="https://newspeak.house">Newspeak House</a>
                </p>
                <p>
                  <span>+</span> Enquiries to{' '}
                  <a href="https://www.twitter.com/docsdotplus">@docsdotplus</a>{' '}
                  or <a href="mailto:ed@newspeak.house">ed@newspeak.house</a>
                </p>
                <p>
                  <span>+</span> Found a bug? Help us out by{' '}
                  <a href="https://github.com/docs-plus/docs.plus/issues">
                    reporting it
                  </a>
                  .{' '}
                </p>
                <p>
                  <span>+</span>{' '}
                  <a href="https://www.patreon.com/docsplus">
                    Back us on Patreon
                  </a>{' '}
                  to help us pay for hosting &amp; development
                </p>
                <p>
                  <span>+</span> Kindly seed funded by{' '}
                  <a href="https://www.grantfortheweb.org">Grant for Web</a>{' '}
                  &amp; <a href="https://www.nesta.org.uk">Nesta</a>
                </p>
              </div>
            </div>
          </div>
          <div className="sm:w-1/2 p-2 w-full  mt-2 sm:mt-0 flex justify-end">
            <div className=" p-5 sm:w-[24rem] w-full border sm:border sm:rounded flex justify-center flex-col align-middle">
              <div className="flex flex-col items-center justify-center  text-gray-800">
                {user && (
                  <div className=" flex justify-between w-full mb-10">
                    <button
                      className="border rounded-md py-1 px-3"
                      onClick={() => signOut()}>
                      Signout
                    </button>
                    <Link
                      className="border rounded-md py-1 px-3"
                      to="/dashboard">
                      Dashboard
                    </Link>
                  </div>
                )}
                {user?.id && user.email && (
                  <div className="w-full text-sm font-semibold flex text-left flex-row justify-start items-center mb-2 ">
                    <p className="">Continue As: </p>
                    <p className="ml-2 font-bold text-blue-600">
                      {profile?.display_name || user?.email}
                    </p>
                  </div>
                )}
                <button
                  className="px-3 w-full py-2 border rounded"
                  onClick={() => enterToPad('random')}>
                  Create a new public doc
                </button>
                <label className="text-center w-full mt-4 sm:mt-6 text-gray-500 block mb-1">
                  or
                </label>

                <div className="flex flex-col w-full">
                  <div className="flex flex-col sm:flex-row w-full font-mono text-sm align-middle">
                    <p className="sm:px-2 py-2 leading-6 rounded sm:rounded-l sm:border sm:border-r-0  sm:rounded-r-none">
                      {namespace}
                    </p>
                    <input
                      ref={docNameRef}
                      placeholder="Document Name"
                      className="p-2 sm:p-1 w-full rounded sm:rounded-l-none border font-mono"
                      id="padName"
                      type="text"
                      onKeyDown={handleKeyDown}
                    />
                  </div>
                  {error && (
                    <p className="text-red-700 text-sm mt-2">
                      *Only lowercase letters, numbers and dashes are allowed
                    </p>
                  )}
                  <Button
                    className=" text-black border ml-auto mt-2 w-full px-3 py-2 rounded"
                    loading={loadingDoc}
                    onClick={enterToPad}>
                    Open public doc
                  </Button>
                </div>
              </div>
              {/* {!user && !user?.id && !user?.email && <div>
                <div className="flex items-center justify-center mt-8 ">
                  <div className="w-full bg-gray-200 h-1"></div>
                  <div className="text-center px-2 font-medium text-gray-400">OR</div>
                  <div className="w-full bg-gray-200 h-1"></div>
                </div>
                <div className='flex flex-col  items-center justify-center mt-6 '>
                  <label className='text-center w-full mb-4 font-bold block text-gray-900'>Sign up for private docs</label>
                  <button className="px-3 w-full py-2 border rounded" onClick={() => navigate('/auth/signup')}>Sign up</button>
                </div>
                <p className='mt-4 font-medium text-sm'>
                  Already have an account? <Link to="/auth/login">Log in</Link>
                </p>
              </div>} */}
            </div>
          </div>

          <div className="flex w-full flex-wrap md:flex-no-wrap border-t mt-8">
            <div className="w-full md:w-3/4 p-2 ">
              <p className=" font-normal text-sm text-gray-700 leading-8 text-center sm:text-left">
                Start exploring our open-source project on{' '}
                <a href="https://github.com/docs-plus/docs.plus" rel="_blanck">
                  {' '}
                  GitHub
                </a>
                , Join our{' '}
                <a
                  href="https://github.com/docs-plus/docs.plus/discussions"
                  rel="_blanck">
                  discussions
                </a>{' '}
                and help make it even better!
              </p>
            </div>
            <div className="w-full md:w-1/4 p-2">
              <div className="ml-auto flex align-middle justify-around sm:justify-end ">
                <div className="mr-3">
                  <GitHubButton
                    aria-label="Star docs-plus/docs.plus on GitHub"
                    data-color-scheme="no-preference: light; light: light; dark: dark;"
                    data-show-count="true"
                    data-size="large"
                    href="https://github.com/docs-plus/docs.plus">
                    Star
                  </GitHubButton>
                </div>
                <div>
                  <GitHubButton
                    aria-label="Discuss docs-plus/docs.plus on GitHub"
                    data-color-scheme="no-preference: light; light: light; dark: dark;"
                    data-size="large"
                    href="https://github.com/docs-plus/docs.plus/discussions">
                    Discuss
                  </GitHubButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function getServerSideProps({ req, res }) {
  return {
    props: { hostname: req?.headers?.host },
  }
}
