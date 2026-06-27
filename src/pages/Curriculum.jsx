import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Pencil,
  Plus,
  Trash2,
  X,
  Check,
  Minus,
  CheckCircle2,
  Clock,
  Lock,
  GitCompare,
  RotateCcw,
  History,
  ArrowLeft,
  CalendarRange,
  FilePlus2,
  Send,
  Clock3,
} from 'lucide-react'
import { useApp } from '../store/AppContext.jsx'
import { PROGRAMME_IDS, entryCredits, semStatus, SEED_CURRICULUM } from '../data/curriculum.js'

const deepClone = (x) => JSON.parse(JSON.stringify(x))

// The signed-in coordinator — stamped onto a proposal so the action history
// records who proposed a change. (Prototype: a single known user.)
const CURRENT_USER = '24b3629@iitb.ac.in'

// Carry the youngest batch's curriculum forward into a fresh, not-yet-published
// version for the next incoming batch, and enrol that batch — returning a NEW
// curriculum (immutable). A no-op if the upcoming batch already exists. This is
// what makes the upcoming batch selectable inside the "Propose change" flow.
function withUpcomingBatch(curriculum, programme) {
  const prog = curriculum[programme]
  const { versions, batches } = prog
  const youngest = [...batches].sort((a, b) => b.admitYear - a.admitYear)[0]
  const nextYear = youngest.admitYear + 1
  const upcomingId = String(nextYear)
  if (batches.some((b) => b.id === upcomingId)) return curriculum

  const prefix = { BDes: 'C', MDes: 'M', PhD: 'P' }[programme] || 'C'
  const newId = `${prefix}${Object.keys(versions).length + 1}`
  const base = versions[youngest.versionId]
  const newVersion = {
    id: newId,
    label: `${nextYear} Curriculum`,
    effectiveFromYear: nextYear,
    approved: false,
    basedOn: youngest.versionId,
    note: `Carried forward from Batch ${youngest.admitYear}. Proposed — pending review.`,
    semesters: deepClone(base.semesters),
  }
  const newBatch = {
    id: upcomingId,
    label: `${nextYear}–${nextYear + 4}`,
    admitYear: nextYear,
    standing: 0,
    currentSem: youngest.currentSem - 2,
    versionId: newId,
  }
  return {
    ...curriculum,
    [programme]: { ...prog, versions: { ...versions, [newId]: newVersion }, batches: [...batches, newBatch] },
  }
}

// When a new version appears in `next` that the proposal baseline doesn't have
// yet (e.g. the user switched programme mid-proposal and we just carried a batch
// forward), fold its pristine, carried-forward state into the baseline — so a
// later edit to it diffs against the carry-forward, not against "nothing".
function foldNewVersions(baseline, next, programme) {
  const bl = baseline[programme]
  const nx = next[programme]
  if (!bl || !nx) return baseline
  const versions = { ...bl.versions }
  let changed = false
  for (const [vid, v] of Object.entries(nx.versions)) {
    if (!versions[vid]) {
      versions[vid] = v
      changed = true
    }
  }
  return changed ? { ...baseline, [programme]: { ...bl, versions } } : baseline
}

// The net set of changes a proposal currently holds: every added / modified /
// removed entry across the selected batches' versions, diffed against the
// baseline snapshot taken when the proposal began. Each carries its versionId so
// a single change can be reverted to the baseline.
function proposalDiff(curriculum, baseline, programme, batchIds) {
  const prog = curriculum[programme]
  const blProg = baseline?.[programme]
  if (!prog || !blProg) return []
  const versionIds = [
    ...new Set(prog.batches.filter((b) => batchIds.includes(b.id)).map((b) => b.versionId)),
  ]
  const out = []
  for (const vid of versionIds) {
    const v = prog.versions[vid]
    const bv = blProg.versions[vid]
    if (!v || !bv) continue
    for (const sem of v.semesters) {
      const baseSem = bv.semesters.find((s) => s.n === sem.n)
      if (!baseSem) continue
      for (const c of diffEntryChanges(baseSem.entries, sem.entries, sem.n)) out.push({ ...c, versionId: vid })
    }
  }
  return out.sort((a, b) => b.semN - a.semN)
}

// The academic term (Autumn / Spring + calendar year) a given semester runs in.
// Sem 1 is the Autumn of the admit year; each later semester is half a year on —
// odd semesters in Autumn, even semesters in the following Spring.
const termOfSem = (admitYear, n) => {
  const autumn = n % 2 === 1
  const year = autumn ? admitYear + (n - 1) / 2 : admitYear + n / 2
  return { semester: autumn ? 'Autumn' : 'Spring', year, label: `${autumn ? 'Autumn' : 'Spring'} ${year}` }
}

// Pristine snapshot of every seeded curriculum version, keyed by version id.
// Edits are immutable, so this stays untouched and serves as the baseline we
// diff in-place edits against — letting "View changes" surface for ANY batch a
// coordinator edits, not only a carried-forward new batch (which has basedOn).
const SEED_VERSIONS = Object.fromEntries(
  PROGRAMME_IDS.flatMap((pid) => Object.entries(SEED_CURRICULUM[pid].versions)),
)

// The baseline a version is diffed against: the batch it was carried forward
// from (live) if it has one, else its own pristine published snapshot.
function baseOf(version, versions) {
  if (version?.basedOn && versions[version.basedOn]) {
    const b = versions[version.basedOn]
    return { semesters: b.semesters, label: b.label }
  }
  const seed = version && SEED_VERSIONS[version.id]
  if (seed) return { semesters: seed.semesters, label: 'published' }
  return null
}
const yearOfSem = (years, n) => years.find((y) => y.sems.includes(n))?.label || ''
// Deterministic mock CPI for a completed semester (student perspective only).
const hash = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}
const mockCPI = (batchId, n) => (7.4 + (hash(`${batchId}-${n}`) % 22) / 10).toFixed(2)

// --- Student enrolment mock (student perspective, done/current sems only) -----
// For the semesters a student has finished or is doing, the curriculum shows
// what they actually took — not the full catalogue of choices. We resolve each
// basket to the option(s) they picked and each open-elective slot to a concrete
// course, deterministically per batch+semester so a given student always sees
// the same transcript. Grades are filled in for completed semesters.
// Weighted toward the higher grades, so a transcript reads plausibly.
const GRADE_POOL = ['AA', 'AA', 'AB', 'AB', 'AB', 'BB', 'BB', 'BB', 'BC', 'CC']
const mockGrade = (batchId, n, code) => GRADE_POOL[hash(`${batchId}-${n}-${code}-g`) % GRADE_POOL.length]

// A pool of plausible institute / HASMED open electives a student might take.
const ELECTIVE_POOL = [
  { code: 'HS 301', name: 'Psychology' },
  { code: 'HS 447', name: 'Film Appreciation' },
  { code: 'HS 425', name: 'Introduction to Linguistics' },
  { code: 'IM 101', name: 'Introduction to Management' },
  { code: 'HS 215', name: 'Indian English Literature' },
  { code: 'CS 101', name: 'Computer Programming and Utilization' },
  { code: 'HS 303', name: 'Philosophy of Mind' },
  { code: 'EC 101', name: 'Economics' },
]

