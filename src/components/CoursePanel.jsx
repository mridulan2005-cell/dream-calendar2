import { useState, useEffect } from 'react'
import {
  X,
  Pencil,
  Check,
  Plus,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  ArrowRight,
  CornerDownRight,
  Undo2,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import {
  slots as allSlots,
  faculty as allFaculty,
  venues as allVenues,
  slotLabel,
  slotDateRange,
  slotsSpan,
  slotById,
} from '../data/seed.js'
import { evaluateCourse, recommendFix, rankDestinations } from '../logic/constraints.js'
import { describeOp } from '../logic/timetable.js'

// Conflict-type → human label for the "Conflict detected" section.
const CONFLICT_LABEL = {
  faculty: 'Faculty Overlap',
  cohort: 'Cohort Clash',
  room: 'Room Conflict',
  facility: 'Venue Facility',
  protected: 'Protected Slot',
  capacity: 'Room Capacity',
  b2b: 'Back-to-back',
}
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) + '.' : s)
import { Field } from './CourseFields.jsx'

const init = (course) => ({
  ...course,
  faculty: [...course.faculty],
  slots: [...course.slots],
  dateRanges: course.dateRanges.map((r) => ({ ...r })),
})

const norm = (c) => JSON.stringify({ s: [...c.slots].sort(), v: c.venue, f: [...c.faculty].sort() })
const byWeek = (ids) => [...ids].sort((a, b) => (slotById[a]?.week || 0) - (slotById[b]?.week || 0))

// A slot chip with a hover tooltip telling when that week runs.
function Chip({ children, tip }) {
  return (
    <span className="group/chip relative inline-block">
      <span className="block rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {children}
      </span>
      <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/chip:opacity-100 dark:bg-slate-700">
        {tip}
      </span>
    </span>
  )
}

