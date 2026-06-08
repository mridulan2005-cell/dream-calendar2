// Core timetable logic: progress counters, conflict detection, view pivots,
// and applying faculty change requests. No React in here — pure functions so
// the rules are easy to reason about and test.

import { cohorts, slots, faculty as allFaculty, venues, slotLabel } from '../data/seed.js'
import { inSameElectiveGroup, isJointSession } from '../data/rules.js'

// --- Batchwise filtering -------------------------------------------------
// The course lists filter by PROGRAM (the student batch). M.Des. programmes
// additionally split by DISCIPLINE, and M.Des. (Research) by year — these show
// up as a contextual second dropdown next to the program selector.
export const PROGRAMS = [
  { id: 'BDes 1', label: 'B.Des. 1st Year' },
  { id: 'BDes 2', label: 'B.Des. 2nd Year' },
  { id: 'BDes 3', label: 'B.Des. 3rd Year' },
  { id: 'BDes 4', label: 'B.Des. 4th Year' },
  { id: 'Dual Degree', label: 'Dual Degree' },
  { id: 'MDes 1', label: 'M.Des. 1st Year', sub: { label: 'Discipline', options: ['ID', 'CD', 'IxD', 'AN', 'MVD'] } },
  { id: 'MDes 2', label: 'M.Des. 2nd Year', sub: { label: 'Discipline', options: ['ID', 'CD', 'IxD', 'AN', 'MVD'] } },
  { id: 'MDesR', label: 'M.Des. (Research)', sub: { label: 'Year', options: ['1', '2'] } },
  { id: 'Ph.D.', label: 'Ph.D.' },
]
export const DISCIPLINE_LABEL = {
  ID: 'Product Design',
  CD: 'Communication Design',
  IxD: 'Interaction Design',
  AN: 'Animation',
  MVD: 'Mobility & Vehicle Design',
}

// Which program bucket a cohort belongs to (matches a PROGRAMS id).
export function courseProgram(cohort) {
  if (cohort.startsWith('MDes 1')) return 'MDes 1'
  if (cohort.startsWith('MDes 2')) return 'MDes 2'
  if (cohort.startsWith('MDesR')) return 'MDesR'
  return cohort // BDes 1..4, Dual Degree, Ph.D. map to themselves
}
// Discipline code (ID/CD/...) for an M.Des. cohort, else null.
export function courseDisciplineCode(cohort) {
  const m = cohort.match(/MDes \d: (ID|CD|IxD|AN|MVD)/)
  return m ? m[1] : null
}
// Does a course pass the (program, sub) filter? Empty program = all.
export function matchesFilter(course, program, sub) {
  if (!program) return true
  if (courseProgram(course.cohort) !== program) return false
  if (!sub) return true
  if (program === 'MDesR') return course.cohort === `MDesR ${sub}`
  return courseDisciplineCode(course.cohort) === sub
}

// The slot system a course ran in last year (inferred from its shape): full-week
// studio cores → M, theory/shared lectures → H, electives → S.
export function pastSlotSystem(course) {
  if (course.type === 'Elective') return 'S'
  if (/photo|film|seminar|theory|history|discourse|thought|writing|skills/i.test(course.title)) return 'H'
  return 'M'
}

// --- Allotment progress (drives the "X of N courses" counters) ---
export function progress(courses) {
  const total = courses.length
  const facultyDone = courses.filter((c) => c.faculty.length > 0).length
  const slotDone = courses.filter((c) => c.slots.length > 0).length
  const venueDone = courses.filter((c) => c.venue).length
  return {
    total,
    faculty: { done: facultyDone, total },
    slot: { done: slotDone, total },
    venue: { done: venueDone, total },
  }
}

