import { useState, useEffect, useMemo } from 'react'
import {
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  CheckCircle2,
  Clock,
  Lock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import {
  CURRICULUM_YEARS,
  CURRICULUM_PROGRAM,
  entryCredits,
  semStatus,
} from '../data/curriculum.js'

const deepClone = (x) => JSON.parse(JSON.stringify(x))
const yearOfSem = (n) => CURRICULUM_YEARS.find((y) => y.sems.includes(n))?.label || ''
// Deterministic mock CPI for a completed semester (student perspective only).
const hash = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const mockCPI = (batchId, n) => (7.4 + (hash(`${batchId}-${n}`) % 22) / 10).toFixed(2)

// Academic-term label for a given offset from "now" (Aut nowYear). Odd offsets
// land on Spring, even on Autumn — the same odd/even rhythm as the semesters.
const termLabel = (nowYear, t) => {
  const aut = t % 2 === 0
  const year = aut ? nowYear + t / 2 : nowYear + (t + 1) / 2
  return `${aut ? 'Aut' : 'Spr'} ${year}`
}

// --- Curriculum diff (vs. the batch this version was carried forward from) ---
// A new batch's curriculum is cloned from the last batch, then edited. We surface
// every change — added / modified / removed entries — against that base so the
// coordinator sees exactly what differs.
const entryKey = (e) => (e.kind === 'basket' ? `basket:${e.title}` : `${e.kind}:${e.code || e.title}`)
const entriesEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function diffSem(version, versions, semN) {
  const baseId = version?.basedOn
  if (!baseId || !versions[baseId]) return null
  const baseSem = versions[baseId].semesters.find((s) => s.n === semN)
  const curSem = version.semesters.find((s) => s.n === semN)
  if (!baseSem || !curSem) return null
  const baseMap = new Map(baseSem.entries.map((e) => [entryKey(e), e]))
  const status = {}
  let added = 0
  let modified = 0
  for (const e of curSem.entries) {
    const k = entryKey(e)
    if (!baseMap.has(k)) {
      status[k] = 'added'
      added++
    } else if (!entriesEqual(baseMap.get(k), e)) {
      status[k] = 'modified'
      modified++
    } else status[k] = 'same'
  }
  const curKeys = new Set(curSem.entries.map(entryKey))
  const removed = baseSem.entries.filter((e) => !curKeys.has(entryKey(e)))
  return {
    status,
    removed,
    added,
    modified,
    changes: added + modified + removed.length,
    baseLabel: versions[baseId].label,
  }
}

// ── Programme Curriculum ─────────────────────────────────────────────────────
// The knowledge layer for the B.Des. programme: input, view and edit what each
// batch studies, semester by semester. Curriculum is versioned — a change is
// proposed as a new version effective from a chosen batch and every batch after,
// while current batches keep theirs (or are edited in place before the term).
//
// Layout: a clean matrix — each batch is a row, its eight semesters laid out in
// one horizontal stretch grouped by year. Selecting a semester opens an in-flow
// detail panel on the right that adjusts the matrix (never an overlay).
export default function Curriculum() {
  const { curriculum, setCurriculum } = useApp()
  const { versions, batches } = curriculum

  const [filter, setFilter] = useState('all') // 'all' | batchId
  const [view, setView] = useState('overview') // 'overview' | 'current'
  const [perspective, setPerspective] = useState('coordinator') // | 'student'
  const [open, setOpen] = useState(null) // { batchId, n } selected for the panel
  const [createOpen, setCreateOpen] = useState(false)
  const [showOlder, setShowOlder] = useState(false)

  // Most-recent batch first. The newest RECENT_COUNT batches show by default;
  // anything older sits behind a "view older batches" toggle to stay uncluttered.
  const RECENT_COUNT = 3
  const ordered = useMemo(() => [...batches].sort((a, b) => b.admitYear - a.admitYear), [batches])
  const older = ordered.slice(RECENT_COUNT)
  const chipBatches = showOlder ? ordered : ordered.slice(0, RECENT_COUNT)
  const youngest = ordered[0]
  const nextYear = youngest.admitYear + 1

  const visibleBatches = filter === 'all' ? chipBatches : ordered.filter((b) => b.id === filter)

  // Close the panel when the filter, view or perspective changes.
  useEffect(() => setOpen(null), [filter, view, perspective])

  // --- Immutable curriculum mutations -------------------------------------
  const updateSemEntries = (versionId, semN, nextEntries) => {
    const v = versions[versionId]
    const nextSems = v.semesters.map((s) => (s.n === semN ? { ...s, entries: nextEntries } : s))
    setCurriculum({
      ...curriculum,
      versions: { ...versions, [versionId]: { ...v, semesters: nextSems } },
    })
  }
  // Create the curriculum for the next incoming batch: carry the youngest
  // batch's curriculum forward into a fresh version, marked "ongoing" (not yet
  // published) so it stays editable until approved. Enrols the new batch and
  // jumps to it.
  const createNextBatch = () => {
    const newId = `C${Object.keys(versions).length + 1}`
    const base = versions[youngest.versionId]
    const newVersion = {
      id: newId,
      label: `${nextYear} Curriculum`,
      effectiveFromYear: nextYear,
      approved: false, // ongoing — not published like the others
      basedOn: youngest.versionId, // for diffing against the last batch
      note: `Carried forward from Batch ${youngest.admitYear}. Ongoing — not yet published.`,
      semesters: deepClone(base.semesters),
    }
    // currentSem at "now" follows the same odd/even cadence: two sems per year
    // behind the next-younger batch (so an incoming batch sits before Sem 1).
    const newBatch = {
      id: String(nextYear),
      label: `${nextYear}–${nextYear + 4}`,
      admitYear: nextYear,
      standing: 0,
      currentSem: youngest.currentSem - 2,
      versionId: newId,
    }
    setCurriculum({
      ...curriculum,
      versions: { ...versions, [newId]: newVersion },
      batches: [...batches, newBatch],
    })
    setFilter(newBatch.id)
    setCreateOpen(false)
  }

  const openBatch = open && batches.find((b) => b.id === open.batchId)
  const openVersion = openBatch && versions[openBatch.versionId]
  const openSemester = openVersion && openVersion.semesters.find((s) => s.n === open.n)
  const batchesOnOpenVersion = openVersion
    ? batches.filter((b) => b.versionId === openVersion.id).length
    : 0

  return (
    <div className="mx-auto max-w-7xl pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Knowledge Layer
          </div>
          <h1 className="mt-1 text-2xl font-bold">Programme Curriculum</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {CURRICULUM_PROGRAM.label} · 4-year programme · {CURRICULUM_PROGRAM.totalCredits} credits
          </p>
        </div>
        <Segmented
          value={perspective}
          onChange={setPerspective}
          options={[
            { id: 'coordinator', label: 'Coordinator', icon: Pencil },
            { id: 'student', label: 'Student', icon: GraduationCap },
          ]}
        />
      </div>

      {/* View selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Select view</span>
        <ViewSelect value={view} onChange={setView} />
        <span className="ml-1 hidden items-center gap-3 text-[11px] text-slate-400 sm:flex">
          <span className="flex items-center gap-1">
            <Lock size={11} /> completed
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-accent" /> current
          </span>
        </span>
      </div>

      {/* Batch filter chips (most recent first) + create-next-batch CTA */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip label="All batches" active={filter === 'all'} onClick={() => setFilter('all')} />
        {chipBatches.map((b) => (
          <Chip
            key={b.id}
            label={`Batch ${b.admitYear}`}
            active={filter === b.id}
            onClick={() => setFilter(b.id)}
          />
        ))}
        {older.length > 0 && (
          <button
            onClick={() => setShowOlder((v) => !v)}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:text-accent dark:text-slate-400"
          >
            {showOlder ? (
              <>
                <ChevronLeft size={14} /> Hide older
              </>
            ) : (
              <>
                View older batches ({older.length}) <ChevronRight size={14} />
              </>
            )}
          </button>
        )}
        {perspective === 'coordinator' && (
          <button
            onClick={() => setCreateOpen(true)}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
          >
            <Plus size={15} /> New · Batch {nextYear}
          </button>
        )}
      </div>

      {/* Active view + in-flow detail panel */}
      <div className="mt-6 flex gap-6">
        <div className="min-w-0 flex-1">
          {view === 'overview' ? (
            <BatchMatrix
              batches={visibleBatches}
              versions={versions}
              perspective={perspective}
              open={open}
              onOpen={(batchId, n) => setOpen({ batchId, n })}
            />
          ) : (
            <CurrentView
              batches={visibleBatches}
              versions={versions}
              perspective={perspective}
              open={open}
              onOpen={(batchId, n) => setOpen({ batchId, n })}
            />
          )}
        </div>

        {open && openSemester && (
          <DetailPanel
            key={`${openVersion.id}-${open.batchId}-${open.n}`}
            batch={openBatch}
            version={openVersion}
            versions={versions}
            semester={openSemester}
            perspective={perspective}
            batchesOnVersion={batchesOnOpenVersion}
            onClose={() => setOpen(null)}
            onSave={(entries) => updateSemEntries(openVersion.id, open.n, entries)}
          />
        )}
      </div>

      {createOpen && (
        <CreateBatchModal
          fromBatch={youngest}
          fromVersion={versions[youngest.versionId]}
          nextYear={nextYear}
          onCancel={() => setCreateOpen(false)}
          onConfirm={createNextBatch}
        />
      )}
    </div>
  )
}

// ── The matrix: batch rows, semesters in one horizontal stretch by year ──────
function BatchMatrix({ batches, versions, perspective, open, onOpen }) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Year group headers, aligned over the semester columns */}
        <div className="flex items-end gap-4">
          <div className="w-24 shrink-0" />
          {CURRICULUM_YEARS.map((y) => (
            <div key={y.year} className="w-[20rem] shrink-0 border-l border-slate-200 pl-4 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {y.label}
              </div>
            </div>
          ))}
        </div>

        {/* One row per batch */}
        {batches.map((b) => {
          const version = versions[b.versionId]
          return (
            <div key={b.id} className="mt-3 flex items-stretch gap-4">
              <BatchRowLabel batch={b} version={version} />
              {CURRICULUM_YEARS.map((y) => (
                <div
                  key={y.year}
                  className="flex w-[20rem] shrink-0 gap-2.5 border-l border-slate-200 pl-4 dark:border-slate-800"
                >
                  {y.sems.map((n) => {
                    const sem = version.semesters.find((s) => s.n === n)
                    return (
                      <div key={n} className="min-w-0 flex-1">
                        <SemCell
                          batch={b}
                          sem={sem}
                          version={version}
                          status={semStatus(b, n)}
                          active={open && open.batchId === b.id && open.n === n}
                          perspective={perspective}
                          diffCount={diffSem(version, versions, n)?.changes || 0}
                          onClick={() => onOpen(b.id, n)}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// A single semester card in the matrix.
function SemCell({ batch, sem, version, status, active, perspective, onClick, diffCount = 0 }) {
  const tone = active
    ? 'border-accent ring-2 ring-accent/40 bg-white dark:bg-slate-900'
    : status === 'current'
      ? 'border-accent/60 ring-1 ring-accent/30 bg-white dark:bg-slate-900'
      : status === 'done'
        ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40'
        : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900'
  return (
    <button
      onClick={onClick}
      className={`flex h-full w-full flex-col gap-1.5 rounded-xl border p-3 text-left transition ${tone}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-bold ${
            status === 'done' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
          }`}
        >
          Sem {sem.n}
        </span>
        {status === 'done' ? (
          <Lock size={12} className="text-slate-400" />
        ) : status === 'current' ? (
          <span className="h-2 w-2 rounded-full bg-accent" />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <VersionTag version={version} />
        {diffCount > 0 && (
          <span className="inline-flex items-center rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            {diffCount} changed
          </span>
        )}
      </div>
      {perspective === 'student' ? (
        <StudentLine batch={batch} n={sem.n} status={status} />
      ) : (
        <span className="text-[11px] text-slate-400">{sem.totalCredits} cr</span>
      )}
    </button>
  )
}

function VersionTag({ version }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
        version.approved
          ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
      }`}
    >
      {version.id}
      {!version.approved && ' · ongoing'}
    </span>
  )
}

// Batch row label, shared by the overview matrix and the current timeline.
function BatchRowLabel({ batch, version }) {
  return (
    <div className="flex w-24 shrink-0 flex-col justify-center">
      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Batch {batch.admitYear}</div>
      <div className="text-[10px] text-slate-400">
        {batch.standing > 0 ? `Year ${batch.standing}` : 'Incoming'}
      </div>
      {!version.approved && (
        <span className="mt-1 inline-flex w-fit items-center rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          Ongoing
        </span>
      )}
    </div>
  )
}

// ── Current timeline: semesters aligned by calendar term, "now" centred ──────
// Columns are academic terms around "now"; each batch's semester sits in the
// term it actually runs, so every batch's current semester lines up in the
// highlighted "now" column. Cells before a batch joins read "—"; after Sem 8,
// "graduated".
function CurrentView({ batches, versions, perspective, open, onOpen }) {
  // The calendar year of the current (autumn) term. Every batch agrees on it:
  // Sem 1 runs in admitYear, and each later semester is half a year on.
  const nowYear = batches.length ? batches[0].admitYear + (batches[0].currentSem - 1) / 2 : 2025
  const offsets = [-2, -1, 0, 1, 2]
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-max">
        {/* Term headers */}
        <div className="flex gap-3">
          <div className="w-24 shrink-0" />
          {offsets.map((t) => {
            const now = t === 0
            return (
              <div
                key={t}
                className={`w-44 shrink-0 pb-2 text-center text-sm font-semibold ${
                  now ? 'text-accent' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {termLabel(nowYear, t)}
                {now && <span className="ml-1 font-normal">· now</span>}
              </div>
            )
          })}
        </div>

        {/* One row per batch */}
        {batches.map((b) => {
          const version = versions[b.versionId]
          return (
            <div key={b.id} className="mt-3 flex items-stretch gap-3">
              <BatchRowLabel batch={b} version={version} />
              {offsets.map((t) => {
                const n = b.currentSem + t
                const sem = version.semesters.find((s) => s.n === n)
                const now = t === 0
                return (
                  <div key={t} className={`relative w-44 shrink-0 ${now ? 'px-px' : ''}`}>
                    {now && (
                      <span className="pointer-events-none absolute -left-1.5 top-0 h-full w-0.5 rounded bg-accent/70" />
                    )}
                    {sem ? (
                      <SemCell
                        batch={b}
                        sem={sem}
                        version={version}
                        status={semStatus(b, n)}
                        active={open && open.batchId === b.id && open.n === n}
                        perspective={perspective}
                        diffCount={diffSem(version, versions, n)?.changes || 0}
                        onClick={() => onOpen(b.id, n)}
                      />
                    ) : (
                      <div className="flex h-full min-h-[5.5rem] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs text-slate-300 dark:border-slate-800 dark:text-slate-600">
                        {n > 8 ? 'graduated' : '—'}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StudentLine({ batch, n, status }) {
  if (status === 'done')
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
        <CheckCircle2 size={11} /> CPI {mockCPI(batch.id, n)}
      </span>
    )
  if (status === 'current')
    return (
      <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
        <Clock size={11} /> in progress
      </span>
    )
  return <span className="text-[11px] font-medium text-slate-400">upcoming</span>
}

// ── In-flow detail panel (adjusts the matrix, not an overlay) ────────────────
function DetailPanel({ batch, version, versions, semester, perspective, batchesOnVersion, onClose, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => deepClone(semester.entries))
  const status = semStatus(batch, semester.n)
  const canEdit = perspective === 'coordinator'
  const diff = diffSem(version, versions, semester.n)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (editing ? setEditing(false) : onClose())
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, onClose])

  const startEdit = () => {
    setDraft(deepClone(semester.entries))
    setEditing(true)
  }
  const save = () => {
    onSave(draft)
    setEditing(false)
  }

  return (
    <aside className="sticky top-4 flex max-h-[calc(100vh-7rem)] w-[420px] shrink-0 flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Semester {semester.n}</h2>
            <StatusPill status={status} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span>
              {yearOfSem(semester.n)} · Batch {batch.admitYear} · {version.label}
            </span>
            {!version.approved && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                Ongoing
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              title="Edit this semester"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {editing && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Pencil size={13} className="shrink-0" />
          Editing {version.label} — affects {batchesOnVersion} batch
          {batchesOnVersion > 1 ? 'es' : ''} on this version.
        </div>
      )}

      {!editing && diff && diff.changes > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-blue-200 bg-blue-50 px-5 py-2 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
          <span className="font-semibold">{diff.changes} change{diff.changes > 1 ? 's' : ''}</span>
          <span className="text-blue-500 dark:text-blue-400">vs {diff.baseLabel}</span>
          <span className="ml-auto flex items-center gap-2">
            {diff.added > 0 && <DiffTag status="added" count={diff.added} />}
            {diff.modified > 0 && <DiffTag status="modified" count={diff.modified} />}
            {diff.removed.length > 0 && <DiffTag status="removed" count={diff.removed.length} />}
          </span>
        </div>
      )}

      <div className="thin-scroll flex-1 overflow-y-auto p-5">
        {editing ? (
          <SemEditView draft={draft} setDraft={setDraft} />
        ) : (
          <SemReadView sem={semester} batch={batch} perspective={perspective} status={status} diff={diff} />
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
        <CreditTag credits={editing ? draftCredits(draft) : semester.totalCredits} label="total" />
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              <Check size={15} /> Save changes
            </button>
          </div>
        ) : (
          <span className="text-xs text-slate-400">
            {semester.entries.filter((e) => e.kind !== 'mandatory').length} courses
          </span>
        )}
      </footer>
    </aside>
  )
}

// ── Read-only semester detail (with diff highlighting vs. the base batch) ────
const DIFF_BG = {
  added: 'bg-green-50/70 ring-1 ring-green-200 dark:bg-green-950/20 dark:ring-green-900/50',
  modified: 'bg-amber-50/70 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/50',
}
function SemReadView({ sem, batch, perspective, status, diff }) {
  const cores = sem.entries.filter((e) => e.kind === 'core' || e.kind === 'project')
  const baskets = sem.entries.filter((e) => e.kind === 'basket')
  const electives = sem.entries.filter((e) => e.kind === 'elective')
  const mandatory = sem.entries.filter((e) => e.kind === 'mandatory')
  const statusOf = (e) => diff?.status?.[entryKey(e)]

  return (
    <div className="space-y-4">
      {perspective === 'student' && status === 'done' && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-950/30 dark:text-green-300">
          <CheckCircle2 size={14} /> Completed with CPI {mockCPI(batch.id, sem.n)}
        </div>
      )}

      {cores.length > 0 && (
        <div>
          <SectionLabel>Core courses</SectionLabel>
          <div className="mt-1.5 space-y-1">
            {cores.map((e, i) => (
              <CoreRow key={`${e.code}-${i}`} e={e} st={statusOf(e)} />
            ))}
          </div>
        </div>
      )}

      {baskets.map((e, i) => (
        <BasketBlock key={`${e.title}-${i}`} e={e} st={statusOf(e)} />
      ))}

      {electives.length > 0 && (
        <div>
          <SectionLabel>Open electives</SectionLabel>
          <div className="mt-1.5 space-y-1.5">
            {electives.map((e, i) => {
              const st = statusOf(e)
              return (
                <div
                  key={`${e.title}-${i}`}
                  className={`flex items-center justify-between rounded-lg border border-dashed border-slate-200 px-3 py-2 dark:border-slate-700 ${st ? DIFF_BG[st] || '' : ''}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{e.title}</span>
                      <DiffTag status={st} />
                    </div>
                    {e.note && <div className="text-[11px] text-slate-400">{e.note}</div>}
                  </div>
                  <CreditTag credits={e.credits} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {mandatory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mandatory.map((e, i) => (
            <span
              key={`${e.code}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              <Lock size={10} /> {e.code} · {e.name} (non-credit)
            </span>
          ))}
        </div>
      )}

      {/* Entries that the base batch had but this one dropped. */}
      {diff?.removed?.length > 0 && (
        <div>
          <SectionLabel>Removed from {diff.baseLabel}</SectionLabel>
          <div className="mt-1.5 space-y-1">
            {diff.removed.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg bg-red-50/60 px-3 py-1.5 text-xs text-red-400 line-through dark:bg-red-950/20 dark:text-red-400/70"
              >
                <span className="w-16 shrink-0 font-semibold">{e.code || ''}</span>
                <span className="min-w-0 flex-1 truncate">{e.name || e.title}</span>
                <DiffTag status="removed" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CoreRow({ e, st }) {
  return (
    <div className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${st ? DIFF_BG[st] || '' : ''}`}>
      <span className="w-16 shrink-0 text-xs font-bold text-slate-400">{e.code}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{e.name}</span>
      <DiffTag status={st} />
      {e.kind === 'core' && (e.l || e.t || e.st) ? (
        <span className="hidden shrink-0 text-[10px] text-slate-400 sm:inline">
          {e.l}-{e.t}-{e.st}
        </span>
      ) : null}
      <CreditTag credits={e.credits} />
    </div>
  )
}

function BasketBlock({ e, st }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30 ${st ? DIFF_BG[st] || '' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {e.title}
          <DiffTag status={st} />
        </span>
        <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent dark:bg-slate-700 dark:text-slate-200">
          pick {e.pick} · {e.credits} cr
        </span>
      </div>
      <div className="mt-2 space-y-1">
        {e.options.map((o, i) => (
          <div key={`${o.code}-${i}`} className="flex items-center gap-2 text-xs">
            <span className="w-16 shrink-0 font-semibold text-slate-400">{o.code}</span>
            <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{o.name}</span>
            <span className="shrink-0 text-slate-400">{o.credits} cr</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Added / Changed / Removed pill used in the diff view.
function DiffTag({ status, count }) {
  if (!status || status === 'same') return null
  const map = {
    added: { label: 'New', cls: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
    modified: { label: 'Changed', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
    removed: { label: 'Removed', cls: 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300' },
  }
  const s = map[status]
  if (!s) return null
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${s.cls}`}>
      {count != null ? `${count} ` : ''}
      {s.label}
    </span>
  )
}

// ── Inline editor ────────────────────────────────────────────────────────────
const draftCredits = (entries) => entries.reduce((sum, e) => sum + entryCredits(e), 0)

function SemEditView({ draft, setDraft }) {
  const update = (i, patch) => setDraft(draft.map((e, idx) => (idx === i ? { ...e, ...patch } : e)))
  const remove = (i) => setDraft(draft.filter((_, idx) => idx !== i))
  const add = (entry) => setDraft([...draft, entry])

  const updateOption = (ei, oi, patch) =>
    update(ei, { options: draft[ei].options.map((o, idx) => (idx === oi ? { ...o, ...patch } : o)) })
  const addOption = (ei) =>
    update(ei, { options: [...draft[ei].options, { code: '', name: '', credits: draft[ei].credits || 2 }] })
  const removeOption = (ei, oi) =>
    update(ei, { options: draft[ei].options.filter((_, idx) => idx !== oi) })

  return (
    <div className="space-y-2.5">
      {draft.map((e, i) =>
        e.kind === 'basket' ? (
          <div
            key={i}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-slate-800 dark:bg-slate-800/30"
          >
            <div className="flex items-center gap-2">
              <Input
                value={e.title}
                onChange={(v) => update(i, { title: v })}
                placeholder="Basket title"
                className="flex-1 font-semibold"
              />
              <RemoveBtn onClick={() => remove(i)} />
            </div>
            <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
              <span>pick</span>
              <Input
                type="number"
                value={e.pick}
                onChange={(v) => update(i, { pick: Number(v) || 1 })}
                className="w-12 text-center"
              />
              <span>· credits each</span>
              <Input
                type="number"
                value={e.credits}
                onChange={(v) => update(i, { credits: Number(v) || 0 })}
                className="w-14 text-center"
              />
            </div>
            <div className="mt-2 space-y-1.5">
              {e.options.map((o, oi) => (
                <div key={oi} className="flex items-center gap-1.5">
                  <Input value={o.code} onChange={(v) => updateOption(i, oi, { code: v })} placeholder="Code" className="w-16" />
                  <Input
                    value={o.name}
                    onChange={(v) => updateOption(i, oi, { name: v })}
                    placeholder="Course name"
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    value={o.credits}
                    onChange={(v) => updateOption(i, oi, { credits: Number(v) || 0 })}
                    className="w-12 text-center"
                  />
                  <RemoveBtn onClick={() => removeOption(i, oi)} />
                </div>
              ))}
              <button
                onClick={() => addOption(i)}
                className="flex items-center gap-1 text-[11px] font-medium text-accent transition hover:underline"
              >
                <Plus size={11} /> Add option
              </button>
            </div>
          </div>
        ) : (
          <div key={i} className="flex items-center gap-1.5">
            <Input value={e.code} onChange={(v) => update(i, { code: v })} placeholder="Code" className="w-16" />
            <Input
              value={e.name || e.title}
              onChange={(v) => update(i, e.kind === 'elective' ? { title: v } : { name: v })}
              placeholder="Course / requirement name"
              className="flex-1"
            />
            <Input
              type="number"
              value={e.credits}
              onChange={(v) => update(i, { credits: Number(v) || 0 })}
              className="w-12 text-center"
            />
            <RemoveBtn onClick={() => remove(i)} />
          </div>
        ),
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <AddBtn onClick={() => add({ kind: 'core', code: '', name: '', l: 0, t: 0, st: 0, credits: 4 })}>
          Add course
        </AddBtn>
        <AddBtn onClick={() => add({ kind: 'basket', title: 'New basket', pick: 1, credits: 2, options: [] })}>
          Add elective basket
        </AddBtn>
        <AddBtn onClick={() => add({ kind: 'elective', title: 'Open elective', credits: 6 })}>
          Add open elective
        </AddBtn>
      </div>
    </div>
  )
}

// ── Create-next-batch confirmation ───────────────────────────────────────────
// Carries the youngest batch's curriculum forward to the next incoming batch.
// The new curriculum starts "ongoing" (unpublished) so it can be edited freely.
function CreateBatchModal({ fromBatch, fromVersion, nextYear, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onMouseDown={onCancel}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent dark:bg-slate-800">
            <Plus size={18} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Create curriculum for Batch {nextYear}?
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              It carries forward{' '}
              <b className="text-slate-700 dark:text-slate-200">Batch {fromBatch.admitYear}</b>'s
              curriculum ({fromVersion.label}) by default. You can edit any semester afterwards.
            </p>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <Clock size={16} className="shrink-0" />
            <span>
              Starts as <b>Ongoing</b> — it stays editable and isn't published like the other
              curriculums until you approve it.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-3 dark:border-slate-800">
          <button
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95"
          >
            <Plus size={15} /> Create curriculum
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small shared bits ────────────────────────────────────────────────────────
// The view picker: a clean labelled dropdown (Overview / Current timeline).
function ViewSelect({ value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3.5 pr-9 text-sm font-semibold text-slate-700 outline-none transition hover:border-slate-300 focus:border-accent dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        <option value="overview">Overview</option>
        <option value="current">Current timeline</option>
      </select>
      <ChevronDown
        size={15}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
      />
    </div>
  )
}

function Segmented({ value, onChange, options }) {
  return (
    <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
      {options.map((o) => {
        const Icon = o.icon
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              value === o.id
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {Icon && <Icon size={15} />} {o.label}
          </button>
        )
      })}
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
      }`}
    >
      {label}
    </button>
  )
}

function StatusPill({ status }) {
  const map = {
    done: { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
    current: { label: 'Current', cls: 'bg-accent-soft text-accent dark:bg-slate-700 dark:text-slate-200' },
    upcoming: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  }
  const s = map[status] || map.upcoming
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.cls}`}>{s.label}</span>
}

function CreditTag({ credits, label }) {
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {credits} cr{label ? ` ${label}` : ''}
    </span>
  )
}

const SectionLabel = ({ children }) => (
  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{children}</div>
)

function Input({ value, onChange, placeholder, type = 'text', className = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`rounded-md border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-accent dark:border-slate-700 dark:bg-slate-950 ${className}`}
    />
  )
}

const RemoveBtn = ({ onClick }) => (
  <button
    onClick={onClick}
    title="Remove"
    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
  >
    <Trash2 size={13} />
  </button>
)

const AddBtn = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 rounded-lg border border-dashed border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-500 transition hover:border-accent hover:text-accent dark:border-slate-600 dark:text-slate-400"
  >
    <Plus size={13} /> {children}
  </button>
)
