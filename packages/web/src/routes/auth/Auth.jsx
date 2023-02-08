import { Outlet } from 'react-router-dom'

const Auth = () => {
  return (
    <div>
      <div className='h-screen bg-slate-100 flex flex-col justify-center align-middle p-4'>
        <div className="p-2 w-full justify-self-center flex justify-center">
          <Outlet />
        </div>
      </div >
    </div >
  )
}

export default Auth
