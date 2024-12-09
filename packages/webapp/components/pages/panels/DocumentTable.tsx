import { Avatar } from '@components/ui/Avatar'

const DocumentTable = ({ data }: any) => {
  const routeForDocument = (slug: string) => {
    window.location.assign(`/${slug}`)
  }

  return (
    <table className="w-full table-auto overflow-hidden rounded-md bg-white shadow-sm">
      <thead className="border bg-slate-200">
        <tr>
          <th className="px-4 py-2 text-left antialiased">Name</th>
          <th className="px-4 py-2 text-left antialiased">Owner</th>
          <th className="px-4 py-2 text-left antialiased">Last Modify</th>
        </tr>
      </thead>
      <tbody>
        {data?.docs.map((row: any) => (
          <tr key={row.id}>
            <td className="max-w-[200px] overflow-hidden border px-4 py-2 antialiased">
              <a
                className="block cursor-pointer truncate text-ellipsis text-left"
                onClick={() => routeForDocument(row.slug)}>
                <span className="tooltip block text-left" data-tip={row.title}>
                  {row.title}
                </span>
              </a>
            </td>
            <td className="max-w-[170px] border px-4 pl-2 text-center">
              <div className="flex items-center justify-start">
                {row.ownerId ? (
                  <Avatar
                    height={32}
                    width={32}
                    src={row?.owner?.avatar_url || row?.user?.avatar_url}
                    avatarUpdatedAt={row?.owner?.avatar_updated_at || row?.user?.avatar_updated_at}
                    id={row?.user?.id}
                    alt={row?.owner?.displayName}
                    online={row?.owner?.status === 'ONLINE'}
                    displayPresence={true}
                    className="mr-1 size-8 rounded-full drop-shadow-md"
                  />
                ) : (
                  <p className="overflow-hidden truncate text-ellipsis text-sm antialiased">
                    unknown user
                  </p>
                )}
                <p className="overflow-hidden truncate text-ellipsis text-sm antialiased">
                  {row.user?.full_name || row.user?.username || row.user?.email}
                </p>
              </div>
            </td>
            <td className="max-w-[260px] overflow-hidden truncate text-ellipsis border px-4 py-2 text-center text-sm antialiased">
              Created on {new Date(row.updatedAt).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default DocumentTable
