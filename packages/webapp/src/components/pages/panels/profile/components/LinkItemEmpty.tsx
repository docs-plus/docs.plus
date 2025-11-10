import { FaLink } from 'react-icons/fa'

const LinkItemEmpty = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-3 rounded-lg border-2 border-dashed border-gray-300 p-6">
      <FaLink className="size-8 text-gray-400" />
      <div className="text-center">
        <p className="text-gray-600">Your link collection is empty!</p>
        <p className="text-sm text-gray-500">
          Add your first link above to start building your collection.
        </p>
      </div>
    </div>
  )
}

export default LinkItemEmpty
