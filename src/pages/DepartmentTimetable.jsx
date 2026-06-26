import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Clock, ChevronRight, CalendarRange, Eye, LayoutGrid } from 'lucide-react'
import TimetableGrid from '../components/TimetableGrid.jsx'

// The department's timetables, one per academic year. The current Autumn term is
// the live draft being built in the planner; everything else is a published,
// view-only snapshot. (Prototype data — the static years render the current
// course set as a representative published timetable.)
const YEARS = [2026, 2025, 2024, 2023, 2022]
const yearLabel = (y) => `${y}–${String(y + 1).slice(-2)}`

function timetablesFor(semester) {
  return YEARS.map((y) => ({
    id: `${y}-${semester}`,
    year: y,
    label: yearLabel(y),
    semester,
    // The current Autumn term is the one in progress in the planner right now.
    inProgress: y === 2026 && semester === 'Autumn',
  }))
}

const READ_VIEWS = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'venue', label: 'Venue' },
]

// ── Department Timetable landing ─────────────────────────────────────────────
// The first page behind the "Department Timetable" nav item: a clean index of
// every year's timetable with an Autumn / Spring toggle. The in-progress draft
// sits at the top and opens the editable planner; the rest open a read-only
// viewer — just the grid, no review rail, tray or editing.
export default function DepartmentTimetable() {
  const [semester, setSemester] = useState('Autumn') // 'Autumn' | 'Spring'
  const [viewing, setViewing] = useState(null) // a static timetable being looked at
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link support: arriving with ?year=&semester= (e.g. from the curriculum
  // timeline) opens that term's timetable directly. The live Autumn draft jumps
  // to the planner; everything else opens the read-only viewer.
  useEffect(() => {
    const y = Number(searchParams.get('year'))
    const sem = searchParams.get('semester')
    if (!y || !sem) return
    setSearchParams({}, { replace: true }) // consume the params so back/refresh is clean
    if (y === 2026 && sem === 'Autumn') {
      navigate('/planner')
      return
    }
    setSemester(sem)
    setViewing({ id: `${y}-${sem}`, year: y, label: yearLabel(y), semester: sem })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  if (viewing) return <ReadOnlyTimetable timetable={viewing} onBack={() => setViewing(null)} />

  const list = timetablesFor(semester)

  return (
    <div className="mx-auto max-w-4xl pb-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            IDC · Department Timetable
          </div>
          <h1 className="mt-1 text-2xl font-bold">Timetables</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            The live draft and every published year. Switch between the Autumn and Spring terms.
          </p>
        </div>
        {/* The institute slot system (S / L / M) — a constant reference, on the
            extreme right of the header. */}
        <button
          onClick={() => navigate('/slot-system')}
          title="View and edit the institute slot system"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300 dark:hover:border-accent"
        >
          <LayoutGrid size={15} /> Slot system
        </button>
      </div>

      {/* Semester toggle */}
      <div className="mt-5 inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
        {['Autumn', 'Spring'].map((s) => (
          <button
            key={s}
            onClick={() => setSemester(s)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
              semester === s
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Timetable list — in-progress first, then published years (newest first) */}
      <div className="mt-5 space-y-2.5">
        {list.map((tt) =>
          tt.inProgress ? (
            <button
              key={tt.id}
              onClick={() => navigate('/planner')}
              className="flex w-full items-center gap-4 rounded-2xl border border-accent/50 bg-accent-soft/40 p-4 text-left ring-1 ring-accent/20 transition hover:border-accent hover:ring-accent/40 dark:bg-slate-800/60"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white">
                <Clock size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900 dark:text-white">
                    {tt.label} · {tt.semester}
                  </span>
                  <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    In progress
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  Being built now — open the planner to edit, review requests and publish.
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
                Open planner <ArrowRight size={16} />
              </span>
            </button>
          ) : (
            <button
              key={tt.id}
              onClick={() => setViewing(tt)}
              className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <CalendarRange size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-slate-900 dark:text-white">
                  {tt.label} · {tt.semester}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">Published · view only</div>
              </div>
              <ChevronRight
                size={18}
                className="shrink-0 text-slate-300 transition group-hover:text-slate-500 dark:text-slate-600"
              />
            </button>
          ),
        )}
      </div>
    </div>
  )
}

// ── Read-only timetable viewer ───────────────────────────────────────────────
// A published timetable, just to look at: the master grid with the Student /
// Faculty / Venue pivot, and nothing else — no review rail, no course tray, no
// editing or drag-drop.
function ReadOnlyTimetable({ timetable, onBack }) {
  const [view, setView] = useState('student')

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            title="Back to all timetables"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">
                {timetable.label} · {timetable.semester}
              </h1>
              <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Eye size={11} /> View only
              </span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">Published timetable · IDC</div>
          </div>
        </div>

        {/* Read-only view pivot */}
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {READ_VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                view === v.id
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Master grid in pure read mode: no move handler (drag-drop off), no
          placement, no preview, clicks inert. TimetableGrid reads its own
          committed courses from the store. */}
      <div className="mt-4 h-[calc(100vh-12rem)] min-h-0 flex-1">
        <TimetableGrid view={view} onCellClick={() => {}} hideConflicts />
      </div>
    </div>
  )
}
