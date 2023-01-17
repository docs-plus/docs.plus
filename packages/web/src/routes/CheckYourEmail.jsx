import { Link } from 'react-router-dom';

const CheckYourEmail = () => {
  return (
    <div className='h-screen max-w-5xl m-auto flex flex-col justify-center align-middle p-4'>
      <div className=" p-2 w-full justify-self-center flex justify-center flex-col">
        <p className='text-center text-lg'>We send you a link to your email. <br /> Please check your email and click on the link to verify /login to your Profile.</p>
        <p className='text-center mt-4'>
          <Link to="/">Home</Link>
        </p>
      </div>
    </div>
  );
}

export default CheckYourEmail;
