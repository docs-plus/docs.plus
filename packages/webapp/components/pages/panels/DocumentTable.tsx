import { Avatar } from '@components/ui/Avatar'

const DocumentTable = ({ data }: any) => {
  const routeForDocument = (slug: string) => {
    window.location.assign(`/${slug}`)
  }

  return (
    <table className="w-full table-auto overflow-hidden rounded-md bg-white shadow-sm">
      <thead className="border border-gray-300 bg-slate-200">
        <tr>
          <th className="px-4 py-2 text-left antialiased">Name</th>
          <th className="px-4 py-2 text-left antialiased">Owner</th>
          <th className="px-4 py-2 text-left antialiased">Last Modify</th>
        </tr>
      </thead>
      <tbody>
        {data?.docs.map((row: any) => (
          <tr key={row.id}>
            <td className="max-w-[200px] overflow-hidden border border-gray-300 px-4 py-2 antialiased">
              <a
                className="block cursor-pointer truncate text-left text-ellipsis"
                onClick={() => routeForDocument(row.slug)}>
                <span className="tooltip block text-left" data-tip={row.title}>
                  {row.title}
                </span>
              </a>
            </td>
            <td className="max-w-[170px] border border-gray-300 px-4 pl-2 text-center">
              <div className="flex items-center justify-start">
                {row.ownerId ? (
                  <Avatar
                    height={32}
                    width={32}
                    src={row?.owner?.avatar_url || row?.user?.avatar_url}
                    avatarUpdatedAt={row?.owner?.avatar_updated_at || row?.user?.avatar_updated_at}
                    id={row?.user?.id}
                    alt={row?.owner?.display_name}
                    online={row?.owner?.status === 'ONLINE'}
                    displayPresence={true}
                    className="mr-1 size-8 rounded-full drop-shadow-md"
                  />
                ) : (
                  <p className="truncate overflow-hidden text-sm text-ellipsis antialiased">
                    unknown user
                  </p>
                )}
                <p className="truncate overflow-hidden text-sm text-ellipsis antialiased">
                  {row.user?.display_name}
                </p>
              </div>
            </td>
            <td className="max-w-[260px] truncate overflow-hidden border border-gray-300 px-4 py-2 text-center text-sm text-ellipsis antialiased">
              Created on {new Date(row.updatedAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DocumentTable
