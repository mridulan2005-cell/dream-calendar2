import { Construction } from 'lucide-react'

// A clean placeholder for the Faculty sections that aren't built out yet
// (Courses / Projects / Schedule / Students), so the nav stays whole.
export default function FacultyPlaceholder({ title }) {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-h1 text-slate-900 dark:text-white">{title}</h1>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-surface py-24 text-center dark:border-slate-800 dark:bg-slate-900">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800">
          <Construction size={22} />
        </span>
        <div className="text-h3-medium text-slate-700 dark:text-slate-200">{title} is coming soon</div>
        <p className="text-body1-regular max-w-sm text-slate-400">
          This section isn’t built yet. Curriculum and Timetable are live in the General group.
        </p>
      </div>
    </div>
  )
}
