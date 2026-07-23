import { useMemo } from 'react'
import { PenLine } from 'lucide-react'
import { buildAeroGrid, aeroPhaseById } from '../data/aeroTimetable.js'

// "2026-07-20" → "20-07" for the Week / Start / End date columns.
const ddmm = (iso) => {
  const p = (iso || '').split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}` : ''
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`
}

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th']
// Autumn runs the odd semesters, so a B.Tech year maps to semester 2N-1.
const ROMAN = ['', 'I', 'III', 'V', 'VII']

// --- Column grouping ----------------------------------------------------------
// The cohort ("Student") view groups its columns under a two-tier header, the
// same shape the IDC grid uses: a PROGRAM band over a per-column leaf. A B.Tech
// department is one programme, so the tiers read: "B.Tech." over "1st year /
// Semester I". Faculty and Venue columns are flat names and keep a single row.
function parseCohort(col) {
  const m = col.match(/^B\.Tech (\d)$/)
  if (m) {
    const y = Number(m[1])
    return { group: 'B.Tech.', leaf: `${ORD[y]} year`, sub: `Semester ${ROMAN[y]}` }
  }
  return { group: col, leaf: col, sub: null }
}

function buildHeader(columns) {
  const byCol = new Map(columns.map((col) => [col, parseCohort(col)]))
  const programs = []
  for (const col of columns) {
    const p = byCol.get(col)
    const last = programs[programs.length - 1]
    if (last && last.group === p.group) last.span++
    else programs.push({ group: p.group, span: 1, startCol: col })
  }
  return { byCol, programs, groupStart: new Set(programs.map((g) => g.startCol)) }
}

// --- Merge plans --------------------------------------------------------------
// Vertical merge, per column: consecutive TEACHING weeks holding the same set of
// courses collapse into one block. A B.Tech course sits at a fixed slot all term,
// so every week of a teaching phase carries an identical set — which is what turns
// each phase into the single tall block the department actually experiences,
// labelled with the week span it covers (W1–W7).
function buildCoursePlan(rows, columns, cell) {
  const skip = new Set()
  const plan = {}
  const K = (ri, ci) => `${ri}|${ci}`
  const sigOf = (ri, ci) => {
    const l = cell[rows[ri].id]?.[columns[ci]] || []
    return l.length ? l.map((c) => c.id).sort().join('|') : null
  }

  for (let ci = 0; ci < columns.length; ci++) {
    let ri = 0
    while (ri < rows.length) {
      if (rows[ri].kind !== 'teach') {
        ri++
        continue
      }
      const list = cell[rows[ri].id]?.[columns[ci]] || []
      const s = sigOf(ri, ci)
      if (!s) {
        plan[K(ri, ci)] = { list, rowSpan: 1, spanLabel: null }
        ri++
        continue
      }
      // Extend down while the next row is still teaching and identical. An exam
      // week breaks the run, so a phase never merges across the exam that ends it.
      let rj = ri
      while (rj + 1 < rows.length && rows[rj + 1].kind === 'teach' && sigOf(rj + 1, ci) === s) rj++
      plan[K(ri, ci)] = {
        list,
        rowSpan: rj - ri + 1,
        spanLabel: rj > ri ? `${rows[ri].label}–${rows[rj].label}` : null,
      }
      for (let rk = ri + 1; rk <= rj; rk++) skip.add(K(rk, ci))
      ri = rj + 1
    }
  }
  return { plan, skip }
}

// Exam weeks are a property of the CALENDAR, not of any one column, so they
// render as a single band across the full width. Consecutive weeks of the same
// exam phase merge into one band (end-sems are W22–W23, one block, not two).
function buildExamPlan(rows) {
  const plan = {}
  const skip = new Set()
  for (let ri = 0; ri < rows.length; ri++) {
    if (rows[ri].kind !== 'exam' || skip.has(ri)) continue
    let rj = ri
    while (rj + 1 < rows.length && rows[rj + 1].phaseId === rows[ri].phaseId) rj++
    plan[ri] = {
      rowSpan: rj - ri + 1,
      phase: aeroPhaseById[rows[ri].phaseId],
      from: rows[ri],
      to: rows[rj],
    }
    for (let rk = ri + 1; rk <= rj; rk++) skip.add(rk)
  }
  return { plan, skip }
}

