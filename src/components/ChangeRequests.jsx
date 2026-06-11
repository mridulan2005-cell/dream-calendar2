import { useState, useEffect, useRef } from 'react'
import { Check, X, ChevronRight, Crosshair, Pencil, CircleAlert } from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { describeOp } from '../logic/timetable.js'
import { slotLabel } from '../data/seed.js'

// Right-side review rail with a two-tab switch: faculty Change requests and the
// live Clashes list. Selecting a card highlights + scrolls to that course on the
// grid; a clash opens the course detail (which carries the recommended fix).
export default function ChangeRequests({
  tab,
  setTab,
  onSelect,
  selectedCourseId,
  onStartEdit,
  onOpenCourse,
}) {
  const { changeRequests, conflicts, acceptRequest, rejectRequest } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const listRef = useRef(null)

  const pendingCount = changeRequests.filter((r) => r.status === 'pending').length
  const clashes = dedupeClashes(conflicts.conflicts)

  // Open the rail and scroll the selected request card into view.
  useEffect(() => {
    if (selectedCourseId) setCollapsed(false)
  }, [selectedCourseId])
  useEffect(() => {
    if (tab !== 'requests' || !selectedCourseId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-course="${selectedCourseId}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selectedCourseId, collapsed, tab])

  if (collapsed) {
    return (
      <aside className="sticky top-0 flex h-screen w-12 shrink-0 flex-col items-center gap-3 border-l border-slate-200 bg-slate-50 py-4 dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={() => setCollapsed(false)}
          title="Show review panel"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ChevronRight size={18} className="rotate-180" />
        </button>
        {pendingCount > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
            {pendingCount}
          </span>
        )}
        {clashes.length > 0 && (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {clashes.length}
          </span>
        )}
        <span className="mt-2 [writing-mode:vertical-rl] text-xs font-medium text-slate-500">
          Review
        </span>
      </aside>
    )
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[380px] shrink-0 flex-col border-l border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 pt-4 dark:border-slate-800">
        <h2 className="text-sm font-semibold">Review</h2>
        <button
          onClick={() => setCollapsed(true)}
          title="Collapse"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Segmented tab switcher */}
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div role="tablist" className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <Tab active={tab === 'requests'} onClick={() => setTab('requests')} label="Change requests" count={pendingCount} tone="amber" />
          <Tab active={tab === 'clashes'} onClick={() => setTab('clashes')} label="Clashes" count={clashes.length} tone="red" />
        </div>
      </div>

      <div ref={listRef} className="thin-scroll flex-1 space-y-3 overflow-y-auto p-4">
        {tab === 'requests' ? (
          changeRequests.length === 0 ? (
            <Empty>No change requests.</Empty>
          ) : (
            changeRequests.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                selected={req.courseId === selectedCourseId}
                onSelect={() => onSelect(req.courseId)}
                onAccept={() => acceptRequest(req.id)}
                onReject={(reason) => rejectRequest(req.id, reason)}
                onStartEdit={() => onStartEdit(req)}
              />
            ))
          )
        ) : clashes.length === 0 ? (
          <Empty>No clashes — the draft is conflict-free. 🎉</Empty>
        ) : (
          clashes.map((c, i) => (
            <ClashCard
              key={i}
              clash={c}
              selected={c.courseIds.includes(selectedCourseId)}
              onOpen={() => onOpenCourse(c.courseIds[0])}
            />
          ))
        )}
      </div>
    </aside>
  )
}

