import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'

export default function Layout() {
  return (
    <div className="flex h-full min-h-screen bg-canvas text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-canvas px-12 py-8 dark:bg-slate-950">
        <Outlet />
      </main>
    </div>
  )
}
