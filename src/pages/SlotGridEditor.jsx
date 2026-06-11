import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  Plus,
  Lock,
  X,
  Ban,
  Layers,
  Check,
  MapPin,
  MoreVertical,
  Link2,
  Pencil,
  Trash2,
  ArrowLeftRight,
  AlertTriangle,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { slots as allSlots, slotLabel, TERM, cohorts } from '../data/seed.js'
import { isProtected, isExamWeek, examWeekLabel } from '../data/rules.js'

const slotOrder = (id) => allSlots.findIndex((s) => s.id === id)
const joinWeeks = (ids) => ids.map(slotLabel).join(', ')
// "2025-07-28" → "28-07" for the grid's Start / End date columns.
const ddmm = (iso) => {
  const p = (iso || '').split('-')
  return p.length === 3 ? `${p[2]}-${p[1]}` : ''
}

// Confirmation shown when 2+ courses would share one week for a batch — either
// because a multi-selection was dropped onto a week, or a course was placed onto
// a week another already holds. The coordinator confirms they genuinely run in
// parallel; if an existing course spans more weeks, the picks can extend across
// its whole run in one step.
function ParallelModal({ slotId, cohort, placing, existing, onConfirm, onExchange, onCancel }) {
  const [applyAll, setApplyAll] = useState(true)

  // An existing occupant whose other weeks the picks can extend across.
  const ref = existing[0]
  const otherWeeks = ref ? ref.slots.filter((s) => s !== slotId && !isProtected(s)) : []
  const canApplyAll = otherWeeks.length > 0
  const existingNames = existing.map((c) => c.code).join(', ')
  const placingNames = placing.map((c) => c.code).join(', ')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parallel-title"
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <Layers size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="parallel-title" className="text-base font-semibold text-slate-900 dark:text-white">
              {slotLabel(slotId)} is already taken
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <b className="text-slate-700 dark:text-slate-200">{existingNames}</b>{' '}
              {existing.length > 1 ? 'run' : 'runs'} in {slotLabel(slotId)} for {cohort}. What should{' '}
              <b className="text-slate-700 dark:text-slate-200">{placingNames}</b> do?
            </p>
          </div>
        </div>

        {/* Two choices: share the week (parallel) or swap weeks (exchange). */}
        <div className="mt-5 space-y-2.5 px-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => onConfirm({ applyAll: applyAll && canApplyAll })}
              className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
            >
              <Layers size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Run in parallel
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Both meet at the same time — different students in each.
                </p>
              </div>
            </button>
            {canApplyAll && (
              <label className="mx-4 mb-3 flex cursor-pointer items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    applyAll ? 'border-accent bg-accent text-white' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {applyAll && <Check size={12} />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={applyAll}
                  onChange={(e) => setApplyAll(e.target.checked)}
                />
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  Also across {ref?.code}'s other weeks ({joinWeeks(otherWeeks)})
                </span>
              </label>
            )}
          </div>

          <button
            onClick={onExchange}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-accent hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
          >
            <ArrowLeftRight size={18} className="mt-0.5 shrink-0 text-slate-500" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Exchange places</div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Swap weeks — {placingNames} takes {slotLabel(slotId)}, {existingNames} moves out.
              </p>
            </div>
          </button>
        </div>

        <div className="mt-5 flex justify-end border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// A grey course block, styled like the main timetable cells (code / batch /
// faculty). The course currently being allotted carries a slight yellow border.
//
// `merge` tells the block which of its four edges touch a sibling cell that
// belongs to the SAME visual block (same course down consecutive weeks, or the
// same course across adjacent batches of identical duration). On those edges we
// straighten the corners and drop the seam so the cells read as one continuous
// block; everywhere else we keep the rounded, free-standing look. The
// straightening is transitioned, so blocks fuse/split with a smooth
// microinteraction as weeks are toggled. Only the block's top-left origin cell
// carries the label — continuation cells render as bare fill.
// Block background by selection state — a sky wash that reads distinctly from
// the amber "active/focus" outline. A whole-block selection tints every member
// cell the same, so a fused block highlights as one continuous shape.
const SEL_BG = {
  none: 'bg-slate-100 dark:bg-slate-800',
  group: 'bg-sky-50 dark:bg-sky-950/40',
  whole: 'bg-sky-100 dark:bg-sky-900/40',
  hover: 'bg-sky-200 dark:bg-sky-800/50',
  nested: 'bg-sky-200 dark:bg-sky-800/60',
}

function CourseBlock({
  course,
  selected,
  onClick,
  onMouseEnter,
  onMouseLeave,
  title,
  merge = {},
  showLabel = true,
  selState = 'none',
  draggable = false,
  onDragStart,
  onDragEnd,
  dragging = false,
}) {
  const radius = [
    !merge.top && !merge.left ? 'rounded-tl-md' : '',
    !merge.top && !merge.right ? 'rounded-tr-md' : '',
    !merge.bottom && !merge.left ? 'rounded-bl-md' : '',
    !merge.bottom && !merge.right ? 'rounded-br-md' : '',
  ].join(' ')
  // A selected block carries a yellow outline that hugs the block's outer
  // boundary. Vertical seams open up; horizontal seams stay closed.
  const border = selected
    ? `border-l-yellow-400 border-r-yellow-400 ${merge.top ? 'border-t-transparent' : 'border-t-yellow-400'} ${
        merge.bottom ? 'border-b-transparent' : 'border-b-yellow-400'
      } dark:border-yellow-400`
    : 'border-transparent'
  const cls = `flex h-full w-full flex-col justify-center border-2 px-2 py-1.5 text-left transition-all duration-300 ease-out ${SEL_BG[selState]} ${radius} ${border}`
  // The cell sits under its batch column, so the block shows what isn't already
  // obvious: the course code, who teaches it, and — once allotted — the venue.
  const body = showLabel ? (
    <>
      <div className="flex items-center gap-1 truncate font-semibold text-slate-800 dark:text-slate-100">
        {course.code}
        {course.locked && <Lock size={9} className="shrink-0 text-slate-400" />}
      </div>
      {course.faculty?.length > 0 && (
        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
          {course.faculty.join(', ')}
        </div>
      )}
      {course.venue && (
        <div className="flex items-center gap-0.5 truncate text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <MapPin size={9} className="shrink-0" />
          {course.venue}
        </div>
      )}
    </>
  ) : null
  if (onClick) {
    const hover = selState === 'none' ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : ''
    return (
      <button
        onClick={onClick}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={title}
        className={`group ${cls} ${hover} ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} ${
          dragging ? 'opacity-40' : ''
        }`}
      >
        {body}
      </button>
    )
  }
  return <div className={cls}>{body}</div>
}

// Direct-manipulation week grid. Opens in its OWN browser tab (launched from a
// slot-allotment card) and stays lock-step with the planner via the store's
// BroadcastChannel — including which course is selected, so switching the course
// in the planner switches the one you allot here. Rows are the teaching weeks
// (W1…W15); columns are batches (default: the course's batch, "Add batch" to
// bring in more for reference). A week holds only ONE course per batch.
export default function SlotGridEditor() {
  const [params] = useSearchParams()
  const cohort = params.get('cohort') || ''
  const focusId = params.get('focus') || ''
  const { courses, updateCourses, selectedCourseId, selectedCourseIds, setSelectedCourse, setSelectedCourses, activeStep } =
    useApp()
  // A pending parallel-placement awaiting confirmation: { slotId, existing }.
  const [pending, setPending] = useState(null)
  // Weeks are editable only while the planner list is on the Slot step. On other
  // steps (e.g. Venue) the grid is read-only and a click just selects the course.
  const inSlotStep = activeStep === 'slot'
  // Two-level block selection: the first click selects the WHOLE fused block; a
  // repeat click on one of its nested courses (a parallel option, or another
  // batch in a merged block) drills down to that one. Clicking empty space clears
  // it. `sel` = { key, members, nested }, `hoverNested` previews a nested course.
  const [sel, setSel] = useState(null)
  const [hoverNested, setHoverNested] = useState(null)
  // Drag-to-swap: `drag` is the block being dragged ({ courseId, slotId }),
  // `dragOver` the cell key currently hovered as a drop target.
  const [drag, setDrag] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  // A course being dragged in from the bottom course tray onto the grid.
  const [trayDrag, setTrayDrag] = useState(null)
  // Faculty-clash notifications the coordinator has dismissed (by pair+slot key).
  const [dismissedClashes, setDismissedClashes] = useState(() => new Set())
  // Resizing a block by its top/bottom edge. `resize.slots` is the live preview;
  // it commits to the store on mouse-up. Refs let the document listeners read the
  // latest values without re-subscribing.
  const [resize, setResize] = useState(null) // { courseId, edge, slots }
  const resizeRef = useRef(null)
  const coursesRef = useRef(courses)
  resizeRef.current = resize
  coursesRef.current = courses
  useEffect(() => {
    const onUp = () => {
      const r = resizeRef.current
      if (!r) return
      const cs = coursesRef.current
      const course = cs.find((c) => c.id === r.courseId)
      const same =
        course &&
        course.slots.length === r.slots.length &&
        course.slots.every((s) => r.slots.includes(s))
      if (course && r.slots.length && !same) {
        const partners = (course.parallel || []).map((id) => cs.find((c) => c.id === id)).filter(Boolean)
        const still = partners.filter((p) => p.slots.some((sl) => r.slots.includes(sl)))
        const dropped = partners.filter((p) => !still.includes(p))
        // Linked joint-session partners move with the resize.
        const linkedUpdates = (course.linked || [])
          .map((id) => cs.find((c) => c.id === id))
          .filter((p) => p && !(p.slots.length === r.slots.length && p.slots.every((s) => r.slots.includes(s))))
          .map((p) => ({ ...p, slots: [...r.slots], durationWeeks: r.slots.length }))
        updateCourses([
          {
            ...course,
            slots: r.slots,
            durationWeeks: r.slots.length,
            parallel: still.map((p) => p.id),
            slotSystem: 'M',
          },
          ...dropped.map((p) => ({ ...p, parallel: (p.parallel || []).filter((id) => id !== course.id) })),
          ...linkedUpdates,
        ])
      }
      setResize(null)
    }
    document.addEventListener('mouseup', onUp)
    return () => document.removeEventListener('mouseup', onUp)
  }, [updateCourses])
  // Column dimension: batches (cohorts) or faculty. Faculty view groups every
  // course under the faculty teaching it, so you see each person's week as you
  // allot. Parallel/clash semantics stay batch-based (it's about students).
  const [view, setView] = useState('batch')

  // The active course follows the planner's selection, falling back to the URL.
  const activeId = selectedCourseId || focusId
  const focus = courses.find((c) => c.id === activeId) || null
  const cap = focus ? focus.durationWeeks || focus.slots.length || 1 : 0
  // Column model. `matchCol` decides if a course belongs in a column; `isFocusCol`
  // marks the focus course's own column(s); `colsUniverse` is the "Add" menu pool.
  // Batch view keys on cohort, faculty on each teacher, venue on the room.
  const facultyList = [...new Set(courses.flatMap((c) => c.faculty))].sort()
  const venueList = [...new Set(courses.map((c) => c.venue).filter(Boolean))].sort()
  // The Venue lens appears once venue allotment is under way.
  const venueReady = activeStep === 'venue' || venueList.length > 0
  const matchCol = (c, col) =>
    view === 'faculty' ? c.faculty.includes(col) : view === 'venue' ? c.venue === col : c.cohort === col
  const isFocusCol = (col) =>
    !!focus &&
    (view === 'faculty'
      ? focus.faculty.includes(col)
      : view === 'venue'
        ? !!focus.venue && focus.venue === col
        : col === focus.cohort)
  const focusCols = focus
    ? view === 'faculty'
      ? focus.faculty
      : view === 'venue'
        ? venueList // the venue lens shows the whole room timetable
        : [focus.cohort]
    : []


  // Every course the user picked in the list that belongs to this grid's batch —
  // these are the courses a week-click places (just the focus when none picked).
  const placing =
    focus &&
    (selectedCourseIds.length
      ? courses.filter((c) => selectedCourseIds.includes(c.id) && c.cohort === focus.cohort)
      : [])
  const toPlaceCourses = focus ? (placing && placing.length ? placing : [focus]) : []
  // The grid is System M only. A course slotted under any other system can't be
  // placed here; a course with no system yet becomes M as soon as it's placed.
  const focusIsM = focus ? !focus.slotSystem || focus.slotSystem === 'M' : false

  // Align the shared selection to this grid's course on first open.
  useEffect(() => {
    if (!selectedCourseId && focusId) setSelectedCourse(focusId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Mirror a remote deselect (e.g. clicking empty in the list window): drop the
  // local block highlight when the shared selection clears.
  useEffect(() => {
    if (!selectedCourseId) {
      setSel(null)
      setHoverNested(null)
    }
  }, [selectedCourseId])

  const [cols, setCols] = useState(() => (cohort ? [cohort] : []))
  // The "Add batch" menu is rendered in a portal anchored to its button, so it
  // escapes the grid's horizontal-scroll container (which would otherwise clip
  // it). `menuPos` is the button's viewport rect, captured when it opens.
  const [addOpen, setAddOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const addBtnRef = useRef(null)
  const menuRef = useRef(null)
  const toggleAddMenu = () => {
    if (addOpen) return setAddOpen(false)
    const r = addBtnRef.current?.getBoundingClientRect()
    if (r) setMenuPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    setAddOpen(true)
  }
  useEffect(() => {
    if (!addOpen) return
    const onDoc = (e) => {
      if (addBtnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setAddOpen(false)
    }
    const close = () => setAddOpen(false)
    document.addEventListener('mousedown', onDoc)
    // Reposition isn't worth it — just close if the page scrolls or resizes.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [addOpen])

  // If the venue lens is no longer offered, fall back to batch.
  useEffect(() => {
    if (view === 'venue' && !venueReady) setView('batch')
  }, [venueReady, view])

  // Flipping the view resets the columns to that lens's defaults (the focus
  // course's cohort/faculty, or — for venue — the whole room timetable).
  useEffect(() => {
    if (focus) setCols(focusCols)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // Keep the active course's column(s) visible.
  useEffect(() => {
    if (!focus) return
    setCols((p) => {
      const add = focusCols.filter((n) => !p.includes(n))
      return add.length ? [...p, ...add] : p
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id])

  const addable = (
    view === 'faculty' ? facultyList : view === 'venue' ? venueList : cohorts
  ).filter((c) => !cols.includes(c))

  // While a block is being resized, mirror its previewed span onto the courses
  // the grid renders from — so it grows/shrinks live without committing yet.
  const previewCourses = resize
    ? courses.map((c) => (c.id === resize.courseId ? { ...c, slots: resize.slots } : c))
    : courses

  // Courses occupying a column in a week. A column is a batch or (faculty view) a
  // teacher, so a co-taught course appears under each of its faculty.
  const occupantsIn = (col, slotId) =>
    previewCourses.filter((c) => matchCol(c, col) && c.slots.includes(slotId))
  // Same-batch occupants — parallel/clash detection stays batch-based.
  const cohortOccupants = (cohort, slotId) =>
    courses.filter((c) => c.cohort === cohort && c.slots.includes(slotId))

  // Commit updates, mirroring each course's new weeks onto its LINKED partners —
  // a joint session (same faculty across batches) moves as one block.
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))
  const pushUpdates = (updates) => {
    const inBatch = new Set(updates.map((u) => u.id))
    const extra = []
    for (const u of updates) {
      if (!u.slots) continue
      for (const lid of u.linked || []) {
        if (inBatch.has(lid)) continue
        const p = courses.find((c) => c.id === lid)
        if (p && !sameSet(p.slots, u.slots)) {
          extra.push({ ...p, slots: [...u.slots], durationWeeks: u.slots.length })
          inBatch.add(lid)
        }
      }
    }
    updateCourses([...updates, ...extra])
  }

  // --- Faculty clashes -----------------------------------------------------
  // Two courses of DIFFERENT batches taught by the same person in the same week
  // are a clash — unless they're already a linked joint session. Surfaced as a
  // bottom prompt offering to link them (after which they move together).
  const clashKey = (c) => `${[c.a.id, c.b.id].sort().join('|')}@${c.slot}`
  const facultyClashes = []
  for (let i = 0; i < courses.length; i++) {
    for (let j = i + 1; j < courses.length; j++) {
      const a = courses[i]
      const b = courses[j]
      if (a.cohort === b.cohort || (a.linked || []).includes(b.id)) continue
      const faculty = a.faculty.find((f) => b.faculty.includes(f))
      if (!faculty) continue
      const slot = a.slots.find((s) => b.slots.includes(s))
      if (slot) facultyClashes.push({ a, b, faculty, slot })
    }
  }
  const activeClash = facultyClashes.find((c) => !dismissedClashes.has(clashKey(c)))
  // Link two courses as a joint session: align their weeks and record the link
  // on both, so the clash clears and moving one moves the other.
  const linkCourses = (a, b) => {
    const slots = [...new Set([...a.slots, ...b.slots])].sort((x, y) => slotOrder(x) - slotOrder(y))
    updateCourses([
      { ...a, slots, durationWeeks: slots.length, linked: [...new Set([...(a.linked || []), b.id])] },
      { ...b, slots, durationWeeks: slots.length, linked: [...new Set([...(b.linked || []), a.id])] },
    ])
  }

  // --- Bulk actions on a multi-selection (the bottom toolbar) ---------------
  const selectedSet = new Set(selectedCourseIds)
  const selectedCourses = courses.filter((c) => selectedSet.has(c.id))
  const allSelectedSameCohort =
    selectedCourses.length > 0 && selectedCourses.every((c) => c.cohort === selectedCourses[0].cohort)
  // Link the picks as one joint group: align their weeks and cross-link them, so
  // they move together from now on.
  const linkSelected = () => {
    const slots = [...new Set(selectedCourses.flatMap((c) => c.slots))].sort(
      (x, y) => slotOrder(x) - slotOrder(y),
    )
    updateCourses(
      selectedCourses.map((c) => ({
        ...c,
        slots,
        durationWeeks: Math.max(1, slots.length),
        linked: [...new Set([...(c.linked || []), ...selectedCourseIds.filter((id) => id !== c.id)])],
      })),
    )
  }
  const lockSelected = () => {
    const lockAll = selectedCourses.some((c) => !c.locked) // any unlocked → lock all
    updateCourses(selectedCourses.map((c) => ({ ...c, locked: lockAll })))
  }
  const deleteSelected = () => {
    updateCourses(
      courses
        .filter(
          (c) =>
            selectedSet.has(c.id) ||
            (c.parallel || []).some((id) => selectedSet.has(id)) ||
            (c.linked || []).some((id) => selectedSet.has(id)),
        )
        .map((c) =>
          selectedSet.has(c.id)
            ? { ...c, slots: [], parallel: [], linked: [] }
            : {
                ...c,
                parallel: (c.parallel || []).filter((id) => !selectedSet.has(id)),
                linked: (c.linked || []).filter((id) => !selectedSet.has(id)),
              },
        ),
    )
    setSelectedCourses([])
  }

  // Resizing: drag a block's top/bottom edge to span more/fewer consecutive
  // weeks, snapping to rows and clamping at a week another course already holds.
  const startResize = (course, edge, e) => {
    e.preventDefault()
    e.stopPropagation()
    setResize({ courseId: course.id, edge, slots: course.slots })
  }
  const spanFor = (course, edge, targetIdx) => {
    const idxs = course.slots
      .map((id) => slotOrder(id))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)
    if (!idxs.length) return course.slots
    const first = idxs[0]
    const last = idxs[idxs.length - 1]
    const cs = coursesRef.current
    const blockedAt = (idx) => {
      const id = allSlots[idx]?.id
      return id && cs.some((c) => c.id !== course.id && c.cohort === course.cohort && c.slots.includes(id))
    }
    const ids = (a, b) => allSlots.slice(a, b + 1).map((s) => s.id)
    if (edge === 'bottom') {
      let nl = Math.max(first, targetIdx)
      if (nl > last) {
        let lim = last
        for (let i = last + 1; i <= nl; i++) {
          if (blockedAt(i)) break
          lim = i
        }
        nl = lim
      }
      return ids(first, nl)
    }
    let nf = Math.min(last, targetIdx)
    if (nf < first) {
      let lim = first
      for (let i = first - 1; i >= nf; i--) {
        if (blockedAt(i)) break
        lim = i
      }
      nf = lim
    }
    return ids(nf, last)
  }
  const resizeToRow = (ri) => {
    setResize((r) => {
      if (!r) return r
      const course = coursesRef.current.find((c) => c.id === r.courseId)
      if (!course) return r
      const span = spanFor(course, r.edge, ri)
      const same = span.length === r.slots.length && span.every((s) => r.slots.includes(s))
      return same ? r : { ...r, slots: span }
    })
  }

  // Remove a course from a week, dropping any parallel pairing it no longer
  // overlaps with (keeps the relationship honest as weeks change).
  const removeFromWeek = (course, slotId) => {
    const nextSlots = course.slots.filter((s) => s !== slotId)
    const partners = (course.parallel || []).map((id) => courses.find((c) => c.id === id)).filter(Boolean)
    const stillParallel = partners.filter((p) => p.slots.some((sl) => nextSlots.includes(sl)))
    const dropped = partners.filter((p) => !stillParallel.includes(p))
    pushUpdates([
      { ...course, slots: nextSlots, parallel: stillParallel.map((p) => p.id) },
      ...dropped.map((p) => ({ ...p, parallel: (p.parallel || []).filter((id) => id !== course.id) })),
    ])
  }
  const removeWeek = (slotId) => removeFromWeek(focus, slotId)

  // Delete the whole block: clear every week the course holds and unlink any
  // parallel partners.
  const deleteCourseBlock = (course) => {
    const partners = (course.parallel || []).map((id) => courses.find((c) => c.id === id)).filter(Boolean)
    updateCourses([
      { ...course, slots: [], parallel: [] },
      ...partners.map((p) => ({ ...p, parallel: (p.parallel || []).filter((id) => id !== course.id) })),
    ])
  }

  // Per-block "more" menu (Link / Lock / Edit / Delete). `blockMenu` holds the
  // course it targets and the viewport anchor for the portal.
  const [blockMenu, setBlockMenu] = useState(null)
  const blockMenuRef = useRef(null)
  useEffect(() => {
    if (!blockMenu) return
    const onDoc = (e) => {
      if (blockMenuRef.current?.contains(e.target)) return
      setBlockMenu(null)
    }
    const close = () => setBlockMenu(null)
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', close, true)
    }
  }, [blockMenu])
  const openBlockMenu = (course, slotId, e) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setBlockMenu({ course, slotId, top: r.bottom + 4, right: window.innerWidth - r.right })
  }
  const toggleLock = (course) => updateCourses([{ ...course, locked: !course.locked }])

  // Add the picked course(s) to a week. If 2+ courses would share the week (a
  // multi-selection, or a course landing on one another already holds), defer to
  // the parallel-confirmation modal; a lone course is placed straight away.
  const addWeek = (slotId) => {
    const toAdd = toPlaceCourses.filter((c) => !c.slots.includes(slotId))
    if (!toAdd.length) return
    const existing = cohortOccupants(focus.cohort, slotId).filter((c) => !toAdd.some((t) => t.id === c.id))
    const sharers = [...toAdd, ...existing]
    // 2+ courses sharing a week run in parallel — confirm first, unless they're
    // already a known parallel set (so placing them across more weeks needn't
    // re-ask every time).
    if (sharers.length >= 2) {
      const allLinked = sharers.every((a) =>
        sharers.every((b) => a.id === b.id || (a.parallel || []).includes(b.id)),
      )
      if (!allLinked) {
        setPending({ slotId, placing: toAdd, existing })
        return
      }
    }
    // Place directly (a lone course, or an already-parallel set). Committing to
    // the grid makes them System M.
    pushUpdates(
      toAdd.map((c) => {
        const next = [...c.slots, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
        return { ...c, slots: next, durationWeeks: Math.max(c.durationWeeks || 1, next.length), slotSystem: 'M' }
      }),
    )
  }

  const toggleWeek = (slotId) => {
    if (!focus || isProtected(slotId) || !focusIsM) return
    if (focus.slots.includes(slotId)) removeWeek(slotId)
    else addWeek(slotId)
  }

  // A course dragged from the bottom tray, dropped on a week. Places it (plus any
  // co-picked courses of its batch) just like a week-click — confirming parallel
  // when 2+ would share the slot. Edits flow to the store, so the list reflects it.
  const dropFromTray = (courseId, col, slotId) => {
    if (isProtected(slotId)) return
    const dragged = courses.find((x) => x.id === courseId)
    if (!dragged || !matchCol(dragged, col)) return
    const group = selectedCourseIds.includes(courseId)
      ? courses.filter((x) => selectedCourseIds.includes(x.id) && x.cohort === dragged.cohort)
      : [dragged]
    const toAdd = group.filter((x) => !x.slots.includes(slotId))
    if (!toAdd.length) return
    const existing = cohortOccupants(dragged.cohort, slotId).filter((x) => !toAdd.some((t) => t.id === x.id))
    const sharers = [...toAdd, ...existing]
    if (sharers.length >= 2) {
      const allLinked = sharers.every((a) =>
        sharers.every((b) => a.id === b.id || (a.parallel || []).includes(b.id)),
      )
      if (!allLinked) {
        setPending({ slotId, placing: toAdd, existing })
        return
      }
    }
    pushUpdates(
      toAdd.map((c) => {
        const next = [...c.slots, slotId].sort((a, b) => slotOrder(a) - slotOrder(b))
        return { ...c, slots: next, durationWeeks: Math.max(c.durationWeeks || 1, next.length), slotSystem: 'M' }
      }),
    )
  }

  // Commit the pending parallel placement: drop the picked course(s) into the
  // week (and optionally the rest of an existing course's run), recording the
  // parallel pairing across everyone sharing the week.
  const confirmParallel = ({ applyAll }) => {
    const { slotId, placing: toAdd, existing, move } = pending
    // Moved-block case: the dragged block slides to its new position and runs
    // parallel with the occupant (it stays one block — never split).
    if (move) {
      const d = toAdd[0]
      const e = existing[0]
      pushUpdates([
        {
          ...d,
          slots: move.srcSlots,
          durationWeeks: move.srcSlots.length,
          slotSystem: 'M',
          parallel: [...new Set([...(d.parallel || []), e.id])],
        },
        { ...e, parallel: [...new Set([...(e.parallel || []), d.id])] },
      ])
      setPending(null)
      return
    }
    const ref = existing[0]
    const extra = applyAll && ref ? ref.slots.filter((s) => s !== slotId && !isProtected(s)) : []
    const allIds = [...toAdd, ...existing].map((c) => c.id)
    updateCourses([
      ...toAdd.map((c) => {
        const nextSlots = [
          ...new Set([...c.slots, slotId, ...extra.filter((s) => !c.slots.includes(s))]),
        ].sort((a, b) => slotOrder(a) - slotOrder(b))
        return {
          ...c,
          slots: nextSlots,
          // Co-running can stretch a course past its nominal duration — keep the
          // cap in step so "x of n" holds.
          durationWeeks: Math.max(c.durationWeeks || 1, nextSlots.length),
          slotSystem: 'M',
          parallel: [...new Set([...(c.parallel || []), ...allIds.filter((id) => id !== c.id)])],
        }
      }),
      ...existing.map((c) => ({
        ...c,
        parallel: [...new Set([...(c.parallel || []), ...toAdd.map((t) => t.id)])],
      })),
    ])
    setPending(null)
  }

  // Exchange: the dropped course takes the week; the existing course vacates it,
  // moving into the dropped course's first week (a true swap) when it has one.
  const exchangePlaces = () => {
    const { placing, existing, move } = pending
    const d = placing[0]
    const e = existing[0]
    if (!d || !e) return setPending(null)
    // Moved-block case: the two courses simply swap their whole week-sets — both
    // stay intact as one block each.
    if (move) {
      pushUpdates([
        { ...d, slots: [...e.slots], durationWeeks: e.slots.length, slotSystem: 'M' },
        { ...e, slots: [...d.slots], durationWeeks: d.slots.length },
      ])
      setPending(null)
      return
    }
    const { slotId } = pending
    const source = d.slots.find((s) => !isProtected(s)) // a week d can hand over
    const dSlots = [...new Set([...d.slots.filter((s) => s !== source), slotId])].sort(
      (a, b) => slotOrder(a) - slotOrder(b),
    )
    const eSlots = (
      source ? [...new Set([...e.slots.filter((s) => s !== slotId), source])] : e.slots.filter((s) => s !== slotId)
    ).sort((a, b) => slotOrder(a) - slotOrder(b))
    pushUpdates([
      { ...d, slots: dSlots, durationWeeks: Math.max(1, dSlots.length), slotSystem: 'M' },
      { ...e, slots: eSlots, durationWeeks: Math.max(1, eSlots.length) },
    ])
    setPending(null)
  }

  if (!focus) {
    return (
      <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <p className="px-6 py-16 text-center text-sm text-slate-400">
          Select a course in the Slot Allotment step to allot its weeks here.
        </p>
      </div>
    )
  }

  // Occupant grid (row = week, col = batch). Each cell is the list of courses in
  // that week; protected weeks are holes, so a course never merges across one.
  const grid = allSlots.map((s) =>
    isProtected(s.id) ? cols.map(() => []) : cols.map((col) => occupantsIn(col, s.id)),
  )
  // Only a lone occupant participates in block-fusing; parallel cells stay split.
  const soloAt = (ri, ci) => {
    const cell = grid[ri]?.[ci]
    return cell && cell.length === 1 ? cell[0] : null
  }
  // Signature of a parallel cell (2+ courses) — the sorted course ids. Adjacent
  // weeks sharing a signature are the same parallel block running across weeks.
  const parSig = (ri, ci) => {
    const cell = grid[ri]?.[ci]
    return cell && cell.length > 1 ? cell.map((c) => c.id).sort().join('|') : null
  }
  const sameSpan = (a, b) =>
    a.slots.length === b.slots.length && a.slots.every((x) => b.slots.includes(x))
  const sameFaculty = (a, b) =>
    a.faculty.length === b.faculty.length && a.faculty.every((f) => b.faculty.includes(f))
  // Vertical: the very same course filling adjacent weeks. Horizontal: two
  // adjacent batches running what is effectively the same session — same code,
  // title and faculty over the same weeks — so it reads as one shared block
  // (whether it's a core for one batch or an elective for another).
  const fuses = (a, b, vertical) => {
    if (!a || !b) return false
    if (vertical) return a.id === b.id
    // Faculty view: the SAME course shown under two adjacent faculty columns is
    // one co-taught session, so it fuses across them.
    if (a.id === b.id) return view === 'faculty'
    return a.code === b.code && a.title === b.title && sameFaculty(a, b) && sameSpan(a, b)
  }
  const mergeAt = (ri, ci) => {
    const occ = soloAt(ri, ci)
    if (!occ) return null
    return {
      top: fuses(occ, soloAt(ri - 1, ci), true),
      bottom: fuses(occ, soloAt(ri + 1, ci), true),
      left: fuses(occ, soloAt(ri, ci - 1), false),
      right: fuses(occ, soloAt(ri, ci + 1), false),
    }
  }

  // --- Selection ----------------------------------------------------------
  // Flood-fill the occupant grid into connected blocks (same fusing rule as the
  // visual merge); a parallel cell is its own block. Each distinct course in a
  // block is a nested item you can drill into.
  const ck = (r, c) => `${r}:${c}`
  const cellAnchor = {} // "ri:ci" -> anchor cell key
  const anchorMembers = {} // anchor -> sorted distinct course ids in the block
  {
    const seen = new Set()
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols.length; c++) {
        if (!grid[r][c]?.length || seen.has(ck(r, c))) continue
        const anchor = ck(r, c)
        const members = new Set()
        const stack = [[r, c]]
        seen.add(anchor)
        while (stack.length) {
          const [y, x] = stack.pop()
          cellAnchor[ck(y, x)] = anchor
          for (const crs of grid[y][x]) members.add(crs.id)
          const solo = soloAt(y, x)
          if (solo) {
            const ext = (ny, nx, vert) => {
              const ns = soloAt(ny, nx)
              if (ns && fuses(solo, ns, vert) && !seen.has(ck(ny, nx))) {
                seen.add(ck(ny, nx))
                stack.push([ny, nx])
              }
            }
            ext(y - 1, x, true)
            ext(y + 1, x, true)
            ext(y, x - 1, false)
            ext(y, x + 1, false)
          } else if (grid[y][x].length > 1) {
            // A parallel cell fuses vertically with adjacent weeks holding the
            // exact same parallel set, so it reads as one block across the run.
            const sig = parSig(y, x)
            const extP = (ny) => {
              if (parSig(ny, x) === sig && !seen.has(ck(ny, x))) {
                seen.add(ck(ny, x))
                stack.push([ny, x])
              }
            }
            extP(y - 1)
            extP(y + 1)
          }
        }
        anchorMembers[anchor] = [...members].sort()
      }
    }
  }
  const blockKeyAt = (ri, ci) => (anchorMembers[cellAnchor[ck(ri, ci)]] || []).join('|')
  const blockMembersAt = (ri, ci) => anchorMembers[cellAnchor[ck(ri, ci)]] || []

  // Click a course: select the whole block first, then drill to the course on a
  // repeat click on the same block. Shift-click toggles it into a multi-select
  // (which raises the bulk toolbar). Selecting also syncs to the planner list.
  const selectBlock = (c, ri, ci, e) => {
    if (e && e.shiftKey) {
      setSel(null)
      setHoverNested(null)
      setSelectedCourses(
        selectedCourseIds.includes(c.id)
          ? selectedCourseIds.filter((x) => x !== c.id)
          : [...selectedCourseIds, c.id],
      )
      return
    }
    const members = blockMembersAt(ri, ci)
    const list = members.length ? members : [c.id]
    const key = list.join('|')
    setHoverNested(null)
    setSel((prev) =>
      prev && prev.key === key
        ? { key, nested: c.id }
        : { key, nested: list.length === 1 ? c.id : null },
    )
    // Selecting a block syncs the selection to the store, so the list window
    // highlights the same course.
    setSelectedCourse(c.id)
  }
  // Clicking empty space clears the block selection AND the shared selection, so
  // the list window deselects too.
  const clearSel = () => {
    setSel(null)
    setHoverNested(null)
    if (selectedCourseId) setSelectedCourse(null)
  }

  // Shift every week of a course by `delta` rows, keeping it ONE contiguous block
  // (a course never splits). Returns null if it would fall off the grid.
  const shiftBlock = (course, delta) => {
    const idxs = course.slots.map((s) => slotOrder(s) + delta)
    if (idxs.some((i) => i < 0 || i >= allSlots.length)) return null
    return idxs.map((i) => allSlots[i].id).sort((a, b) => slotOrder(a) - slotOrder(b))
  }
  // Drag a block onto another cell of the same batch: the WHOLE block moves by
  // the drag delta. An empty destination just moves it; an occupied one asks
  // whether to run parallel or exchange positions.
  const handleDrop = (targetCol, targetSlotId) => {
    const d = drag
    setDrag(null)
    setDragOver(null)
    if (!d || d.slotId === targetSlotId) return
    const src = courses.find((c) => c.id === d.courseId)
    if (!src || !matchCol(src, targetCol) || isProtected(targetSlotId)) return
    if (src.slots.includes(targetSlotId)) return // dropping on one of its own weeks
    const srcSlots = shiftBlock(src, slotOrder(targetSlotId) - slotOrder(d.slotId))
    if (!srcSlots) return // the whole block would run off the grid
    // Any course the moved block would land on (anywhere in its run, not just the
    // grabbed week) → ask whether to run parallel or exchange.
    const occ = courses.find(
      (c) => c.id !== src.id && matchCol(c, targetCol) && c.slots.some((s) => srcSlots.includes(s)),
    )
    if (occ) {
      setPending({ slotId: targetSlotId, placing: [src], existing: [occ], move: { srcSlots } })
      return
    }
    pushUpdates([{ ...src, slots: srcSlots, durationWeeks: srcSlots.length, slotSystem: 'M' }])
  }
  // Selection state for one course's cell, used for the sky wash.
  const selStateOf = (c, ri, ci) => {
    if (!sel || blockKeyAt(ri, ci) !== sel.key) return 'none'
    if (sel.nested) return c.id === sel.nested ? 'nested' : 'group'
    if (hoverNested === c.id) return 'hover'
    return 'whole'
  }
  // Handlers for a course block: click to select/drill, hover to preview a nested
  // course once the whole block is selected.
  const blockInteraction = (c, ri, ci) => ({
    onClick: (e) => {
      e.stopPropagation()
      selectBlock(c, ri, ci, e)
    },
    onMouseEnter: () => {
      if (sel && !sel.nested && sel.key === blockKeyAt(ri, ci)) setHoverNested(c.id)
    },
    onMouseLeave: () => setHoverNested((h) => (h === c.id ? null : h)),
    title: `Select ${c.code}`,
    selState: selStateOf(c, ri, ci),
  })

  return (
    <div
      className={`min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${
        resize ? 'cursor-ns-resize select-none' : ''
      }`}
    >
      {/* Header */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Allotting weeks · {TERM.semester} 2026-27
          </div>
          <h1 className="text-xl font-bold">
            <span className="text-slate-500 dark:text-slate-400">{focus.code}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            {focus.title}
          </h1>
        </div>

        {/* Group the grid's columns by batch, faculty, or — once venue allotment
            is under way — venue (the room timetable). */}
        <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm dark:bg-slate-800">
          {[
            { id: 'batch', label: 'By batch' },
            { id: 'faculty', label: 'By faculty' },
            ...(venueReady ? [{ id: 'venue', label: 'By venue' }] : []),
          ].map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setView(o.id)
                clearSel()
              }}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                view === o.id
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </header>

      {!focusIsM && (
        <div className="flex items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Ban size={16} className="shrink-0" />
          <span>
            <b>{focus.code}</b> is slotted under Slot System {focus.slotSystem}, which isn't placed on
            the week grid. Switch it to System M in the planner to allot weeks here.
          </span>
        </div>
      )}

      {focusIsM && !inSlotStep && (
        <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <Lock size={15} className="shrink-0 text-slate-400" />
          <span>
            {activeStep === 'venue'
              ? 'Venue allotment is active — weeks are locked here. Click a course to surface it in the planner and assign its room.'
              : 'Weeks can only be edited on the Slot step of the planner. Click a course to select it.'}
          </span>
        </div>
      )}

      <div className={`overflow-auto p-6 ${inSlotStep ? 'pb-32' : ''}`} onClick={clearSel}>
        <table className="border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 w-12 rounded-tl-lg border-b border-l border-r border-t border-slate-200 bg-slate-50 px-2 py-2.5 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                Week
              </th>
              <th className="sticky left-[3rem] top-0 z-20 w-14 border-b border-r border-t border-slate-200 bg-slate-50 px-2 py-2.5 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                Start
              </th>
              <th className="sticky left-[6.5rem] top-0 z-20 w-14 border-b border-r border-t border-slate-200 bg-slate-50 px-2 py-2.5 text-left font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-900">
                End
              </th>
              {cols.map((col) => {
                const isFocus = isFocusCol(col)
                return (
                  <th
                    key={col}
                    className={`min-w-[150px] border-b border-r border-t border-slate-200 px-3 py-2.5 text-left align-middle font-semibold dark:border-slate-700 ${
                      isFocus
                        ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300'
                        : 'bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{col}</span>
                      {cols.length > 1 && (
                        <button
                          onClick={() => setCols((p) => p.filter((c) => c !== col))}
                          title={`Remove ${col} column`}
                          className="shrink-0 text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    {isFocus && (
                      <div className="mt-0.5 text-[10px] font-normal text-amber-600 dark:text-amber-400">
                        allotting {focus.code}
                      </div>
                    )}
                  </th>
                )
              })}
              {/* Add-batch control */}
              <th className="sticky top-0 border-b border-t border-slate-200 bg-white px-3 py-2.5 align-middle dark:border-slate-700 dark:bg-slate-950">
                <button
                  ref={addBtnRef}
                  onClick={toggleAddMenu}
                  disabled={addable.length === 0}
                  aria-haspopup="listbox"
                  aria-expanded={addOpen}
                  className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-400"
                >
                  <Plus size={14} /> {view === 'faculty' ? 'Add faculty' : 'Add batch'}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {allSlots.map((s, ri) => {
              const examWk = isExamWeek(s.id)
              return (
                <tr key={s.id}>
                  {(() => {
                    const stickyBg = 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
                    return (
                      <>
                        <td className={`sticky left-0 z-10 w-12 border-b border-l border-r px-2 py-2 align-top ${stickyBg}`}>
                          <div className="font-semibold text-slate-600 dark:text-slate-300">{s.label}</div>
                          {examWk && (
                            <div className="mt-1 inline-block rounded bg-yellow-200 px-1 py-0.5 text-[8px] font-semibold uppercase text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200">
                              {examWeekLabel(s.id).replace(' exams', '')}
                            </div>
                          )}
                        </td>
                        <td
                          className={`sticky left-[3rem] z-10 w-14 whitespace-nowrap border-b border-r px-2 py-2 align-top text-[11px] font-medium text-slate-500 dark:text-slate-400 ${stickyBg}`}
                        >
                          {ddmm(s.dateRange.start)}
                        </td>
                        <td
                          className={`sticky left-[6.5rem] z-10 w-14 whitespace-nowrap border-b border-r px-2 py-2 align-top text-[11px] font-medium text-slate-500 dark:text-slate-400 ${stickyBg}`}
                        >
                          {ddmm(s.dateRange.end)}
                        </td>
                      </>
                    )
                  })()}

                  {cols.map((col, ci) => {
                    const isFocusBatch = isFocusCol(col)
                    const cell = grid[ri][ci] // courses in this week-cell
                    const hasFocusHere = cell.some((c) => c.id === focus.id)
                    const hasRoom = focus.slots.length < cap
                    const canAdd =
                      inSlotStep && isFocusBatch && focusIsM && cell.length === 0 && hasRoom
                    // Dropping onto a cell another course already holds offers a
                    // parallel pairing (instead of a hard block).
                    const canParallel =
                      inSlotStep && isFocusBatch && focusIsM && hasRoom && !hasFocusHere && cell.length > 0
                    const merge = mergeAt(ri, ci)
                    // A parallel block fuses vertically with weeks holding the
                    // same parallel set, so it's drawn once across the run.
                    const pSig = cell.length > 1 ? parSig(ri, ci) : null
                    const pTop = !!pSig && parSig(ri - 1, ci) === pSig
                    const pBottom = !!pSig && parSig(ri + 1, ci) === pSig
                    const mTop = merge?.top || pTop
                    const mBottom = merge?.bottom || pBottom
                    const mLeft = merge?.left || false
                    const mRight = merge?.right || false
                    // Close the inter-cell gap (td padding) and hide the seam
                    // border on edges where this block fuses with a neighbour.
                    const pad = `${mTop ? 'pt-0' : 'pt-1'} ${mBottom ? 'pb-0' : 'pb-1'} ${
                      mLeft ? 'pl-0' : 'pl-1'
                    } ${mRight ? 'pr-0' : 'pr-1'}`
                    const seamB = mBottom ? 'border-b-transparent' : 'border-b-slate-200 dark:border-b-slate-800'
                    const seamR = mRight ? 'border-r-transparent' : 'border-r-slate-200 dark:border-r-slate-800'
                    return (
                      <td
                        key={col}
                        onDragOver={(e) => {
                          const src = drag && courses.find((c) => c.id === drag.courseId)
                          const tray = trayDrag ? courses.find((c) => c.id === trayDrag) : null
                          const inGridOk = src && matchCol(src, col) && drag.slotId !== s.id
                          const trayOk = tray && matchCol(tray, col) && !tray.slots.includes(s.id)
                          if ((inGridOk || trayOk) && !isProtected(s.id)) {
                            e.preventDefault()
                            setDragOver(ck(ri, ci))
                          }
                        }}
                        onDragLeave={() => setDragOver((o) => (o === ck(ri, ci) ? null : o))}
                        onDrop={(e) => {
                          e.preventDefault()
                          setDragOver(null)
                          if (trayDrag) dropFromTray(trayDrag, col, s.id)
                          else handleDrop(col, s.id)
                        }}
                        onMouseEnter={() => resize && resizeToRow(ri)}
                        className={`group/cell relative h-14 border-b border-r ${seamB} ${seamR} ${pad} align-middle bg-white transition-all duration-300 ease-out dark:bg-slate-950 ${
                          // Plain white cells with grid lines; only course blocks are
                          // filled. A hovered drop target rings in the accent colour.
                          dragOver === ck(ri, ci) ? 'ring-2 ring-inset ring-accent' : ''
                        }`}
                      >
                        {cell.length > 1 && pTop ? (
                          // Continuation of a parallel block that runs across
                          // weeks — bare fill so the courses are named only once.
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              selectBlock(cell[0], ri, ci)
                            }}
                            className={`h-full w-full ${
                              sel && blockKeyAt(ri, ci) === sel.key
                                ? sel.nested
                                  ? SEL_BG.group
                                  : SEL_BG.whole
                                : 'bg-slate-100 dark:bg-slate-800'
                            } ${pBottom ? '' : 'rounded-b-md'}`}
                          />
                        ) : cell.length > 1 ? (
                          // Parallel cell: the courses share the week (different
                          // students in each), shown as one block split into rows.
                          <div
                            className={`flex w-full flex-col divide-y divide-slate-300 overflow-hidden rounded-t-md dark:divide-slate-600 ${
                              pBottom ? '' : 'rounded-b-md'
                            }`}
                            title="These courses run in parallel — different students in each"
                          >
                            {cell.map((c) => {
                              const inter = blockInteraction(c, ri, ci)
                              const bg =
                                inter.selState !== 'none'
                                  ? SEL_BG[inter.selState]
                                  : 'bg-slate-100 dark:bg-slate-800'
                              const hover =
                                inter.selState === 'none' ? 'hover:bg-slate-200 dark:hover:bg-slate-700' : ''
                              const isDragging = drag?.courseId === c.id && drag?.slotId === s.id
                              return (
                                <button
                                  key={c.id}
                                  onClick={inter.onClick}
                                  onMouseEnter={inter.onMouseEnter}
                                  onMouseLeave={inter.onMouseLeave}
                                  draggable={inSlotStep && !c.locked}
                                  onDragStart={() => setDrag({ courseId: c.id, slotId: s.id })}
                                  onDragEnd={() => {
                                    setDrag(null)
                                    setDragOver(null)
                                  }}
                                  title={inter.title}
                                  className={`flex flex-col justify-center px-2 py-1 text-left transition ${bg} ${hover} ${
                                    inSlotStep ? 'cursor-grab active:cursor-grabbing' : ''
                                  } ${isDragging ? 'opacity-40' : ''} ${
                                    selectedCourseIds.includes(c.id)
                                      ? 'ring-2 ring-inset ring-yellow-400'
                                      : ''
                                  }`}
                                >
                                  <div className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                                    {c.code}
                                  </div>
                                  {c.faculty?.length > 0 && (
                                    <div className="truncate text-[9px] text-slate-500 dark:text-slate-400">
                                      {c.faculty.join(', ')}
                                    </div>
                                  )}
                                  {c.venue && (
                                    <div className="flex items-center gap-0.5 truncate text-[9px] text-slate-500 dark:text-slate-400">
                                      <MapPin size={8} className="shrink-0" />
                                      {c.venue}
                                    </div>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        ) : cell.length === 1 ? (
                          <CourseBlock
                            course={cell[0]}
                            selected={selectedCourseIds.includes(cell[0].id)}
                            {...blockInteraction(cell[0], ri, ci)}
                            merge={merge}
                            showLabel={!(merge.top || merge.left)}
                            draggable={inSlotStep && !cell[0].locked}
                            onDragStart={() => setDrag({ courseId: cell[0].id, slotId: s.id })}
                            onDragEnd={() => {
                              setDrag(null)
                              setDragOver(null)
                            }}
                            dragging={drag?.courseId === cell[0].id && drag?.slotId === s.id}
                          />
                        ) : canAdd ? (
                          <button
                            onClick={() => toggleWeek(s.id)}
                            title={
                              toPlaceCourses.length > 1
                                ? `Allot ${toPlaceCourses.map((c) => c.code).join(', ')} to ${s.label}`
                                : `Allot ${focus.code} to ${s.label}`
                            }
                            className="group flex h-full w-full items-center justify-center rounded-md border border-dashed border-transparent transition hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-900"
                          >
                            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 opacity-0 transition group-hover:opacity-100">
                              <Plus size={12} />{' '}
                              {toPlaceCourses.length > 1 ? `${toPlaceCourses.length} courses` : focus.code}
                            </span>
                          </button>
                        ) : null}

                        {/* Resize handles — drag a block's top/bottom edge to span
                            more/fewer consecutive weeks. Available in any view,
                            whether or not the course is selected. */}
                        {cell.length === 1 && !cell[0].locked && (
                          <>
                            {!merge?.top && (
                              <div
                                onMouseDown={(e) => startResize(cell[0], 'top', e)}
                                title="Drag to resize"
                                className="absolute inset-x-1 top-0 z-10 flex h-2 cursor-ns-resize items-start justify-center opacity-0 transition group-hover/cell:opacity-100"
                              >
                                <div className="mt-0.5 h-1 w-6 rounded-full bg-accent/70" />
                              </div>
                            )}
                            {!merge?.bottom && (
                              <div
                                onMouseDown={(e) => startResize(cell[0], 'bottom', e)}
                                title="Drag to resize"
                                className="absolute inset-x-1 bottom-0 z-10 flex h-2 cursor-ns-resize items-end justify-center opacity-0 transition group-hover/cell:opacity-100"
                              >
                                <div className="mb-0.5 h-1 w-6 rounded-full bg-accent/70" />
                              </div>
                            )}
                          </>
                        )}

                        {/* Per-block "more" menu (link / lock / edit / delete) —
                            available in any view. */}
                        {cell.length > 0 && (
                          <button
                            onClick={(e) => openBlockMenu(hasFocusHere ? focus : cell[0], s.id, e)}
                            title="More"
                            className="absolute right-1 top-1 z-20 hidden h-5 w-5 items-center justify-center rounded-md bg-white/90 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-700 group-hover/cell:flex dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <MoreVertical size={13} />
                          </button>
                        )}

                        {/* Hover affordance to run the active course parallel to
                            whatever already sits in this week. */}
                        {canParallel && (
                          <button
                            onClick={() =>
                              setPending({
                                slotId: s.id,
                                placing: toPlaceCourses.filter((c) => !c.slots.includes(s.id)),
                                existing: cell,
                              })
                            }
                            title={`Run ${focus.code} in parallel here`}
                            className="absolute inset-0 flex items-center justify-center rounded-md opacity-0 transition hover:bg-amber-50/70 hover:opacity-100 dark:hover:bg-amber-950/40"
                          >
                            <span className="flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 shadow-sm dark:bg-slate-900/90 dark:text-amber-300">
                              <Plus size={10} /> parallel
                            </span>
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="border-b border-slate-100 dark:border-slate-800/50" />
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add-batch menu — portaled to the body so the grid's scroll container
          can't clip it, fixed-positioned under its button. */}
      {addOpen &&
        addable.length > 0 &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            role="listbox"
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
            className="z-50 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <button
              onClick={() => {
                setCols((view === 'faculty' ? facultyList : cohorts).slice())
                setAddOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-semibold text-accent transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Plus size={13} /> {view === 'faculty' ? 'All faculty' : 'All batches'}
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            {addable.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setCols((p) => [...p, c])
                  setAddOpen(false)
                }}
                className="flex w-full items-center px-3 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {c}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {/* Bulk toolbar — appears for a 2+ multi-selection. */}
      {selectedCourseIds.length >= 2 && (
        <div
          className={`fixed left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900 ${
            inSlotStep ? 'bottom-28' : 'bottom-6'
          }`}
        >
          <span className="px-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {selectedCourseIds.length} selected
          </span>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          {[
            {
              label: 'Link',
              icon: Link2,
              onClick: linkSelected,
              // Linking is for a joint session ACROSS batches — same-batch picks
              // would just be parallel, so it's disabled then.
              disabled: allSelectedSameCohort,
              title: allSelectedSameCohort
                ? 'Link is for courses in different batches (same teacher, same time)'
                : 'Link as one joint session',
            },
            {
              label: selectedCourses.every((c) => c.locked) ? 'Unlock' : 'Lock',
              icon: Lock,
              onClick: lockSelected,
            },
          ].map((b) => (
            <button
              key={b.label}
              onClick={b.onClick}
              disabled={b.disabled}
              title={b.title}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <b.icon size={14} /> {b.label}
            </button>
          ))}
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <Trash2 size={14} /> Delete
          </button>
          <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            onClick={() => setSelectedCourses([])}
            title="Clear selection"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Faculty-clash prompt — same teacher, same week, two batches. */}
      {activeClash && (
        <div
          className={`fixed left-1/2 z-40 flex w-[min(92vw,30rem)] -translate-x-1/2 items-start gap-3 rounded-xl border border-amber-300 bg-white px-4 py-3 shadow-xl dark:border-amber-700/60 dark:bg-slate-900 ${
            selectedCourseIds.length >= 2 ? 'bottom-44' : inSlotStep ? 'bottom-28' : 'bottom-6'
          }`}
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1 text-sm">
            <div className="text-slate-700 dark:text-slate-200">
              <b>{activeClash.faculty}</b> teaches <b>{activeClash.a.code}</b> ({activeClash.a.cohort}) and{' '}
              <b>{activeClash.b.code}</b> ({activeClash.b.cohort}) both in {slotLabel(activeClash.slot)}.
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Link them as one joint session so they move together?
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              onClick={() => linkCourses(activeClash.a, activeClash.b)}
              className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white transition hover:brightness-95"
            >
              <Link2 size={12} /> Link
            </button>
            <button
              onClick={() => setDismissedClashes((s) => new Set(s).add(clashKey(activeClash)))}
              className="rounded-lg px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Sticky course tray — the focus batch's courses, draggable onto a week.
          Stays pinned while the timetable scrolls; placements sync to the list. */}
      {inSlotStep && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            <Layers size={12} /> {focus.cohort} courses
            <span className="font-normal normal-case tracking-normal text-slate-400">
              · drag a card onto a week to allot it
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {courses
              .filter((c) => c.cohort === focus.cohort)
              .map((c) => {
                const allotted = c.slots.length > 0
                const picked = c.id === selectedCourseId
                return (
                  <div
                    key={c.id}
                    draggable
                    onClick={() => setSelectedCourse(c.id)}
                    onDragStart={(e) => {
                      setTrayDrag(c.id)
                      setSelectedCourse(c.id)
                      e.dataTransfer.setData('text/plain', c.id)
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onDragEnd={() => {
                      setTrayDrag(null)
                      setDragOver(null)
                    }}
                    title={`Click to select · drag ${c.code} onto a week`}
                    className={`flex w-36 shrink-0 cursor-grab select-none flex-col rounded-lg border px-3 py-2 transition active:cursor-grabbing ${
                      picked
                        ? 'border-accent ring-2 ring-accent/40 dark:border-accent'
                        : allotted
                          ? 'border-green-200 bg-green-50/60 dark:border-green-900/40 dark:bg-green-950/20'
                          : 'border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-1 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {c.code}
                      {allotted && <Check size={11} className="shrink-0 text-green-600" />}
                    </div>
                    <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {c.faculty.length ? c.faculty.join(', ') : 'unassigned'}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Per-block more-menu — portaled so the grid scroll container can't clip it. */}
      {blockMenu &&
        createPortal(
          <div
            ref={blockMenuRef}
            role="menu"
            style={{ position: 'fixed', top: blockMenu.top, right: blockMenu.right }}
            className="z-50 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {[
              {
                icon: Link2,
                label: 'Link',
                // Add the course to the multi-selection — a step toward linking it
                // parallel with another (select more, then drop them on a week).
                onClick: () => setSelectedCourses([...new Set([...selectedCourseIds, blockMenu.course.id])]),
              },
              {
                icon: Lock,
                label: blockMenu.course.locked ? 'Unlock' : 'Lock',
                onClick: () => toggleLock(blockMenu.course),
              },
              { icon: Pencil, label: 'Edit', onClick: () => setSelectedCourse(blockMenu.course.id) },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick()
                  setBlockMenu(null)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <item.icon size={14} className="text-slate-400" /> {item.label}
              </button>
            ))}
            <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
            <button
              onClick={() => {
                deleteCourseBlock(blockMenu.course)
                setBlockMenu(null)
              }}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>,
          document.body,
        )}

      {pending && (
        <ParallelModal
          slotId={pending.slotId}
          cohort={focus.cohort}
          placing={pending.placing}
          existing={pending.existing}
          onConfirm={confirmParallel}
          onExchange={exchangePlaces}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  )
}
