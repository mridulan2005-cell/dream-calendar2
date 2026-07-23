// Aerospace Engineering (B.Tech / Dual Degree) department timetable.
// Mapped from the official curriculum:
//   "Curriculum of B.Tech … in Aerospace Engineering, IIT Bombay — Batch of 2023
//    and onwards (updated 19 Jun 2026)", Table I (semester-wise course schedule).
//
// IDC and a B.Tech department differ in ONE structural way, and the app models
// exactly that difference — everything else (the grid, the pivots, the weekly
// view) is shared, so switching departments never changes the interface:
//
//   IDC    — a course is a full-week studio MODULE that occupies a few of the 15
//            teaching weeks and can be moved between them. Its semester grid is
//            genuinely week-by-week.
//   B.Tech — a course sits at a FIXED institute slot and repeats every teaching
//            week of the term. Nothing moves week to week, so the semester grid
//            collapses into one tall block per teaching phase: everything the
//            year studies, from the start of the block to the exam that closes it.
//
// The term is Autumn 2026-27 (matching the app's TERM). Autumn runs the ODD
// semesters, so each B.Tech year shows its odd-semester load:
//   1st year → Semester I,  2nd year → Semester III,
//   3rd year → Semester V,  4th year → Semester VII.

import { departmentSlots, DEFAULT_SLOT_SYSTEM } from './slotSystem.js'

// --- Departments offered in the department switcher --------------------------
// `idc` is the existing planner (studio modules). `aero` is wired below. The rest
// are listed so the switcher reads as a real institute-wide control; they land on
// a "not imported yet" placeholder until their curriculum is mapped in.
export const departments = [
  { id: 'idc', code: 'IDC', name: 'Design (IDC)', kind: 'studio', ready: true },
  { id: 'aero', code: 'AE', name: 'Aerospace Engineering', kind: 'btech', ready: true },
  { id: 'cse', code: 'CSE', name: 'Computer Science & Engineering', kind: 'btech', ready: false },
  { id: 'mech', code: 'ME', name: 'Mechanical Engineering', kind: 'btech', ready: false },
  { id: 'elec', code: 'EE', name: 'Electrical Engineering', kind: 'btech', ready: false },
  { id: 'civil', code: 'CE', name: 'Civil Engineering', kind: 'btech', ready: false },
]

// --- Academic calendar -------------------------------------------------------
// The semester is one continuous 23-week band, shaped by the two exams that
// punctuate it: teaching runs to the mid-sem in W8, resumes after it, and closes
// with the end-sems in W22–W23. A teaching PHASE is the unit that matters here —
// every course of a year runs at its fixed slot through the whole phase — so the
// semester grid draws one block per phase rather than 20 identical week cells.
export const AERO_PHASES = [
  { id: 'block-1', kind: 'teach', label: 'Teaching block I', from: 1, to: 7 },
  { id: 'midsem', kind: 'exam', label: 'Mid-semester examinations', short: 'Mid-sem', from: 8, to: 8 },
  { id: 'block-2', kind: 'teach', label: 'Teaching block II', from: 9, to: 21 },
  { id: 'endsem', kind: 'exam', label: 'End-semester examinations', short: 'End-sem', from: 22, to: 23 },
]
export const aeroPhaseById = Object.fromEntries(AERO_PHASES.map((p) => [p.id, p]))
const phaseOfWeek = (n) => AERO_PHASES.find((p) => n >= p.from && n <= p.to)
const TOTAL_WEEKS = AERO_PHASES[AERO_PHASES.length - 1].to

// Teaching weeks run Mon–Fri from the first Monday of term.
const WEEK1_MON = new Date('2026-07-20')
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const isoD = (d) => d.toISOString().slice(0, 10)

// The rows of the semester grid — the same shape as IDC's `slots` (id / label /
// week / dateRange) so both grids read weeks identically, plus the phase each
// week belongs to.
export const AERO_WEEKS = Array.from({ length: TOTAL_WEEKS }, (_, i) => {
  const n = i + 1
  const phase = phaseOfWeek(n)
  const start = addDays(WEEK1_MON, (n - 1) * 7)
  return {
    id: `AW${n}`,
    label: `W${n}`,
    week: n,
    kind: phase.kind, // 'teach' | 'exam'
    phaseId: phase.id,
    dateRange: { start: isoD(start), end: isoD(addDays(start, 4)) },
  }
})
export const AERO_TEACHING_WEEKS = AERO_WEEKS.filter((w) => w.kind === 'teach')

// Each phase resolved to the weeks that open and close it. This is what the
// weekly view's "Jump to" rail lists: IDC's rail groups consecutive weeks holding
// the same course, and for a B.Tech department that grouping IS the phase — the
// week repeats unchanged from the start of a block to the exam that ends it.
export const aeroPhaseSpans = AERO_PHASES.map((p) => ({
  ...p,
  from: AERO_WEEKS[p.from - 1],
  to: AERO_WEEKS[p.to - 1],
}))

