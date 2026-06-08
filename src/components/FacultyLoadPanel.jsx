import { useMemo, useState } from 'react'
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Download,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  GraduationCap,
  BookOpen,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { facultyWorkload } from '../logic/timetable.js'
import { useResizableWidth } from '../hooks/useResizableWidth.js'
import ResizeHandle from './ResizeHandle.jsx'

// Faculty workload, shown as a SIDE PANEL beside the faculty allotment list
// (rather than a separate tab) so the planner can cross-check a member's total
// teaching load while assigning — no context switch. Styled as soft cards with
// avatar chips and icon-led labels; grouped by discipline; rows expand to the
// member's courses.
export default function FacultyLoadPanel({ onClose, highlightFaculty }) {
  const { courses } = useApp()
  const { width, onResizeStart } = useResizableWidth(400)
  const [query, setQuery] = useState('')
  const [openRow, setOpenRow] = useState(null)
  const [collapsed, setCollapsed] = useState({})

  const all = useMemo(() => facultyWorkload(courses), [courses])
  const q = query.trim().toLowerCase()
  const filtered = q
    ? all.filter((f) => f.name.toLowerCase().includes(q) || f.discipline.toLowerCase().includes(q))
    : all

  const groups = useMemo(() => {
    const m = new Map()
    for (const f of filtered) {
      if (!m.has(f.discipline)) m.set(f.discipline, [])
      m.get(f.discipline).push(f)
    }
    return [...m.entries()]
  }, [filtered])

  const downloadCsv = () => {
    const rows = [['Name', 'Title', 'Discipline', 'This term (credits)', 'Previous (credits)', 'Change %']]
    for (const f of all) rows.push([f.name, f.title, f.discipline, f.load, f.prevLoad, `${f.delta}%`])
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'faculty-load.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <aside
      style={{ width }}
      className="sticky top-0 flex max-h-[calc(100vh-3rem)] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
    >
      <ResizeHandle onMouseDown={onResizeStart} />
      {/* Header */}
      <div className="px-5 pb-4 pt-4">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <Users size={12} /> Faculty workload
          </span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <h2 className="mt-3 text-xl font-bold">Faculty Load List</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {all.length} faculty teaching this term · grouped by discipline.
        </p>
      </div>

      {/* Search + export */}
      <div className="flex items-center gap-2 px-5 pb-4">
        <div className="flex flex-1 items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5 dark:bg-slate-800">
          <Search size={15} className="text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a faculty member"
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          onClick={downloadCsv}
          title="Download .csv"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Download size={14} /> CSV
        </button>
      </div>

      {/* Discipline groups */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No faculty match “{query}”.</p>
        )}
        {groups.map(([discipline, members]) => {
          const isCollapsed = collapsed[discipline]
          return (
            <div key={discipline}>
              <button
                onClick={() => setCollapsed((c) => ({ ...c, [discipline]: !c[discipline] }))}
                className="mb-2 flex w-full items-center gap-2"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent dark:bg-slate-800">
                  <GraduationCap size={13} />
                </span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{discipline}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {members.length}
                </span>
                {isCollapsed ? (
                  <ChevronRight size={15} className="ml-auto text-slate-400" />
                ) : (
                  <ChevronDown size={15} className="ml-auto text-slate-400" />
                )}
              </button>

              {!isCollapsed && (
                <div className="space-y-2">
                  {members.map((f) => (
                    <FacultyCard
                      key={f.name}
                      f={f}
                      open={openRow === f.name}
                      onToggle={() => setOpenRow(openRow === f.name ? null : f.name)}
                      highlight={highlightFaculty?.includes(f.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

function FacultyCard({ f, open, onToggle, highlight }) {
  return (
    <div
      className={`rounded-xl border bg-white transition dark:bg-slate-900 ${
        highlight
          ? 'border-accent ring-1 ring-accent/30 dark:border-accent'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent dark:bg-slate-800">
          {initials(f.name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{f.name}</div>
          <div className="truncate text-[11px] text-slate-400">{f.title}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">{f.load}</div>
          <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
            <span>vs {f.prevLoad}</span>
            <Delta delta={f.delta} />
          </div>
        </div>
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-slate-400" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-3 py-3 dark:border-slate-800">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            <BookOpen size={12} /> {f.courses.length} course{f.courses.length === 1 ? '' : 's'} · {f.load} credits
          </div>
          <div className="space-y-1.5">
            {f.courses.map((c) => (
              <div
                key={c.id}
                className="flex items-baseline justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs dark:bg-slate-800/60"
              >
                <span className="truncate">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.code}</span>{' '}
                  <span className="text-slate-500 dark:text-slate-400">{c.title}</span>
                </span>
                <span className="shrink-0 text-slate-400">{c.credits} cr</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Delta({ delta }) {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-0.5 font-medium text-slate-400">
        <Minus size={10} /> 0%
      </span>
    )
  const up = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${
        up ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'
      }`}
    >
      {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {up ? '+' : ''}
      {delta}%
    </span>
  )
}
