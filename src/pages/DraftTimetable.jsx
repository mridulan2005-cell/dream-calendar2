import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle2, Undo2, Redo2, X } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { TERM } from '../data/seed.js'
import { rankDestinations, evaluateCourse } from '../logic/constraints.js'
import TimetableGrid from '../components/TimetableGrid.jsx'
import PersonalisedTimetable from '../components/PersonalisedTimetable.jsx'
import ChangeRequests from '../components/ChangeRequests.jsx'
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
  const [viewMode, setViewMode] = useState('planning') // 'planning' | 'personalised'
  const [sharing, setSharing] = useState(false)
  const personalised = viewMode === 'personalised'

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
  const canPublish = pendingRequests.length === 0 && hardConflicts === 0 && !workflow.published
  const onPublish = () => {
    if (canPublish) publish()
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

        {/* Status strip */}
        <div className={`shrink-0 px-8 pt-4 ${personalised ? 'hidden' : ''}`}>
          {hardConflicts > 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              <AlertTriangle size={16} />
              {hardConflicts} slot conflict(s) must be resolved before publishing.
            </div>
          ) : pendingRequests.length === 0 && !workflow.published ? (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-2 text-sm text-green-700 dark:bg-green-950/30 dark:text-green-300">
              <CheckCircle2 size={16} /> No conflicts and all requests resolved — ready to publish.
            </div>
          ) : null}
        </div>

        {/* View controls */}
        <div className="flex shrink-0 items-center justify-between px-8 py-5">
          <div className="flex items-center gap-4">
            {/* Undo / redo toolbar — planning only (personalised view is read-only) */}
            {!personalised && (
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
                <option value="planning">Planning View</option>
                <option value="personalised">Personalised View</option>
              </select>
            </label>
          </div>

          {!personalised && (
            <div className="flex items-center gap-3">
              {placement && (
                <span className="text-xs italic text-accent">View locked to Student during edit</span>
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

        {/* Main region — planning grid, or the read-only personalised view */}
        {personalised ? (
          <div className="min-h-0 flex-1">
            <PersonalisedTimetable />
          </div>
        ) : (
          <div className="min-h-0 flex-1 px-8 pb-6">
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
            />
          </div>
        )}
      </div>

      {/* Single right-side panel (planning only): edit > details > requests */}
      {personalised ? null : edit && editCourse ? (
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
      ) : detailsCourseId ? (
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
      ) : (
        <ChangeRequests
          tab={railTab}
          setTab={setRailTab}
          onSelect={setHighlight}
          selectedCourseId={highlight}
          onStartEdit={startEdit}
          onOpenCourse={openCourseDetail}
        />
      )}

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
