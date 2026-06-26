import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Undo2, Redo2, X, Download, Check, Layers, History } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { TERM, slotLabel, slots as allSlots } from '../data/seed.js'
import { rankDestinations, evaluateCourse } from '../logic/constraints.js'
import { timetableChanges } from '../logic/timetable.js'
import TimetableGrid from '../components/TimetableGrid.jsx'
import WeeklyTimetable from '../components/WeeklyTimetable.jsx'
import ChangeRequests from '../components/ChangeRequests.jsx'
import TimetableHistory from '../components/TimetableHistory.jsx'
import EditCoursePanel from '../components/EditCoursePanel.jsx'
import CoursePanel from '../components/CoursePanel.jsx'
import ShareModal from '../components/ShareModal.jsx'

const VIEWS = [
  { id: 'student', label: 'Student' },
  { id: 'faculty', label: 'Faculty' },
  { id: 'venue', label: 'Venue' },
]

const cloneCourse = (c) => ({
  ...c,
  faculty: [...c.faculty],
  slots: [...c.slots],
  dateRanges: c.dateRanges.map((r) => ({ ...r })),
})

// Has a course's CURRENT state already achieved what a change request asked for?
// Lets us auto-resolve a request the coordinator satisfied indirectly — by
// dragging the block or editing the course details — without clicking Apply.
// 'split' (and anything we can't read back from the course) is left for a manual
// decision.
function requestSatisfied(course, op) {
  if (!course || !op) return false
  switch (op.kind) {
    case 'reslot':
      return course.slots.includes(op.to) && !course.slots.includes(op.from)
    case 'addSlot':
      return course.slots.includes(op.slot)
    case 'venue':
      return course.venue === op.to
    case 'addFaculty':
      return course.faculty.includes(op.faculty)
    default:
      return false
  }
}

