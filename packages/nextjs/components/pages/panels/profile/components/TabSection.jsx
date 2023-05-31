const TabSection = ({ name, description, children }) => {
  return (
    <div className="flex flex-col p-4 antialiased">
      <p className="text-lg font-bold">{name}</p>
      <p className="text-gray-400 text-sm">{description}</p>
      {children}
    </div>
  )
}

export default TabSection
