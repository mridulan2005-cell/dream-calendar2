import { useState } from 'react'
import { ArrowLeft, CheckCircle2, Loader2, ArrowRight } from 'lucide-react'
import CourseFields from './CourseFields.jsx'
import { slotLabel } from '../data/seed.js'

// Unified change-request edit surface: the same course editor that opens on a
// course click, PLUS the live constraint impact of the edit and ranked
// alternatives — in one side panel, with back-navigation to the requests list.
// Everything is a dry run; nothing commits until "Apply change".
export default function EditCoursePanel({
  course,
  request,
  draft,
  setDraft,
  impact,
  ranking,
  candidateSlot,
  onPickSlot,
  applying,
  otherRequests = [],
  onApply,
  onBack,
}) {
  const [showResolve, setShowResolve] = useState(false)
  const cat = impact?.category
  const target = draft.durationWeeks || draft.slots.length || 1
  const weeksOk = draft.slots.length === target
  const canApply = weeksOk && cat !== 'red' && !applying

  const handleApply = () => {
    if (!canApply) return
    if (otherRequests.length > 0) setShowResolve(true)
    else onApply(false)
  }

  const alts = (ranking?.top || []).filter((s) => s !== candidateSlot).slice(0, 2)

  return (
    <aside className="sticky top-0 flex h-screen w-[380px] shrink-0 flex-col border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      {/* Header with back-navigation */}
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <button
          onClick={onBack}
          className="mb-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft size={14} /> Change requests
        </button>
        <div className="text-[11px] font-medium uppercase tracking-wide text-accent">
          Edit · dry run
        </div>
        <h2 className="mt-0.5 text-lg font-bold">{course.code}</h2>
        <p className="text-xs text-slate-500">{course.title}</p>
        {request && (
          <div className="mt-2 rounded-lg bg-white p-2 text-xs dark:bg-slate-950">
            <span className="italic text-slate-500">Requested by {request.by}:</span>{' '}
            <span className="text-slate-700 dark:text-slate-200">{request.detail}</span>
          </div>
        )}
      </div>

      <div className="thin-scroll flex-1 space-y-5 overflow-y-auto p-5">
        {/* The course editor (identical to the course-details panel) */}
        <CourseFields draft={draft} setDraft={setDraft} />

        {/* Ranked alternatives for the requested slot move */}
        {alts.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Suggested slots
            </div>
            <div className="space-y-2">
              {alts.map((slotId) => {
                const e = ranking.map[slotId]
                return (
                  <div
                    key={slotId}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] font-bold text-white">
                        {e.rank}
                      </span>
                      <div>
                        <div className="font-semibold">{slotLabel(slotId)}</div>
                        <div className="text-[10px] text-green-700 dark:text-green-400">
                          {e.reason}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => onPickSlot(slotId)}
                      className="flex items-center gap-1 rounded-md px-2 py-1 font-medium text-accent hover:bg-accent-soft dark:hover:bg-slate-800"
                    >
                      use <ArrowRight size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer / actions */}
      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        {showResolve ? (
          <div className="space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {otherRequests.length} other request(s) target {course.code}. Resolve which?
            </p>
            <button
              onClick={() => onApply(false)}
              className="w-full rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95"
            >
              Resolve only this request
            </button>
            <button
              onClick={() => onApply(true)}
              className="w-full rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Resolve all {otherRequests.length + 1} for {course.code}
            </button>
            <button
              onClick={() => setShowResolve(false)}
              className="w-full py-1 text-xs text-slate-400 hover:text-slate-600"
            >
              back
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onBack}
              disabled={applying}
              className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!canApply}
              title={
                !weeksOk
                  ? `Select exactly ${target} week${target === 1 ? '' : 's'} (${draft.slots.length} selected)`
                  : cat === 'red'
                    ? 'Resolve the hard clash before applying'
                    : 'Apply this change'
              }
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800"
            >
              {applying ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Re-validating…
                </>
              ) : (
                <>
                  <CheckCircle2 size={15} /> Apply change
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
