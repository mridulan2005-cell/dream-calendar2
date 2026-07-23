import { Outlet } from 'react-router-dom'
import TopNav from './TopNav.jsx'
import FacultySideNav from './FacultySideNav.jsx'

// The Faculty workspace: the shared top header, a clean left side nav, and a
// scrollable content area. "Curriculum" opens the Programme Curriculum page and
// "Timetable" the Master Timetable — both rendered inside the faculty chrome so
// the nav persists (the IITB Experience sidebar never appears here).
export default function FacultyLayout() {
  return (
    <div className="flex h-screen flex-col bg-canvas text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <TopNav />
      <div className="flex min-h-0 flex-1">
        <FacultySideNav />
        <main className="flex-1 overflow-y-auto px-8 py-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
