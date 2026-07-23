import { useState, useMemo, useEffect } from 'react'
import { Clock, PenLine, Plus } from 'lucide-react'
import {
  aeroYears,
  aeroFaculty,
  aeroCourseById,
  aeroPhaseSpans,
} from '../data/aeroTimetable.js'
import { DAYS, PERIODS, periodLabel, freeSlotsAt } from '../data/slotSystem.js'
import { catalogueAt } from '../data/catalogue.js'
import { useApp } from '../store/AppContext.jsx'
import AeroSemesterGrid from './AeroSemesterGrid.jsx'
import AeroCoursePanel from './AeroCoursePanel.jsx'
import CourseDiscoveryPanel from './CourseDiscoveryPanel.jsx'

const VIEWS = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'venue', label: 'Venue' },
]

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtD = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${Number(d)} ${MON[Number(m) - 1]}`
}

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const overlaps = (s1, e1, s2, e2) => toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2)

// Course fills, in the IDC weekly grid's language rather than a palette of our
// own: a long 3-hour lab block is the B.Tech counterpart of IDC's studio, so it
// takes the same amber; a lecture takes the same grey the semester grid gives
// every course block, so one course reads identically in both views. Electives
// aren't a third colour — they're a lecture whose course isn't picked yet, and
// they say so in italics (the semester grid draws them the same way).
const LECTURE_FILL = 'border-slate-200 bg-[#E1E8EF] dark:border-slate-700 dark:bg-slate-800'
const LAB_FILL = 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/25'
const fillFor = (type) => (type === 'lab' ? LAB_FILL : LECTURE_FILL)

// Group a day's blocks into the period-column spans they cover. Two slots can
// share a column at different sub-times (e.g. Slot 5 ends 10:55 and Slot 6 starts
// 11:05 — both touch the 10:35–11:25 column); such blocks merge into one spanning
// group and are laid out side-by-side by their real clock time.
function dayGroups(blocks, day) {
  const items = blocks
    .filter((bl) => bl.day === day)
    .map((bl) => {
      let a = -1
      let b = -1
      PERIODS.forEach((p, idx) => {
        if (p.kind === 'lunch') return
        if (overlaps(p.start, p.end, bl.start, bl.end)) {
          if (a < 0) a = idx
          b = idx
        }
      })
      if (a < 0) return null
      return { ...bl, a, b, startMin: toMin(bl.start), endMin: toMin(bl.end) }
    })
    .filter(Boolean)
    .sort((x, y) => x.a - y.a || x.startMin - y.startMin)

  const groups = []
  for (const it of items) {
    const g = groups[groups.length - 1]
    if (g && it.a <= g.b) {
      g.b = Math.max(g.b, it.b)
      g.items.push(it)
    } else groups.push({ a: it.a, b: it.b, items: [it] })
  }
  return groups
}

// A B.Tech department's published timetable. Deliberately the SAME shell as the
// IDC planner — the Select View switch on the left, the pivot controls on the
// right, the grid below, a detail panel on the side — so switching department in
// the header changes the data, never the interface. What differs is only what the
// department actually is: its courses are fixed to institute slots for the whole
// term, so the semester grid draws one block per teaching phase instead of IDC's
// movable week-by-week studio modules, and nothing here is editable.
// Which view you're in (sem vs weekly, and the pivot within it) is owned by the
// page, not by this component — it's a property of the reader, not the
// department, so it has to survive switching from one department to another.
// What can't carry across is the entity being shown: a batch or faculty member
// only exists within one department, so those selections stay local.
export default function AeroTimetable({
  viewMode,
  setViewMode,
  view,
  setView,
  weeklyMode,
  setWeeklyMode,
  // Course discovery: a student browsing what to add to a free slot. Gated by the
  // page (student, weekly, registration open); this grid just wires the click.
  discover = false,
}) {
  // Free cells surface the institute S / L slots still open there, read from the
  // live slot system — the same source (and the same look) as the IDC weekly
  // grid, so an empty slot reads identically in either department.
  const { slotSystem } = useApp()
  const [weeklyYearId, setWeeklyYearId] = useState(aeroYears[0].id)
  const [weeklyFaculty, setWeeklyFaculty] = useState(aeroFaculty[0] || null)
  // The free cell a student is browsing courses for: { key, label, freeIds }.
  // Owned here (not by the page) because this grid renders its own side panels,
  // exactly as it owns the course-detail drawer.
  const [discoverCell, setDiscoverCell] = useState(null)
  // Which stretch of the term the weekly view is showing — the rail's selection.
  const [phaseId, setPhaseId] = useState(aeroPhaseSpans[0].id)
  // Course detail drawer: the open course, plus the block it was opened from
  // (those siblings become the drawer's tabs).
  const [detailsId, setDetailsId] = useState(null)
  const [detailGroupIds, setDetailGroupIds] = useState([])
  const weekly = viewMode === 'weekly'
  const canDiscover = discover && weekly

  // The panel is anchored to one cell of one entity's week — close it whenever
  // the ground it stood on moves (discovery turned off, left weekly, or the
  // year / faculty / pivot being shown changed).
  useEffect(() => {
    if (!canDiscover) setDiscoverCell(null)
  }, [canDiscover])
  useEffect(() => {
    setDiscoverCell(null)
  }, [weeklyMode, weeklyYearId, weeklyFaculty])

  const weeklyYear = useMemo(
    () => aeroYears.find((y) => y.id === weeklyYearId) || aeroYears[0],
    [weeklyYearId],
  )
  // What the weekly grid draws: one year's whole week, or one teacher's.
  const weeklyBlocks = useMemo(() => {
    if (weeklyMode === 'faculty')
      return aeroYears
        .flatMap((y) => y.blocks)
        .filter((b) => b.course.faculty.includes(weeklyFaculty))
    return weeklyYear.blocks
  }, [weeklyMode, weeklyFaculty, weeklyYear])


  const phase = aeroPhaseSpans.find((p) => p.id === phaseId) || aeroPhaseSpans[0]

  const entityLabel =
    weeklyMode === 'faculty'
      ? weeklyFaculty || '—'
      : `${weeklyYear.year} · ${weeklyYear.semester}`

  const openCourse = (course, group) => {
    setDetailsId(course.id)
    setDetailGroupIds(group && group.length > 1 ? group.map((c) => c.id) : [])
  }
  const closeCourse = () => {
    setDetailsId(null)
    setDetailGroupIds([])
  }

  const detailCourse = detailsId ? aeroCourseById[detailsId] : null
  const detailGroup = detailGroupIds.map((id) => aeroCourseById[id]).filter(Boolean)

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* View controls — same layout as the IDC planner: Select View on the
            left, the pivot for the current view on the right. */}
        <div className="flex shrink-0 items-center justify-between px-8 py-2.5">
          <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            Select View:
            <select
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value)
                closeCourse()
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="sem">Sem View</option>
              <option value="weekly">Weekly View</option>
            </select>
          </label>

          {weekly ? (
            /* Weekly pivot — a Student/Faculty toggle plus the entity dropdown,
               mirroring the IDC weekly controls. */
            <div className="flex items-center gap-2">
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {[
                  { id: 'student', label: 'Student' },
                  { id: 'faculty', label: 'Faculty' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setWeeklyMode(m.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      weeklyMode === m.id
                        ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {weeklyMode === 'faculty' ? (
                <select
                  aria-label="Select faculty"
                  value={weeklyFaculty || ''}
                  onChange={(e) => setWeeklyFaculty(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {aeroFaculty.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              ) : (
                <select
                  aria-label="Select batch"
                  value={weeklyYear.id}
                  onChange={(e) => setWeeklyYearId(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {aeroYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.year} · {y.semester}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            /* Sem pivot — the same Student / Faculty / Venue switch the IDC grid
               uses; it re-pivots the grid's columns. */
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setView(v.id)
                    closeCourse()
                  }}
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
          )}
        </div>

        {/* Main region */}
        {weekly ? (
          <div className="min-h-0 flex-1 overflow-auto px-8 pb-6">
            <WeeklyGrid
              blocks={weeklyBlocks}
              system={slotSystem}
              entityLabel={entityLabel}
              showCohort={weeklyMode === 'faculty'}
              phase={phase}
              onSelectPhase={setPhaseId}
              discover={canDiscover}
              pickedCell={discoverCell?.key || null}
              onPickCell={setDiscoverCell}
            />
            {/* Pass/No-Pass & co-curricular courses that don't take a weekday
                slot — only meaningful for a batch's own week. */}
            {weeklyMode === 'student' && weeklyYear.passFail?.length > 0 && (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Also this semester · Pass / No-Pass · co-curricular
                </div>
                <div className="flex flex-wrap gap-2">
                  {weeklyYear.passFail.map((c) => (
                    <span
                      key={c.code}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                    >
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {c.code}
                      </span>
                      <span className="text-slate-400">{c.title}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-8 pb-3">
            <div className="min-h-0 flex-1">
              <AeroSemesterGrid
                view={view}
                onCourseClick={openCourse}
                selectedCourseId={detailsId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Detail drawer — sem view only, exactly as in the IDC planner. */}
      {!weekly && detailCourse && (
        <AeroCoursePanel
          course={detailCourse}
          group={detailGroup}
          onSelectCourse={setDetailsId}
          onClose={closeCourse}
        />
      )}

      {/* Course discovery — weekly view only, when a student has clicked a free
          cell to see what they could add there. Mirrors the IDC weekly view. */}
      {weekly && discoverCell && (
        <CourseDiscoveryPanel cell={discoverCell} onClose={() => setDiscoverCell(null)} />
      )}
    </div>
  )
}

// --- Weekly Day × Time grid ---------------------------------------------------
// Laid out exactly like the IDC weekly view: a "Jump to" rail down the left, the
// span and entity as a heading, and the day × period grid beside them.
function WeeklyGrid({
  blocks,
  system,
  entityLabel,
  showCohort,
  phase,
  onSelectPhase,
  discover = false,
  pickedCell = null,
  onPickCell,
}) {
  const dateLabel = `${fmtD(phase.from.dateRange.start)} – ${fmtD(phase.to.dateRange.end)}`
  const isExam = phase.kind === 'exam'

  return (
    <div className="flex gap-6">
      {/* The phase rail steps aside while the discovery panel is open — that
          panel is about one cell in one phase, so jumping to another phase
          mid-choice would only pull the two out of step (as on the IDC grid). */}
      {!pickedCell && <PhaseRail activeId={phase.id} onSelect={onSelectPhase} />}

      <div className="min-w-0 flex-1 overflow-x-auto">
        <div className="mb-3 flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{dateLabel}</h2>
          <span className="text-sm text-slate-400">{entityLabel}</span>
        </div>

        {isExam ? (
          <ExamWeekNotice phase={phase} />
        ) : blocks.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            Nothing scheduled at a weekday slot for this selection.
          </p>
        ) : (
          <>
            <table className="w-full border-separate border-spacing-0 text-xs">
              <thead>
                <tr>
                  <th className="w-16 rounded-tl-lg border border-slate-200 bg-slate-50 px-2 py-2 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                    Day
                  </th>
                  {PERIODS.map((p) =>
                    p.kind === 'lunch' ? (
                      <th
                        key={p.id}
                        className="w-6 border-b border-r border-t border-slate-200 bg-slate-50 px-1 py-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <span className="block text-[9px] font-semibold uppercase tracking-wide text-slate-400 [writing-mode:vertical-rl]">
                          Lunch
                        </span>
                      </th>
                    ) : (
                      <th
                        key={p.id}
                        className="min-w-[104px] border-b border-r border-t border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900"
                      >
                        {periodLabel(p.start)} – {periodLabel(p.end)}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => (
                  <tr key={d}>
                    <th className="border-b border-l border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-top font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {d}
                    </th>
                    <DayCells
                      day={d}
                      blocks={blocks}
                      system={system}
                      showCohort={showCohort}
                      discover={discover}
                      pickedCell={pickedCell}
                      onPickCell={onPickCell}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
            <Legend />
          </>
        )}
      </div>
    </div>
  )
}

// "Jump to" rail — the same pattern as the IDC weekly view's, listing the stretches
// of term rather than individual weeks. That is the honest mapping: IDC's rail
// groups consecutive weeks that hold the same course, and here that grouping is
// the phase, because the week repeats unchanged until an exam interrupts it. The
// exam stretches are listed too, so the rail covers the whole term and selecting
// one tells you plainly that nothing is taught then.
function PhaseRail({ activeId, onSelect }) {
  return (
    <nav className="sticky top-4 hidden h-fit w-44 shrink-0 self-start md:block">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jump to</div>
      <div className="mt-2 border-l border-slate-200 dark:border-slate-800">
        {aeroPhaseSpans.map((p) => {
          const active = p.id === activeId
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              title={`${p.from.week === p.to.week ? p.from.label : `${p.from.label}–${p.to.label}`} · ${
                p.kind === 'exam' ? p.short : 'teaching'
              }`}
              className={`-ml-px flex w-full items-center border-l-2 py-1 pl-3 text-left text-xs transition ${
                active
                  ? 'border-accent font-semibold text-accent'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <span className="shrink-0">
                {fmtD(p.from.dateRange.start)} – {fmtD(p.to.dateRange.end)}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

// The mid-sem / end-sem stretches have no weekly schedule to draw. Rather than an
// empty grid, say so — in the same hatched language the semester grid uses for
// these weeks.
function ExamWeekNotice({ phase }) {
  return (
    <div className="exam-band flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-16 text-center dark:border-slate-800">
      <PenLine size={20} className="text-amber-700 dark:text-amber-400" />
      <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
        {phase.label}
      </div>
      <p className="max-w-sm text-xs text-amber-700/70 dark:text-amber-400/70">
        No classes run during this stretch — the weekly schedule resumes when
        teaching does.
      </p>
    </div>
  )
}

// Free institute-slot chips for a cell the entity isn't taught in — the single S
// slots grey, the composed L blocks indigo. These ARE the same S / L chips the
// IDC weekly grid shows (drawn from the same institute slot system), so a spare
// slot reads identically whichever department you're looking at.
function SlotChips({ s, l }) {
  if (!s.length && !l.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {s.map((id) => (
        <span
          key={id}
          className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          {id}
        </span>
      ))}
      {l.map((id) => (
        <span
          key={id}
          className="rounded bg-indigo-50 px-1 py-0.5 font-mono text-[10px] font-medium text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-300"
        >
          {id}
        </span>
      ))}
    </div>
  )
}

// One day's row of period cells. A course occupies the columns its clock time
// overlaps, and column-sharing slots sit side-by-side by their real time within
// the spanned group. Every other cell surfaces the institute slots still free
// there — the same scaffolding the IDC weekly grid shows.
function DayCells({ day, blocks, system, showCohort, discover = false, pickedCell = null, onPickCell }) {
  const groups = useMemo(() => dayGroups(blocks, day), [blocks, day])
  const cells = []
  let i = 0
  while (i < PERIODS.length) {
    const p = PERIODS[i]
    if (p.kind === 'lunch') {
      cells.push(
        <td
          key={p.id}
          className="border-b border-r border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40"
        />,
      )
      i++
      continue
    }
    const grp = groups.find((g) => g.a === i)
    if (grp) {
      const span = grp.b - grp.a + 1
      const winStart = toMin(PERIODS[grp.a].start)
      const winLen = Math.max(1, toMin(PERIODS[grp.b].end) - winStart)
      cells.push(
        <td
          key={p.id}
          colSpan={span}
          className="border-b border-r border-slate-200 p-0 align-top dark:border-slate-800"
        >
          <div className="relative min-h-[4.75rem] w-full">
            {grp.items.map((it) => {
              const left = ((it.startMin - winStart) / winLen) * 100
              const width = ((it.endMin - it.startMin) / winLen) * 100
              const c = it.course
              return (
                <div
                  key={`${c.code}-${it.day}-${it.start}`}
                  style={{ left: `${left}%`, width: `calc(${Math.max(width, 12)}% - 4px)` }}
                  title={`${c.code} · ${c.title} · ${it.slotCode || it.slot} · ${it.start}–${it.end}`}
                  className={`absolute inset-y-1 mx-0.5 flex flex-col overflow-hidden rounded-lg border px-2 py-1.5 ${fillFor(c.type)}`}
                >
                  <span className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">
                    {c.code}
                  </span>
                  <span
                    className={`truncate text-[10px] leading-tight ${
                      c.type === 'elective'
                        ? 'italic text-slate-500 dark:text-slate-400'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {showCohort ? c.cohort : c.title}
                  </span>
                  <span className="mt-auto flex items-center gap-1 truncate pt-0.5 text-[9px] text-slate-500 dark:text-slate-400">
                    <Clock size={8} className="shrink-0" /> {it.start}–{it.end} · {it.slotCode || it.slot}
                  </span>
                </div>
              )
            })}
          </div>
        </td>,
      )
      i = grp.b + 1
      continue
    }
    // A free cell surfaces the institute slots still open there: the single S
    // slots that START in this period, plus any composed L block that begins
    // here. Both are shown — the whole point of the empty cell is to say what
    // could still be scheduled in it.
    const { s, l } = freeSlotsAt(system, day, p)
    const ids = [...s, ...l]
    // Course discovery: a free cell offers itself as somewhere to add a course
    // only if it can honour the click — a free slot AND something in the
    // catalogue that meets there. Same rule (and look) as the IDC weekly grid.
    const cellKey = `${day}#${p.id}`
    const canDiscover = discover && !!onPickCell && ids.length > 0 && catalogueAt(ids).length > 0
    const isPicked = canDiscover && pickedCell === cellKey
    cells.push(
      <td
        key={p.id}
        onClick={
          canDiscover
            ? (e) => {
                e.stopPropagation()
                onPickCell({
                  key: cellKey,
                  label: `${day} ${periodLabel(p.start)}–${periodLabel(p.end)}`,
                  freeIds: ids,
                })
              }
            : undefined
        }
        title={canDiscover ? 'Click to see what you can add in this slot' : undefined}
        className={`group/free border-b border-r px-2 py-2 align-top transition dark:border-slate-800 ${
          isPicked
            ? 'cursor-pointer border-accent bg-accent-soft/60 ring-1 ring-inset ring-accent dark:bg-accent/20'
            : canDiscover
              ? 'cursor-pointer border-slate-200 bg-white hover:bg-accent-soft/30 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-800/50'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
        }`}
      >
        <SlotChips s={s} l={l} />
        {/* The invitation stays hidden until the pointer is on the cell — the
            grid reads first as a timetable, not a row of buttons. */}
        {canDiscover && !isPicked && (
          <span className="mt-1 flex items-center gap-0.5 text-[9px] font-medium text-accent opacity-0 transition group-hover/free:opacity-100">
            <Plus size={9} className="shrink-0" /> Add
          </span>
        )}
      </td>,
    )
    i++
  }
  return <>{cells}</>
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className={`h-3 w-3 rounded border ${LECTURE_FILL}`} />
        lecture slot
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`h-3 w-3 rounded border ${LAB_FILL}`} />
        laboratory (3-hour block)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="italic text-slate-500 dark:text-slate-300">Elective</span>
        chosen from a basket
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-500 dark:bg-slate-800">
          1A
        </span>
        free single (S)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="rounded bg-indigo-50 px-1 py-0.5 font-mono text-[9px] text-indigo-500 dark:bg-indigo-950/40">
          L1
        </span>
        free lecture block (L)
      </span>
    </div>
  )
}
