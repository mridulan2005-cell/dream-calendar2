import { useMemo, useState } from 'react'
import { X, Send } from 'lucide-react'
import { Overlay } from './Overlay.jsx'

// A faculty member's "Request a change" dialog. Rather than editing the master
// timetable directly (that's the coordinator's job), they describe what they'd
// like changed for one of their courses and send it to the department timetable
// coordinator. This is a lightweight wireframe flow — it confirms via a toast.
export default function RequestChangeModal({
  courses,
  fromName,
  myCourseKey,
  presetCourseId = null,
  presetMessage = '',
  onClose,
  onSubmit,
}) {
  // The faculty's own courses are the ones they can request changes to.
  const myCourses = useMemo(() => {
    const list = myCourseKey
      ? courses.filter((c) => c.faculty?.includes(myCourseKey))
      : courses
    // De-dupe by code — the same course can appear across several cohorts.
    const seen = new Set()
    return list.filter((c) => (seen.has(c.code) ? false : seen.add(c.code)))
  }, [courses, myCourseKey])

  const [courseId, setCourseId] = useState(
    presetCourseId || (myCourses[0] ? myCourses[0].id : ''),
  )
  const [message, setMessage] = useState(presetMessage)

  const selected = courses.find((c) => c.id === courseId) || null
  const canSend = message.trim().length > 0

  const submit = () => {
    if (!canSend) return
    onSubmit({ courseCode: selected?.code || '', courseId, message: message.trim() })
  }

  return (
    <Overlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Request a change</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your request goes to the department timetable coordinator for review.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mt-5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          Course
        </label>
        {myCourses.length > 0 ? (
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900"
          >
            {myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title} ({c.cohort})
              </option>
            ))}
          </select>
        ) : (
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            A general request (not tied to a specific course).
          </p>
        )}

        <label className="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-400">
          What would you like changed?
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          autoFocus
          placeholder="e.g. Could DE 319 move out of slot M4 — it clashes with a lab I run that week."
          className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900"
        />

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">From {fromName}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!canSend}
              className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} /> Send request
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  )
}
