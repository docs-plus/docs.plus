import SignInForm from './SignInForm'

const SignInPanel = () => {
  return (
    <>
      {/* <div className="sm:w-1/2 p-2 w-full  mt-2 sm:mt-0  ">
        <h4 className="font-bold text-3xl  antialiased">
          Embrace the Power of Collaboration with <span className="text-docsy">Docs.plus!</span>
        </h4>
        <p></p>

        <p className="font-bold mt-1 text-xl text-gray-400 antialiased">Connect, share, learn</p>
        <p></p>
        <p className="text-base mt-4 antialiased">
          <span className="text-docsy font-bold">– </span>
          Empower your team with real-time knowledge sharing.
        </p>
        <p className="text-base  antialiased">
          <span className="text-docsy font-bold">– </span>
          Unleash the potential of teamwork and knowledge sharing.
        </p>
      </div> */}
      <div className="w-full flex justify-center items-center">
        <SignInForm className="sm:w-[25rem] w-full flex flex-col" />
      </div>
    </>
  )
}

export default SignInPanel
