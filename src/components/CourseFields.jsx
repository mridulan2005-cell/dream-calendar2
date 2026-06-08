import { useState } from 'react'
import { X, Plus } from 'lucide-react'
import {
  slots as allSlots,
  faculty as allFaculty,
  venues as allVenues,
  slotLabel,
  slotDateRange,
  slotById,
} from '../data/seed.js'

// Controlled editor fields for a course draft (slots, duration, dates, venue,
// faculty). Shared by the course-details panel and the change-request edit panel
// so both look and behave identically. `setDraft` takes a functional updater.
export default function CourseFields({ draft, setDraft }) {
  const [addingFaculty, setAddingFaculty] = useState(false)
  const [addingSlot, setAddingSlot] = useState(false)

  const target = draft.durationWeeks || draft.slots.length || 1
  const sortedSlots = [...draft.slots].sort((a, b) => (slotById[a]?.week || 0) - (slotById[b]?.week || 0))
  const availableSlots = allSlots.filter((s) => !draft.slots.includes(s.id))

  const addSlot = (id) =>
    setDraft((d) => ({ ...d, slots: d.slots.includes(id) ? d.slots : [...d.slots, id] }))
  const removeSlot = (id) => setDraft((d) => ({ ...d, slots: d.slots.filter((s) => s !== id) }))

  const removeFaculty = (name) =>
    setDraft((d) => ({ ...d, faculty: d.faculty.filter((f) => f !== name) }))

  const addFaculty = (name) =>
    setDraft((d) => ({
      ...d,
      faculty: d.faculty.includes(name) ? d.faculty : [...d.faculty, name],
    }))

  return (
    <div className="space-y-6">
      {/* Weeks — add chips like the faculty field; must total the course duration. */}
      <Field label="Week">
        <div className="flex flex-wrap items-center gap-2">
          {sortedSlots.map((s) => (
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
          {draft.slots.length < target &&
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
                {availableSlots.map((s) => (
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
        </div>
      </Field>

      {/* Duration is fixed by the course; the weeks must total it. */}
      <Field label="Duration">
        <span className="text-sm text-slate-600 dark:text-slate-300">
          {target} week{target === 1 ? '' : 's'}
        </span>
        {draft.slots.length !== target && (
          <span className="ml-1 text-sm text-amber-600">
            · select {target} week{target === 1 ? '' : 's'} ({draft.slots.length} selected)
          </span>
        )}
      </Field>

      {/* Dates (derived — every module starts and ends on a week) */}
      <Field label="Dates">
        {draft.slots.length ? (
          <div className="space-y-1">
            {[...draft.slots]
              .sort((a, b) => (slotById[a]?.week || 0) - (slotById[b]?.week || 0))
              .map((s) => (
                <div key={s} className="text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{slotLabel(s)}</span>
                  <span className="text-slate-400"> · {slotDateRange(s)}</span>
                </div>
              ))}
          </div>
        ) : (
          <span className="text-sm italic text-amber-600">no weeks selected</span>
        )}
      </Field>

      {/* Venue */}
      <Field label="Venue 1">
        <select
          value={draft.venue}
          onChange={(e) => setDraft((d) => ({ ...d, venue: e.target.value }))}
          className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800"
        >
          <option value="">— not allotted —</option>
          {allVenues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>

      {/* Faculty */}
      <Field label="Teaching Faculty">
        <div className="flex flex-wrap items-center gap-2">
          {draft.faculty.map((f) => (
            <span
              key={f}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
            >
              {f}
              <button onClick={() => removeFaculty(f)} className="text-slate-400 hover:text-red-500">
                <X size={13} />
              </button>
            </span>
          ))}
          {addingFaculty ? (
            <select
              autoFocus
              onChange={(e) => {
                if (e.target.value) addFaculty(e.target.value)
                setAddingFaculty(false)
              }}
              onBlur={() => setAddingFaculty(false)}
              className="rounded-md bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800"
            >
              <option value="">Select…</option>
              {allFaculty
                .filter((f) => !draft.faculty.includes(f))
                .map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
            </select>
          ) : (
            <button
              onClick={() => setAddingFaculty(true)}
              className="inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2 py-1 text-sm text-slate-500 hover:border-accent hover:text-accent dark:border-slate-600"
            >
              <Plus size={13} /> Add
            </button>
          )}
        </div>
      </Field>
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {children}
    </div>
  )
}