// --- Institute lecture / lab slots (IITB slot system) ------------------------
// A B.Tech department allots in the SAME slot vocabulary as the institute slot
// system — its lecture slots are the S-period groups (slot "1" = the periods 1A,
// 1B, 1C), its labs are the L slots, its modules the M slots. `departmentSlots`
// derives all of this straight from the slot system (data/slotSystem.js, which
// mirrors the institute XML), so the codes here are the real ones and stay in
// lockstep with the system. `aeroSlotById` is the by-id lookup the grid and the
// course panel read; `aeroSlotOptions(system)` gives the live options the
// allotment dropdown offers (from the store's editable slot system).
export const aeroSlotOptions = departmentSlots
export const AERO_SLOTS = departmentSlots(DEFAULT_SLOT_SYSTEM)
export const aeroSlotById = Object.fromEntries(AERO_SLOTS.all.map((s) => [s.id, s]))

// Resolve a course's slot ids into concrete weekly blocks (each tagged with the
// owning course, the slot id and the real period code so the grid can render and
// label them with the institute code, e.g. "1A").
const resolveBlocks = (course) =>
  course.slots.flatMap((id) => {
    const def = aeroSlotById[id]
    if (!def) return []
    return def.blocks.map((blk) => ({
      ...blk,
      slot: id,
      slotCode: blk.code,
      slotKind: def.kind,
      course,
    }))
  })

// A course's display "type" for colour/grouping. Electives (chosen from a basket)
// render as open placeholders; labs amber; everything else a core lecture.
const typeOf = (c) => (c.elective ? 'elective' : c.lab ? 'lab' : 'core')

// The weekly view fills every cell a batch isn't taught in with the institute
// slots still open there. Those free-slot chips are drawn straight from the
// shared institute S / L slot system (see slotSystem.js `freeSlotsAt`) — the
// same source and look as the IDC weekly grid — so a spare slot reads
// identically in either department.

// --- Semester-wise courses (Table I) -----------------------------------------
// SCOPE: this is the AEROSPACE DEPARTMENT's own timetable, so it lists ONLY the
// courses the department itself offers — the AE-coded courses and its own
// departmental electives. The institute service courses a batch also takes but
// that OTHER departments own and schedule (Mathematics' MA 105, CSE's CS 101,
// Physics' PH 117, the HSS/IDC/ENT HASMED course, Economics EC 101, Environmental
// Studies ES/HS 250, and the HASMED / STEM / Flexible elective baskets) are NOT
// the AE department's to timetable, so they're deliberately excluded — the AE
// coordinator only allots slots, faculty and venues for AE's own courses.
//
// ltpc = Lecture-Tutorial-Practical-Credit structure, verbatim from the PDF.
// `slots` are the institute slots each course occupies (clash-free within a year).
// Rooms follow the department's convention: a year lectures in its own home hall
// (its courses sit at different slots, so the hall is never double-booked) and
// practicals go to the dedicated lab. Faculty are likewise assigned so nobody is
// timetabled against themselves. A departmental elective is chosen from the AE
// basket, so it renders as an open placeholder but still carries the slot, teacher
// and room the coordinator has allotted for that offering.
const YEARS = [
  {
    id: 'y1',
    year: '1st Year',
    semester: 'Semester I',
    cohort: 'B.Tech 1',
    courses: [
      { code: 'AE 103', title: 'A Historical Perspective of Aerospace Engineering', ltpc: '3-0-0-6', slots: ['S1'], faculty: ['Vaidya'], venue: 'LA 001' },
    ],
  },
  {
    id: 'y2',
    year: '2nd Year',
    semester: 'Semester III',
    cohort: 'B.Tech 2',
    courses: [
      { code: 'AE 223', title: 'Thermodynamics and Propulsion', ltpc: '3-0-0-6', slots: ['S1'], faculty: ['Bhattacharya'], venue: 'LA 002' },
      { code: 'AE 227', title: 'Solid Mechanics', ltpc: '3-0-0-6', slots: ['S2'], faculty: ['Nadkarni'], venue: 'LA 002' },
      { code: 'AE 308', title: 'Control Theory', ltpc: '3-0-0-6', slots: ['S3'], faculty: ['Rajagopal'], venue: 'LA 002' },
      { code: 'AE 229', title: 'Introduction to Aerodynamics and Propulsion Laboratory', ltpc: '0-0-3-3', slots: ['L1'], lab: true, faculty: ['Bhattacharya', 'Deshmukh'], venue: 'AE Aerodynamics Lab' },
      { code: 'AE 231', title: 'Introduction to Aerospace Structures and Control Laboratory', ltpc: '0-0-3-3', slots: ['L3'], lab: true, faculty: ['Nadkarni', 'Deshmukh'], venue: 'AE Structures Lab' },
    ],
  },
  {
    id: 'y3',
    year: '3rd Year',
    semester: 'Semester V',
    cohort: 'B.Tech 3',
    courses: [
      { code: 'AE 339', title: 'High Speed Aerodynamics', ltpc: '3-0-0-6', slots: ['S1'], faculty: ['Rajagopal'], venue: 'LC 101' },
      { code: 'AE 341', title: 'Flight Mechanics of Aircrafts & Spacecrafts', ltpc: '3-0-0-6', slots: ['S2'], faculty: ['Vaidya'], venue: 'LC 101' },
      { code: 'AE 344', title: 'Aero Propulsion', ltpc: '3-0-0-6', slots: ['S3'], faculty: ['Bhattacharya'], venue: 'LC 101' },
      { code: 'AE 343', title: 'Aerodynamics Laboratory', ltpc: '0-0-3-3', slots: ['L2'], lab: true, faculty: ['Deshmukh'], venue: 'AE Aerodynamics Lab' },
      { code: 'AE 345', title: 'Aircraft Propulsion Laboratory', ltpc: '0-0-3-3', slots: ['L4'], lab: true, faculty: ['Menon'], venue: 'AE Propulsion Lab' },
    ],
  },
  {
    id: 'y4',
    year: '4th Year',
    semester: 'Semester VII',
    cohort: 'B.Tech 4',
    courses: [
      { code: 'AE Dept Elective III', title: 'Departmental Elective (AE basket)', ltpc: '3-0-0-6', slots: ['S1'], elective: true, faculty: ['Menon'], venue: 'LC 201' },
      { code: 'AE Dept Elective IV', title: 'Departmental Elective (AE basket)', ltpc: '3-0-0-6', slots: ['S2'], elective: true, faculty: ['Sundaram'], venue: 'LC 201' },
    ],
  },
]

