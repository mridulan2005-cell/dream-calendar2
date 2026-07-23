import { ChevronDown } from 'lucide-react'
import { ACADEMIC_YEARS, SEMESTERS } from '../data/seed.js'
import { departments } from '../data/aeroTimetable.js'

// The term scope that every planner step now shares: academic year + semester +
// department. Lifted to the Workspace so switching it on one step carries to all
// the others (and to the Master Timetable). Rendered as a full-width band that
// scrolls away with the page, freeing the viewport for the list/grid beneath.
export default function ScopeBand({ scope, onChange, className = '' }) {
  const set = (patch) => onChange({ ...scope, ...patch })
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-3 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <ScopeSelect
          label="Academic Year"
          value={scope.academicYear}
          onChange={(v) => set({ academicYear: v })}
        >
          {ACADEMIC_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </ScopeSelect>
        <ScopeSelect
          label="Semester"
          value={scope.semester}
          onChange={(v) => set({ semester: v })}
        >
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </ScopeSelect>
      </div>
      <ScopeSelect
        label="Department"
        value={scope.departmentId}
        onChange={(v) => set({ departmentId: v })}
        width="w-56"
      >
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
            {d.ready ? '' : ' — coming soon'}
          </option>
        ))}
      </ScopeSelect>
    </div>
  )
}

// One labelled dropdown in the scope band. Shared by every step (and re-exported
// so the Master Timetable header can drop its private copy).
export function ScopeSelect({ label, value, onChange, width = 'w-36', children }) {
  return (
    <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600 dark:text-slate-300">
      {label}
      <span className="relative inline-flex items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${width} cursor-pointer appearance-none truncate rounded-lg border border-slate-300 bg-white py-1.5 pl-3 pr-9 text-sm font-medium text-slate-800 outline-none transition hover:border-accent focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`}
        >
          {children}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 text-slate-400" />
      </span>
    </label>
  )
}
