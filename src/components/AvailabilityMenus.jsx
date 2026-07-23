import { Ban, MessageSquarePlus, Trash2 } from 'lucide-react'

// Shared faculty-availability affordances used by both the weekly grid
// (WeeklyTimetable) and the semester grid (TimetableGrid): a cursor-anchored
// right-click action menu and the reason-entry popover for marking
// unavailability. Both mirror the DurationPopover chrome for a consistent feel.

// Small right-click action menu anchored at the cursor — the two faculty
// actions on the selected cells.
export function CellMenu({
  x,
  y,
  count,
  title,
  showUnavailable = true,
  allUnavailable,
  onRequestChange,
  onMarkUnavailable,
  onClearUnavailable,
  onClose,
}) {
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 236)
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 160)
  return (
    <>
      <div
        className="fixed inset-0 z-[60]"
        onMouseDown={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left, top }}
        className="fixed z-[61] w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {title || `${count} slot${count > 1 ? 's' : ''} selected`}
        </div>
        <button
          onClick={onRequestChange}
          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-accent-soft hover:text-accent dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <MessageSquarePlus size={15} className="shrink-0" /> Request a change
        </button>
        {showUnavailable && (
          <button
            onClick={onMarkUnavailable}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-200 dark:hover:bg-red-950/30"
          >
            <Ban size={15} className="shrink-0" /> {allUnavailable ? 'Edit reason' : 'Mark unavailable'}
          </button>
        )}
        {showUnavailable && allUnavailable && (
          <button
            onClick={onClearUnavailable}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <Trash2 size={15} className="shrink-0" /> Clear unavailable
          </button>
        )}
      </div>
    </>
  )
}

// Reason-entry popover for marking unavailability — a short note that travels to
// the coordinator with the flagged slots. `labels` are the human descriptions of
// the flagged cells (e.g. "Mon 9:30–10:25" or "Week W3"). Anchored at the cursor.
export function ReasonPopover({ x, y, labels = [], value, onChange, onSave, onClose }) {
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1024) - 292)
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 768) - 236)
  return (
    <>
      <div className="fixed inset-0 z-[60]" onMouseDown={onClose} />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ left, top }}
        className="fixed z-[61] w-72 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Ban size={14} className="text-red-500" /> Mark unavailable
        </div>
        <div className="mb-2.5 max-h-16 overflow-y-auto text-[11px] leading-relaxed text-slate-400">
          {labels.join(' · ')}
        </div>
        <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Reason
        </label>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          autoFocus
          placeholder="e.g. Away at a conference / recurring lab commitment"
          className="w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
        />
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <button
            onClick={onClose}
            className="rounded-md px-2.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex items-center gap-1.5 rounded-md bg-red-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-600"
          >
            <Ban size={12} /> Mark unavailable
          </button>
        </div>
      </div>
    </>
  )
}
