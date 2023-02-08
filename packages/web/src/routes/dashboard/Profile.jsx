import { Link } from 'react-router-dom'

import { useAuth } from '../../contexts/Auth'

const Profile = () => {
  const { user, profile } = useAuth()

  console.log(profile)

  return (
    <div>
      <div className='w-full border-b  border-gray-400 px-2 py-4'>
        <h2 className='font-bold text-2xl'>Profile</h2>
      </div>

      <div className='overflow-auto  sm:max-h-[40rem] max-h-full'>
        <div className='px-2 py-4'>
          <p className='font-bold text-base'>Profile Picture</p>
          <p className='text-gray-500'>Upload a picture to make your profile stand out and let people <br /> recognize your comments and contributions easily!</p>
          <Link className="mt-4 text-black rounded-2xl shadow-md  inline-flex justify-center  hover:border-indigo-600 border-2 border-white  hover:shadow-inner smooth-hover" to="/dashboard/profile">
            <img alt="avatar" className="w-20 h-20 object-cover object-center " src={user?.user_metadata?.avatar_url ? user.user_metadata.avatar_url : 'https://api.dicebear.com/5.x/micah/svg?seed=Zoey'} />
          </Link>
        </div>

        <div className='px-2 py-4 mt-4'>
          <p className='font-bold text-base'>Account Information</p>
          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>U</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Full Name</label>
              <input className='text-sm outline-none' placeholder='Type your name...' type="text" />
            </div>
          </div>

          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>@</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Username</label>
              <input className='text-sm outline-none' placeholder='Type your username...' type="text" />
            </div>
          </div>

          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>N</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Namespace</label>
              <input disabled className='text-sm outline-none font-mono' placeholder='Type your username...' type="text" value={'docs.plus/' + profile?.doc_namespace} />
            </div>
          </div>
        </div>

        <div className='px-2 py-4'>
          <p className='font-bold text-base'>About</p>
          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 '>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Bio</label>
              <textarea className='text-sm outline-none' placeholder="Let us know a little about yourself..." rows={6} type="text" ></textarea>
            </div>
          </div>
        </div>

        <div className='px-2 py-4 mt-4'>
          <p className='font-bold text-base'>Profile Social Links</p>
          <p className='text-gray-500'>Add your social media profiles so others can connect with you <br></br> and you can grow your network!</p>

          <div className='mt-4 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>T</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Twitter</label>
              <input className='text-sm outline-none' placeholder='Enter Twitter Account...' type="text" />
            </div>
          </div>

          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>G</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Github</label>
              <input className='text-sm outline-none' placeholder='Enter Github Account...' type="text" />
            </div>
          </div>

          <div className='mt-2 rounded border w-80 px-4 pr-2 py-1 flex flex-row'>
            <div className='mr-2'>W</div>
            <div className='flex flex-col w-full'>
              <label className='text-sm font-bold text-gray-500'>Website</label>
              <input className='text-sm outline-none' placeholder='www.example.com' type="text" />
            </div>
          </div>
        </div>

      </div>

      <div className='border-t px-2 py-4 flex flex-row-reverse'>
        <button className='bg-indigo-600 text-white rounded-md px-4 py-2 hover:bg-indigo-700'>Save Changes</button>
      </div>

    </div >
  )
}

export default Profile
