import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { History, Layers } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { departmentSlots, PERIODS, periodLabel } from '../data/slotSystem.js'
import {
  MASTER_COURSES,
  MASTER_FACULTY,
  MASTER_FACULTY_COLUMNS,
  MASTER_SEMESTERS,
  MASTER_DAYS,
  MASTER_PHASES,
  placeAt,
  courseTag,
} from '../data/aeroMasterTimetable.js'

// The Aerospace Master Slot Grid — opened in its own tab from the Slot Allotment
// step, the B.Tech counterpart of IDC's week grid. It reproduces the institute's
// published timetable at its REAL institute slots: every course sits where its
// slot actually meets (a lecture slot's 1A / 1B / 1C fall on Mon / Tue / Thu, a
// lab on one afternoon), so the week reads sparsely and correctly rather than as
// a course smeared across a whole row. Everything is carried over from last year.
//
// The controls mirror IDC's grid window:
//   • a "By batch / By faculty" pivot that changes what the COLUMNS are;
//   • By batch → semester columns (all shown; narrow to just 1st Sem, 5th Sem …);
//   • By faculty → one column per professor, each showing that professor's own
//     weekly timetable — their courses gathered from every semester;
//   • a course tray along the bottom listing the courses to be mapped, each card
//     click-to-locate in the grid.

// Every course block reads the same — the uniform IDC block (a calm slate card
// with the code, its Core / Elective · … tag, the coordinating professor and the
// concrete sub-slot met here). No per-kind colours; the tag tells them apart. The
// <td> carries the data-focus hook so the focused course can be scrolled to.
function CourseCell({ course, slotCode, focused, showFaculty, onFocus }) {
  if (!course) {
    return <td className="border border-slate-200 bg-white p-0 align-top dark:border-slate-800 dark:bg-slate-950" />
  }
  return (
    <td
      data-focus={focused ? '1' : undefined}
      className="border border-slate-200 p-1 align-top dark:border-slate-800"
    >
      <button
        onClick={() => onFocus(course.code)}
        title={`${course.code} · ${course.title}${slotCode ? ` · slot ${slotCode}` : ''}`}
        className={`relative flex h-full min-h-[44px] w-full flex-col justify-start overflow-hidden rounded-md bg-[#E1E8EF] px-1.5 py-1 text-left transition hover:bg-accent-soft dark:bg-slate-800 dark:hover:bg-slate-700 ${
          focused ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-950' : ''
        }`}
      >
        {slotCode && (
          <span className="absolute right-1 top-1 text-[8px] font-semibold text-slate-400 dark:text-slate-500">
            {slotCode}
          </span>
        )}
        <span className="truncate pr-5 text-[11px] font-semibold leading-tight text-slate-800 dark:text-slate-100">
          {course.short}
        </span>
        <span className="truncate text-[9px] font-medium uppercase tracking-wide text-slate-400">
          {courseTag(course)}
        </span>
        {showFaculty && course.faculty && (
          <span className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
            {course.faculty}
          </span>
        )}
      </button>
    </td>
  )
}

// A light filter chip — the same look as the IDC / AeroSection batch tabs.
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

