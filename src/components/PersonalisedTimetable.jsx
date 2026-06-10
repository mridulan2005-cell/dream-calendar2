import { useEffect, useMemo, useState } from 'react'
import { MapPin, GraduationCap, CalendarDays } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { cohorts, slotsSpan } from '../data/seed.js'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Weekly class blocks plus the two fixed recesses, in clock order. The recesses
// are drawn as slim grey gutter columns (vertical label in the header).
const COLS = [
  { id: 'c1', label: '8:30 – 9:25' },
  { id: 'c2', label: '9:30 – 10:25' },
  { id: 'c3', label: '10:30 – 11:25' },
  { id: 'c4', label: '11:30 – 12:25' },
  { id: 'lunch', label: 'Lunch · 12:30 – 1:55', recess: true },
  { id: 'c5', label: '2:00 – 3:25' },
  { id: 'c6', label: '3:30 – 4:55' },
  { id: 'break', label: 'Break · 5:00 – 5:25', recess: true },
  { id: 'c7', label: '5:30 – 6:55' },
  { id: 'c8', label: '7:00 – 8:25' },
]
const MORNING_SPAN = 4 // c1..c4
const AFTERNOON_SPAN = 2 // c5..c6
const EVENING_SPAN = 2 // c7..c8
const ELECTIVE_DAY = 'Wed' // the open-elective / seminar slot in the IDC week

// Group teaching weeks (W1..W15) into contiguous stretches that share the exact
// same set of courses — each stretch becomes one entry in the week jump-nav, so
// the nav only shows a new card when the timetable actually changes.
function buildWeekRanges(myCourses) {
  const ranges = []
  let prevSig = null
  for (let n = 1; n <= 15; n++) {
    const active = myCourses.filter((c) => c.slots.includes(`M${n}`))
    if (active.length === 0) {
      prevSig = null // a free week breaks the run
      continue
    }
    const sig = active
      .map((c) => c.id)
      .sort()
      .join(',')
    if (sig === prevSig) ranges[ranges.length - 1].weeks.push(n)
    else ranges.push({ sig, weeks: [n], courses: active })
    prevSig = sig
  }
  return ranges
}

// One course, drawn inside a day/time cell. Electives carry an indigo wash so the
// recurring "choose-one" options stand out against the amber studio blocks.
function CourseEntry({ course }) {
  return (
    <div>
      <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{course.code}</div>
      {course.faculty.length > 0 && (
        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {course.faculty.join(', ')}
        </div>
      )}
      {course.venue && (
        <div className="flex items-center gap-0.5 truncate text-[11px] text-slate-400">
          <MapPin size={9} className="shrink-0" />
          {course.venue}
        </div>
      )}
    </div>
  )
}

// A merged class block spanning several time columns (morning / afternoon /
// evening). Tinted amber for studio cores, indigo for electives.
function BlockCell({ span, courses }) {
  const elective = courses.length > 0 && courses[0].type !== 'Core'
  const tint =
    courses.length === 0
      ? ''
      : elective
        ? 'bg-indigo-50/70 dark:bg-indigo-950/20'
        : 'bg-amber-50/70 dark:bg-amber-950/15'
  return (
    <td colSpan={span} className={`border border-slate-100 p-2 align-top dark:border-slate-800/80 ${tint}`}>
      <div className="flex flex-col gap-2.5">
        {courses.map((c) => (
          <CourseEntry key={c.id} course={c} />
        ))}
      </div>
    </td>
  )
}

const RecessCell = () => (
  <td className="w-7 border-x border-slate-100 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/50" />
)

