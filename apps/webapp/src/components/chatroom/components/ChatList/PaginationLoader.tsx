import { Loading } from '@components/ui/Loading'

export const PaginationLoader = () => (
  <div className="py-4" data-key="pagination-loader">
    <Loading size="sm" label="Loading messages" />
  </div>
)
