import { useApp } from '../../store/AppContext.jsx'
import { progress } from '../../logic/timetable.js'
import ScopeBand from '../ScopeBand.jsx'

// Shared chrome for the planner's content steps (courses, faculty, slot, venue).
// Mirrors the Master Timetable's layout so every step looks the same: the term
// scope band and the section header scroll away with the page, then the section
// header pins and only the list beneath it keeps scrolling. The planner nav sits
// full-height on the left; the status footer runs along the bottom.
// `totals` optionally overrides the footer stats — a read-only department (e.g.
// Aerospace) reports its own published counts rather than the live IDC planner's.
export default function StepShell({ nav, header, children, scope, setScope, totals }) {
  const { courses, conflicts } = useApp()
  const p = progress(courses)
  const coursesCount = totals?.courses ?? courses.length
  const unassigned = totals?.unassigned ?? p.slot.total - p.slot.done
  const conflictFree = totals?.conflictFree ?? conflicts.conflicts.length === 0

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* The planner nav on the left runs the full height; the section's scope
          band, header and body scroll on the right, with the footer pinned. */}
      <div className="flex min-h-0 flex-1">
        {nav}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* One scroll region: the scope band scrolls away, the section header
              sticks to the top, and the body list keeps scrolling under it. */}
          <main className="min-h-0 flex-1 overflow-y-auto">
            {scope && setScope && (
              <div className="border-b border-slate-100 bg-[#F5F9F8] px-8 py-3 dark:border-slate-800 dark:bg-slate-950">
                <ScopeBand scope={scope} onChange={setScope} />
              </div>
            )}
            <header className="sticky top-0 z-20 border-b border-slate-100 bg-[#F5F9F8] px-8 py-3 dark:border-slate-800 dark:bg-slate-950">
              {header}
            </header>
            <div className="px-8 py-6">{children}</div>
          </main>

          <footer className="flex shrink-0 items-center gap-6 border-t border-slate-200 px-8 py-2.5 text-xs dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">
              Total courses: <b className="text-slate-700 dark:text-slate-200">{coursesCount}</b>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Unassigned:{' '}
              <b className={unassigned ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}>
                {unassigned}
              </b>
            </span>
            <span className="flex items-center gap-1.5">
              Conflict-free:{' '}
              <b className={conflictFree ? 'text-green-600' : 'text-red-500'}>
                {conflictFree ? 'Yes' : 'No'}
              </b>
            </span>
            <span className="ml-auto italic text-slate-400">Draft v0.8.2 · auto-saved</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