export default function AeroSlotGrid() {
  const [params] = useSearchParams()
  // A focused course (deep-linked from a slot card, or picked from the tray) is
  // ringed everywhere it appears; the first occurrence is scrolled into view.
  const [focusCode, setFocusCode] = useState(params.get('focus') || '')

  // The live institute slot system decides where each slot meets — read it so a
  // slot edit on the Slot System page flows straight into this grid.
  const { slotSystem } = useApp()
  const slotDefs = useMemo(() => {
    const map = {}
    for (const s of departmentSlots(slotSystem).all) map[s.id] = s
    return map
  }, [slotSystem])

  // The IDC grid-window controls: a batch/faculty pivot, then chips.
  const [filterBy, setFilterBy] = useState('batch') // 'batch' | 'faculty'
  const byFaculty = filterBy === 'faculty'
  const [semTags, setSemTags] = useState(() => new Set()) // empty = all semesters
  const [facultyTags, setFacultyTags] = useState(() => new Set()) // empty = all faculty

  const toggleSem = (id) =>
    setSemTags((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  const toggleFaculty = (name) =>
    setFacultyTags((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })

  // The grid's column-groups. By batch each group is a semester (its allotted
  // courses); by faculty each group is a professor (their courses across every
  // semester → their weekly timetable). Chips choose which groups are shown.
  const columnGroups = useMemo(() => {
    if (byFaculty) {
      return facultyTags.size === 0
        ? MASTER_FACULTY_COLUMNS
        : MASTER_FACULTY_COLUMNS.filter((c) => facultyTags.has(c.id))
    }
    return semTags.size === 0 ? MASTER_SEMESTERS : MASTER_SEMESTERS.filter((s) => semTags.has(s.id))
  }, [byFaculty, facultyTags, semTags])

  const dayCols = columnGroups.length * MASTER_DAYS.length
  const isFocus = (course) => !!focusCode && course && course.code === focusCode

  // The tray lists every distinct course across the shown column-groups — the set
  // still to be mapped out.
  const trayCourses = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const g of columnGroups) {
      for (const c of g.courses) {
        if (!seen.has(c.code) && MASTER_COURSES[c.code]) {
          seen.add(c.code)
          out.push(MASTER_COURSES[c.code])
        }
      }
    }
    return out
  }, [columnGroups])

  // Scroll the focused course's first occurrence into view when it changes.
  const containerRef = useRef(null)
  useEffect(() => {
    if (!focusCode || !containerRef.current) return
    const el = containerRef.current.querySelector('[data-focus="1"]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [focusCode, columnGroups])

  // One period's row across every visible column-group × day. `lead` renders the
  // rowspanning Start / End cells on the block's first row.
  const periodRow = (period, lead) => (
    <tr key={period.id}>
      {lead}
      <td className="sticky left-0 z-10 whitespace-nowrap border border-slate-200 bg-slate-50 px-2 py-2 text-left text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
        {periodLabel(period.start)}–{periodLabel(period.end)}
      </td>
      {columnGroups.map((group) =>
        MASTER_DAYS.map((day) => {
          const placed = placeAt(group.courses, day.key, period, slotDefs)
          const course = placed?.course || null
          return (
            <CourseCell
              key={`${group.id}-${day.key}-${period.id}`}
              course={course}
              slotCode={placed?.slotCode}
              focused={isFocus(course)}
              showFaculty={!byFaculty}
              onFocus={setFocusCode}
            />
          )
        }),
      )}
    </tr>
  )

  // A whole teaching block: the day's period rows (with a LUNCH divider). The
  // block's first row carries the Start / End dates as rowspanning cells.
  const teachBlock = (phase) => {
    const dateCell = (value) => (
      <td
        rowSpan={PERIODS.length}
        className="border border-slate-200 bg-slate-50 px-2 text-center align-middle text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
      >
        {value}
      </td>
    )
    return (
      <Fragment key={phase.id}>
        {PERIODS.map((period, i) => {
          const lead =
            i === 0 ? (
              <>
                {dateCell(phase.start)}
                {dateCell(phase.end)}
              </>
            ) : null
          if (period.kind === 'lunch') {
            return (
              <tr key={period.id}>
                <td className="sticky left-0 z-10 border border-slate-200 bg-slate-100 px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-800/60">
                  Lunch
                </td>
                <td
                  colSpan={dayCols}
                  className="border border-slate-200 bg-slate-100 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-800/60"
                >
                  Lunch
                </td>
              </tr>
            )
          }
          return periodRow(period, lead)
        })}
      </Fragment>
    )
  }

  // An exam stretch — a single full-width band (MIDSEMS / ENDSEMS) with its own
  // Start / End dates, drawn in the amber the app uses for exam weeks.
  const examBand = (phase) => (
    <tr key={phase.id}>
      <td className="border border-slate-200 bg-amber-50 px-2 py-2 text-center text-xs font-semibold text-amber-800 dark:border-slate-800 dark:bg-amber-950/30 dark:text-amber-300">
        {phase.start}
      </td>
      <td className="border border-slate-200 bg-amber-50 px-2 py-2 text-center text-xs font-semibold text-amber-800 dark:border-slate-800 dark:bg-amber-950/30 dark:text-amber-300">
        {phase.end}
      </td>
      <td
        colSpan={dayCols + 1}
        className="border border-slate-200 bg-amber-50 py-2.5 text-center text-xs font-bold uppercase tracking-[0.2em] text-amber-800 dark:border-slate-800 dark:bg-amber-950/30 dark:text-amber-300"
      >
        {phase.label}
      </td>
    </tr>
  )

  const focusCourse = focusCode ? MASTER_COURSES[focusCode] : null

  return (
    <div className="flex h-screen flex-col bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Header — matches the slot-grid editor's chrome. */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Slot Allotment · Master Grid · Autumn 2026-27
            </div>
            <h1 className="text-xl font-bold">Aerospace Engineering — Institute Timetable</h1>
            {focusCourse && (
              <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Locating{' '}
                <span className="font-semibold text-slate-700 dark:text-slate-200">{focusCourse.code}</span> ·{' '}
                {focusCourse.title}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <History size={13} className="shrink-0" />
            Courses carried over from 2025-26
          </div>
        </div>

        {/* Controls — the batch/faculty pivot and its chips. By batch chooses which
            semester columns to show; By faculty turns the columns into professors,
            each showing their own weekly timetable. */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
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

          <div className="flex flex-wrap items-center gap-1.5">
            {byFaculty ? (
              <>
                <Chip label="All faculty" active={facultyTags.size === 0} onClick={() => setFacultyTags(new Set())} />
                {MASTER_FACULTY.map((f) => (
                  <Chip key={f} label={f} active={facultyTags.has(f)} onClick={() => toggleFaculty(f)} />
                ))}
              </>
            ) : (
              <>
                <Chip label="All" active={semTags.size === 0} onClick={() => setSemTags(new Set())} />
                {MASTER_SEMESTERS.map((s) => (
                  <Chip key={s.id} label={s.label} active={semTags.has(s.id)} onClick={() => toggleSem(s.id)} />
                ))}
              </>
            )}
          </div>
        </div>
      </header>

      {/* The grid. Horizontally scrollable, and vertically within its own pane so
          the bottom course tray stays pinned — the IDC grid layout. */}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto p-6">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="sticky left-0 top-0 z-20 border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Start
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                End
              </th>
              <th
                rowSpan={2}
                className="sticky top-0 z-10 border border-slate-300 bg-slate-100 px-2 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Time
              </th>
              {columnGroups.map((group) => (
                <th
                  key={group.id}
                  colSpan={MASTER_DAYS.length}
                  className="sticky top-0 z-10 border border-slate-300 bg-slate-200 px-2 py-1.5 text-center text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-100"
                >
                  {group.label}
                </th>
              ))}
            </tr>
            <tr>
              {columnGroups.map((group) =>
                MASTER_DAYS.map((day) => (
                  <th
                    key={`${group.id}-${day.key}`}
                    className="sticky top-9 z-10 min-w-[92px] border border-slate-300 bg-sky-50 px-1 py-1 text-center text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {day.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {columnGroups.length === 0 ? (
              <tr>
                <td colSpan={3} className="border border-slate-200 px-4 py-10 text-sm text-slate-400 dark:border-slate-800">
                  Nothing selected — pick a chip above.
                </td>
              </tr>
            ) : (
              MASTER_PHASES.map((phase) => (phase.kind === 'teach' ? teachBlock(phase) : examBand(phase)))
            )}
          </tbody>
        </table>
      </div>

      {/* Course tray — the courses still to be mapped out, styled like the IDC
          planner's tray. Click a card to locate the course in the grid. */}
      <div className="shrink-0 border-t border-slate-200 bg-slate-50/60 px-6 py-3 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <Layers size={12} /> Courses to map
          <span className="font-normal normal-case tracking-normal text-slate-400">
            · click a card to locate it in the grid
          </span>
        </div>
        <div className="thin-scroll flex gap-2 overflow-x-auto pb-1">
          {trayCourses.map((c) => {
            const picked = c.code === focusCode
            return (
              <button
                key={c.code}
                onClick={() => setFocusCode(c.code)}
                title={`${c.code} · ${c.title}`}
                className={`flex w-44 shrink-0 cursor-pointer select-none flex-col rounded-lg border px-3 py-2 text-left transition ${
                  picked
                    ? 'border-accent ring-2 ring-accent/40 dark:border-accent'
                    : 'border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                }`}
              >
                <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{c.short}</div>
                <div className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {courseTag(c)}
                </div>
                <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {c.faculty || 'Multiple offerings'}
                </div>
              </button>
            )
          })}
          {trayCourses.length === 0 && (
            <p className="px-2 py-3 text-xs text-slate-400">No courses in this view.</p>
          )}
        </div>
      </div>
    </div>
  )
}