// Deterministically pick `basket.pick` of a basket's options for this student.
const pickBasketOptions = (batchId, n, basket) => {
  const opts = basket.options || []
  const count = Math.min(basket.pick || 1, opts.length)
  return opts
    .map((o, i) => ({ o, r: hash(`${batchId}-${n}-${basket.title}-${o.code || i}`) }))
    .sort((a, b) => a.r - b.r)
    .slice(0, count)
    .map((x) => x.o)
}

// Resolve a generic open-elective slot to a concrete course this student took.
const pickElective = (batchId, n, e) => ELECTIVE_POOL[hash(`${batchId}-${n}-${e.title}`) % ELECTIVE_POOL.length]

// Flatten a semester into the concrete courses a student took: fixed cores and
// projects as-is, each basket resolved to its picked option(s), each open
// elective to a concrete course. `from` records the slot a choice came from.
const studentCourses = (sem, batch) =>
  sem.entries.flatMap((e) => {
    if (e.kind === 'core' || e.kind === 'project')
      return [{ code: e.code, name: e.name, credits: e.credits, kind: e.kind }]
    if (e.kind === 'basket')
      return pickBasketOptions(batch.id, sem.n, e).map((o) => ({
        code: o.code,
        name: o.name,
        credits: o.credits ?? e.credits,
        kind: 'elective',
        from: e.title,
      }))
    if (e.kind === 'elective') {
      const c = pickElective(batch.id, sem.n, e)
      return [{ code: c.code, name: c.name, credits: e.credits, kind: 'elective', from: e.title }]
    }
    return [] // mandatory handled separately
  })

// --- Curriculum diff (vs. the batch this version was carried forward from) ---
// A new batch's curriculum is cloned from the last batch, then edited. We surface
// every change — added / modified / removed entries — against that base so the
// coordinator sees exactly what differs.
const entryKey = (e) => (e.kind === 'basket' ? `basket:${e.title}` : `${e.kind}:${e.code || e.title}`)
const entriesEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b)
function diffSem(version, versions, semN) {
  const base = baseOf(version, versions)
  if (!base) return null
  const baseSem = base.semesters.find((s) => s.n === semN)
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
    baseLabel: base.label,
  }
}

// Flat list of every change in a batch's curriculum vs. the version it was
// carried forward from — one item per added / modified / removed entry, across
// all semesters. Drives the "View changes" panel (revert + unread tracking).
function batchChanges(version, versions) {
  const base = baseOf(version, versions)
  if (!base) return []
  const out = []
  for (const curSem of version.semesters) {
    const baseSem = base.semesters.find((s) => s.n === curSem.n)
    if (!baseSem) continue
    const baseMap = new Map(baseSem.entries.map((e) => [entryKey(e), e]))
    const curMap = new Map(curSem.entries.map((e) => [entryKey(e), e]))
    for (const e of curSem.entries) {
      const k = entryKey(e)
      if (!baseMap.has(k)) out.push(mkChange('added', curSem.n, k, e, null))
      else if (!entriesEqual(baseMap.get(k), e)) out.push(mkChange('modified', curSem.n, k, e, baseMap.get(k)))
    }
    for (const e of baseSem.entries) {
      if (!curMap.has(entryKey(e))) out.push(mkChange('removed', curSem.n, entryKey(e), null, e))
    }
  }
  // Most recent first: later semesters surface at the top of the panel.
  return out.sort((a, b) => b.semN - a.semN)
}
function mkChange(type, semN, key, cur, base) {
  const e = cur || base
  return { id: `${semN}:${type}:${key}`, type, semN, key, cur, base, code: e.code || '', name: e.name || e.title || '' }
}
// A one-line, colourless summary of what an entry's change was (panel text).
const hrsOf = (x) => `${x.l ?? 0}-${x.t ?? 0}-${x.st ?? 0}`
function changeSummary(c) {
  if (c.type === 'added') return 'Added'
  if (c.type === 'removed') return 'Removed'
  const b = c.base
  const e = c.cur
  const bits = []
  if (b.credits !== e.credits) bits.push(`${b.credits} → ${e.credits} cr`)
  if (e.kind === 'core' && hrsOf(b) !== hrsOf(e)) bits.push(`${hrsOf(b)} → ${hrsOf(e)}`)
  if ((b.name || b.title) !== (e.name || e.title)) bits.push('renamed')
  if (e.kind === 'basket' && b.pick !== e.pick) bits.push(`pick ${b.pick} → ${e.pick}`)
  return bits.length ? bits.join(' · ') : 'Edited'
}
// Diff one save into a flat list of individual entry changes (added / modified /
// removed) between the semester's previous and next entries. Each becomes one
// minimal card in the action-history bar.
function diffEntryChanges(prevEntries, nextEntries, semN) {
  const prevMap = new Map(prevEntries.map((e) => [entryKey(e), e]))
  const nextMap = new Map(nextEntries.map((e) => [entryKey(e), e]))
  const out = []
  for (const e of nextEntries) {
    const k = entryKey(e)
    if (!prevMap.has(k)) out.push(mkChange('added', semN, k, e, null))
    else if (!entriesEqual(prevMap.get(k), e)) out.push(mkChange('modified', semN, k, e, prevMap.get(k)))
  }
  for (const e of prevEntries) if (!nextMap.has(entryKey(e))) out.push(mkChange('removed', semN, entryKey(e), null, e))
  return out
}

// A short, lower-case verb/delta for one change — "added", "removed", "renamed",
// "3 → 4 cr". Mirrors the first-image card's quiet second line.
function actionLabel(c) {
  if (c.type === 'added') return 'added'
  if (c.type === 'removed') return 'removed'
  const s = changeSummary(c)
  return s === 'Edited' ? 'edited' : s
}

