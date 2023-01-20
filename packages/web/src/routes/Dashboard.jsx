import { redirect, Link, useNavigate } from "react-router-dom";
import { useAuth } from '../contexts/Auth'
import { Outlet } from "react-router-dom"
import { Doc } from '../components/icons/Icons';
const Profile = () => {

  const { signInWithOtp, signIn, signOut, signInWithOAuth, user } = useAuth()

  const btn_displayProfileModal = () => {
    // console.log("askllkajsd")
    document.querySelector('.profileModal').classList.remove('hidden')
  }

  const btn_hiddProfileModal = () => {
    document.querySelector('.profileModal').classList.add('hidden')
  }

  return (

    <div className='bg-slate-100 h-full overflow-auto   min-h-screen flex items-center justify-center '>
      <div className=' container   border-1 shadow-sm bg-white p-3 flex-1 flex flex-col space-y-5 lg:space-y-0 lg:flex-row lg:space-x-10 max-w-6xl sm:p-6  sm:rounded-md m-auto'>
        <div className="border shadow-inner px-2 lg:px-4 py-2 lg:py-6 sm:rounded-md flex lg:flex-col justify-between">
          <nav className="flex items-center flex-row space-x-2 lg:space-x-0 lg:flex-col lg:space-y-2">
            <Link to="/" className="text-indigo-900  shadow-md border-indigo-600 border-2 p-4 inline-flex justify-center rounded-md hover:shadow-inner  hover:text-Indigo-800 smooth-hover" href="#">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
              </svg>
            </Link>
          </nav>
          <div className="flex items-center flex-row space-x-2 lg:space-x-0 lg:flex-col lg:space-y-2">
            {/* <a className="text-black p-4 inline-flex justify-center rounded-md hover:border-gray-400 border border-white hover:text-Indigo-800 smooth-hover" href="#">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"></path>
              </svg>
            </a>*/}
            <button onClick={signOut} className="text-black p-4 inline-flex justify-center rounded-md hover:border-gray-400 border border-white hover:text-Indigo-800 smooth-hover" href="#">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd"></path>
              </svg>
            </button>
            <Link to="/dashboard/profile" className="text-black rounded-full shadow-md  inline-flex justify-center  hover:border-indigo-600 border-2 border-white  hover:shadow-inner smooth-hover">
              <img className="w-14 h-14 object-cover object-center rounded-full" referrerPolicy="no-referrer" src={user?.user_metadata?.avatar_url ? user.user_metadata.avatar_url : "https://api.dicebear.com/5.x/micah/svg?seed=Zoey"} alt="avatar" />
            </Link>
          </div>
        </div>

        <div className="flex-1 px-2 sm:px-0 sm:max-h-[48rem] min-h-[48rem]  max-h-full">

          <Outlet />

          {/* <div className="flex justify-between items-center">
            <h3 className="text-3xl font-extralight text-white/50">Groups</h3>
            <div className="inline-flex items-center space-x-2">
              <a className="bg-gray-900 text-white/50 p-2 rounded-md hover:text-white smooth-hover" href="#">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
                </svg>
              </a>
              <a className="bg-gray-900 text-white/50 p-2 rounded-md hover:text-white smooth-hover" href="#">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                </svg>
              </a>
            </div>
          </div>
          <div className="mb-10 sm:mb-0 mt-10 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            <div className="group bg-gray-900/30 py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/40 hover:smooth-hover">
              <a className="bg-gray-900/70 text-white/50 group-hover:text-white group-hover:smooth-hover flex w-20 h-20 rounded-full items-center justify-center" href="#">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
              </a>
              <a className="text-white/50 group-hover:text-white group-hover:smooth-hover text-center" href="#">Create group</a>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1547592180-85f173990554?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1170&amp;q=80" alt="cuisine" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Cuisine</h4>
              <p className="text-white/50">55 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">22 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1171&amp;q=80" alt="art" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Art</h4>
              <p className="text-white/50">132 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">4 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1560419015-7c427e8ae5ba?ixlib=rb-1.2.1&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=1170&amp;q=80" alt="gaming" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Gaming</h4>
              <p className="text-white/50">207 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">0 Online <span className="ml-2 w-2 h-2 block bg-red-400 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1485846234645-a62644f84728?ixlib=rb-1.2.1&amp;ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;auto=format&amp;fit=crop&amp;w=1159&amp;q=80" alt="cinema" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">cinema</h4>
              <p className="text-white/50">105 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">12 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1484704849700-f032a568e944?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1170&amp;q=80" alt="song" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Song</h4>
              <p className="text-white/50">67 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">3 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1542831371-29b0f74f9713?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1170&amp;q=80" alt="code" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Code</h4>
              <p className="text-white/50">83 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">43 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
            <div className="relative group bg-gray-900 py-10 sm:py-20 px-4 flex flex-col space-y-2 items-center cursor-pointer rounded-md hover:bg-gray-900/80 hover:smooth-hover">
              <img className="w-20 h-20 object-cover object-center rounded-full" src="https://images.unsplash.com/photo-1533147670608-2a2f9775d3a4?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&amp;ixlib=rb-1.2.1&amp;auto=format&amp;fit=crop&amp;w=1170&amp;q=80" alt="dancing" />
              <h4 className="text-white text-2xl font-bold capitalize text-center">Dancing</h4>
              <p className="text-white/50">108 members</p>
              <p className="absolute top-2 text-white/20 inline-flex items-center text-xs">86 Online <span className="ml-2 w-2 h-2 block bg-green-500 rounded-full group-hover:animate-pulse"></span></p>
            </div>
          </div> */}
        </div>




      </div>



    </div >);
}

export default Profile;

