const Home = () => {
  return (
    <div>
      <div className='w-full border-b  border-gray-400 px-2 py-4'>
        <h2 className='font-bold text-2xl'>Recent documents</h2>
      </div>

      <div className='h-full flex justify-center'>
        <div className='px-2 py-4 mt-24 rounded-md w-4/6 border-2 text-center border-dashed'>
          icon
          <p className='font-medium'>No Docuemnts</p>
          <p className='text-gray-500 font-light'>Get started by createing a new Document</p>
          <div className='mt-4'>
            <button className='bg-blue-500 text-white px-4 py-2 text-sm rounded'> New Document</button>
          </div>
        </div>
      </div>


    </div>
  );
}

export default Home;
