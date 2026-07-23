import DeptHeader from '../components/DeptHeader.jsx'
import DeptSideNav from '../components/DeptSideNav.jsx'
import Workspace from './Workspace.jsx'
import { useRole } from '../store/RoleContext.jsx'

// The "Timetable" destination. For the coordinator (`ttc`) this is the full
// planner Master Timetable; for a faculty member or student it collapses to a
// read-only view of the master timetable — driven by the `viewer` prop threaded
// into the Workspace.
// The page wears its own chrome: the Department Timetable header over the planner
// step rail. A viewer has no steps to walk, so the rail is theirs to skip and the
// timetable runs full width.
export default function FacultyTimetable() {
  const { role } = useRole()
  const viewer = role !== 'ttc'

  return (
    <div className="flex h-screen flex-col bg-canvas text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <DeptHeader />
      <div className="flex min-h-0 flex-1">
        {/* The coordinator gets the planner rail; a faculty member gets it too so
            they can reach the slot surface to set their preferences. A student
            stays a pure viewer, pinned to the published Master Timetable. */}
        {role !== 'student' && <DeptSideNav faculty={role === 'faculty'} />}
        <Workspace embedded viewer={viewer} role={role} />
      </div>
    </div>
  )
}