// Precompute each year's enriched courses + the weekly blocks they resolve to.
// Blocks are resolved from the ENRICHED courses so a block carries the same
// course identity (id, type, cohort, room) the semester grid and detail panel use.
export const aeroYears = YEARS.map((y) => {
  const courses = y.courses.map((c) => ({
    ...c,
    id: `${y.id}-${c.code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    type: typeOf(c),
    cohort: y.cohort,
    year: y.year,
    semester: y.semester,
    faculty: c.faculty || [],
    venue: c.venue || '',
  }))
  return { ...y, courses, blocks: courses.flatMap((c) => resolveBlocks(c)) }
})

// --- The department's courses, pivoted like IDC's -----------------------------
// One flat list plus the three column dimensions the semester grid pivots on —
// the same model `buildGrid` gives the IDC planner, so the grid, the view
// switcher and the detail panel all behave identically across departments.
export const aeroCourses = aeroYears.flatMap((y) => y.courses)
export const aeroCohorts = YEARS.map((y) => y.cohort)
export const aeroFaculty = [...new Set(aeroCourses.flatMap((c) => c.faculty))].sort((a, b) =>
  a.localeCompare(b),
)
export const aeroVenues = [...new Set(aeroCourses.map((c) => c.venue).filter(Boolean))].sort((a, b) =>
  a.localeCompare(b),
)
export const aeroCourseById = Object.fromEntries(aeroCourses.map((c) => [c.id, c]))

// Which columns of `view` a course belongs to (mirrors the IDC pivot rules).
const courseColumns = (course, view) => {
  if (view === 'faculty') return course.faculty
  if (view === 'venue') return course.venue ? [course.venue] : []
  return [course.cohort]
}

// cell[weekId][column] = courses meeting that week. A B.Tech course runs every
// teaching week of the term, so it fills every teaching row of its column and
// none of the exam rows — which is exactly what makes the grid collapse into one
// block per teaching phase. Columns with nothing in them are dropped, keeping the
// Faculty / Venue pivots dense.
export function buildAeroGrid(view) {
  const all = view === 'faculty' ? aeroFaculty : view === 'venue' ? aeroVenues : aeroCohorts
  const cell = {}
  const used = new Set()
  for (const w of AERO_WEEKS) cell[w.id] = {}

  for (const course of aeroCourses) {
    for (const col of courseColumns(course, view)) {
      used.add(col)
      for (const w of AERO_TEACHING_WEEKS) {
        if (!cell[w.id][col]) cell[w.id][col] = []
        cell[w.id][col].push(course)
      }
    }
  }
  return { rows: AERO_WEEKS, columns: all.filter((col) => used.has(col)), cell }
}
