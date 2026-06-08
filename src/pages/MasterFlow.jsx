import { useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarRange, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { progress } from '../logic/timetable.js'
import { TERM, reviewStats } from '../data/seed.js'

// IITB Experience home. The redesigned Department Timetable flow now lives in a
// dedicated planner (/planner); this screen is the entry point into it, with a
// quick at-a-glance status so the coordinator knows where things stand.
export default function MasterFlow() {
  const { courses, workflow, conflicts, changeRequests } = useApp()
  const navigate = useNavigate()
  const p = progress(courses)
  const slotComplete = p.slot.done === p.slot.total
  const conflictFree = conflicts.conflicts.length === 0

  const stage = !workflow.coursesFinalised
    ? 'Confirm running courses'
    : !slotComplete
      ? 'Allot faculty, slots & venues'
      : !workflow.generated
        ? 'Ready to generate'
        : 'Draft under review'

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center gap-8 text-sm">
        <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          Academic Year:
          <select className="rounded-md border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <option>{TERM.academicYear}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          Semester
          <select className="rounded-md border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
            <option>{TERM.semester}</option>
          </select>
        </label>
      </div>

      <h1 className="mt-8 text-2xl font-bold">
        {TERM.dept} Department · {TERM.semester} 2026-27
      </h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">
        Plan, allot and publish the department timetable for the semester.
      </p>

      {/* Department Timetable entry card */}
      <button
        onClick={() => navigate('/planner')}
        className="group mt-7 flex w-full items-center gap-5 rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-accent hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent dark:bg-slate-800">
          <CalendarRange size={26} />
        </span>
        <div className="flex-1">
          <div className="text-lg font-bold text-slate-900 dark:text-white">Department Timetable</div>
          <div className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            Current stage — <span className="font-medium text-slate-700 dark:text-slate-200">{stage}</span>
          </div>
        </div>
        <span className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition group-hover:brightness-95">
          Open planner <ArrowRight size={16} />
        </span>
      </button>

      {/* Quick status row */}
      <div className="mt-5 grid grid-cols-3 gap-4">
        <StatCard label="Courses running" value={courses.length} />
        <StatCard
          label={`Slots allotted (${p.slot.total - p.slot.done} left)`}
          value={`${p.slot.done}/${p.slot.total}`}
          tone={slotComplete ? 'ok' : 'warn'}
        />
        <StatCard
          label={conflictFree ? 'Conflict-free' : 'Conflicts'}
          value={conflictFree ? 'Yes' : conflicts.conflicts.length}
          icon={conflictFree ? CheckCircle2 : AlertTriangle}
          tone={conflictFree ? 'ok' : 'bad'}
        />
      </div>

      {workflow.generated && (
        <p className="mt-5 text-sm text-slate-500 dark:text-slate-400">
          Draft reviewed by {reviewStats.reviewed} of {reviewStats.total} people ·{' '}
          {changeRequests.length} change request(s) made.
        </p>
      )}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, tone }) {
  const valueColor =
    tone === 'ok'
      ? 'text-green-600 dark:text-green-400'
      : tone === 'warn'
        ? 'text-amber-600'
        : tone === 'bad'
          ? 'text-red-500'
          : 'text-slate-800 dark:text-slate-100'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        {Icon && <Icon size={13} />} {label}
      </div>
      <div className={`mt-1 text-2xl font-bold ${valueColor}`}>{value}</div>
    </div>
  )
}