// Course detail with inline, hover-to-edit fields. Hovering a field reveals a
// pencil; clicking it edits that field in place. Edits update a draft that is
// mirrored live onto the grid (via onDraftChange) and re-scored for impact;
// nothing is committed until "Save changes".
export default function CoursePanel({
  course,
  onClose,
  variant = 'full',
  onDraftChange,
  group = [],
  onSelectCourse,
}) {
  const { updateCourse, courses, changeRequests, acceptRequest, rejectRequest } = useApp()
  const [draft, setDraft] = useState(() => init(course))
  const [editingField, setEditingField] = useState(null) // 'slots' | 'venue' | 'faculty' | null

  // Change requests raised against this course (shown after the details).
  const requests = changeRequests.filter(
    (r) => r.courseId === course.id || r.courseCode === course.code,
  )

  // Reload when a different course opens.
  useEffect(() => {
    setDraft(init(course))
    setEditingField(null)
  }, [course.id])

  // Keep the draft's slots in sync when the SAME course is moved directly on the
  // grid (drag-drop commits to the store immediately). Without this, the panel's
  // stale draft is mirrored back over the grid and the move appears to need a
  // manual Save. Only slots are synced, so in-panel venue/faculty edits survive.
  useEffect(() => {
    setDraft((d) => {
      const same =
        d.slots.length === course.slots.length && d.slots.every((s) => course.slots.includes(s))
      return same ? d : { ...d, slots: [...course.slots] }
    })
  }, [course.slots]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror the working draft onto the grid for a live preview.
  useEffect(() => {
    onDraftChange?.(draft)
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  const [reassignDone, setReassignDone] = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)

  const dirty = norm(draft) !== norm(course)
  const impact = evaluateCourse(draft, courses)
  const recommendation =
    impact.hard.length > 0 || impact.soft.length > 0 ? recommendFix(draft, courses) : null
  const hasProblem = impact.hard.length > 0 || impact.soft.length > 0
  const isClash = impact.hard.length > 0

  // System solutions, best first. Slot moves come from the constraint engine
  // (ranked using how clean each week is — i.e. faculty availability and past
  // placements); a non-move fallback is offered per conflict type.
  const moveTo = (from, to) =>
    setDraft((d) => ({ ...d, slots: d.slots.map((s) => (s === from ? to : s)) }))
  const solutions = []
  if (recommendation) {
    const ranking = rankDestinations(draft, recommendation.from, courses)
    for (const slot of ranking.top.slice(0, 2)) {
      solutions.push({
        key: `move-${slot}`,
        title: `Move to ${slotLabel(slot)}`,
        desc: sentence(ranking.map[slot]?.reason),
        onClick: () => moveTo(recommendation.from, slot),
      })
    }
  }
  if (impact.hard.some((h) => h.type === 'faculty')) {
    solutions.push({
      key: 'reassign',
      title: 'Request Faculty Reassignment',
      desc: reassignDone ? 'Admin has been notified.' : 'Keep slot, but alert Admin to reassign.',
      onClick: () => setReassignDone(true),
      done: reassignDone,
    })
  }
  if (impact.hard.some((h) => h.type === 'room')) {
    solutions.push({
      key: 'room',
      title: 'Request Room Change',
      desc: 'Keep slot, ask facilities for another venue.',
      onClick: () => setReassignDone(true),
    })
  }

  const addSlot = (id) =>
    setDraft((d) => ({ ...d, slots: d.slots.includes(id) ? d.slots : [...d.slots, id] }))
  const removeSlot = (id) => setDraft((d) => ({ ...d, slots: d.slots.filter((s) => s !== id) }))
  const removeFaculty = (name) =>
    setDraft((d) => ({ ...d, faculty: d.faculty.filter((f) => f !== name) }))
  const addFaculty = (name) =>
    setDraft((d) => ({ ...d, faculty: d.faculty.includes(name) ? d.faculty : [...d.faculty, name] }))

  // The number of weeks is fixed by the course duration; you can't save unless
  // exactly that many weeks are selected.
  const targetWeeks = draft.durationWeeks || draft.slots.length || 1
  const weeksOk = draft.slots.length === targetWeeks

  const save = () => {
    if (!weeksOk) return
    updateCourse(draft)
    onClose()
  }

  const shell =
    variant === 'inset'
      ? 'sticky top-0 flex max-h-[calc(100vh-4rem)] w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
      : 'flex h-full min-h-0 w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'

  // Render a field as a hover-to-edit row, or its inline editor when active.
  const field = (key, label, display, editor) =>
    editingField === key ? (
      <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
          <button
            onClick={() => setEditingField(null)}
            className="flex items-center gap-1 text-xs font-semibold text-accent"
          >
            <Check size={13} /> Done
          </button>
        </div>
        {editor}
      </div>
    ) : (
      <button
        onClick={() => setEditingField(key)}
        className="group -mx-2.5 block w-full rounded-lg px-2.5 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800/50"
      >
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
          <Pencil size={12} className="text-slate-400 opacity-0 transition group-hover:opacity-100" />
        </div>
        {display}
      </button>
    )

  return (
    <aside className={shell}>
      {/* Parallel-course tabs at the very top — switch between the courses that
          run in this slot (underline-indicator tab pattern). */}
      {group.length > 1 && (
        <div
          className="thin-scroll flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-1 dark:border-slate-800"
          role="tablist"
          aria-label="Parallel courses"
        >
          {group.map((c) => {
            const isActive = c.id === course.id
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={isActive}
                title={c.title}
                onClick={() => !isActive && onSelectCourse?.(c.id)}
                className={`relative shrink-0 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'text-accent'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {c.code}
                {isActive && (
                  <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold">{draft.code}</h2>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{draft.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draft.type} Course &nbsp;|&nbsp; {draft.credits} Credits &nbsp;|&nbsp; {draft.year}
          </p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Conflict detected + system solutions */}
        {hasProblem && (
          <div
            className={`rounded-xl border p-4 ${
              isClash
                ? 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20'
                : 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20'
            }`}
          >
            <div
              className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${
                isClash ? 'text-red-600 dark:text-red-300' : 'text-amber-600 dark:text-amber-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isClash ? 'bg-red-500' : 'bg-amber-500'}`} />
              {isClash ? 'Conflict detected' : 'Constraint noted'}
            </div>

            <ul className="mt-2.5 space-y-1.5 text-sm text-slate-700 dark:text-slate-200">
              {(isClash ? impact.hard : impact.soft).map((it, i) => (
                <li key={i}>
                  <span className="font-semibold">{CONFLICT_LABEL[it.type] || 'Conflict'}:</span>{' '}
                  {it.text}
                </li>
              ))}
            </ul>

            {solutions.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  System solutions
                </div>
                <div className="mt-2 space-y-2">
                  {solutions.map((sol, i) => (
                    <button
                      key={sol.key}
                      onClick={sol.onClick}
                      className={`relative block w-full rounded-lg border p-3 text-left transition ${
                        i === 0
                          ? 'border-accent bg-white shadow-sm hover:brightness-[0.98] dark:bg-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                      }`}
                    >
                      {i === 0 && (
                        <span className="absolute right-2 top-0 -translate-y-1/2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                          Recommended
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {sol.done && <Check size={13} className="text-green-600" />}
                        {sol.title}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sol.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-[10px] italic text-slate-400">
                  Ranked using faculty availability &amp; past-term placements.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Slots (inline editable) — chips show when they run on hover */}
        {field(
          'slots',
          'Slots',
          <div className="flex flex-wrap gap-2">
            {draft.slots.length ? (
              byWeek(draft.slots).map((s) => (
                <Chip key={s} tip={`Runs ${slotDateRange(s)}`}>
                  {slotLabel(s)}
                </Chip>
              ))
            ) : (
              <span className="text-sm italic text-amber-600">not allotted</span>
            )}
          </div>,
          <div className="flex flex-wrap items-center gap-2">
            {byWeek(draft.slots).map((s) => (
              <span
                key={s}
                title={slotDateRange(s)}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
              >
                {slotLabel(s)}
                <button onClick={() => removeSlot(s)} className="text-slate-400 hover:text-red-500">
                  <X size={13} />
                </button>
              </span>
            ))}
            {draft.slots.length < targetWeeks &&
              (addingSlot ? (
                <select
                  autoFocus
                  onChange={(e) => {
                    if (e.target.value) addSlot(e.target.value)
                    setAddingSlot(false)
                  }}
                  onBlur={() => setAddingSlot(false)}
                  className="rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
                >
                  <option value="">Select week…</option>
                  {allSlots
                    .filter((s) => !draft.slots.includes(s.id))
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label} · {slotDateRange(s.id)}
                      </option>
                    ))}
                </select>
              ) : (
                <button
                  onClick={() => setAddingSlot(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 hover:border-accent hover:text-accent dark:border-slate-600"
                >
                  <Plus size={13} /> Add
                </button>
              ))}
          </div>,
        )}

        {/* Course Duration is fixed; the selected weeks must total it. */}
        <Field label="Course Duration">
          {draft.slots.length ? (
            <div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {targetWeeks} week{targetWeeks === 1 ? '' : 's'} total
                {!weeksOk && (
                  <span className="ml-1 font-normal text-amber-600">
                    · select {targetWeeks} ({draft.slots.length} selected)
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1">
                {byWeek(draft.slots).map((s) => (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    <span className="w-9 shrink-0 font-medium text-slate-500">{slotLabel(s)}</span>
                    <span className="text-slate-600 dark:text-slate-300">{slotDateRange(s)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-sm italic text-amber-600">no slots selected</span>
          )}
        </Field>

        {/* Venue (inline editable) */}
        {field(
          'venue',
          'Venue',
          <span className="text-sm text-slate-700 dark:text-slate-200">
            {draft.venue || <span className="italic text-amber-600">not allotted</span>}
          </span>,
          <select
            value={draft.venue}
            onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))}
            className="w-full rounded-lg bg-white px-3 py-2 text-sm dark:bg-slate-900"
          >
            <option value="">— not allotted —</option>
            {allVenues.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>,
        )}

        {/* Faculty (inline editable) */}
        {field(
          'faculty',
          'Teaching Faculty',
          <div className="flex flex-wrap gap-2">
            {draft.faculty.length ? (
              draft.faculty.map((f) => (
                <span key={f} className="rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">
                  {f}
                </span>
              ))
            ) : (
              <span className="text-sm italic text-amber-600">not allotted</span>
            )}
          </div>,
          <div className="flex flex-wrap items-center gap-2">
            {draft.faculty.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-700"
              >
                {f}
                <button onClick={() => removeFaculty(f)} className="text-slate-400 hover:text-red-500">
                  <X size={13} />
                </button>
              </span>
            ))}
            <FacultyAdd existing={draft.faculty} onAdd={addFaculty} />
          </div>,
        )}

        {/* Change requests raised against this course */}
        {requests.length > 0 && (
          <div className="border-t border-slate-100 pt-5 dark:border-slate-800">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Change request{requests.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-3">
              {requests.map((req) => (
                <RequestItem
                  key={req.id}
                  req={req}
                  onAccept={() => acceptRequest(req.id)}
                  onReject={() => rejectRequest(req.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — only appears once the course has unsaved edits. With no edits
          there is nothing to save; close via the × in the header. */}
      {dirty && (
        <div className="flex gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
          <button
            onClick={() => setDraft(init(course))}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <Undo2 size={15} /> Undo
          </button>
          <button
            onClick={save}
            disabled={!weeksOk}
            title={
              weeksOk
                ? undefined
                : `Select exactly ${targetWeeks} week${targetWeeks === 1 ? '' : 's'} (${draft.slots.length} selected)`
            }
            className="flex-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800"
          >
            Save changes
          </button>
        </div>
      )}
    </aside>
  )
}

function RequestItem({ req, onAccept, onReject }) {
  const pending = req.status === 'pending'
  return (
    <div
      className={`rounded-xl border p-3 text-xs ${
        req.status === 'accepted'
          ? 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20'
          : req.status === 'rejected'
            ? 'border-slate-200 bg-slate-50 opacity-70 dark:border-slate-800 dark:bg-slate-900'
            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="italic text-slate-500">Requested by {req.by}</span>
        {pending ? (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onAccept}
              title="Accept & apply"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-green-600 hover:text-white dark:border-slate-700"
            >
              <Check size={14} strokeWidth={3} />
            </button>
            <button
              onClick={onReject}
              title="Reject"
              className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-300 text-slate-500 hover:bg-slate-500 hover:text-white dark:border-slate-700"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <span
            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase ${
              req.status === 'accepted'
                ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300'
                : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {req.status}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-slate-700 dark:text-slate-200">{req.summary}</p>
      <p className="mt-1 text-slate-500">{req.detail}</p>
      <div className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {describeOp(req.op)}
      </div>
    </div>
  )
}

function Banner({ tone, icon: Icon, title, items }) {
  const cls =
    tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300'
      : 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
  const head = tone === 'red' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
  return (
    <div className={`rounded-xl border p-3 text-xs ${cls}`}>
      <div className={`flex items-center gap-1.5 font-semibold ${head}`}>
        <Icon size={13} /> {title}
      </div>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i}>• {t}</li>
        ))}
      </ul>
    </div>
  )
}

function FacultyAdd({ existing, onAdd }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 hover:border-accent hover:text-accent dark:border-slate-600"
      >
        <Plus size={13} /> Add
      </button>
    )
  }
  return (
    <select
      autoFocus
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value)
        setOpen(false)
      }}
      onBlur={() => setOpen(false)}
      className="rounded-md bg-white px-2 py-1 text-sm dark:bg-slate-900"
    >
      <option value="">Select…</option>
      {allFaculty
        .filter((f) => !existing.includes(f))
        .map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
    </select>
  )
}
