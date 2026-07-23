import { CalendarRange, AlertCircle, Clock, ArrowUpRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useRole } from '../store/RoleContext.jsx'

// The Department Timetable container on the Faculty tab: the one card that owns
// the department's timetable and hands the person off to it. What it shows —
// and where it lands — follows the account. The coordinator gets the allotment's
// standing and the things blocking publish; a faculty member gets their own
// share of the work (preferences, the published draft).
const VIEWS = {
  // Coordinator — running the allotment.
  ttc: {
    title: 'Department Timetable Management',
    link: { label: 'View full Timetable', to: '/faculty/timetable' },
    progress: { label: 'Slot Allotment', term: 'Autumn 2026', done: 36, total: 75, unit: 'placed' },
    rows: [
      {
        icon: AlertCircle,
        tone: 'alert',
        title: 'Faculty Clash on DE 312',
        sub: 'overlap occurs at slot x, wednesday',
        action: { label: 'resolve', to: '/faculty/timetable?step=faculty', primary: true },
      },
      {
        icon: Clock,
        tone: 'muted',
        title: "7 Faculty haven't confirmed availability",
        sub: 'Autumn 2026',
        action: { label: 'remind', to: '/faculty/timetable?step=faculty' },
      },
    ],
  },
  // Teaching faculty — their own preferences against the department's draft.
  faculty: {
    title: 'Department Timetable',
    link: { label: 'View full Timetable', to: '/faculty/timetable' },
    progress: { label: 'My Slot Preferences', term: 'Autumn 2026', done: 2, total: 3, unit: 'submitted' },
    rows: [
      {
        icon: Clock,
        tone: 'alert',
        title: 'Slot preference submission deadline — May 10th',
        sub: '1 course still needs a preference',
        action: { label: 'submit', to: '/faculty/timetable?step=slot', primary: true },
      },
      {
        icon: CalendarRange,
        tone: 'muted',
        title: 'Draft timetable is published for this semester',
        sub: 'Autumn 2026',
        action: { label: 'view', to: '/faculty/timetable' },
      },
    ],
  },
}
// A student has no stake in running the timetable — they only read the published one.
VIEWS.student = {
  title: 'Department Timetable',
  link: { label: 'View full Timetable', to: '/faculty/timetable' },
  progress: { label: 'Published Timetable', term: 'Autumn 2026', done: 75, total: 75, unit: 'placed' },
  rows: [
    {
      icon: CalendarRange,
      tone: 'muted',
      title: 'Draft timetable is published for this semester',
      sub: 'Autumn 2026',
      action: { label: 'view', to: '/faculty/timetable' },
    },
  ],
}

export default function DeptTimetableCard({ className = '' }) {
  const { role } = useRole()
  const navigate = useNavigate()
  const view = VIEWS[role] ?? VIEWS.faculty
  const { done, total } = view.progress
  const pct = total ? Math.round((done / total) * 100) : 0

  return (
    <section
      className={`flex flex-col rounded-xl border border-slate-200 bg-canvas p-4 dark:border-slate-800 dark:bg-slate-900/40 ${className}`}
    >
      <div className="mb-3.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
            <CalendarRange size={16} />
          </span>
          <h2 className="text-h3-medium text-slate-700 dark:text-slate-200">{view.title}</h2>
        </div>
        <button
          onClick={() => navigate(view.link.to)}
          className="text-body2-regular flex items-center gap-1 text-accent transition hover:underline focus:outline-none"
        >
          {view.link.label}
        </button>
      </div>

      {/* Where the allotment stands. */}
      <button
        onClick={() => navigate(view.link.to)}
        className="group rounded-lg bg-surface px-4 py-3 text-left transition hover:bg-accent-soft/40 focus:outline-none dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body1-medium text-slate-700 dark:text-slate-200">
            {view.progress.label}{' '}
            <span className="text-body2-regular text-slate-400">{view.progress.term}</span>
          </span>
          <span className="text-body2-regular shrink-0 text-slate-500 dark:text-slate-300">
            {done}/{total} {view.progress.unit}
          </span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      </button>

      {/* What's outstanding — each row hands off to the surface that resolves it. */}
      <div className="mt-2.5 space-y-2.5">
        {view.rows.map((row, i) => (
          <AlertRow key={i} {...row} onGo={() => navigate(row.action.to)} />
        ))}
      </div>
    </section>
  )
}

function AlertRow({ icon: Icon, tone, title, sub, action, onGo }) {
  return (
    <button
      onClick={onGo}
      className="group flex w-full items-center justify-between gap-3 rounded-lg bg-surface px-4 py-3 text-left transition hover:bg-accent-soft/40 focus:outline-none dark:bg-slate-900 dark:hover:bg-slate-800"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon
          size={17}
          className={`shrink-0 ${tone === 'alert' ? 'text-rose-500' : 'text-slate-400'}`}
        />
        <span className="min-w-0">
          <span className="text-body1-regular block truncate text-slate-700 dark:text-slate-200">{title}</span>
          <span className="text-body3-regular block truncate text-slate-400">{sub}</span>
        </span>
      </span>
      <span
        className={`text-body2-regular flex shrink-0 items-center gap-1 rounded-md px-3 py-1.5 transition ${
          action.primary
            ? 'bg-accent text-white group-hover:brightness-95'
            : 'border border-slate-200 bg-[#f9f9fb] text-slate-500 group-hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
        }`}
      >
        {action.label}
        <ArrowUpRight size={12} className="opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )
}
