import { Avatar } from '@components/Avatar'
const DocumentTable = ({ data }) => {
  const routeForDocument = (slug) => {
    // router.push(`/${slug}`)
    window.location = `/${slug}`
  }

  return (
    <table className="table-auto rounded-md overflow-hidden shadow-sm bg-white w-full">
      <thead className="bg-slate-200 border">
        <tr>
          <th className="px-4 py-2 text-left antialiased">Name</th>
          <th className="px-4 py-2 text-left antialiased">Owner</th>
          <th className="px-4 py-2 text-left antialiased">Last Modify</th>
        </tr>
      </thead>
      <tbody>
        {data?.docs.map((row) => (
          <tr key={row.id}>
            <td className="border px-4 py-2 max-w-[500px] overflow-hidden truncate antialiased overflow-ellipsis">
              <a className="cursor-pointer" onClick={() => routeForDocument(row.slug)}>
                {row.title}
              </a>
            </td>
            <td className="border text-center p2 px-4 pl-2 max-w-[170px] ">
              <div className="flex items-center justify-start ">
                {row.ownerId ? (
                  <Avatar
                    height={32}
                    width={32}
                    srcAvatar={row?.user?.avatar_url || row?.user?.default_avatar_url}
                    className="w-8 h-8 rounded-full drop-shadow-md mr-1"
                  />
                ) : (
                  <p className="text-sm overflow-hidden truncate antialiased overflow-ellipsis">
                    unknown user
                  </p>
                )}
                <p className="text-sm overflow-hidden truncate antialiased overflow-ellipsis">
                  {row.user?.full_name || row.user?.username || row.user?.email}
                </p>
              </div>
            </td>
            <td className="border text-center px-4 py-2 max-w-[260px] text-sm overflow-hidden truncate antialiased overflow-ellipsis">
              Created on {new Date(row.updatedAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DocumentTable