// Apply a revert of a single change to a semester's entries.
function revertEntries(entries, c) {
  if (c.type === 'added') return entries.filter((e) => entryKey(e) !== c.key)
  if (c.type === 'removed') return [...entries, c.base]
  return entries.map((e) => (entryKey(e) === c.key ? c.base : e))
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

  const [programme, setProgramme] = useState('BDes') // 'BDes' | 'MDes' | 'PhD'
  const [perspective, setPerspective] = useState('coordinator') // 'coordinator' | 'student'
  const [selectedBatches, setSelectedBatches] = useState(() =>
    curriculum.BDes.batches.map((b) => b.id),
  )
  // Propose-change flow. `proposalBaseline` is the curriculum snapshot the
  // proposal's net changes are diffed against (taken once the upcoming batch has
  // been carried forward); `preProposal` is the full state to restore on discard.
  const [proposing, setProposing] = useState(false)
  const [proposalBaseline, setProposalBaseline] = useState(null)
  const [preProposal, setPreProposal] = useState(null)
  const [proposalReason, setProposalReason] = useState('')
  // A running log of edits made this session — each save appends one entry.
  // Newest first, so the dock reads most-recent → oldest left to right.
  const [history, setHistory] = useState([])
  // A submitted proposal opened from the history tray, shown in a detail panel.
  const [openProposal, setOpenProposal] = useState(null)

  // Everything below is scoped to the selected programme: its meta, year
  // grouping, curriculum versions and enrolled batches.
  const prog = curriculum[programme]
  const { versions, batches } = prog
  const { years, program: programMeta } = prog

  const isStudent = perspective === 'student'
  // Most-recent batch first.
  const ordered = useMemo(() => [...batches].sort((a, b) => b.admitYear - a.admitYear), [batches])
  const youngest = ordered[0]
  const nextYear = youngest.admitYear + 1

  const visibleBatches = ordered.filter((b) => selectedBatches.includes(b.id))

  // The net set of changes the open proposal currently holds (derived, always
  // accurate), diffed against the baseline taken when the proposal began.
  const proposalChanges = useMemo(
    () => (proposing ? proposalDiff(curriculum, proposalBaseline, programme, selectedBatches) : []),
    [proposing, curriculum, proposalBaseline, programme, selectedBatches],
  )

  // Switching programme (or perspective) repopulates the batch picker: a
  // coordinator sees every batch by default; a student only their own latest.
  // While proposing, the proposal handlers own the selection, so we skip this.
  useEffect(() => {
    if (proposing) return
    const ids = [...batches].sort((a, b) => b.admitYear - a.admitYear)
    setSelectedBatches(isStudent ? [ids[0].id] : ids.map((b) => b.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programme, perspective])

  const toggleBatch = (id) =>
    setSelectedBatches((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]))
  const selectBatch = (id) => setSelectedBatches([id]) // student: single-select
  const allSelected = selectedBatches.length === ordered.length
  const toggleAllBatches = () => setSelectedBatches(allSelected ? [] : ordered.map((b) => b.id))

  // --- Immutable curriculum mutations -------------------------------------
  // Write one semester's entries (no logging) — the shared primitive behind both
  // normal edits and proposal reverts.
  const writeSemEntries = (versionId, semN, nextEntries) => {
    const v = versions[versionId]
    const nextSems = v.semesters.map((s) => (s.n === semN ? { ...s, entries: nextEntries } : s))
    setCurriculum({
      ...curriculum,
      [programme]: {
        ...prog,
        versions: { ...versions, [versionId]: { ...v, semesters: nextSems } },
      },
    })
  }
  const updateSemEntries = (versionId, semN, nextEntries) => {
    const v = versions[versionId]
    const prevEntries = v.semesters.find((s) => s.n === semN)?.entries || []
    const changes = diffEntryChanges(prevEntries, nextEntries, semN)
    writeSemEntries(versionId, semN, nextEntries)
    // While proposing, edits are summarised live in the proposal panel (derived),
    // so they don't also flood the global action history.
    if (!proposing && changes.length) {
      const batch = batches.find((b) => b.versionId === versionId)
      const stamp = Date.now()
      const items = changes.map((c, i) => ({
        id: `${stamp}-${i}-${c.id}`,
        batchId: batch?.id,
        batchLabel: batch?.admitYear ?? v.label,
        semN,
        type: c.type,
        code: c.code,
        name: c.name,
        label: actionLabel(c),
      }))
      setHistory((h) => [...items, ...h])
    }
  }

  // --- Propose-change flow -------------------------------------------------
  // Enter the flow: carry the upcoming batch forward (so it's selectable), snap
  // the baseline, and focus the picker on that incoming batch.
  const startProposal = () => {
    const next = withUpcomingBatch(curriculum, programme)
    setPreProposal(curriculum)
    setCurriculum(next)
    setProposalBaseline(next)
    setProposalReason('')
    setSelectedBatches([String(nextYear)])
    setProposing(true)
  }
  // Switch the proposal to another programme: ensure its upcoming batch exists,
  // fold it into the baseline, and focus it.
  const switchProposalProgramme = (pid) => {
    const before = new Set(curriculum[pid].batches.map((b) => b.id))
    const next = withUpcomingBatch(curriculum, pid)
    setCurriculum(next)
    setProposalBaseline((bl) => foldNewVersions(bl, next, pid))
    const orderedPid = [...next[pid].batches].sort((a, b) => b.admitYear - a.admitYear)
    const upcoming = orderedPid.find((b) => !before.has(b.id)) || orderedPid[0]
    setProgramme(pid)
    setSelectedBatches([upcoming.id])
  }
  const revertProposalChange = (c) => {
    const sem = versions[c.versionId]?.semesters.find((s) => s.n === c.semN)
    if (sem) writeSemEntries(c.versionId, c.semN, revertEntries(sem.entries, c))
  }
  const submitProposal = () => {
    if (!proposalChanges.length || !proposalReason.trim()) return
    const batchLabels = selectedBatches
      .map((id) => ordered.find((b) => b.id === id)?.admitYear)
      .filter(Boolean)
    const entry = {
      id: `prop-${Date.now()}`,
      kind: 'proposal',
      programmeLabel: programMeta.label,
      batchLabels,
      changes: proposalChanges.map((c) => ({ type: c.type, code: c.code, name: c.name, semN: c.semN })),
      reason: proposalReason.trim(),
      proposedBy: CURRENT_USER,
      status: 'Pending review',
      ts: Date.now(),
    }
    setHistory((h) => [entry, ...h])
    setProposing(false)
    setProposalBaseline(null)
    setPreProposal(null)
    setProposalReason('')
  }
  const cancelProposal = () => {
    if (preProposal) setCurriculum(preProposal)
    const src = preProposal?.[programme]?.batches || batches
    setProposing(false)
    setProposalBaseline(null)
    setPreProposal(null)
    setProposalReason('')
    setSelectedBatches([...src].sort((a, b) => b.admitYear - a.admitYear).map((b) => b.id))
  }

  const jumpToSem = (h) => {
    const el = h.batchId && document.getElementById(`sem-${h.batchId}-${h.semN}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className={`mx-auto max-w-7xl ${history.length ? 'pb-32' : 'pb-12'}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {proposing ? 'Knowledge Layer · Proposing a change' : 'Knowledge Layer'}
          </div>
          <h1 className="mt-1 text-2xl font-bold">
            {proposing ? 'Propose a curriculum change' : 'Programme Curriculum'}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {proposing
              ? 'Pick a programme and batch, edit any semester — your changes collect on the right.'
              : `${programMeta.label} · ${programMeta.durationLabel} · ${programMeta.totalCredits} credits`}
          </p>
        </div>
        {!proposing && (
          <Segmented
            value={perspective}
            onChange={setPerspective}
            options={[
              { id: 'coordinator', label: 'Coordinator', icon: Pencil },
              { id: 'student', label: 'Student', icon: GraduationCap },
            ]}
          />
        )}
      </div>

      {/* Programme + batch pickers (dual listbox) */}
      <div className="mt-5 flex flex-wrap items-start gap-4">
        <Listbox
          label="Programme"
          items={PROGRAMME_IDS.map((id) => ({ id, label: curriculum[id].program.label }))}
          selected={[programme]}
          onSelect={proposing ? switchProposalProgramme : setProgramme}
        />
        <Listbox
          label="Batch"
          multi={!isStudent}
          items={ordered.map((b) => ({
            id: b.id,
            label: `Batch ${b.admitYear}`,
            hint: versions[b.versionId].approved ? undefined : proposing ? 'upcoming' : 'ongoing',
          }))}
          selected={selectedBatches}
          onSelect={isStudent ? selectBatch : toggleBatch}
          onToggleAll={!isStudent && !proposing ? toggleAllBatches : undefined}
        />

        <div className="ml-auto flex flex-col items-end gap-3">
          {!proposing && perspective === 'coordinator' && (
            <button
              onClick={startProposal}
              className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
            >
              <FilePlus2 size={15} /> Propose change
            </button>
          )}
          {proposing && (
            <button
              onClick={cancelProposal}
              className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Discard proposal
            </button>
          )}
        </div>
      </div>

      {/* Expanded curriculum (+ proposal panel while proposing) */}
      <div className="mt-6">
        {visibleBatches.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center text-sm text-slate-400 dark:border-slate-800">
            Select a batch to view its curriculum.
          </div>
        ) : (
          <ExpandedView
            batches={visibleBatches}
            versions={versions}
            years={years}
            perspective={perspective}
            onSaveSem={updateSemEntries}
            hideReview={proposing}
            live={proposing}
            rightPanel={
              proposing ? (
                <ProposalPanel
                  programmeLabel={programMeta.label}
                  batchLabels={selectedBatches
                    .map((id) => ordered.find((b) => b.id === id)?.admitYear)
                    .filter(Boolean)}
                  changes={proposalChanges}
                  reason={proposalReason}
                  onReason={setProposalReason}
                  onRevert={revertProposalChange}
                  onSubmit={submitProposal}
                  onCancel={cancelProposal}
                />
              ) : null
            }
          />
        )}
      </div>

      <VersionHistoryBar
        history={history}
        onJump={jumpToSem}
        onOpenProposal={setOpenProposal}
        onClear={() => setHistory([])}
      />
      {openProposal && (
        <ProposalDetailPanel proposal={openProposal} onClose={() => setOpenProposal(null)} />
      )}
    </div>
  )
}

// ── Action-history bar ───────────────────────────────────────────────────────
// A docked bar that is part of the viewport, pinned to the very bottom and
// stretching the full width of the main content area (not a floating overlay).
// It's portaled to <body> and positioned to track the <main> element's box, so
// it stays correct when the sidebar collapses. Every edit appends minimal change
// cards — newest first (leftmost) — chained left by a light arrow, each clickable
// to jump back to the semester it touched. Layout references the second image.
function VersionHistoryBar({ history, onJump, onOpenProposal, onClear }) {
  // Track the main content area's left/width so the bar spans exactly it.
  // Guard against no-op updates: returning the previous state when the measured
  // box is unchanged lets React bail out, which prevents a ResizeObserver →
  // setState → re-measure feedback loop.
  const [box, setBox] = useState(null)
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const measure = () => {
      const r = main.getBoundingClientRect()
      const left = Math.round(r.left)
      const width = Math.round(r.width)
      setBox((prev) => (prev && prev.left === left && prev.width === width ? prev : { left, width }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(main)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  if (!history.length || !box) return null

  return createPortal(
    <div
      style={{ left: box.left, width: box.width }}
      className="fixed bottom-0 z-40 border-t border-slate-200 bg-white shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center gap-4 px-6 py-2.5">
        <div className="flex shrink-0 items-center gap-2 text-slate-500 dark:text-slate-400">
          <History size={15} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Action history</span>
        </div>
        <div className="thin-scroll flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {history.map((h, i) => (
            <div key={h.id} className="flex shrink-0 items-center gap-1.5">
              {i > 0 && <ArrowLeft size={14} className="shrink-0 text-slate-300 dark:text-slate-600" />}
              {h.kind === 'proposal' ? (
                <ProposalCard h={h} onClick={() => onOpenProposal(h)} />
              ) : (
                <ActionCard h={h} onClick={() => onJump(h)} />
              )}
            </div>
          ))}
        </div>
        <button
          onClick={onClear}
          className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          Clear
        </button>
      </div>
    </div>,
    document.body,
  )
}

function ActionCard({ h, onClick }) {
  const tone = CHANGE_TONE[h.type] || CHANGE_TONE.modified
  const removed = h.type === 'removed'
  return (
    <button
      onClick={onClick}
      title="Jump to this semester"
      className="flex w-44 shrink-0 flex-col gap-0.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left transition hover:border-accent dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-baseline gap-1.5">
        {h.code && (
          <span className={`shrink-0 text-[10px] font-bold ${removed ? 'text-red-300 line-through dark:text-red-400/60' : 'text-slate-400'}`}>
            {h.code}
          </span>
        )}
        <span
          className={`truncate text-[12px] ${
            removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-700 dark:text-slate-200'
          }`}
        >
          {h.name || h.code}
        </span>
      </div>
      <div className="text-[10px] text-slate-400">
        Sem {h.semN} · <span className={`font-medium ${tone}`}>{h.label}</span>
      </div>
    </button>
  )
}

// A submitted change proposal in the action history: a slightly wider card that
// records what was proposed, who proposed it, and its review status.
function ProposalCard({ h, onClick }) {
  const count = h.changes?.length ?? 0
  const scope = h.batchLabels?.length ? `Batch ${h.batchLabels.join(', ')}` : h.programmeLabel
  return (
    <button
      onClick={onClick}
      title="Open this proposal"
      className="flex w-56 shrink-0 flex-col gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-accent dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200">
          <FilePlus2 size={12} className="shrink-0 text-accent" />
          <span className="truncate">Change proposal</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          <Clock3 size={9} /> {h.status}
        </span>
      </div>
      <div className="truncate text-[10px] text-slate-400">
        {scope} · {count} change{count === 1 ? '' : 's'}
      </div>
      <div className="truncate text-[10px] text-slate-400">by {h.proposedBy}</div>
    </button>
  )
}

// ── Proposal detail panel — opened from a proposal card in the history tray ──
// A clean right-side drawer: what was proposed (the change list) and why (the
// reason), with the meta and review status. Read-only — no fills beyond the
// per-change colour that carries meaning.
const PROPOSAL_TYPE_LABEL = { added: 'Added', removed: 'Removed', modified: 'Changed' }
function ProposalDetailPanel({ proposal, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const changes = proposal.changes || []
  const scope = proposal.batchLabels?.length
    ? `Batch ${proposal.batchLabels.join(', ')}`
    : proposal.programmeLabel
  const when = new Date(proposal.ts).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" />
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        className="relative flex h-full w-[24rem] max-w-[90vw] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              <FilePlus2 size={14} className="shrink-0 text-accent" /> Change proposal
            </div>
            <div className="mt-1 truncate text-xs text-slate-400">
              {proposal.programmeLabel} · {scope}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
          <span className="flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <Clock3 size={10} /> {proposal.status}
          </span>
          <span className="truncate">by {proposal.proposedBy}</span>
          <span className="ml-auto shrink-0 text-slate-400">{when}</span>
        </div>

        <div className="thin-scroll flex-1 overflow-y-auto px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reason</div>
          <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
            {proposal.reason || <span className="text-slate-400">No reason given.</span>}
          </p>

          <div className="mt-5 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Changes requested
            </div>
            <span className="tabular-nums text-xs font-medium text-slate-400">{changes.length}</span>
          </div>
          <div className="mt-2 space-y-1.5">
            {changes.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No changes recorded.</div>
            ) : (
              changes.map((c, i) => {
                const removed = c.type === 'removed'
                const tone = CHANGE_TONE[c.type] || CHANGE_TONE.modified
                return (
                  <div
                    key={i}
                    className="flex items-start gap-2.5 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        {c.code && (
                          <span
                            className={`shrink-0 text-[11px] font-semibold ${
                              removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-400'
                            }`}
                          >
                            {c.code}
                          </span>
                        )}
                        <span
                          className={`truncate text-[13px] ${
                            removed
                              ? 'text-red-400 line-through dark:text-red-400/70'
                              : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {c.name || c.code}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Sem {c.semN}</div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-bold ${tone}`}>
                      {PROPOSAL_TYPE_LABEL[c.type] || 'Changed'}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body,
  )
}

// Batch standing label (e.g. "Year 3", "Incoming", "Graduated"), shown in each
// batch's section header in the expanded view.
function standingLabel(batch, version) {
  const maxN = Math.max(...version.semesters.map((s) => s.n))
  if (batch.currentSem > maxN) return 'Graduated'
  return batch.standing > 0 ? `Year ${batch.standing}` : 'Incoming'
}

// ── Expanded view: every semester's full curriculum, vertically ─────────────
// The browse-everything counterpart to the compact timeline. Each batch is a
// section; within it semesters run top-to-bottom (Sem 1 → Sem 8) with their
// complete course list spelled out inline. A sticky "Jump to" rail mirrors the
// structure — the current semester carries a tag and the rail tracks whatever
// section is in view (scroll-spy), so a long page stays navigable with one
// click. Read-focused: editing still lives in the timeline/overview views.
function ExpandedView({ batches, versions, years, perspective, onSaveSem, hideReview = false, rightPanel = null, live = false }) {
  const [activeId, setActiveId] = useState(null)
  // Which batch's "View changes" review is open (inline diff + side panel), and
  // which individual changes the coordinator has already seen (figma-style unread
  // dots). Both are session state — the review is a lens, not a saved setting.
  const [changesBatchId, setChangesBatchId] = useState(null)
  const [seen, setSeen] = useState(() => new Set())

  // Flat, ordered list of every semester section on screen (batch order as
  // given — most recent first — semesters ascending within each batch).
  const sections = useMemo(
    () =>
      batches.flatMap((b) =>
        versions[b.versionId].semesters.map((s) => ({ id: `sem-${b.id}-${s.n}`, batchId: b.id, n: s.n })),
      ),
    [batches, versions],
  )

  // Scroll-spy: highlight the rail item for the section nearest the top of the
  // viewport. The band (rootMargin) keeps a single active item as you scroll.
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter(Boolean)
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (!visible.length) return
        visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        setActiveId(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -75% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [sections])

  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const canEdit = perspective === 'coordinator'

  // The batch currently under change-review, its version and full change list.
  const reviewBatch = changesBatchId && batches.find((b) => b.id === changesBatchId)
  const reviewVersion = reviewBatch && versions[reviewBatch.versionId]
  const reviewChanges = useMemo(
    () => (reviewVersion ? batchChanges(reviewVersion, versions) : []),
    [reviewVersion, versions],
  )
  const markSeen = () => setSeen((prev) => new Set([...prev, ...reviewChanges.map((c) => c.id)]))
  const revertChange = (c) => {
    const sem = reviewVersion.semesters.find((s) => s.n === c.semN)
    onSaveSem(reviewVersion.id, c.semN, revertEntries(sem.entries, c))
  }

  return (
    <div className="flex gap-6">
      {/* Jump-to rail (scroll-spy) */}
      <nav className="sticky top-4 hidden h-fit w-44 shrink-0 self-start lg:block">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Jump to</div>
        <div className="mt-2 space-y-3.5">
          {batches.map((b) => {
            const batchActive = !!activeId && activeId.startsWith(`sem-${b.id}-`)
            return (
            <div key={b.id}>
              <button
                onClick={() => jumpTo(`batch-${b.id}`)}
                className={`mb-1 block w-full text-left text-xs font-bold transition ${
                  batchActive ? 'text-accent' : 'text-slate-700 hover:text-accent dark:text-slate-200'
                }`}
              >
                Batch {b.admitYear}
              </button>
              <div className="border-l border-slate-200 dark:border-slate-800">
                {versions[b.versionId].semesters.map((s) => {
                  const id = `sem-${b.id}-${s.n}`
                  const st = semStatus(b, s.n)
                  const active = activeId === id
                  return (
                    <button
                      key={id}
                      onClick={() => jumpTo(id)}
                      className={`-ml-px flex w-full items-center gap-1.5 border-l-2 py-1 pl-3 text-left text-xs transition ${
                        active
                          ? 'border-accent font-semibold text-accent'
                          : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>Sem {s.n}</span>
                      {st === 'current' && (
                        <span className="rounded bg-accent-soft px-1 py-0.5 text-[9px] font-bold uppercase text-accent dark:bg-slate-700 dark:text-slate-200">
                          Now
                        </span>
                      )}
                      {st === 'done' && <Check size={10} className="text-slate-300 dark:text-slate-600" />}
                    </button>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      </nav>

      {/* Expanded curriculum, batch by batch */}
      <div className="min-w-0 flex-1 space-y-10">
        {batches.map((b) => {
          const version = versions[b.versionId]
          const changes = batchChanges(version, versions)
          const reviewing = changesBatchId === b.id
          const unread = changes.some((c) => !seen.has(c.id))
          return (
            <section key={b.id} id={`batch-${b.id}`} className="scroll-mt-6">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Batch {b.admitYear}</h2>
                <span className="text-xs text-slate-400">{standingLabel(b, version)}</span>
                {!hideReview && changes.length > 0 && (
                  <button
                    onClick={() => setChangesBatchId(reviewing ? null : b.id)}
                    className={`ml-auto flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition ${
                      reviewing
                        ? 'font-medium text-slate-700 dark:text-slate-200'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                    }`}
                  >
                    <GitCompare size={13} />
                    <span>{reviewing ? 'Reviewing changes' : 'View changes'}</span>
                    <span className="tabular-nums text-slate-300 dark:text-slate-500">{changes.length}</span>
                    {unread && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-5">
                {version.semesters.map((s) => (
                  <ExpandedSemCard
                    key={`sem-${b.id}-${s.n}`}
                    batch={b}
                    version={version}
                    versions={versions}
                    years={years}
                    semester={s}
                    perspective={perspective}
                    reviewing={reviewing}
                    canEdit={canEdit}
                    onSaveSem={onSaveSem}
                    live={live}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      {/* Right rail: the proposal panel while proposing, else the change-review
          panel when a batch's "View changes" is open. */}
      {rightPanel
        ? rightPanel
        : reviewBatch && reviewVersion && (
            <ChangesPanel
              key={reviewBatch.id}
              batch={reviewBatch}
              changes={reviewChanges}
              seen={seen}
              onSeen={markSeen}
              onRevert={revertChange}
              onJump={(c) => jumpTo(`sem-${reviewBatch.id}-${c.semN}`)}
              onClose={() => setChangesBatchId(null)}
            />
          )}
    </div>
  )
}

// ── Proposal panel — the right rail of the "Propose change" flow ─────────────
// Clean and minimal: a quiet running list of the edits the proposal holds (colour
// only where it carries meaning — green added, red removed, amber modified), a
// reason field, and a single submit CTA. No fills, no chrome beyond the border.
function ProposalPanel({ programmeLabel, batchLabels, changes, reason, onReason, onRevert, onSubmit, onCancel }) {
  const canSubmit = changes.length > 0 && reason.trim().length > 0
  const scope = batchLabels.length
    ? `${programmeLabel} · Batch ${batchLabels.join(', ')}`
    : programmeLabel
  return (
    <aside className="sticky top-4 hidden h-fit max-h-[calc(100vh-7rem)] w-80 shrink-0 flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <header className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Proposed changes</div>
          <span className="tabular-nums text-xs font-medium text-slate-400">{changes.length}</span>
        </div>
        <div className="mt-0.5 truncate text-[11px] text-slate-400">{scope}</div>
      </header>

      <div className="thin-scroll min-h-[3rem] flex-1 overflow-y-auto">
        {changes.length === 0 ? (
          <div className="px-4 py-10 text-center text-xs text-slate-400">
            No changes yet — edit any semester below and they’ll collect here.
          </div>
        ) : (
          changes.map((c) => (
            <ProposalChangeRow key={`${c.versionId}:${c.id}`} c={c} onRevert={() => onRevert(c)} />
          ))
        )}
      </div>

      <div className="border-t border-slate-200 px-4 py-3 dark:border-slate-800">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Reason for change
        </label>
        <textarea
          value={reason}
          onChange={(e) => onReason(e.target.value)}
          rows={3}
          placeholder="Why is this change being proposed?"
          className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-1 focus:ring-accent dark:border-slate-700 dark:text-slate-200"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100"
          >
            <Send size={15} /> Submit proposal
          </button>
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </aside>
  )
}

function ProposalChangeRow({ c, onRevert }) {
  const removed = c.type === 'removed'
  const tone = CHANGE_TONE[c.type] || CHANGE_TONE.modified
  return (
    <div className="group flex items-start gap-2.5 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800/70">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          {c.code && (
            <span
              className={`shrink-0 text-[11px] font-semibold ${
                removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-400'
              }`}
            >
              {c.code}
            </span>
          )}
          <span
            className={`truncate text-[13px] ${
              removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {c.name || c.code}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          Sem {c.semN} · <span className={`font-medium ${tone}`}>{changeSummary(c)}</span>
        </div>
      </div>
      <button
        onClick={onRevert}
        title="Undo this change"
        className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  )
}

// One semester in the expanded view. Read-only by default; "Edit" flips the card
// in place into the inline editor (no side panel). When the batch is under
// change-review, the read view becomes a field-level diff against the base batch.
function ExpandedSemCard({ batch, version, versions, years, semester: s, perspective, reviewing, canEdit, onSaveSem, live = false }) {
  const navigate = useNavigate()
  const status = semStatus(batch, s.n)
  const id = `sem-${batch.id}-${s.n}`
  const diff = reviewing ? diffSem(version, versions, s.n) : null
  const base = reviewing ? baseOf(version, versions)?.semesters.find((x) => x.n === s.n) : null
  // Finished semesters are locked — their curriculum is history and can't be edited.
  const editable = canEdit && status !== 'done'
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => deepClone(s.entries))

  // In a proposal, edits are live: every change writes straight through, so it
  // surfaces in the proposal panel immediately (no "Save" step — undo lives in
  // the panel). Otherwise edits buffer in `draft` until Save.
  const applyDraft = (next) => {
    const resolved = typeof next === 'function' ? next(draft) : next
    setDraft(resolved)
    if (live) onSaveSem(version.id, s.n, resolved)
  }

  // The academic term this semester runs in, and a jump into the department
  // timetable for it — carrying a breadcrumb so the timetable can come back here.
  const term = termOfSem(batch.admitYear, s.n)
  const goToTimetable = () =>
    navigate(`/timetables?year=${term.year}&semester=${term.semester}`, {
      state: { crumbs: [{ label: 'Programme Curriculum', to: '/curriculum' }] },
    })

  const startEdit = () => {
    setDraft(deepClone(s.entries))
    setEditing(true)
  }
  const save = () => {
    onSaveSem(version.id, s.n, draft)
    setEditing(false)
  }
  const semChanges = diff?.changes || 0

  return (
    <div
      id={id}
      className={`group scroll-mt-6 rounded-2xl border bg-white p-5 transition dark:bg-slate-900 ${
        editing
          ? 'border-accent ring-2 ring-accent/40'
          : status === 'current'
            ? 'border-accent/50 ring-1 ring-accent/20'
            : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Semester {s.n}</h3>
        <StatusPill status={status} />
        <span className="text-xs text-slate-400">{yearOfSem(years, s.n)}</span>
        {!editing && reviewing && semChanges > 0 && (
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {semChanges} changed
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {!editing && (
            <button
              onClick={goToTimetable}
              title={`View the ${term.label} timetable`}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 opacity-0 transition hover:border-accent hover:text-accent focus:opacity-100 group-hover:opacity-100 dark:border-slate-700 dark:text-slate-300"
            >
              <CalendarRange size={13} /> Timetable
            </button>
          )}
          <CreditTag credits={editing ? draftCredits(draft) : s.totalCredits} label="total" />
          {canEdit && status === 'done' && !editing && (
            <span
              title="Finished semesters are locked"
              className="flex items-center gap-1 text-xs font-medium text-slate-400 dark:text-slate-500"
            >
              <Lock size={12} /> Locked
            </span>
          )}
          {editable && !editing && (
            <button
              onClick={startEdit}
              title="Edit this semester"
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent dark:border-slate-700 dark:text-slate-300"
            >
              <Pencil size={13} /> Edit
            </button>
          )}
        </span>
      </div>

      {editing ? (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            <Pencil size={13} className="shrink-0" />{' '}
            {live
              ? 'Editing live — every change appears in the proposal on the right. Undo any change there.'
              : `Editing ${version.label} — changes apply to every batch on this version.`}
          </div>
          <SemEditView draft={draft} setDraft={live ? applyDraft : setDraft} />
          <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {live ? (
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:brightness-95"
              >
                <Check size={15} /> Done
              </button>
            ) : (
              <>
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
              </>
            )}
          </div>
        </>
      ) : diff && base ? (
        <SemDiffView sem={s} base={base} diff={diff} />
      ) : (
        <SemReadView sem={s} batch={batch} perspective={perspective} status={status} flat />
      )}
    </div>
  )
}

// ── Field-level inline diff for one semester (the "View changes" read mode) ──
// Walks the base batch's entries in order so removed courses stay in place
// (struck through), survivors show old → new values inline, and added courses
// trail at the end. Mirrors the panel, but in the curriculum itself.
function SemDiffView({ sem, base, diff }) {
  const statusMap = diff?.status || {}
  const notMand = (e) => e.kind !== 'mandatory'
  const baseMap = new Map(base.entries.map((e) => [entryKey(e), e]))
  const curMap = new Map(sem.entries.map((e) => [entryKey(e), e]))

  const rows = []
  for (const be of base.entries.filter(notMand)) {
    const k = entryKey(be)
    const cur = curMap.get(k)
    if (cur) rows.push({ entry: cur, base: be, status: statusMap[k] || 'same' })
    else rows.push({ entry: be, base: be, status: 'removed' })
  }
  for (const ce of sem.entries.filter(notMand)) {
    if (!baseMap.has(entryKey(ce))) rows.push({ entry: ce, status: 'added' })
  }
  const mandatory = sem.entries.filter((e) => e.kind === 'mandatory')

  return (
    <div className="space-y-1.5">
      {rows.map((r, i) =>
        r.entry.kind === 'basket' ? <DiffBasketRow key={i} row={r} /> : <DiffCourseRow key={i} row={r} />,
      )}
      {mandatory.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
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
    </div>
  )
}

function DiffCourseRow({ row }) {
  const { entry: e, base: b, status } = row
  const isCore = e.kind === 'core'
  const metric = (x) => (isCore ? `${x.l ?? 0}-${x.t ?? 0}-${x.st ?? 0} · ${x.credits} cr` : `${x.credits} cr`)
  const removed = status === 'removed'
  const added = status === 'added'
  const modified = status === 'modified'
  const metricChanged = modified && b && metric(b) !== metric(e)

  const tone = added
    ? 'border-l-2 border-green-500 bg-green-50/50 dark:bg-green-950/20'
    : removed
      ? 'border-l-2 border-red-300 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/20'
      : modified
        ? 'border-l-2 border-amber-400 bg-amber-50/50 dark:bg-amber-950/20'
        : 'border-l-2 border-transparent'

  let marker = null
  if (added) marker = { label: 'New', cls: 'text-green-600 dark:text-green-400' }
  else if (removed) marker = { label: 'Removed', cls: 'text-red-400 dark:text-red-400/70' }
  else if (metricChanged && e.credits !== b.credits)
    marker = { label: e.credits > b.credits ? 'Credits ↑' : 'Credits ↓', cls: 'text-amber-600 dark:text-amber-400' }
  else if (modified) marker = { label: 'Changed', cls: 'text-amber-600 dark:text-amber-400' }

  return (
    <div className={`flex items-center gap-3 rounded-md px-3 py-2 ${tone}`}>
      <span className={`w-16 shrink-0 text-xs font-bold ${removed ? 'text-red-300 line-through dark:text-red-400/60' : 'text-slate-400'}`}>
        {e.code}
      </span>
      <span
        className={`min-w-0 flex-1 truncate text-sm ${
          removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-700 dark:text-slate-200'
        } ${added ? 'font-semibold' : ''}`}
      >
        {e.name || e.title}
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[11px]">
        {metricChanged && <span className="text-red-400 line-through dark:text-red-400/60">{metric(b)}</span>}
        {removed ? (
          <span className="text-red-400 line-through dark:text-red-400/60">{metric(b)}</span>
        ) : (
          <span className={metricChanged ? 'font-semibold text-green-600 dark:text-green-400' : 'text-slate-400'}>
            {metric(e)}
          </span>
        )}
      </span>
      {marker && <span className={`w-14 shrink-0 text-right text-[10px] font-bold ${marker.cls}`}>{marker.label}</span>}
    </div>
  )
}

function DiffBasketRow({ row }) {
  const { entry: e, status } = row
  if (status === 'removed')
    return (
      <div className="rounded-xl border border-dashed border-red-200 bg-red-50/40 px-3 py-2.5 dark:border-red-900/50 dark:bg-red-950/20">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-red-400 line-through dark:text-red-400/70">{e.title}</span>
          <span className="text-[10px] font-bold text-red-400 dark:text-red-400/70">Removed</span>
        </div>
      </div>
    )
  return <BasketBlock e={e} st={status === 'same' ? undefined : status} />
}

// ── "View changes" side panel — minimal, colourless, figma-comment style ─────
// Every change on one line, newest semester first, each with a revert affordance
// on hover. An unread change carries a small accent dot until the panel is seen.
function ChangesPanel({ batch, changes, seen, onSeen, onRevert, onJump, onClose }) {
  useEffect(() => {
    const t = setTimeout(onSeen, 1000)
    return () => clearTimeout(t)
  }, [onSeen])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <aside className="sticky top-4 hidden h-fit max-h-[calc(100vh-7rem)] w-72 shrink-0 flex-col self-start overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 xl:flex">
      <header className="flex items-start justify-between gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">Changes</div>
          <div className="text-[11px] text-slate-400">
            Batch {batch.admitYear} · {changes.length} change{changes.length === 1 ? '' : 's'}
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
        >
          <X size={16} />
        </button>
      </header>
      <div className="thin-scroll flex-1 overflow-y-auto">
        {changes.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-400">No changes yet.</div>
        ) : (
          changes.map((c) => (
            <ChangeRow
              key={c.id}
              c={c}
              unread={!seen.has(c.id)}
              onRevert={() => onRevert(c)}
              onJump={() => onJump?.(c)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

// Colour + label per change type — a removed course is struck through so the
// row reads as "this is gone", an added one is green, an edit amber with its
// specific delta (e.g. "3 → 4 cr"). Clicking the row scrolls the curriculum to
// the semester where the change lives.
const CHANGE_TONE = {
  added: 'text-green-600 dark:text-green-400',
  removed: 'text-red-500 dark:text-red-400',
  modified: 'text-amber-600 dark:text-amber-400',
}
function ChangeRow({ c, unread, onRevert, onJump }) {
  const removed = c.type === 'removed'
  const tone = CHANGE_TONE[c.type] || CHANGE_TONE.modified
  return (
    <div className="group flex items-start gap-2.5 border-b border-slate-100 px-4 py-2.5 last:border-0 dark:border-slate-800/70">
      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-transparent'}`} />
      <button
        onClick={onJump}
        title="Jump to this semester"
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-baseline gap-1.5">
          {c.code && (
            <span
              className={`shrink-0 text-[11px] font-semibold ${
                removed ? 'text-red-400 line-through dark:text-red-400/70' : 'text-slate-400'
              }`}
            >
              {c.code}
            </span>
          )}
          <span
            className={`truncate text-[13px] ${
              removed
                ? 'text-red-400 line-through dark:text-red-400/70'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {c.name || c.code}
          </span>
        </div>
        <div className="mt-0.5 text-[11px] text-slate-400">
          Sem {c.semN} · <span className={`font-medium ${tone}`}>{changeSummary(c)}</span>
        </div>
      </button>
      <button
        onClick={onRevert}
        title="Revert this change"
        className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 group-hover:opacity-100 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <RotateCcw size={13} />
      </button>
    </div>
  )
}

// ── Read-only semester detail (with diff highlighting vs. the base batch) ────
const DIFF_BG = {
  added: 'bg-green-50/70 ring-1 ring-green-200 dark:bg-green-950/20 dark:ring-green-900/50',
  modified: 'bg-amber-50/70 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/50',
}
function SemReadView({ sem, batch, perspective, status, diff, flat = false }) {
  // A student looking at a semester they've finished or are doing sees their own
  // enrolment — the courses they actually took, with grades once it's done —
  // not the full catalogue of electives. Upcoming sems fall through to the
  // standard catalogue view below.
  if (perspective === 'student' && (status === 'done' || status === 'current'))
    return <StudentSemView sem={sem} batch={batch} status={status} flat={flat} />

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
              <CoreRow key={`${e.code}-${i}`} e={e} st={statusOf(e)} flat={flat} />
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
                  <CreditTag credits={e.credits} flat={flat} />
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

// ── Student enrolment view (the courses a student took, with grades) ─────────
// A transcript-style read of one semester from the student's own perspective.
// Done semesters carry letter grades and an SPI; the current semester reads
// "in progress". Mandatory (non-credit) requirements sit in a quiet footer.
function StudentSemView({ sem, batch, status, flat = false }) {
  const done = status === 'done'
  const courses = studentCourses(sem, batch)
  const mandatory = sem.entries.filter((e) => e.kind === 'mandatory')
  const credits = courses.reduce((sum, c) => sum + (c.credits || 0), 0)

  return (
    <div className="space-y-4">
      {done ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/30">
          <span className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
            <CheckCircle2 size={15} /> Completed
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-green-700 dark:text-green-300">
            SPI {mockCPI(batch.id, sem.n)}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent dark:bg-slate-800 dark:text-slate-200">
          <Clock size={15} /> In progress · {credits} credits enrolled
        </div>
      )}

      <div>
        <SectionLabel>{done ? 'Courses & grades' : 'Enrolled courses'}</SectionLabel>
        <div className="mt-1.5 space-y-1">
          {courses.map((c, i) => (
            <div
              key={`${c.code}-${i}`}
              className="flex items-center gap-3 rounded-md px-2 py-1.5"
            >
              <span className="w-16 shrink-0 text-xs font-bold text-slate-400">{c.code}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-700 dark:text-slate-200">{c.name}</span>
                {c.from && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{c.from}</span>
                )}
              </span>
              {done ? (
                <GradeTag grade={mockGrade(batch.id, sem.n, c.code)} flat={flat} />
              ) : (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  ongoing
                </span>
              )}
              <CreditTag credits={c.credits} flat={flat} />
            </div>
          ))}
        </div>
      </div>

      {mandatory.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mandatory.map((e, i) => (
            <span
              key={`${e.code}-${i}`}
              className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            >
              {done ? <Check size={10} className="text-green-600 dark:text-green-400" /> : <Lock size={10} />}{' '}
              {e.code} · {e.name} (non-credit)
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// Letter-grade badge — quiet and neutral (no tier colour), so the transcript
// reads calmly rather than as a graded report card. `flat` renders it as light,
// unboxed text — for the scannable expanded view.
function GradeTag({ grade, flat = false }) {
  if (flat)
    return (
      <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums text-slate-500 dark:text-slate-400">
        {grade}
      </span>
    )
  return (
    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {grade}
    </span>
  )
}

function CoreRow({ e, st, flat = false }) {
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
      <CreditTag credits={e.credits} flat={flat} />
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

// ── Small shared bits ────────────────────────────────────────────────────────
// Dual-listbox picker. The programme list is single-select (one ticked row); the
// batch list is multi-select with an "All batches" master row. Same checkbox
// affordance throughout, scrollable and capped in height so it stays compact.
function Listbox({ label, items, selected, onSelect, multi = false, onToggleAll }) {
  const isSel = (id) => selected.includes(id)
  const allSel = items.length > 0 && items.every((it) => isSel(it.id))
  const someSel = items.some((it) => isSel(it.id))
  return (
    <div className="flex w-56 flex-col">
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div
        role="listbox"
        aria-label={label}
        aria-multiselectable={multi}
        className="thin-scroll h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 p-1 dark:border-slate-700 dark:bg-slate-900/50"
      >
        {multi && onToggleAll && (
          <>
            <ListboxRow label="All batches" checked={allSel} partial={someSel && !allSel} onClick={onToggleAll} />
            <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
          </>
        )}
        {items.map((it) => (
          <ListboxRow
            key={it.id}
            label={it.label}
            hint={it.hint}
            checked={isSel(it.id)}
            onClick={() => onSelect(it.id)}
          />
        ))}
      </div>
    </div>
  )
}

function ListboxRow({ label, hint, checked, partial = false, onClick }) {
  return (
    <button
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition ${
        checked
          ? 'bg-white font-semibold text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
          : 'text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/50'
      }`}
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition ${
          checked || partial
            ? 'border-accent bg-accent text-white'
            : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
        }`}
      >
        {partial ? <Minus size={12} strokeWidth={3} /> : checked ? <Check size={12} strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && (
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
          {hint}
        </span>
      )}
    </button>
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

function StatusPill({ status }) {
  const map = {
    done: { label: 'Completed', cls: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-300' },
    current: { label: 'Current', cls: 'bg-accent-soft text-accent dark:bg-slate-700 dark:text-slate-200' },
    upcoming: { label: 'Upcoming', cls: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' },
  }
  const s = map[status] || map.upcoming
  return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.cls}`}>{s.label}</span>
}

function CreditTag({ credits, label, flat = false }) {
  if (flat)
    return (
      <span className="shrink-0 text-xs font-medium tabular-nums text-slate-400">
        {credits} cr{label ? ` ${label}` : ''}
      </span>
    )
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
      value={value ?? ''}
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