// --- Faculty workload -----------------------------------------------------
// The "Faculty Load" side panel reads this. A member's teaching load for the
// term is the sum of credits across the courses assigned to them. Previous-year
// load is illustrative (deterministic per name, so it's stable across renders)
// and lets us show a delta. Discipline is inferred from the cohorts they teach.
const DISCIPLINE = { ID: 'Product Design', CD: 'Communication Design', IxD: 'Interaction Design', AN: 'Animation', MVD: 'Mobility & Vehicle Design' }
export function disciplineOf(cohort) {
  const m = cohort.match(/MDes(?:R)? ?\d?:?\s*(ID|CD|IxD|AN|MVD)/)
  if (m) return DISCIPLINE[m[1]]
  if (cohort.startsWith('BDes') || cohort === 'Dual Degree') return 'B.Des. Programme'
  if (cohort.startsWith('MDesR')) return 'Design Research'
  if (cohort === 'Ph.D.') return 'Design Research'
  return 'Other'
}

// Stable pseudo-random integer in [0,n) from a string (so seeded prev-load and
// title don't flicker between renders).
function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

const TITLES = ['Professor', 'Associate Professor', 'Assistant Professor']

export function facultyWorkload(courses) {
  const map = new Map()
  for (const c of courses) {
    for (const f of c.faculty) {
      if (!map.has(f)) map.set(f, { name: f, courses: [], load: 0, disciplines: new Set() })
      const e = map.get(f)
      e.courses.push(c)
      e.load += c.credits || 0
      e.disciplines.add(disciplineOf(c.cohort))
    }
  }
  return [...map.values()]
    .map((e) => {
      const h = hash(e.name)
      // Previous-year load varies ±8 credits around this term's load.
      const prevLoad = Math.max(4, e.load + ((h % 17) - 8))
      const delta = prevLoad ? Math.round(((e.load - prevLoad) / prevLoad) * 100) : 0
      return {
        name: e.name,
        title: TITLES[h % TITLES.length],
        discipline: [...e.disciplines][0] || 'Other',
        courses: e.courses,
        load: e.load,
        prevLoad,
        delta,
      }
    })
    .sort((a, b) => b.load - a.load)
}

// --- Conflict detection ---
// Two courses clash when they share a slot AND share a resource: the same
// student cohort, a teaching-faculty member, or a venue. Returns a list of
// conflicts plus a Set of course ids and a Set of "courseId@slot" cell keys
// involved, so the grid can highlight precisely.
export function detectConflicts(courses) {
  const conflicts = []
  const conflictCourseIds = new Set()
  const conflictCells = new Set()

  // Index courses by each slot they occupy.
  const bySlot = new Map()
  for (const course of courses) {
    for (const slot of course.slots) {
      if (!bySlot.has(slot)) bySlot.set(slot, [])
      bySlot.get(slot).push(course)
    }
  }

  for (const [slot, group] of bySlot) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        // The same course taught to several cohorts (one shared session),
        // parallel electives (student picks one), and planned co-taught joint
        // sessions are intentional overlaps, not clashes.
        if (a.code === b.code) continue
        if (inSameElectiveGroup(a.id, b.id) || isJointSession(a.id, b.id)) continue
        const reasons = []
        if (a.cohort === b.cohort) reasons.push({ type: 'cohort', value: a.cohort })
        const sharedFac = a.faculty.filter((f) => b.faculty.includes(f))
        for (const f of sharedFac) reasons.push({ type: 'faculty', value: f })
        if (a.venue && a.venue === b.venue) reasons.push({ type: 'venue', value: a.venue })

        for (const r of reasons) {
          conflicts.push({ slot, ...r, courses: [a.code, b.code], courseIds: [a.id, b.id] })
          conflictCourseIds.add(a.id)
          conflictCourseIds.add(b.id)
          conflictCells.add(`${a.id}@${slot}`)
          conflictCells.add(`${b.id}@${slot}`)
        }
      }
    }
  }
  return { conflicts, conflictCourseIds, conflictCells }
}

