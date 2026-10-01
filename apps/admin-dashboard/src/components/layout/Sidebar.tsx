import { NavBrand, NavFooter, NavLinks } from './NavRow'

export function Sidebar() {
  return (
    <aside className="bg-base-200 border-base-300 sticky top-0 flex h-screen w-64 flex-col border-r">
      <div className="border-base-300 border-b p-4">
        <NavBrand />
      </div>

      <NavLinks />

      <NavFooter />
    </aside>
  )
}
