const LinksMenu = () => {
  return (
    <div className="mb-8 flex w-full flex-col rounded-lg border border-gray-300">
      <ul className="menu menu-sm w-full">
        <li>
          <a href="#" target="_blank" className="mt-2">
            FAQ
          </a>
        </li>
        <li>
          <a href="#" target="_blank" className="mt-2">
            Request a feature
          </a>
        </li>
        <li>
          <a href="#" target="_blank" className="mt-2">
            Report an issue
          </a>
        </li>
        <li>
          <a href="#" target="_blank" className="mt-2">
            Privacy policy
          </a>
        </li>
        <li>
          <a href="#" target="_blank" className="mt-2">
            Terms of service
          </a>
        </li>
      </ul>
    </div>
  )
}

export default LinksMenu
