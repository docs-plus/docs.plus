import { NotificationPanel } from '../desktop/NotificationPanel'

const NotificationModal = () => (
  <div className="bg-base-100 flex h-full w-full flex-col overflow-hidden">
    <NotificationPanel variant="sheet" />
  </div>
)

export default NotificationModal