export default function DraftTimetable() {
  const navigate = useNavigate()
  const { courses, changeRequests, conflicts, pendingRequests, workflow, publish, updateCourse, updateCourses, resolveRequests, undo, redo, canUndo, canRedo } =
    useApp()

  // Undo / redo keyboard shortcuts are wired globally in AppProvider.
  const [view, setView] = useState('student')
  const [viewMode, setViewMode] = useState('sem') // 'sem' | 'weekly'
  const [sharing, setSharing] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false) // change-history rail open?
  const weekly = viewMode === 'weekly'

  // Every place the live timetable has drifted from last year's carried-over
  // mapping (a course moved weeks, or a room reassigned) — drives the change
  // history rail. Recomputed as the coordinator edits.
  const changes = useMemo(() => timetableChanges(courses), [courses])

  // The weekly view reuses the grid-window's WeeklyTimetable, which seeds its
  // batch from a focus course. Any allotted course works — it only sets the
  // initial batch (switchable via the in-view chips).
  const weeklyFocus = useMemo(
    () => courses.find((c) => c.slots.length > 0) || courses[0] || null,
    [courses],
  )

  // Courses still not mapped onto the semester grid (no weeks allotted) — these
  // populate the bottom tray, draggable onto a week to place them.
  const unmappedCourses = useMemo(
    () => courses.filter((c) => c.slots.length === 0),
    [courses],
  )
  // The course currently being dragged from the bottom tray onto the grid.
  const [trayDrag, setTrayDrag] = useState(null)
  // Tray batch filter — only meaningful when unmapped courses span several
  // cohorts. Falls back to "all" if the active cohort gets fully placed.
  const [trayFilter, setTrayFilter] = useState('all')
  const trayCohorts = useMemo(
    () => [...new Set(unmappedCourses.map((c) => c.cohort))],
    [unmappedCourses],
  )
  const effectiveTrayFilter = trayCohorts.includes(trayFilter) ? trayFilter : 'all'
  const shownTrayCourses =
    effectiveTrayFilter === 'all'
      ? unmappedCourses
      : unmappedCourses.filter((c) => c.cohort === effectiveTrayFilter)

  // Drop a tray course onto a (column, week): give it that week. The grid only
  // offers the drop on a column the course belongs to, so this just commits it.
  const slotIdx = (id) => allSlots.findIndex((s) => s.id === id)
  const placeFromTray = (courseId, slotId) => {
    const c = courses.find((x) => x.id === courseId)
    if (!c || c.slots.includes(slotId)) return
    const next = [...c.slots, slotId].sort((a, b) => slotIdx(a) - slotIdx(b))
    updateCourse({ ...c, slots: next, durationWeeks: Math.max(c.durationWeeks || 1, next.length) })
    setTrayDrag(null)
  }

  // Single right-side panel. Mode is derived: edit > details > rail (tabbed).
  const [highlight, setHighlight] = useState(null) // selected courseId, ringed in the grid
  const [detailsCourseId, setDetailsCourseId] = useState(null) // course-details mode
  const [detailGroupIds, setDetailGroupIds] = useState([]) // parallel-course tabs in the drawer
  const [edit, setEdit] = useState(null) // edit session (see startEdit)
  const [railTab, setRailTab] = useState('requests') // 'requests' | 'clashes'
  const [detailPreview, setDetailPreview] = useState(null) // live draft mirrored onto the grid

  // --- Toasts: transient confirmations that slide up from the bottom ---
  const [toasts, setToasts] = useState([])
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setToasts((t) => [...t, { id, ...toast }])
    setTimeout(() => dismissToast(id), 5000)
  }, [dismissToast])

  // Auto-resolve change requests the coordinator satisfied indirectly (a manual
  // drag or a detail-panel edit), and announce it. The side panel + grid badge
  // react automatically once the request leaves "pending".
  useEffect(() => {
    const satisfied = pendingRequests.filter((r) =>
      requestSatisfied(courses.find((c) => c.id === r.courseId), r.op),
    )
    if (satisfied.length === 0) return
    resolveRequests(satisfied.map((r) => r.id))
    for (const r of satisfied)
      pushToast({
        tone: 'request',
        title: 'Change request resolved',
        msg: `${r.courseCode} — ${r.by}'s request is now satisfied.`,
      })
  }, [courses]) // eslint-disable-line react-hooks/exhaustive-deps

  // Announce when manual actions clear slot clashes (conflict count drops).
  const prevClashes = useRef(conflicts.conflicts.length)
  useEffect(() => {
    const now = conflicts.conflicts.length
    const before = prevClashes.current
    if (now < before)
      pushToast({
        tone: 'clash',
        title: 'Clash resolved',
        msg: `${before - now} slot clash${before - now > 1 ? 'es' : ''} cleared.`,
      })
    prevClashes.current = now
  }, [conflicts]) // eslint-disable-line react-hooks/exhaustive-deps

  // `group` is the list of parallel courses sharing the clicked block (one course
  // when a normal block is opened). They become the tabs in the detail drawer.
  const openCourseDetail = (courseId, group) => {
    setHighlight(courseId)
    setEdit(null)
    setDetailPreview(null)
    setDetailsCourseId(courseId)
    setDetailGroupIds(group && group.length > 1 ? group.map((c) => c.id) : [])
  }
  const closeCourseDetail = () => {
    setDetailsCourseId(null)
    setDetailGroupIds([])
    setDetailPreview(null)
  }

  const disputedIds = useMemo(
    () => new Set(pendingRequests.map((r) => r.courseId)),
    [pendingRequests],
  )

  // --- Edit session derivations ---
  const editCourse = edit ? courses.find((c) => c.id === edit.courseId) : null
  const ranking = useMemo(
    () => (edit && editCourse ? rankDestinations(editCourse, edit.fromSlot, courses) : null),
    [edit?.courseId, edit?.fromSlot, editCourse, courses],
  )
  const impact = useMemo(
    () => (edit ? evaluateCourse(edit.draft, courses) : null),
    [edit?.draft, courses],
  )
  const ghostSlot = edit ? edit.candidateSlot || edit.hoverSlot || ranking?.rank1Slot || null : null
  const otherRequestsForEdit = edit
    ? changeRequests.filter(
        (r) => r.status === 'pending' && r.courseId === edit.courseId && r.id !== edit.requestId,
      )
    : []

  // --- Panel transitions ---
  const startEdit = (req) => {
    const course = courses.find((c) => c.id === req.courseId)
    if (!course) return
    const fromSlot = req.op?.kind === 'reslot' ? req.op.from : course.slots[0]
    setDetailsCourseId(null)
    setHighlight(req.courseId)
    setViewMode('sem') // placement happens on the sem grid (e.g. when editing from weekly)
    setView('student')
    setEdit({
      courseId: req.courseId,
      requestId: req.id,
      fromSlot,
      draft: cloneCourse(course),
      candidateSlot: null,
      hoverSlot: null,
      applying: false,
    })
  }

  const editDraft = (updater) => setEdit((e) => (e ? { ...e, draft: updater(e.draft) } : e))
  const hoverSlot = (slot) => setEdit((e) => (e ? { ...e, hoverSlot: slot } : e))
  const pickSlot = (slot) =>
    setEdit((e) => {
      if (!e) return e
      const prev = e.candidateSlot || e.fromSlot
      const has = e.draft.slots.includes(prev)
      const slots = Array.from(
        new Set(has ? e.draft.slots.map((s) => (s === prev ? slot : s)) : [...e.draft.slots, slot]),
      )
      return { ...e, draft: { ...e.draft, slots }, candidateSlot: slot }
    })

  const backToRequests = () => setEdit(null)

  const applyEdit = async (closeAll) => {
    if (!edit) return
    const session = edit
    setEdit((e) => (e ? { ...e, applying: true } : e))
    // Simulated server-side re-validation before the atomic commit.
    await new Promise((r) => setTimeout(r, 650))
    if (evaluateCourse(session.draft, courses).category === 'red') {
      setEdit((e) => (e ? { ...e, applying: false } : e))
      return
    }
    updateCourse(session.draft)
    const ids = [session.requestId]
    if (closeAll) ids.push(...otherRequestsForEdit.map((r) => r.id))
    resolveRequests(ids)
    setEdit(null)
  }

  // Clicking any course block highlights it on the grid and opens its detail —
  // any change request for it is shown inside the detail (after the fields).
  const onCourseClick = (course, group) => {
    setHighlight(course.id)
    openCourseDetail(course.id, group)
  }

  const placement =
    edit && editCourse
      ? {
          active: true,
          course: editCourse,
          column: editCourse.cohort,
          fromSlot: edit.fromSlot,
          destinations: ranking.map,
          candidateSlot: edit.candidateSlot,
          ghostSlot,
          onHover: hoverSlot,
          onPick: pickSlot,
        }
      : null

  const hardConflicts = conflicts.conflicts.length
  // The review rail only exists when there's something to review — any change
  // request (pending or resolved) or any live clash. Drives both sem & weekly.
  const hasReview = changeRequests.length > 0 || hardConflicts > 0
  const canPublish = pendingRequests.length === 0 && hardConflicts === 0 && !workflow.published
  const onPublish = () => {
    if (canPublish) publish()
  }

  // Export the timetable built so far as a CSV the coordinator can open in
  // Excel / Sheets. Everything else auto-saves locally; this is the explicit
  // "take a copy with me" action.
  const downloadTimetable = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['Code', 'Title', 'Batch', 'Faculty', 'Venue', 'Weeks']]
    const sorted = [...courses].sort(
      (a, b) => a.cohort.localeCompare(b.cohort) || a.code.localeCompare(b.code),
    )
    for (const c of sorted) {
      rows.push([
        c.code,
        c.title,
        c.cohort,
        c.faculty.join('; '),
        c.venue || '',
        c.slots.map(slotLabel).join(' '),
      ])
    }
    const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `timetable-${TERM.semester}-2026-27`.replace(/\s+/g, '-').toLowerCase() + '.csv'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full min-w-0 flex-1 overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Left: header/controls stay static; only the grid scrolls. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex shrink-0 items-start justify-between border-b border-slate-100 bg-white px-8 py-5 dark:border-slate-800 dark:bg-slate-950">
          <div>
            <div className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
              Department Timetable · {TERM.semester} 2026-27
            </div>
            <h1 className="text-2xl font-bold">Draft Timetable</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500">
              <Check size={13} className="text-green-500" /> Auto-saved
            </span>
            <button
              onClick={downloadTimetable}
              title="Download timetable (CSV)"
              aria-label="Download timetable"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300"
            >
              <Download size={18} />
            </button>
            <button
              onClick={onPublish}
              disabled={!canPublish}
              title={
                workflow.published
                  ? 'Already published'
                  : !canPublish
                    ? 'Resolve all change requests and conflicts first'
                    : 'Publish timetable'
              }
              className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${
                workflow.published
                  ? 'bg-ok-soft text-green-800'
                  : canPublish
                    ? 'bg-accent text-white hover:brightness-95'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800'
              }`}
            >
              {workflow.published ? 'Published ✓' : 'Publish Timetable'}
            </button>
            <button
              onClick={() => setSharing(true)}
              className="rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
            >
              Share access
            </button>
          </div>
        </header>

        {/* Status strip — slim inline badge so it doesn't eat vertical space */}
        <div className={`shrink-0 px-8 pt-2 ${weekly ? 'hidden' : ''}`}>
          {hardConflicts > 0 ? (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={13} />
              {hardConflicts} slot conflict{hardConflicts > 1 ? 's' : ''} to resolve before publishing
            </div>
          ) : pendingRequests.length === 0 && !workflow.published ? (
            <div className="inline-flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-300">
              <CheckCircle2 size={13} /> No conflicts — ready to publish
            </div>
          ) : null}
        </div>

        {/* View controls */}
        <div className="flex shrink-0 items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            {/* Undo / redo toolbar — sem view only (weekly view edits via its own grid) */}
            {!weekly && (
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title="Undo (Ctrl+Z)"
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Undo2 size={16} />
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  title="Redo (Ctrl+Shift+Z)"
                  className="flex h-8 w-8 items-center justify-center rounded-r-lg text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Redo2 size={16} />
                </button>
              </div>
            )}

            <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              Select View:
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="sem">Sem View</option>
                <option value="weekly">Weekly View</option>
              </select>
            </label>
          </div>

          {!weekly && (
            <div className="flex items-center gap-3">
              {placement && (
                <span className="text-xs italic text-accent">View locked to Student during edit</span>
              )}
              {!placement && (
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  title="View change history vs. last year's timetable"
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    historyOpen
                      ? 'border-accent text-accent'
                      : 'border-slate-200 text-slate-600 hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300'
                  }`}
                >
                  <History size={15} /> View changes
                  {changes.length > 0 && (
                    <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold text-accent dark:bg-slate-700 dark:text-slate-200">
                      {changes.length}
                    </span>
                  )}
                </button>
              )}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                {VIEWS.map((v) => (
                  <button
                    key={v.id}
                    disabled={!!placement}
                    onClick={() => setView(v.id)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition disabled:opacity-40 ${
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
          )}
        </div>

        {/* Main region — the semester grid (with its course tray), or the weekly
            view reused verbatim from the grid window. */}
        {weekly ? (
          <div className="min-h-0 flex-1 overflow-auto">
            {weeklyFocus ? (
              <WeeklyTimetable focus={weeklyFocus} courses={courses} />
            ) : (
              <p className="px-8 py-16 text-center text-sm text-slate-400">
                No courses to show yet.
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col px-8 pb-6">
            <div className="min-h-0 flex-1">
              <TimetableGrid
                view={view}
                onCellClick={onCourseClick}
                highlightCourseId={highlight}
                placement={placement}
                disputedIds={disputedIds}
                previewCourse={detailsCourseId ? detailPreview : null}
                onMoveCourses={(moves) =>
                  updateCourses(moves.map((m) => ({ ...m.course, slots: m.slots })))
                }
                trayDragCourseId={trayDrag}
                onTrayDrop={placeFromTray}
              />
            </div>

            {/* Course tray — courses not yet mapped onto the grid, draggable onto
                a week in their own column. Only shown while something is still
                unmapped (no empty placeholder once everything is placed). */}
            {!placement && unmappedCourses.length > 0 && (
              <div className="mt-3 shrink-0 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    <Layers size={12} /> Unmapped courses
                    <span className="font-normal normal-case tracking-normal text-slate-400">
                      · drag a card onto a week in its column to place it
                    </span>
                  </span>
                  {trayCohorts.length > 1 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <TrayChip
                        label="All"
                        count={unmappedCourses.length}
                        active={effectiveTrayFilter === 'all'}
                        onClick={() => setTrayFilter('all')}
                      />
                      {trayCohorts.map((co) => (
                        <TrayChip
                          key={co}
                          label={co}
                          count={unmappedCourses.filter((c) => c.cohort === co).length}
                          active={effectiveTrayFilter === co}
                          onClick={() => setTrayFilter(co)}
                        />
                      ))}
                    </div>
                  )}
                </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {shownTrayCourses.map((c) => {
                      const picked = c.id === highlight
                      return (
                        <div
                          key={c.id}
                          draggable
                          onClick={() => onCourseClick(c)}
                          onDragStart={(e) => {
                            setTrayDrag(c.id)
                            e.dataTransfer.effectAllowed = 'copy'
                            e.dataTransfer.setData('text/plain', c.id)
                          }}
                          onDragEnd={() => setTrayDrag(null)}
                          title={`Click to open · drag ${c.code} onto a week in ${c.cohort}`}
                          className={`flex w-40 shrink-0 cursor-grab select-none flex-col rounded-lg border px-3 py-2 transition active:cursor-grabbing ${
                            picked
                              ? 'border-accent ring-2 ring-accent/40 dark:border-accent'
                              : 'border-slate-200 bg-white hover:border-accent dark:border-slate-700 dark:bg-slate-900'
                          }`}
                        >
                          <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {c.code}
                          </div>
                          <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                            {c.cohort}
                          </div>
                          <div className="truncate text-[10px] text-slate-400">
                            {c.faculty.length ? c.faculty.join(', ') : 'unassigned'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Single right-side panel: edit > details (sem only) > review rail.
          The review rail (requests + clashes) is shown in BOTH sem and weekly
          views, but only when there's actually something to review. */}
      {edit && editCourse ? (
        <EditCoursePanel
          course={editCourse}
          request={changeRequests.find((r) => r.id === edit.requestId)}
          draft={edit.draft}
          setDraft={editDraft}
          impact={impact}
          ranking={ranking}
          candidateSlot={edit.candidateSlot}
          onPickSlot={pickSlot}
          applying={edit.applying}
          otherRequests={otherRequestsForEdit}
          onApply={applyEdit}
          onBack={backToRequests}
        />
      ) : !weekly && detailsCourseId ? (
        <CoursePanel
          course={courses.find((c) => c.id === detailsCourseId)}
          group={detailGroupIds.map((id) => courses.find((c) => c.id === id)).filter(Boolean)}
          onSelectCourse={(id) => {
            setHighlight(id)
            setDetailPreview(null)
            setDetailsCourseId(id)
          }}
          onClose={closeCourseDetail}
          onDraftChange={setDetailPreview}
        />
      ) : !weekly && historyOpen ? (
        <TimetableHistory
          changes={changes}
          selectedCourseId={highlight}
          onSelect={(id) => {
            setView('student') // the cohort column always shows the course
            setHighlight(id)
          }}
          onClose={() => setHistoryOpen(false)}
        />
      ) : hasReview ? (
        <ChangeRequests
          tab={railTab}
          setTab={setRailTab}
          onSelect={setHighlight}
          selectedCourseId={highlight}
          onStartEdit={startEdit}
          onOpenCourse={openCourseDetail}
        />
      ) : null}

      {sharing && <ShareModal onClose={() => setSharing(false)} />}

      {/* Toasts — slide up from the bottom centre */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{ animation: 'toast-in 0.25s ease-out' }}
            className={`pointer-events-auto flex w-[360px] max-w-[90vw] items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              t.tone === 'clash'
                ? 'border-green-200 bg-white dark:border-green-900/60 dark:bg-slate-900'
                : 'border-accent/30 bg-white dark:border-accent/30 dark:bg-slate-900'
            }`}
          >
            <CheckCircle2
              size={18}
              className={`mt-0.5 shrink-0 ${t.tone === 'clash' ? 'text-green-600' : 'text-accent'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t.title}</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t.msg}</div>
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// A light, low-emphasis filter chip for the course tray — segregates unmapped
// courses by batch when several cohorts are still waiting to be placed.
function TrayChip({ label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
        active
          ? 'bg-accent-soft text-accent dark:bg-slate-700 dark:text-slate-100'
          : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {label}
      {count != null && (
        <span className={active ? 'opacity-60' : 'text-slate-400'}>{count}</span>
      )}
    </button>
  )
}
