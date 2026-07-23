import { useMemo, useState } from 'react'
import { Search, Clock3, MapPin, Users, ChevronDown, Plus, X, Grid3x3 } from 'lucide-react'
import { TERM, PREV_YEAR } from '../../data/seed.js'
import { departments, aeroYears, aeroFaculty, aeroVenues, aeroSlotById } from '../../data/aeroTimetable.js'
import { departmentSlots } from '../../data/slotSystem.js'
import { useApp } from '../../store/AppContext.jsx'
import SectionHeader from './SectionHeader.jsx'
import StepShell from './StepShell.jsx'
import StatusFilter from './StatusFilter.jsx'

// The Aerospace (B.Tech) department reads its planner steps through the SAME
// interface as the IDC planner — switching department in the header changes the
// data, never the chrome. So every step here carries the IDC controls: the batch
// filter, the All / Allotted / Unallotted status tabs, an editable faculty list,
// a slotting control with a grid shortcut, an editable venue, and the last-year
// reference on the right of each card. What differs is only the underlying data
// (the AE courses) and its options (institute slots, AE faculty and venues).
//
// `mode` picks which of the four steps this renders:
//   courses → Running Courses List   faculty → Faculty Allotment
//   slot    → Slot Allotment         venue   → Venue Allotment
const TITLES = {
  courses: 'Running Courses List',
  faculty: 'Faculty Allotment',
  slot: 'Slot Allotment',
  venue: 'Venue Allotment',
}
const COUNT_NOUN = { courses: 'courses', faculty: 'faculty', slot: 'slots', venue: 'venues' }

// ltpc "3-0-0-6" → 6 credits (the last field), and a readable course-type label.
const creditsOf = (c) => Number((c.ltpc || '').split('-').pop()) || null
const TYPE_LABEL = { core: 'Core', lab: 'Laboratory', elective: 'Elective' }
const typeLabel = (c) => TYPE_LABEL[c.type] || 'Course'

// A B.Tech department is filtered by the SEMESTER a batch is sitting, not by the
// internal "B.Tech N" cohort tag — a year is known by its semester (Sem 1, Sem 3,
// Sem 5, Sem 7). Each chip still filters on the cohort behind it.
const ROMAN_TO_NUM = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 }
const semNumber = (semester) => ROMAN_TO_NUM[(semester || '').replace(/semester/i, '').trim()] ?? null
const SEM_CHIPS = aeroYears.map((y) => ({
  cohort: y.cohort,
  label: semNumber(y.semester) ? `Sem ${semNumber(y.semester)}` : y.semester,
}))

const SELECT_CLS =
  'appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
// The slot-system keys a B.Tech course can be allotted in.
const SLOT_SYSTEMS = ['S', 'L', 'M']

// Whether a course is "allotted" for the current step — the same predicate the
// IDC status tabs use, applied per step.
const allottedFor = (mode, c) =>
  mode === 'faculty'
    ? c.faculty.length > 0
    : mode === 'slot'
      ? c.slots.length > 0
      : mode === 'venue'
        ? !!c.venue
        : c.faculty.length > 0 && c.slots.length > 0 && !!c.venue

