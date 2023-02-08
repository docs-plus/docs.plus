const Button = ({ children, style, onClick: click, loading, className }) => {
  return (
    <button className={'w-full text-center flex justify-center items-center px-4 py-2 text-white leading-6 border rounded-md transition ease-in-out duration-150' + className}
      disabled={loading}
      style={style}
      type="button"
      onClick={click}>
      {loading
        ? <>
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 " fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor"></path>
          </svg>
          Processing...
        </>
        : children}
    </button>
  )
}

export default Button
