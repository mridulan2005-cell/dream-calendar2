import { Outlet } from 'react-router-dom'
import TopNav from './TopNav.jsx'

// The shell for the top-level persona tabs (Today / Campus / Employee / Head):
// the shared top header over a single scrollable content area.
export default function TopNavLayout() {
  return (
    <div className="flex h-screen flex-col bg-canvas text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopNav />
      <main className="flex-1 overflow-y-auto px-8 py-7">
        <Outlet />
      </main>
    </div>
  )
}
