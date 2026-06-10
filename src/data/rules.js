// Scheduling rules the constraint engine reads. Kept as data so the "referee"
// stays declarative and easy to extend.

import { slots } from './seed.js'

// No slot is hard-blocked any more: the exam weeks below are drawn as a backdrop
// but still accept teaching/reviews, so nothing is institute-reserved.
export const protectedSlots = []

// Exam weeks, highlighted across every batch as a timetable backdrop. They do
// NOT block placement — sessions can still be scheduled during them. Keyed by
// teaching-week slot id (mid-sem ≈ W8, end-sem ≈ the final week).
export const examWeeks = [
  { id: 'M8', label: 'Mid-sem exams' },
  { id: 'M15', label: 'End-sem exams' },
]
const examSet = new Set(examWeeks.map((e) => e.id))
export const isExamWeek = (slotId) => examSet.has(slotId)
export const examWeekLabel = (slotId) => examWeeks.find((e) => e.id === slotId)?.label || ''

// Rooms: seating capacity + facilities available.
export const rooms = {
  'BDes 1 Classroom': { capacity: 30, facilities: ['projector', 'studio'] },
  'BDes 2 Classroom': { capacity: 30, facilities: ['projector', 'studio'] },
  'BDes 3 Classroom': { capacity: 30, facilities: ['projector', 'studio'] },
  'BDes 4 Classroom': { capacity: 30, facilities: ['projector', 'studio'] },
  'Jr. ID Classroom': { capacity: 18, facilities: ['projector', 'workshop'] },
  'Jr. CD Classroom': { capacity: 18, facilities: ['projector', 'computers'] },
  'Jr. IxD Classroom': { capacity: 18, facilities: ['projector', 'computers'] },
  'Jr. Anim. Classroom': { capacity: 18, facilities: ['projector', 'computers', 'studio'] },
  'Jr. MVD Classroom': { capacity: 18, facilities: ['projector', 'workshop'] },
  'Sr. ID Classroom': { capacity: 20, facilities: ['projector', 'workshop'] },
  'Sr. Anim. Classroom': { capacity: 20, facilities: ['projector', 'computers', 'studio'] },
  'Sr. MVD Classroom': { capacity: 20, facilities: ['projector', 'workshop'] },
  'Mini Theatre': { capacity: 80, facilities: ['projector', 'audio', 'screening'] },
  'Conference Room': { capacity: 15, facilities: ['projector'] },
  Auditorium: { capacity: 150, facilities: ['projector', 'audio', 'screening', 'stage'] },
}

// Approx. student counts per cohort (for room-capacity checks + impact).
export const cohortSizes = {
  'BDes 1': 30,
  'BDes 2': 30,
  'BDes 3': 28,
  'BDes 4': 24,
  'Dual Degree': 12,
  'MDes 1: ID': 12,
  'MDes 1: CD': 12,
  'MDes 1: IxD': 12,
  'MDes 1: AN': 10,
  'MDes 1: MVD': 10,
  'MDes 2: ID': 12,
  'MDes 2: CD': 12,
  'MDes 2: IxD': 12,
  'MDes 2: AN': 10,
  'MDes 2: MVD': 10,
  'MDesR 1': 6,
  'MDesR 2': 6,
  'Ph.D.': 20,
}

// Elective groups: courses in the same group are MEANT to run in parallel, so a
// slot overlap between them is intentional (not a clash). Course ids match seed.
// Derived from the source sheet: electives that share a cohort + week.
export const electiveGroups = [
  ['DE-417', 'DE-419'], // BDes 3 soft core (week 1)
  ['DE-319', 'DE-320'], // BDes 3 elective 1 (week 4)
  ['DE-317', 'DE-303', 'DE-302', 'DE-311', 'DE-329', 'DE-307'], // BDes 3 elective 2 (week 7)
  ['DE-331', 'DE-699', 'DE-337', 'DE-327'], // BDes 3 elective 3 (week 10)
  ['DE-718', 'DE-679', 'DE-677', 'DE-692', 'DE-698'], // MDes 2 elective 2 (week 4)
  ['DE-721', 'DE-705', 'DE-668', 'DE-720'], // MDes 2 elective 3 (week 7)
]

// Joint sessions: a faculty teaching two of these in the same slot is a planned
// co-taught session, not a double-booking.
export const jointSessions = [
  ['DE-221', 'DEP-102'], // studio + practicum co-run
]

// Required facilities derived from the course (lightweight heuristic on title).
export function requiredFacilities(course) {
  const t = course.title.toLowerCase()
  const req = ['projector']
  if (/studio|drawing|form|making|clay|model/.test(t)) req.push('studio')
  if (/anim|film|screen|narrativ|photo/.test(t)) req.push('screening')
  if (/interface|prototyp|interaction|comput/.test(t)) req.push('computers')
  return req
}

// Slot index helper (for back-to-back adjacency).
const slotIndex = Object.fromEntries(slots.map((s, i) => [s.id, i]))
export const adjacentSlots = (slotId) => {
  const i = slotIndex[slotId]
  return [slots[i - 1]?.id, slots[i + 1]?.id].filter(Boolean)
}

export const isProtected = (slotId) => protectedSlots.includes(slotId)
export const inSameElectiveGroup = (a, b) =>
  electiveGroups.some((g) => g.includes(a) && g.includes(b))
export const isJointSession = (a, b) =>
  jointSessions.some((g) => g.includes(a) && g.includes(b))