// --- View pivots ---
// Returns the column list for a given view dimension.
export function columnsFor(view) {
  if (view === 'faculty') return allFaculty
  if (view === 'venue') return venues
  return cohorts
}

// Does a course belong in (column, view)? In faculty/venue views a course can
// appear in several columns (one per faculty member / its venue).
function courseColumns(course, view) {
  if (view === 'faculty') return course.faculty
  if (view === 'venue') return course.venue ? [course.venue] : []
  return [course.cohort]
}

// Build a grid model: cell[slotId][column] = [courses]. Only columns that hold
// at least one course are kept (keeps the Faculty/Venue views from being mostly
// empty), unless `dense` is requested.
export function buildGrid(courses, view, { dense = false } = {}) {
  const allColumns = columnsFor(view)
  const cell = {}
  const usedColumns = new Set()

  for (const s of slots) cell[s.id] = {}

  for (const course of courses) {
    if (course.slots.length === 0) continue
    const cols = courseColumns(course, view)
    for (const col of cols) {
      usedColumns.add(col)
      for (const slot of course.slots) {
        if (!cell[slot]) cell[slot] = {}
        if (!cell[slot][col]) cell[slot][col] = []
        cell[slot][col].push(course)
      }
    }
  }

  const columns = dense ? allColumns : allColumns.filter((col) => usedColumns.has(col))
  return { rows: slots, columns, cell }
}

// --- Applying a faculty change request to a course ---
// Returns a NEW course object with the op applied; never mutates the input.
export function applyOp(course, op) {
  const next = {
    ...course,
    faculty: [...course.faculty],
    slots: [...course.slots],
    dateRanges: course.dateRanges.map((r) => ({ ...r })),
  }
  switch (op.kind) {
    case 'reslot': {
      next.slots = next.slots.map((s) => (s === op.from ? op.to : s))
      if (!next.slots.includes(op.to)) next.slots.push(op.to)
      break
    }
    case 'addSlot': {
      if (!next.slots.includes(op.slot)) next.slots.push(op.slot)
      break
    }
    case 'split': {
      // Split the term into consecutive blocks of the given week counts.
      next.dateRanges = splitTerm(op.weeks)
      next.durationWeeks = op.weeks.reduce((a, b) => a + b, 0)
      break
    }
    case 'venue': {
      next.venue = op.to
      break
    }
    case 'addFaculty': {
      if (!next.faculty.includes(op.faculty)) next.faculty.push(op.faculty)
      break
    }
    default:
      break
  }
  return next
}

// Human-readable summary of an op, for the change-request card.
export function describeOp(op) {
  switch (op.kind) {
    case 'reslot':
      return `Move ${slotLabel(op.from)} → ${slotLabel(op.to)}`
    case 'addSlot':
      return `Add ${slotLabel(op.slot)}`
    case 'split':
      return `Split into ${op.weeks.join(' + ')} week blocks`
    case 'venue':
      return `Change venue to ${op.to}`
    case 'addFaculty':
      return `Add faculty ${op.faculty}`
    default:
      return 'Change'
  }
}

// Split the standard term (Aug 3 – Nov 13) into N consecutive week-blocks.
function splitTerm(weeks) {
  const termStart = new Date('2026-08-03')
  const ranges = []
  let cursor = new Date(termStart)
  for (const w of weeks) {
    const start = new Date(cursor)
    const end = new Date(cursor)
    end.setDate(end.getDate() + w * 7 - 3) // end on the Friday of the last week
    ranges.push({ start: iso(start), end: iso(end) })
    cursor = new Date(end)
    cursor.setDate(cursor.getDate() + 17) // gap before the next block
  }
  return ranges
}

const iso = (d) => d.toISOString().slice(0, 10)

// Pretty date for the modal (DD/MM/YYYY).
export function fmtDate(isoStr) {
  if (!isoStr) return ''
  const [y, m, d] = isoStr.split('-')
  return `${d}/${m}/${y}`
}