export default function AeroSection({ mode, nav, scope, setScope }) {
  const { aeroCourses, updateAeroCourse } = useApp()
  const department = departments.find((d) => d.id === scope?.departmentId) || departments[0]

  const [filterBy, setFilterBy] = useState('batch') // slot step: batch | faculty
  const [cohortTags, setCohortTags] = useState([]) // empty = all semesters
  const [facultyTags, setFacultyTags] = useState([]) // empty = all faculty
  const [status, setStatus] = useState('all') // all | allotted | unallotted
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const showStatus = mode !== 'courses' // IDC's running-courses list has no status tabs
  const showFilterToggle = mode === 'slot' // only slot carries the batch/faculty toggle
  const byFaculty = showFilterToggle && filterBy === 'faculty'

  const list = useMemo(
    () =>
      aeroCourses.filter((c) => {
        const matchesChips = byFaculty
          ? facultyTags.length === 0 || c.faculty.some((f) => facultyTags.includes(f))
          : cohortTags.length === 0 || cohortTags.includes(c.cohort)
        return (
          matchesChips &&
          (!q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q))
        )
      }),
    [aeroCourses, byFaculty, cohortTags, facultyTags, q],
  )
  const allottedCount = list.filter((c) => allottedFor(mode, c)).length
  const counts = { all: list.length, allotted: allottedCount, unallotted: list.length - allottedCount }
  const shown =
    !showStatus || status === 'all'
      ? list
      : list.filter((c) => (status === 'allotted' ? allottedFor(mode, c) : !allottedFor(mode, c)))

  const total = aeroCourses.length
  const fullyAllotted = aeroCourses.filter((c) => allottedFor('courses', c)).length
  const stepAllotted = aeroCourses.filter((c) => allottedFor(mode, c)).length

  // A department whose curriculum hasn't been mapped in yet gets the same
  // "not imported" state the Master Timetable shows.
  if (!department.ready) {
    return (
      <StepShell
        nav={nav}
        scope={scope}
        setScope={setScope}
        totals={{ courses: 0, unassigned: 0, conflictFree: true }}
        header={
          <SectionHeader eyebrow={`Department Timetable ${TERM.semester} 2026-27`} title={TITLES[mode]} />
        }
      >
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-center px-8 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <Clock3 size={26} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-100">
            {department.name} isn’t imported yet
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-500 dark:text-slate-400">
            This department’s course schedule hasn’t been mapped into the planner. Switch to
            Aerospace Engineering or Design (IDC) to see a live timetable.
          </p>
        </div>
      </StepShell>
    )
  }

  const headerCount =
    mode === 'courses' ? (
      <span className="rounded-full bg-ok-soft px-3 py-1 text-sm font-medium text-green-800">
        {fullyAllotted} of {total} fully allotted
      </span>
    ) : (
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          stepAllotted === total ? 'bg-ok-soft text-green-800' : 'bg-amber-100 text-amber-800'
        }`}
      >
        {stepAllotted} of {total} allotted ({total - stepAllotted} left)
      </span>
    )

  return (
    <StepShell
      nav={nav}
      scope={scope}
      setScope={setScope}
      totals={{ courses: total, unassigned: total - stepAllotted, conflictFree: true }}
      header={
        <SectionHeader
          eyebrow={`Department Timetable ${TERM.semester} 2026-27`}
          title={TITLES[mode]}
          action={headerCount}
        />
      }
    >
      <div className="mx-auto max-w-7xl">
        {/* Filters — the batch/faculty toggle (slot only), the semester or faculty
            chips, and a search box, mirroring the IDC step controls. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-3">
          {showFilterToggle && (
            <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
              {[
                { id: 'batch', label: 'By batch' },
                { id: 'faculty', label: 'By faculty' },
              ].map((o) => (
                <button
                  key={o.id}
                  onClick={() => setFilterBy(o.id)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    filterBy === o.id
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {byFaculty ? (
              <>
                <Chip
                  label="All faculty"
                  active={facultyTags.length === 0}
                  onClick={() => setFacultyTags([])}
                />
                {aeroFaculty.map((f) => (
                  <Chip
                    key={f}
                    label={f}
                    active={facultyTags.includes(f)}
                    onClick={() =>
                      setFacultyTags((t) =>
                        t.includes(f) ? t.filter((x) => x !== f) : [...t, f],
                      )
                    }
                  />
                ))}
              </>
            ) : (
              <>
                <Chip label="All" active={cohortTags.length === 0} onClick={() => setCohortTags([])} />
                {SEM_CHIPS.map((s) => (
                  <Chip
                    key={s.cohort}
                    label={s.label}
                    active={cohortTags.includes(s.cohort)}
                    onClick={() =>
                      setCohortTags((t) =>
                        t.includes(s.cohort) ? t.filter((x) => x !== s.cohort) : [...t, s.cohort],
                      )
                    }
                  />
                ))}
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900">
              <Search size={15} className="text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for a course code or name"
                className="w-60 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
            {/* The master-grid shortcut lives here once — beside the search — for
                the whole Slot Allotment step, rather than on every course card. */}
            {mode === 'slot' && (
              <button
                onClick={() => window.open('/aero-slot-grid', '_blank')}
                title="Open the institute master timetable in a new tab"
                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                <Grid3x3 size={15} /> Grid
              </button>
            )}
          </div>
        </div>

        {/* Status tabs + running count — as on the IDC allotment steps. */}
        <div className="mt-4 flex items-center justify-between">
          {showStatus ? (
            <StatusFilter value={status} onChange={setStatus} counts={counts} />
          ) : (
            <span />
          )}
          <span className="text-xs text-slate-400">
            <b className="text-slate-600 dark:text-slate-300">{allottedCount}</b> of {list.length}{' '}
            {COUNT_NOUN[mode]} allotted
          </span>
        </div>

        <div className="mt-3 space-y-3 pb-4">
          {shown.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-5 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="min-w-0 flex-[1.4]">
                <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {typeLabel(c)} Course{creditsOf(c) ? ` · ${creditsOf(c)} Credits` : ''}
                </div>
                <div className="mt-0.5 truncate text-base font-semibold text-slate-900 dark:text-white">
                  <span className="text-slate-500 dark:text-slate-400">{c.code}</span>
                  <span className="mx-1.5 text-slate-300">|</span>
                  {c.title}
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-400">
                  {c.year} · {c.semester}
                  {mode === 'slot' && (
                    <> · To be taught by: {c.faculty.length ? c.faculty.join(' & ') : 'unassigned'}</>
                  )}
                </div>
              </div>

              <Detail mode={mode} course={c} onUpdate={updateAeroCourse} />
            </div>
          ))}
          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400 dark:border-slate-800">
              No courses in this view.
            </p>
          )}
        </div>
      </div>
    </StepShell>
  )
}

// The per-step content on the right of each card — editable exactly as in IDC,
// plus the last-year reference that step carries.
function Detail({ mode, course, onUpdate }) {
  if (mode === 'courses') {
    // The programme is shown (read-only, as in IDC), but a B.Tech course carries
    // no design sub-discipline, so the discipline control is present for layout
    // parity yet not choosable.
    return (
      <>
        <Labelled label="Programme">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">B.Tech.</span>
        </Labelled>
        <Labelled label="Discipline">
          <div className="relative">
            <select
              disabled
              title="Aerospace courses have no sub-discipline"
              className={`${SELECT_CLS} cursor-not-allowed opacity-60`}
            >
              <option>Not applicable</option>
            </select>
            <ChevronDown
              size={15}
              className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
          </div>
        </Labelled>
      </>
    )
  }

  if (mode === 'faculty') {
    return (
      <>
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            <Users size={11} /> Teaching faculty
          </div>
          <FacultyEditor
            value={course.faculty}
            onChange={(next) => onUpdate({ ...course, faculty: next })}
          />
        </div>
        <div className="w-52 shrink-0 text-right text-xs leading-snug text-slate-400">
          {course.prevFaculty?.length ? (
            <>
              Taught by{' '}
              <span className="text-slate-500 dark:text-slate-300">
                {course.prevFaculty.join(' & ')}
              </span>{' '}
              in {PREV_YEAR}
            </>
          ) : (
            <span className="italic">No record from {PREV_YEAR}</span>
          )}
        </div>
      </>
    )
  }

  if (mode === 'slot') {
    const prevSys = aeroSlotById[course.prevSlots?.[0]]?.system || 'S'
    const prevCodes = course.prevSlots?.length
      ? course.prevSlots.map((id) => aeroSlotById[id]?.code || id).join(', ')
      : '—'
    return (
      <>
        <SlotControl course={course} onUpdate={onUpdate} />
        <div className="w-48 shrink-0 text-right text-xs leading-snug text-slate-400">
          Ran in{' '}
          <span className="font-medium text-slate-600 dark:text-slate-300">Slot System {prevSys}</span>{' '}
          (Slots {prevCodes}) in {PREV_YEAR}
        </div>
      </>
    )
  }

  // mode === 'venue'
  return (
    <>
      <div className="flex-1">
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">Venue</div>
        <div className="relative inline-block">
          <select
            value={course.venue || ''}
            onChange={(e) => onUpdate({ ...course, venue: e.target.value })}
            className={SELECT_CLS}
          >
            <option value="">Select a venue</option>
            {aeroVenues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          <ChevronDown
            size={15}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
        </div>
      </div>
      <div className="flex w-52 shrink-0 items-center justify-end gap-1.5 text-right text-xs text-slate-400">
        <MapPin size={13} className="shrink-0" />
        {course.prevVenue ? (
          <span>
            Used <span className="font-medium text-slate-600 dark:text-slate-300">{course.prevVenue}</span>{' '}
            in {PREV_YEAR}
          </span>
        ) : (
          <span className="italic">No record from {PREV_YEAR}</span>
        )}
      </div>
    </>
  )
}

// Slotting control for a B.Tech course, styled to match the IDC slot card: a
// "Slotting type" selector (the institute S / L / M systems) beside a dropdown of
// that system's actual slots — the real institute codes, read live from the
// editable slot system so editing the system updates the options here too. The
// grid shortcut lives once beside the search bar, not on every card.
function SlotControl({ course, onUpdate }) {
  const { slotSystem } = useApp()
  const opts = useMemo(() => departmentSlots(slotSystem), [slotSystem])
  const current = course.slots[0] || ''
  const currentDef = opts.all.find((o) => o.id === current)
  const [system, setSystem] = useState(currentDef?.system || (course.lab ? 'L' : 'S'))
  const slotOptions = system === 'L' ? opts.labs : system === 'M' ? opts.modules : opts.lectures
  return (
    <div className="flex flex-[2] items-end gap-3">
      <SelectField label="Slotting type">
        <select value={system} onChange={(e) => setSystem(e.target.value)} className={SELECT_CLS}>
          {SLOT_SYSTEMS.map((k) => (
            <option key={k} value={k}>
              Slot System {k}
            </option>
          ))}
        </select>
      </SelectField>
      <SelectField label="Slot">
        <select
          value={current}
          onChange={(e) => onUpdate({ ...course, slots: e.target.value ? [e.target.value] : [] })}
          className={SELECT_CLS}
        >
          <option value="">Select a slot</option>
          {slotOptions.map((o) => (
            <option key={o.id} value={o.id} title={`${o.days.join(', ')} · ${o.start}–${o.end}`}>
              {o.code}
            </option>
          ))}
        </select>
      </SelectField>
    </div>
  )
}

// Inline chips + add-dropdown editor for a course's teaching faculty — the same
// control the IDC faculty step uses, populated from the AE faculty roster.
function FacultyEditor({ value, onChange }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((f) => (
        <span
          key={f}
          className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {f}
          <button
            onClick={() => onChange(value.filter((x) => x !== f))}
            className="text-slate-400 hover:text-red-500"
          >
            <X size={12} />
          </button>
        </span>
      ))}
      {adding ? (
        <select
          autoFocus
          onChange={(e) => {
            if (e.target.value) onChange([...value, e.target.value])
            setAdding(false)
          }}
          onBlur={() => setAdding(false)}
          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">Type or select…</option>
          {aeroFaculty
            .filter((f) => !value.includes(f))
            .map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
        </select>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-600"
        >
          <Plus size={13} /> {value.length ? 'Add' : 'Select faculty'}
        </button>
      )}
    </div>
  )
}

// Label over a native select, with the chevron affordance the IDC cards use.
function SelectField({ label, children }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="relative inline-block">
        {children}
        <ChevronDown
          size={15}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  )
}

// A small stacked "label over value" cell used on the running-courses card.
function Labelled({ label, children }) {
  return (
    <div className="shrink-0">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}

// A light filter chip matching the IDC BatchTabs look.
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? 'bg-accent text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      {label}
    </button>
  )
}