function Tab({ active, onClick, label, count, tone }) {
  const badge =
    tone === 'red'
      ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active
          ? 'bg-white text-slate-900 shadow dark:bg-slate-700 dark:text-white'
          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${badge}`}>{count}</span>
      )}
    </button>
  )
}

const Empty = ({ children }) => (
  <p className="px-2 py-10 text-center text-sm text-slate-400">{children}</p>
)

// --- Clashes -----------------------------------------------------------------
function dedupeClashes(conflictList) {
  const seen = new Set()
  const out = []
  for (const c of conflictList) {
    const key = `${[...c.courses].sort().join('|')}|${c.type}|${c.value}|${c.slot}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

function describeClash(clash) {
  const week = <b>{slotLabel(clash.slot)}</b>
  const who = <b>{clash.value}</b>
  if (clash.type === 'faculty')
    return <>Same faculty {who} is assigned to overlapping sessions in {week}.</>
  if (clash.type === 'venue') return <>Room {who} is double-booked in {week}.</>
  return <>Cohort {who} has two overlapping sessions in {week}.</>
}

function ClashCard({ clash, selected, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className={`block w-full rounded-2xl border bg-white p-3.5 text-left transition hover:border-slate-300 dark:bg-slate-900 ${
        selected ? 'border-accent ring-2 ring-accent/30' : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
          <CircleAlert size={17} className="shrink-0 text-red-500" />
          {clash.courses[0]}
          <span className="text-sm font-normal text-slate-400">×</span>
          {clash.courses[1]}
        </span>
        <span className="shrink-0 rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:bg-red-950/50 dark:text-red-300">
          {clash.type}
        </span>
      </div>
      <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-[13px] leading-snug text-slate-600 dark:bg-slate-800/50 dark:text-slate-300">
        {describeClash(clash)}
      </div>
    </button>
  )
}

// --- Change requests ---------------------------------------------------------
// An icon-only action button that expands to reveal its text label when hovered
// (the "expanding pill" pattern). At rest it's a compact icon square; pointing
// at it slides the word out — so the row of Apply / Edit / Reject stays calm and
// uncluttered until the user reaches for one.
const PILL_TONE = {
  green:
    'text-green-600 hover:border-green-400 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30',
  accent: 'text-slate-600 hover:border-accent hover:text-accent dark:text-slate-300',
  red: 'text-slate-600 hover:border-red-400 hover:text-red-600 dark:text-slate-300',
}
function ActionPill({ icon: Icon, label, tone, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group/pill flex items-center rounded-md border border-slate-300 px-1.5 py-1 transition-all duration-200 dark:border-slate-700 ${PILL_TONE[tone]}`}
    >
      <Icon size={13} className="shrink-0" />
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-medium opacity-0 transition-all duration-200 group-hover/pill:ml-1 group-hover/pill:max-w-[64px] group-hover/pill:opacity-100">
        {label}
      </span>
    </button>
  )
}

// Pending cards reveal Apply / Edit / Reject only on hover (kept calm at rest).
// Reject opens an inline reason field that must be filled before confirming.
function RequestCard({ req, selected, onSelect, onAccept, onReject, onStartEdit }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const confirmReject = () => {
    onReject(reason.trim())
    setRejecting(false)
    setReason('')
  }

  return (
    <div
      data-course={req.courseId}
      onClick={onSelect}
      className={`group cursor-pointer rounded-2xl border p-3.5 transition ${
        selected
          ? 'border-accent shadow-md ring-2 ring-accent/30'
          : req.status === 'accepted'
            ? 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20'
            : req.status === 'rejected'
              ? 'border-slate-200 bg-slate-100 opacity-70 dark:border-slate-800 dark:bg-slate-800/40'
              : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs italic text-slate-500">Requested by {req.by}</span>
        {req.status === 'accepted' ? (
          <span className="shrink-0 rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-green-700 dark:bg-green-950/50 dark:text-green-300">
            accepted
          </span>
        ) : req.status === 'rejected' ? (
          <span className="shrink-0 rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            rejected
          </span>
        ) : (
          !rejecting && (
            <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <ActionPill
                icon={Check}
                label="Apply"
                tone="green"
                onClick={(e) => {
                  e.stopPropagation()
                  onAccept()
                }}
              />
              <ActionPill
                icon={Pencil}
                label="Edit"
                tone="accent"
                onClick={(e) => {
                  e.stopPropagation()
                  onStartEdit()
                }}
              />
              <ActionPill
                icon={X}
                label="Reject"
                tone="red"
                onClick={(e) => {
                  e.stopPropagation()
                  setRejecting(true)
                }}
              />
            </div>
          )
        )}
      </div>

      <div className="mt-1 flex items-center gap-1.5">
        <h3 className="text-base font-bold">{req.courseCode}</h3>
        {selected && <Crosshair size={14} className="text-accent" />}
      </div>
      <p className={`mt-1 text-xs text-slate-600 dark:text-slate-300 ${selected ? '' : 'line-clamp-1'}`}>
        {req.summary}
      </p>
      {selected && <p className="mt-1.5 text-xs text-slate-500">{req.detail}</p>}

      <div className="mt-2 inline-block rounded-md bg-accent-soft px-2 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
        {describeOp(req.op)}
        {req.status === 'accepted' && ' · applied'}
      </div>

      {req.status === 'rejected' && req.rejectionReason && (
        <p className="mt-2 text-[11px] text-slate-500">
          <span className="font-medium">Reason:</span> {req.rejectionReason}
        </p>
      )}

      {/* Inline reject-reason field */}
      {rejecting && (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <label className="text-[11px] font-medium text-slate-500">Reason for rejection</label>
          <textarea
            autoFocus
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this request is being rejected…"
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-900"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => {
                setRejecting(false)
                setReason('')
              }}
              className="rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={confirmReject}
              disabled={!reason.trim()}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Confirm reject
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