// The "Personalised View" of the generated timetable: a student's (or a
// faculty's) week, with a left jump-nav over the stretches of the term where
// that week is constant. Read-only — a clean consumer view of the plan.
export default function PersonalisedTimetable() {
  const { courses } = useApp()
  const [role, setRole] = useState('student') // 'student' | 'faculty'

  const batches = useMemo(
    () => cohorts.filter((co) => courses.some((c) => c.cohort === co)),
    [courses],
  )
  const faculties = useMemo(
    () => [...new Set(courses.flatMap((c) => c.faculty))].sort(),
    [courses],
  )
  const [batch, setBatch] = useState(batches[0] || '')
  const [fac, setFac] = useState(faculties[0] || '')

  const myCourses = useMemo(
    () =>
      role === 'student'
        ? courses.filter((c) => c.cohort === batch)
        : courses.filter((c) => c.faculty.includes(fac)),
    [courses, role, batch, fac],
  )
  const ranges = useMemo(() => buildWeekRanges(myCourses), [myCourses])

  // Keep the selected jump-nav entry valid as the entity (batch/faculty) changes.
  const [activeIdx, setActiveIdx] = useState(0)
  useEffect(() => setActiveIdx(0), [role, batch, fac])
  const range = ranges.length ? ranges[Math.min(activeIdx, ranges.length - 1)] : null

  // Cores fill the week as studios (Mon/Tue/Thu/Fri, morning + afternoon);
  // electives sit on the elective day. With no core, the electives themselves
  // are the week's modules and fill those days.
  const cores = range ? range.courses.filter((c) => c.type === 'Core') : []
  const electives = range ? range.courses.filter((c) => c.type !== 'Core') : []
  const studio = cores.length ? cores : range ? range.courses : []
  const electiveDayCourses = cores.length ? electives : []

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Toolbar: Student/Faculty toggle + the matching entity selector */}
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 px-8 pb-4">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { id: 'student', label: 'Student', Icon: GraduationCap },
            { id: 'faculty', label: 'Faculty', Icon: CalendarDays },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setRole(r.id)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                role === r.id
                  ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <r.Icon size={14} /> {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          {role === 'student' ? 'Select Batch:' : 'Select Faculty:'}
          {role === 'student' ? (
            <select
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={fac}
              onChange={(e) => setFac(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {faculties.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <div className="flex min-h-0 flex-1 border-t border-slate-100 dark:border-slate-800">
        {/* Left: jump-to-week nav */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-slate-100 py-2 dark:border-slate-800">
          <div className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Jump to week
          </div>
          {ranges.map((r, i) => {
            const active = i === activeIdx
            return (
              <button
                key={r.sig}
                onClick={() => setActiveIdx(i)}
                className={`block w-full border-l-2 px-4 py-3 text-left transition ${
                  active
                    ? 'border-accent bg-accent-soft dark:bg-slate-800'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                <div
                  className={`text-sm font-semibold ${
                    active ? 'text-accent' : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {slotsSpan(r.weeks.map((n) => `M${n}`))}
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {r.weeks.length} week{r.weeks.length > 1 ? 's' : ''} · W{r.weeks[0]}
                  {r.weeks.length > 1 ? `–W${r.weeks[r.weeks.length - 1]}` : ''}
                </div>
              </button>
            )
          })}
          {ranges.length === 0 && (
            <p className="px-4 py-6 text-sm text-slate-400">No scheduled classes.</p>
          )}
        </aside>

        {/* Right: the selected week's day × time grid */}
        <div className="min-w-0 flex-1 overflow-auto p-6">
          {range ? (
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 w-16 rounded-tl-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    Time / Day
                  </th>
                  {COLS.map((col) =>
                    col.recess ? (
                      <th
                        key={col.id}
                        className="w-7 border-y border-r border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div
                          style={{ writingMode: 'vertical-rl' }}
                          className="mx-auto whitespace-nowrap text-[9px] font-medium uppercase tracking-wide text-slate-400"
                        >
                          {col.label}
                        </div>
                      </th>
                    ) : (
                      <th
                        key={col.id}
                        className="min-w-[96px] border-y border-r border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {col.label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((day) => {
                  const isElectiveDay = day === ELECTIVE_DAY
                  const morning = isElectiveDay ? electiveDayCourses : studio
                  const afternoon = isElectiveDay ? [] : studio
                  return (
                    <tr key={day}>
                      <td className="sticky left-0 z-10 w-16 border-x border-b border-slate-200 bg-slate-50 px-2 py-2 text-center font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                        {day}
                      </td>
                      <BlockCell span={MORNING_SPAN} courses={morning} />
                      <RecessCell />
                      <BlockCell span={AFTERNOON_SPAN} courses={afternoon} />
                      <RecessCell />
                      <BlockCell span={EVENING_SPAN} courses={[]} />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400">
              No classes scheduled for this {role === 'student' ? 'batch' : 'faculty member'} yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
