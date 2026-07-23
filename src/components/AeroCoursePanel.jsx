import { X } from 'lucide-react'
import { aeroSlotById } from '../data/aeroTimetable.js'
import { periodLabel } from '../data/slotSystem.js'
import { Field } from './CourseFields.jsx'

const TYPE_LABEL = {
  core: 'Core course',
  lab: 'Laboratory',
  elective: 'Elective — chosen from a basket',
}

// "S1" → "Mon, Tue, Thu · 9:30 – 10:25". A slot's periods all share a clock time,
// so one line describes the whole slot.
function describeSlot(id) {
  const slot = aeroSlotById[id]
  if (!slot) return null
  return `${slot.days.join(', ')} · ${periodLabel(slot.start)} – ${periodLabel(slot.end)}`
}

// A slot chip with a hover tooltip for when it meets — the same read-only chip
// pattern the IDC course panel uses for its week slots. The chip shows the real
// institute slot code(s) (e.g. "1A · 1B · 1C").
function SlotChip({ name }) {
  const tip = describeSlot(name)
  const label = aeroSlotById[name]?.code || name
  return (
    <span className="group/chip relative inline-block">
      <span className="block rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {label}
      </span>
      {tip && (
        <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/chip:opacity-100 dark:bg-slate-700">
          {tip}
        </span>
      )}
    </span>
  )
}

// Course details for the published B.Tech timetable. Read-only by nature: a
// B.Tech course's slot, room and teacher are set by the institute's own slot
// system, so there is nothing to edit here. Laid out exactly like the IDC course
// panel — the same field labels and chips — so a course reads identically in
// either department: slot, venue and faculty, and nothing else.
export default function AeroCoursePanel({ course, group = [], onSelectCourse, onClose }) {
  if (!course) return null

  return (
    <aside className="flex h-full min-h-0 w-[380px] shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Sibling courses in the same block become tabs, exactly as they do in the
          IDC planner's drawer. */}
      {group.length > 1 && (
        <div
          className="thin-scroll flex gap-1 overflow-x-auto border-b border-slate-100 px-4 pt-1 dark:border-slate-800"
          role="tablist"
          aria-label="Courses in this block"
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
                {isActive && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
              </button>
            )
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5 dark:border-slate-800">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{course.code}</h2>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">{course.title}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {TYPE_LABEL[course.type]} &nbsp;|&nbsp; {course.ltpc} &nbsp;|&nbsp; {course.year}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close course details"
          className="shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body — slot, venue, faculty, in the IDC panel's field style. */}
      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        <Field label="Slots">
          {course.slots.length ? (
            <div className="flex flex-wrap gap-2">
              {course.slots.map((name) => (
                <SlotChip key={name} name={name} />
              ))}
            </div>
          ) : (
            <span className="text-sm italic text-amber-600">not allotted</span>
          )}
        </Field>

        <Field label="Venue">
          {course.venue ? (
            <span className="inline-block rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {course.venue}
            </span>
          ) : (
            <span className="text-sm italic text-slate-400">Follows the chosen course.</span>
          )}
        </Field>

        <Field label="Teaching Faculty">
          {course.faculty.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {course.faculty.map((f) => (
                <span
                  key={f}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {f}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm italic text-slate-400">
              Assigned once the student picks a course from the basket.
            </span>
          )}
        </Field>
      </div>
    </aside>
  )
}
