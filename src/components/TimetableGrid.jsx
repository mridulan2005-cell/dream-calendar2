import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/AppContext.jsx'
import { buildGrid, detectConflicts } from '../logic/timetable.js'

// "2025-07-28" → "28-07" for the Week / Start / End date columns.
const ddmm = (iso) => {
  const p = (iso || '').split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}` : ''
}

// Category background for placement-mode destination cells.
const CAT = {
  green: 'bg-green-50 ring-1 ring-green-400 dark:bg-green-950/30 dark:ring-green-700',
  amber: 'bg-amber-50 ring-1 ring-amber-400 dark:bg-amber-950/30 dark:ring-amber-700',
  red: 'bg-red-50 ring-1 ring-red-400 dark:bg-red-950/30 dark:ring-red-800',
  grey: 'bg-slate-100 dark:bg-slate-800/60',
}

const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th']

// A 1x1 transparent image used to suppress the browser's native drag ghost, so
// the only thing visible while dragging is our own low-opacity cell preview.
const TRANSPARENT_DRAG_IMG =
  typeof Image !== 'undefined'
    ? (() => {
        const img = new Image()
        img.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        return img
      })()
    : null

// --- Student-view column grouping ---------------------------------------------
// The "Student" view has ~18 cohort columns. Rather than a flat wall of headers,
// we group them under a two-tier header keyed on the PROGRAM. Every column stays
// visible (this is the department coordinator's master view — nothing collapses);
// the tiers only add structure for scanning.
//
//   program (tier 1): B.Des. | M.Des. | M.Des. (Research) | Ph.D. | Dual Degree
//   year    (tier 2): only M.Des. splits into "1st Year" / "2nd Year"
//   leaf    (row):    the actual grid column. For the year-based programs the
//                     leaf shows BOTH the year and the Autumn semester it maps to
//                     (year N -> odd semester 2N-1); for M.Des. the leaf is the
//                     discipline (ID / CD / IxD / AN / MVD).
// Two-tier header: a PROGRAM group (tier 1) over a per-column LEAF (tier 2).
//   B.Des.            -> 1st..4th year + Dual Degree (9th sem)
//   M.Des. 1st Year   -> ID / CD / IxD / AN / MVD   (its own group)
//   M.Des. 2nd Year   -> ID / CD / IxD / AN / MVD   (a separate group)
//   M.Des. (Research) -> 1st year / 2nd year
//   Ph.D.             -> Ph.D.
function parseCohort(col) {
  let m = col.match(/^BDes (\d)$/)
  if (m) {
    const y = Number(m[1])
    return { group: 'B.Des.', leaf: `${ORD[y]} year`, sub: `Sem ${2 * y - 1}` }
  }
  if (col === 'Dual Degree') return { group: 'B.Des.', leaf: 'Dual Degree', sub: 'Sem 9' }
  m = col.match(/^MDes (\d): (.+)$/)
  if (m) return { group: `M.Des. ${ORD[Number(m[1])]} Year`, leaf: m[2], sub: null }
  m = col.match(/^MDesR (\d)$/)
  if (m) {
    const y = Number(m[1])
    return { group: 'M.Des. (Research)', leaf: `${ORD[y]} year`, sub: `Sem ${2 * y - 1}` }
  }
  if (col === 'Ph.D.') return { group: 'Ph.D.', leaf: 'Ph.D.', sub: null }
  return { group: col, leaf: col, sub: null }
}

// Build the two-row header model from the ordered, already-filtered column list.
// Columns of one program are contiguous (see the `cohorts` order in seed.js), so
// consecutive runs give the tier-1 colSpans directly.
function buildHeader(columns) {
  const byCol = new Map(columns.map((col) => [col, parseCohort(col)]))
  const programs = []
  for (const col of columns) {
    const p = byCol.get(col)
    const last = programs[programs.length - 1]
    if (last && last.group === p.group) last.span++
    else programs.push({ group: p.group, span: 1, startCol: col })
  }
  const groupStart = new Set(programs.map((g) => g.startCol))
  return { byCol, programs, groupStart }
}

// The slot x column grid. `view` pivots columns (cohort / faculty / venue).
// Same-course cells are merged into one block: vertically across consecutive
// weeks, and horizontally across the cohort columns that share a course (so a
// seminar taught to several cohorts is one wide block, not many parallel ones).
// Conflicts are red; a change-request target is ringed amber. In `placement`
// mode every cell is kept individual (each is its own colour-coded drop target).
export default function TimetableGrid({
  view,
  onCellClick,
  highlightCourseId,
  placement,
  disputedIds,
  onMoveCourses,
  previewCourse,
  trayDragCourseId,
  onTrayDrop,
  // Published, view-only timetables render every course block uniformly — the
  // red clash highlight belongs only to the live draft being built. When set,
  // conflict styling is suppressed so the grid reads as one calm, settled plan.
  hideConflicts = false,
}) {
  const { courses: committed, conflicts: committedConflicts } = useApp()
  const disputed = disputedIds || new Set()
  // While a course is being edited in the detail panel, mirror its draft onto
  // the grid (and re-run conflict detection) so edits show live before saving.
  const courses = previewCourse
    ? committed.map((c) => (c.id === previewCourse.id ? previewCourse : c))
    : committed
  const conflicts = previewCourse ? detectConflicts(courses) : committedConflicts
  const { rows, columns, cell } = buildGrid(courses, view)
  const containerRef = useRef(null)
  const active = placement?.active

  // Grouped program/year header is meaningful only for the cohort ("student")
  // view; faculty/venue columns are flat names and keep the plain single row.
  const grouped = view === 'student'
  const header = grouped ? buildHeader(columns) : null

  // Direct drag-drop (normal mode): drag a course to another slot in the same
  // column. The whole course moves as one block (never split); dropping onto a
  // slot held by another course swaps the two courses' positions.
  const [dragInfo, setDragInfo] = useState(null) // { courseId, column, grabSlot, code }
  const [overKey, setOverKey] = useState(null) // `${col}@${slot}` being dragged over
  const dndEnabled = !active && !!onMoveCourses
  const order = rows.map((r) => r.id)

  // A course dragged in from the bottom tray (DraftTimetable). It may only land
  // in a column it belongs to — its cohort (or, in faculty view, a teacher).
  const trayCourse =
    trayDragCourseId && !active ? courses.find((c) => c.id === trayDragCourseId) : null
  const matchCol = (c, col) =>
    view === 'faculty' ? c.faculty.includes(col) : view === 'venue' ? c.venue === col : c.cohort === col

  // Shift every week of a course by `delta` rows; null if it would leave the grid.
  const shiftCourse = (course, delta) => {
    const idxs = course.slots.map((s) => order.indexOf(s) + delta)
    if (idxs.some((i) => i < 0 || i >= order.length)) return null
    return idxs.map((i) => order[i])
  }

  const handleDrop = (targetSlot, col) => {
    setOverKey(null)
    const info = dragInfo
    setDragInfo(null)
    if (!info || info.column !== col) return // same column only
    const a = courses.find((c) => c.id === info.courseId)
    if (!a) return
    // The grabbed week lands exactly on the drop week; the whole course moves
    // by the same delta (one block, never split).
    const delta = order.indexOf(targetSlot) - order.indexOf(info.grabSlot)
    if (delta === 0) return
    const aSlots = shiftCourse(a, delta)
    if (!aSlots) return
    // If another course sits on the drop week, swap them (it moves the other way).
    const b = (cell[targetSlot]?.[col] || []).find((c) => c.id !== a.id)
    if (b) {
      const bSlots = shiftCourse(b, -delta)
      if (!bSlots) return
      onMoveCourses([
        { course: a, slots: aSlots },
        { course: b, slots: bSlots },
      ])
    } else {
      onMoveCourses([{ course: a, slots: aSlots }])
    }
  }

  // Scroll the selected request's target into view (non-placement).
  useEffect(() => {
    if (active || !highlightCourseId || !containerRef.current) return
    const el = containerRef.current.querySelector('[data-hl="1"]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [highlightCourseId, view, active])

  // On entering placement mode, scroll the rank-1 destination into view.
  useEffect(() => {
    if (!active || !containerRef.current) return
    const el = containerRef.current.querySelector('[data-rank="1"]')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
  }, [active, placement?.course?.id])

  const subtitle = (course) => {
    if (view === 'student') return course.venue || '—'
    return course.cohort
  }

  if (columns.length === 0) {
    return (
      <p className="px-2 py-8 text-sm text-slate-400">
        Nothing to show in this view yet — allot slots first.
      </p>
    )
  }

  // --- 2-D merge plan. plan[`ri|ci`] = render spec; cells covered by a span are
  // added to `skip`. Merging is off in placement mode (per-cell drop targets).
  const skip = new Set()
  const plan = {}
  const K = (ri, ci) => `${ri}|${ci}`
  const cellList = (ri, ci) => cell[rows[ri].id]?.[columns[ci]] || []
  const sigOf = (ri, ci) => {
    const l = cellList(ri, ci)
    return l.length ? l.map((c) => c.id).sort().join('|') : null
  }
  const singleCode = (ri, ci) => {
    const l = cellList(ri, ci)
    return l.length === 1 ? l[0].code : l.length > 1 ? '__multi__' : null
  }

  // Pass 1 — horizontal: the same single course across cohort columns (empty
  // cohort cells in between are absorbed into the span).
  if (!active) {
    for (let ri = 0; ri < rows.length; ri++) {
      for (let ci = 0; ci < columns.length; ci++) {
        if (skip.has(K(ri, ci)) || plan[K(ri, ci)]) continue
        const code = singleCode(ri, ci)
        if (!code || code === '__multi__') continue
        let last = ci
        for (let cj = ci + 1; cj < columns.length; cj++) {
          const cc = singleCode(ri, cj)
          if (cc === code) last = cj
          else if (cc === null) continue
          else break
        }
        let count = 0
        for (let cj = ci; cj <= last; cj++) if (singleCode(ri, cj) === code) count++
        if (last > ci && count >= 2) {
          plan[K(ri, ci)] = { list: cellList(ri, ci), rowSpan: 1, colSpan: last - ci + 1, shared: true }
          for (let cj = ci + 1; cj <= last; cj++) skip.add(K(ri, cj))
        }
      }
    }
  }

  // Pass 2 — vertical: consecutive weeks holding the same course set (a single
  // multi-week course, or a fixed group of parallel electives) + normal cells.
  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci]
    const mergingDisabled = active && col === placement.column
    let ri = 0
    while (ri < rows.length) {
      const k = K(ri, ci)
      if (skip.has(k) || plan[k]) {
        ri++
        continue
      }
      const list = cellList(ri, ci)
      const s = sigOf(ri, ci)
      if (!active && !mergingDisabled && s) {
        let rj = ri
        while (rj + 1 < rows.length && !skip.has(K(rj + 1, ci)) && !plan[K(rj + 1, ci)] && sigOf(rj + 1, ci) === s)
          rj++
        plan[k] = {
          list,
          rowSpan: rj - ri + 1,
          colSpan: 1,
          spanLabel: rj > ri ? `${rows[ri].label}–${rows[rj].label}` : null,
        }
        for (let rk = ri + 1; rk <= rj; rk++) skip.add(K(rk, ci))
        ri = rj + 1
      } else {
        plan[k] = { list, rowSpan: 1, colSpan: 1, spanLabel: null }
        ri++
      }
    }
  }

  return (
    <div ref={containerRef} className="thin-scroll h-full overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          {grouped ? (
            <>
              {/* Tier 1: program groups (uniform height row) */}
              <tr>
                <th
                  rowSpan={2}
                  className="sticky left-0 top-0 z-30 w-12 min-w-[3rem] border border-slate-200 bg-white px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  Week
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[3rem] top-0 z-30 w-14 min-w-[3.5rem] border border-slate-200 bg-white px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  Start
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[6.5rem] top-0 z-30 w-14 min-w-[3.5rem] border border-slate-200 bg-white px-2 text-left align-middle font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-950"
                >
                  End
                </th>
                {header.programs.map((g) => (
                  <th
                    key={g.startCol}
                    colSpan={g.span}
                    className="sticky top-0 z-20 h-9 border border-slate-200 bg-white px-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                  >
                    {g.group}
                  </th>
                ))}
              </tr>
              {/* Tier 2: per-column leaf (uniform height row) */}
              <tr>
                {columns.map((col) => {
                  const leaf = header.byCol.get(col)
                  const groupStart = header.groupStart.has(col)
                  return (
                    <th
                      key={col}
                      className={`sticky top-9 z-20 h-12 min-w-[120px] border border-slate-200 px-2 text-center align-middle font-medium transition-colors dark:border-slate-800 ${
                        groupStart ? 'border-l-slate-300 dark:border-l-slate-600' : ''
                      } ${
                        dragInfo && dragInfo.column === col
                          ? 'bg-accent-soft font-semibold text-accent dark:bg-accent/20'
                          : 'bg-white dark:bg-slate-950'
                      } ${
                        active && col === placement.column
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      } ${dragInfo && dragInfo.column !== col ? 'opacity-40' : ''}`}
                    >
                      <div>{leaf.leaf}</div>
                      {leaf.sub && <div className="text-[9px] font-normal text-slate-400">{leaf.sub}</div>}
                      {active && col === placement.column && (
                        <div className="text-[10px] font-normal text-accent">• moving</div>
                      )}
                    </th>
                  )
                })}
              </tr>
            </>
          ) : (
            <tr>
              <th className="sticky left-0 top-0 z-30 h-12 w-12 min-w-[3rem] border border-slate-200 bg-white px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                Week
              </th>
              <th className="sticky left-[3rem] top-0 z-30 h-12 w-14 min-w-[3.5rem] border border-slate-200 bg-white px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                Start
              </th>
              <th className="sticky left-[6.5rem] top-0 z-30 h-12 w-14 min-w-[3.5rem] border border-slate-200 bg-white px-2 text-left font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                End
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className={`sticky top-0 z-20 h-12 min-w-[120px] border border-slate-200 px-2 text-left font-medium transition-colors dark:border-slate-800 ${
                    dragInfo && dragInfo.column === col
                      ? 'bg-accent-soft font-semibold text-accent dark:bg-accent/20'
                      : 'bg-white dark:bg-slate-950'
                  } ${
                    active && col === placement.column
                      ? 'text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  } ${dragInfo && dragInfo.column !== col ? 'opacity-40' : ''}`}
                >
                  {col}
                  {active && col === placement.column && (
                    <span className="ml-1 text-[10px] font-normal text-accent">• moving</span>
                  )}
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {rows.map((slot, ri) => (
            <tr key={slot.id}>
              <td className="sticky left-0 z-10 h-16 w-12 min-w-[3rem] border border-slate-200 bg-white px-2 py-3 align-top font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                {slot.label}
              </td>
              <td className="sticky left-[3rem] z-10 h-16 w-14 min-w-[3.5rem] whitespace-nowrap border border-slate-200 bg-white px-2 py-3 align-top text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                {ddmm(slot.dateRange.start)}
              </td>
              <td className="sticky left-[6.5rem] z-10 h-16 w-14 min-w-[3.5rem] whitespace-nowrap border border-slate-200 bg-white px-2 py-3 align-top text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950">
                {ddmm(slot.dateRange.end)}
              </td>
              {columns.map((col, ci) => {
                const k = K(ri, ci)
                if (skip.has(k)) return null
                const entry = plan[k]
                const list = entry.list
                const merged = entry.rowSpan > 1 || entry.colSpan > 1
                const isDestCol = active && col === placement.column
                const evalResult = isDestCol ? placement.destinations[slot.id] : null

                const overKeyThis = `${col}@${slot.id}`
                const dnd = dndEnabled
                  ? {
                      enabled: true,
                      isOver: overKey === overKeyThis,
                      valid: dragInfo && dragInfo.column === col,
                      onOver: () => setOverKey(overKeyThis),
                      onLeave: () => setOverKey((kk) => (kk === overKeyThis ? null : kk)),
                      onDrop: () => handleDrop(slot.id, col),
                    }
                  : null
                // Tray drop: an unmapped course can land on an empty cell of a
                // column it belongs to.
                const tray =
                  trayCourse && onTrayDrop && matchCol(trayCourse, col) && list.length === 0
                    ? {
                        isOver: overKey === overKeyThis,
                        onOver: () => setOverKey(overKeyThis),
                        onLeave: () => setOverKey((kk) => (kk === overKeyThis ? null : kk)),
                        onDrop: () => {
                          setOverKey(null)
                          onTrayDrop(trayCourse.id, slot.id)
                        },
                      }
                    : null
                const dimmed = dragInfo && dragInfo.column !== col
                const highlightCol = dragInfo && dragInfo.column === col

                return (
                  <PlacementCell
                    key={col}
                    rowSpan={entry.rowSpan}
                    colSpan={entry.colSpan}
                    isDestCol={isDestCol}
                    evalResult={evalResult}
                    placement={placement}
                    slotId={slot.id}
                    active={active}
                    dnd={dnd}
                    tray={tray}
                    dimmed={dimmed}
                    highlightCol={highlightCol}
                  >
                    <div
                      className={`flex flex-col gap-1 ${
                        active ? 'h-full' : 'absolute inset-0 p-1'
                      }`}
                    >
                      {/* Placement-mode ghost preview chip */}
                      {isDestCol && placement.ghostSlot === slot.id && (
                        <div className="rounded-md border border-dashed border-accent bg-accent-soft/60 px-2 py-1.5 text-accent dark:bg-slate-800">
                          <div className="font-semibold">{placement.course.code}</div>
                          <div className="text-[10px] italic">preview</div>
                        </div>
                      )}

                      {/* Drag-drop preview: a low-opacity ghost of the dragged
                          course snapped to the hovered week (Google-Calendar style). */}
                      {dnd?.isOver && dnd.valid && dragInfo && (
                        <div className="pointer-events-none rounded-md border border-dashed border-accent/60 bg-accent-soft/50 px-2 py-1.5 opacity-60 dark:bg-slate-700/60">
                          <div className="font-semibold text-accent">{dragInfo.code}</div>
                        </div>
                      )}

                      {/* Parallel courses (same cohort + same weeks) collapse into
                          ONE stacked block; clicking it opens the detail drawer
                          with the courses as tabs. A lone course fills the cell as
                          before. Placement mode keeps per-course lanes so the drag
                          origin stays individually addressable. */}
                      {!active && list.length > 1 ? (
                        (() => {
                          const anyDisputed = list.some((c) => disputed.has(c.id))
                          const anyClash =
                            !hideConflicts &&
                            list.some((c) => conflicts.conflictCells.has(`${c.id}@${slot.id}`))
                          const groupHl = list.some((c) => c.id === highlightCourseId)
                          return (
                            <button
                              data-hl={groupHl ? '1' : undefined}
                              onClick={() => onCellClick(list[0], list)}
                              className={`relative flex h-full w-full flex-col overflow-hidden rounded-md text-left transition ${
                                anyClash
                                  ? 'bg-red-100 hover:bg-red-200 dark:bg-red-950/40'
                                  : 'bg-slate-100 hover:bg-accent-soft dark:bg-slate-800 dark:hover:bg-slate-700'
                              } ${
                                groupHl
                                  ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-950'
                                  : anyClash
                                    ? 'ring-1 ring-red-400 dark:ring-red-700'
                                    : ''
                              }`}
                            >
                              {anyDisputed && (
                                <span
                                  title="Has a change request"
                                  className="absolute right-1.5 top-1.5 z-10 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-800"
                                />
                              )}
                              <div className="thin-scroll flex-1 divide-y divide-slate-200/80 overflow-y-auto dark:divide-slate-700/60">
                                {list.map((course) => (
                                  <div key={course.id} className="flex items-baseline gap-1.5 px-2 py-1.5">
                                    <span className="shrink-0 font-semibold text-slate-800 dark:text-slate-100">
                                      {course.code}
                                    </span>
                                    <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                      {subtitle(course)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              {merged && entry.spanLabel && (
                                <div className="shrink-0 px-2 py-0.5 text-[9px] font-medium text-accent">
                                  {entry.spanLabel}
                                </div>
                              )}
                            </button>
                          )
                        })()
                      ) : (
                      <div className={`flex-1 ${active && list.length > 1 ? 'flex w-max gap-1' : 'space-y-1'}`}>
                        {list.map((course) => {
                          const clash =
                            !hideConflicts && conflicts.conflictCells.has(`${course.id}@${slot.id}`)
                          const highlighted = course.id === highlightCourseId
                          const isOrigin =
                            active && course.id === placement.course.id && slot.id === placement.fromSlot
                          const canDrag = isOrigin || (dndEnabled && entry.colSpan === 1)

                          return (
                            <button
                              key={course.id}
                              data-hl={highlighted ? '1' : undefined}
                              draggable={canDrag}
                              onDragStart={(e) => {
                                if (isOrigin) {
                                  e.dataTransfer.setData('text', course.id)
                                  return
                                }
                                if (dndEnabled && entry.colSpan === 1) {
                                  e.dataTransfer.effectAllowed = 'move'
                                  e.dataTransfer.setData('text', course.id)
                                  if (TRANSPARENT_DRAG_IMG)
                                    e.dataTransfer.setDragImage(TRANSPARENT_DRAG_IMG, 0, 0)
                                  setDragInfo({
                                    courseId: course.id,
                                    column: col,
                                    grabSlot: slot.id,
                                    code: course.code,
                                  })
                                }
                              }}
                              onDragEnd={() => {
                                setDragInfo(null)
                                setOverKey(null)
                              }}
                              onClick={() => !active && onCellClick(course)}
                              className={`relative flex h-full w-full flex-col justify-start overflow-hidden rounded-md px-2 py-1.5 text-left transition ${
                                list.length > 1 ? 'min-w-[84px] flex-1 basis-0' : ''
                              } ${
                                canDrag ? 'cursor-grab active:cursor-grabbing' : ''
                              } ${
                                clash
                                  ? 'bg-red-100 hover:bg-red-200 dark:bg-red-950/40'
                                  : 'bg-slate-100 hover:bg-accent-soft dark:bg-slate-800 dark:hover:bg-slate-700'
                              } ${
                                isOrigin
                                  ? 'cursor-grab ring-2 ring-accent ring-offset-1 dark:ring-offset-slate-950'
                                  : highlighted
                                    ? 'ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-950'
                                    : clash
                                      ? 'ring-1 ring-red-400 dark:ring-red-700'
                                      : ''
                              } ${active && !isOrigin ? 'opacity-60' : ''} ${
                                dragInfo?.courseId === course.id ? 'opacity-30' : ''
                              }`}
                            >
                              {!active && disputed.has(course.id) && (
                                <span
                                  title="Has a change request"
                                  className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-800"
                                />
                              )}
                              <div className="truncate font-semibold text-slate-800 dark:text-slate-100">
                                {course.code}
                              </div>
                              <div className="truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                {subtitle(course)}
                              </div>
                              {entry.shared && (
                                <div className="mt-0.5 text-[9px] font-medium text-accent">
                                  shared across cohorts
                                </div>
                              )}
                              {course.faculty?.length > 0 && (
                                <div className="mt-0.5 truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">
                                  {course.faculty.join(', ')}
                                </div>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      )}
                    </div>
                  </PlacementCell>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// A grid cell. In placement mode it is a colour-coded placement drop target; in
// normal mode (via `dnd`) it is a drop target for direct course drag-drop.
function PlacementCell({
  rowSpan,
  colSpan,
  isDestCol,
  evalResult,
  placement,
  slotId,
  active,
  dnd,
  tray,
  dimmed,
  highlightCol,
  children,
}) {
  const cat = evalResult?.category
  const isCandidate = placement?.candidateSlot === slotId
  const isOriginSlot = placement?.fromSlot === slotId

  // Body cells keep their grid lines but no fill; only course blocks are filled.
  // `relative` lets the course block fill the cell via absolute positioning (a
  // percentage height won't resolve inside an auto-height table cell), so a block
  // covers its whole span — both weeks of a W1–W2 course, etc.
  const base = 'relative border border-slate-200 align-top transition-colors dark:border-slate-800'
  const placementBg = isDestCol && cat ? CAT[cat] : ''
  const colHighlight = highlightCol ? 'bg-accent-soft/70 dark:bg-accent/15' : ''
  const candidateRing = isCandidate ? 'outline outline-2 outline-accent' : ''
  const interactive = isDestCol && cat !== 'grey'
  const dndOver =
    (dnd?.isOver && dnd.valid) || tray?.isOver ? 'outline outline-2 outline-accent' : ''

  const handlers = interactive
    ? {
        onMouseEnter: () => placement.onHover(slotId),
        onClick: () => placement.onPick(slotId),
        onDragOver: (e) => {
          e.preventDefault()
          placement.onHover(slotId)
        },
        onDrop: (e) => {
          e.preventDefault()
          placement.onPick(slotId)
        },
      }
    : tray
      ? {
          onDragOver: (e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            tray.onOver()
          },
          onDragLeave: () => tray.onLeave(),
          onDrop: (e) => {
            e.preventDefault()
            tray.onDrop()
          },
        }
      : dnd?.enabled
      ? {
          onDragOver: (e) => {
            e.preventDefault()
            if (dnd.valid) {
              e.dataTransfer.dropEffect = 'move'
              dnd.onOver()
            } else {
              e.dataTransfer.dropEffect = 'none'
            }
          },
          onDragLeave: () => dnd.onLeave(),
          onDrop: (e) => {
            e.preventDefault()
            if (dnd.valid) dnd.onDrop()
          },
        }
      : {}

  return (
    <td
      rowSpan={rowSpan}
      colSpan={colSpan}
      className={`${base} ${placementBg} ${colHighlight} ${candidateRing} ${dndOver} ${dimmed ? 'opacity-40' : ''} ${interactive ? 'cursor-pointer' : ''} ${tray ? 'cursor-copy' : ''}`}
      {...handlers}
    >
      {/* Rank badge + rank-1 reason */}
      {isDestCol && evalResult?.rank && (
        <div className="mb-1 flex items-center gap-1" data-rank={evalResult.rank}>
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
            {evalResult.rank}
          </span>
          {evalResult.rank === 1 && (
            <span className="text-[9px] leading-tight text-green-700 dark:text-green-400">
              {evalResult.reason}
            </span>
          )}
        </div>
      )}
      {isOriginSlot && isDestCol && (
        <div className="mb-1 text-[9px] font-medium uppercase text-accent">origin</div>
      )}
      {children}
    </td>
  )
}
