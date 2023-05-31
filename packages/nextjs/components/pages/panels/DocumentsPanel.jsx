import React, { useState } from 'react'
// Dummy Data
import { faker } from '@faker-js/faker'
import { useEffect } from 'react'

const data = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `Document ${i + 1}`,
  owner: `Owner ${i + 1}`,
  lastModify: `Modified on ${new Date().toLocaleDateString()} by Modifier ${
    i + 1
  }`,
}))

const DocumentsPanel = () => {
  const [currentPage, setCurrentPage] = useState(0)
  const [data, setData] = useState([])
  const itemsPerPage = 9

  useEffect(() => {
    const generateData = (numRows) => {
      return Array.from({ length: numRows }, (_, i) => ({
        id: i + 1,
        name: faker.commerce.productDescription(),
        owner: faker.person.fullName(),
        lastModify: `${new Date().toLocaleDateString()} by ${faker.person.fullName()}`,
      }))
    }

    setData(generateData(40))
  }, [])

  const pages = Math.ceil(data.length / itemsPerPage)

  const paginatedData = data.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  )

  const pagination = Array.from({ length: pages }, (_, i) => i + 1)

  return (
    <div className="flex flex-col items-center justify-center">
      <table className="table-auto rounded-md overflow-hidden shadow-sm bg-white">
        <thead className="bg-slate-200 border">
          <tr>
            <th className="px-4 py-2 text-left antialiased">Name</th>
            <th className="px-4 py-2 text-left antialiased">Owner</th>
            <th className="px-4 py-2 text-left antialiased">Last Modify</th>
          </tr>
        </thead>
        <tbody>
          {paginatedData.map((row) => (
            <tr key={row.id}>
              <td className="border px-4 py-2 max-w-[500px] overflow-hidden truncate antialiased overflow-ellipsis">
                {row.name}
              </td>
              <td className="border p2 px-4 pl-2 max-w-[170px] ">
                <div className="flex items-center justify-start ">
                  <img
                    src={faker.image.avatarLegacy()}
                    className="w-8 h-8 rounded-full drop-shadow-md mr-1"
                  />
                  <p className="text-sm  overflow-hidden truncate antialiased overflow-ellipsis">
                    {row.owner}
                  </p>
                </div>
              </td>
              <td className="border px-4 py-2 max-w-[260px] text-sm overflow-hidden truncate antialiased overflow-ellipsis">
                {row.lastModify}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex mt-4">
        {pagination.map((num) => (
          <button
            key={num}
            className={`mx-1 px-4 py-2 border rounded ${
              num - 1 === currentPage ? 'bg-blue-500 text-white' : ''
            }`}
            onClick={() => setCurrentPage(num - 1)}>
            {num}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DocumentsPanel
