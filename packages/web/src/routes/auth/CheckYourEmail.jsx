import { Link } from 'react-router-dom';

const CheckYourEmail = () => {
  return (
    <div className='h-screen max-w-5xl m-auto flex flex-col justify-center  p-4'>
      <div className="bg-white w-[30rem] p-4 rounded-md shadow text-center">

        <div className="bg-green-200 m-auto w-12 h-12 flex items-center rounded-full justify-center text-white">
          <svg className="fill-current text-green-600" width="24" height="24" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        </div>
        <div className='my-6 mt-4'>
          <h1 className='text-xl font-semibold text-center'>Check your email</h1>
          <h2 className='text-center text-sm text-gray-400 mt-1'>Authenticate successfully, please check your email and then click the link to verify/login to your dashboard</h2>
        </div>

        <Link to="/" className='bg-indigo-600 block w-full text-sm text-center text-white hover:text-white font-light rounded-md px-4 py-2 hover:bg-indigo-700'>
          Go back to Home
        </Link>

      </div >
    </div >
  );
}

export default CheckYourEmail;




//