// The published B.Tech semester timetable: weeks down the side, the chosen pivot
// across the top — the same grid the IDC planner uses, reading the same way. It
// is read-only (a B.Tech department's slots are set by the institute, not moved
// here), so there is no drag-drop, no placement mode and no clash styling; a
// course block is a link into its details.
export default function AeroSemesterGrid({ view, onCourseClick, selectedCourseId }) {
  const { rows, columns, cell } = useMemo(() => buildAeroGrid(view), [view])
  const { plan, skip } = useMemo(() => buildCoursePlan(rows, columns, cell), [rows, columns, cell])
  const exam = useMemo(() => buildExamPlan(rows), [rows])

  const grouped = view === 'student'
  const header = grouped ? buildHeader(columns) : null

  // What a course block's second line says — the room in the cohort view (where
  // the column already tells you the year), the year everywhere else.
  const subtitle = (course) =>
    view === 'student' ? course.venue || '—' : course.cohort

  if (columns.length === 0) {
    return <p className="px-2 py-8 text-sm text-slate-400">Nothing to show in this view.</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="thin-scroll min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            {grouped ? (
              <>
                {/* Tier 1: programme band */}
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-30 w-12 min-w-[3rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    Week
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[3rem] top-0 z-30 w-14 min-w-[3.5rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    Start
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[6.5rem] top-0 z-30 w-14 min-w-[3.5rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                  >
                    End
                  </th>
                  {header.programs.map((g) => (
                    <th
                      key={g.startCol}
                      colSpan={g.span}
                      className="sticky top-0 z-20 h-9 border border-slate-200 bg-[#F5F9F8] px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                    >
                      {g.group}
                    </th>
                  ))}
                </tr>
                {/* Tier 2: per-column leaf */}
                <tr>
                  {columns.map((col) => {
                    const leaf = header.byCol.get(col)
                    return (
                      <th
                        key={col}
                        className={`sticky top-9 z-20 h-12 min-w-[120px] border border-slate-200 bg-[#F5F9F8] px-2 text-center align-middle font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 ${
                          header.groupStart.has(col) ? 'border-l-slate-300 dark:border-l-slate-600' : ''
                        }`}
                      >
                        <div>{leaf.leaf}</div>
                        {leaf.sub && (
                          <div className="text-[9px] font-normal text-slate-400">{leaf.sub}</div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </>
            ) : (
              <tr>
                <th className="sticky left-0 top-0 z-30 h-12 w-12 min-w-[3rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  Week
                </th>
                <th className="sticky left-[3rem] top-0 z-30 h-12 w-14 min-w-[3.5rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  Start
                </th>
                <th className="sticky left-[6.5rem] top-0 z-30 h-12 w-14 min-w-[3.5rem] border border-slate-200 bg-[#F5F9F8] px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                  End
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="sticky top-0 z-20 h-12 min-w-[120px] border border-slate-200 bg-[#F5F9F8] px-2 text-left font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {rows.map((wk, ri) => {
              const isExam = wk.kind === 'exam'
              return (
                <tr key={wk.id}>
                  <td
                    className={`sticky left-0 z-10 h-16 w-12 min-w-[3rem] border border-slate-200 px-2 py-3 align-top font-semibold dark:border-slate-800 ${
                      isExam
                        ? 'bg-[#F5F9F8] text-amber-700 dark:bg-slate-950 dark:text-amber-400'
                        : 'bg-[#F5F9F8] text-slate-500 dark:bg-slate-950'
                    }`}
                  >
                    {wk.label}
                  </td>
                  <td className="sticky left-[3rem] z-10 h-16 w-14 min-w-[3.5rem] whitespace-nowrap border border-slate-200 bg-[#F5F9F8] px-2 py-3 align-top text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    {ddmm(wk.dateRange.start)}
                  </td>
                  <td className="sticky left-[6.5rem] z-10 h-16 w-14 min-w-[3.5rem] whitespace-nowrap border border-slate-200 bg-[#F5F9F8] px-2 py-3 align-top text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                    {ddmm(wk.dateRange.end)}
                  </td>

                  {isExam ? (
                    exam.skip.has(ri) ? null : (
                      <ExamBand
                        entry={exam.plan[ri]}
                        colSpan={columns.length}
                      />
                    )
                  ) : (
                    columns.map((col, ci) => {
                      const k = `${ri}|${ci}`
                      if (skip.has(k)) return null
                      const entry = plan[k]
                      if (!entry || entry.list.length === 0) {
                        return (
                          <td
                            key={col}
                            className="border border-slate-200 bg-white align-top dark:border-slate-800 dark:bg-slate-950"
                          />
                        )
                      }
                      return (
                        <td
                          key={col}
                          rowSpan={entry.rowSpan}
                          className="relative border border-slate-200 align-top dark:border-slate-800"
                        >
                          <PhaseBlock
                            entry={entry}
                            subtitle={subtitle}
                            selectedCourseId={selectedCourseId}
                            onCourseClick={onCourseClick}
                          />
                        </td>
                      )
                    })
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Legend />
    </div>
  )
}

// One teaching phase for one column: every course the year runs, from the start
// of the block to the exam that closes it. Absolute positioning lets the block
// fill its whole rowSpan (a percentage height won't resolve in an auto-height
// table cell), so W1–W7 reads as one continuous stretch.
function PhaseBlock({ entry, subtitle, selectedCourseId, onCourseClick }) {
  const holdsSelection = entry.list.some((c) => c.id === selectedCourseId)
  return (
    <div className="absolute inset-0 p-1">
      <div
        className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-[#E1E8EF] transition dark:bg-slate-800 ${
          holdsSelection ? 'ring-2 ring-accent ring-offset-1 dark:ring-offset-slate-950' : ''
        }`}
      >
        <div className="thin-scroll flex-1 divide-y divide-slate-200/80 overflow-y-auto dark:divide-slate-700/60">
          {entry.list.map((course) => {
            const isSelected = course.id === selectedCourseId
            return (
              <button
                key={course.id}
                data-hl={isSelected ? '1' : undefined}
                onClick={() => onCourseClick?.(course, entry.list)}
                title={`${course.code} · ${course.title} · ${course.slots.join(', ')}`}
                className={`flex w-full items-baseline gap-1.5 px-2 py-1.5 text-left transition hover:bg-accent-soft dark:hover:bg-slate-700 ${
                  isSelected ? 'bg-accent-soft dark:bg-slate-700' : ''
                }`}
              >
                <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-100">
                  {course.code}
                </span>
                <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                  {subtitle(course)}
                </span>
              </button>
            )
          })}
        </div>
        {entry.spanLabel && (
          <div className="shrink-0 px-2 py-0.5 text-[9px] font-medium text-accent">
            {entry.spanLabel}
          </div>
        )}
      </div>
    </div>
  )
}

// A mid-sem / end-sem band across the whole width — no teaching happens in any
// column, so it reads as a break in the term rather than as a row of empty cells.
// The band can be far wider than the viewport, so its label sticks just past the
// frozen week columns and stays legible however far the grid is scrolled across.
function ExamBand({ entry, colSpan }) {
  const { phase, from, to, rowSpan } = entry
  const span = from.week === to.week ? from.label : `${from.label}–${to.label}`
  const dates = `${fmtDay(from.dateRange.start)} – ${fmtDay(to.dateRange.end)}`
  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className="exam-band border border-slate-200 p-0 align-middle dark:border-slate-800"
    >
      <div className="sticky left-[10rem] flex w-max min-h-[3rem] items-center gap-2.5 px-4 py-2">
        <PenLine size={14} className="shrink-0 text-amber-700 dark:text-amber-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
          {phase.label}
        </span>
        <span className="text-[11px] text-amber-700/70 dark:text-amber-400/70">
          {span} · {dates} · no classes
        </span>
      </div>
    </td>
  )
}

function Legend() {
  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-4 text-[11px] text-slate-400">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-[#E1E8EF] dark:bg-slate-800" />
        Courses running through the block
      </span>
      <span className="flex items-center gap-1.5">
        <span className="exam-band h-3 w-3 rounded border border-slate-200 dark:border-slate-700" />
        Examination week — no classes
      </span>
      <span className="flex items-center gap-1.5">
        <span className="font-medium text-accent">W1–W7</span>
        the weeks a block spans
      </span>
    </div>
  )
}
