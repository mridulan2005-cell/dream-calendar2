// Aerospace "Master Slot Grid" — the published institute timetable a coordinator
// opens from the Slot Allotment step (the B.Tech counterpart of IDC's week grid).
//
// This is the WHOLE-INSTITUTE picture for the four odd semesters Aerospace runs in
// Autumn: every batch's week, laid side by side. Unlike IDC's grid (which allots
// movable studio modules week by week), a B.Tech department's courses sit at fixed
// institute slots and repeat every teaching week — so the grid is a single weekly
// canvas, drawn once per teaching block and reused across the term.
//
// The layout mirrors the institute's own published sheet:
//   • columns are grouped by SEMESTER (1st / 3rd / 5th / 7th), each split into the
//     five teaching days M–Fr;
//   • rows are the day's periods — four morning lecture bands, LUNCH, three
//     afternoon lab bands;
//   • the term reads top to bottom as teaching-block → MIDSEMS → teaching-block →
//     ENDSEMS, with the exam stretches drawn as full-width bands and each block's
//     Start/End dates carried in the two leftmost columns.
//
// Because every course meets four (lectures) or repeats (labs) times a week, the
// institute rotates them DIAGONALLY across the week: a semester's morning courses
// step one day later each period, so no course sits at the same clock time twice
// and every batch's five mornings are balanced. That single rule — index by
// (day + period) — reproduces the whole morning grid; the afternoon labs alternate
// the same way. This is exactly the pattern on the printed sheet.

// --- Departments (the grid's show/hide filter) -------------------------------
// A semester's week is assembled from several departments' courses: Aerospace's
// own AE-coded courses plus the institute service courses other departments own
// and schedule (CSE's CS 101, Maths' MA 105, Physics' PH 117, …) and the shared
// elective / minor baskets. The grid lets the coordinator choose which of these
// to see — the same "pick your columns" control IDC's grid gives, here keyed by
// the owning department rather than by batch.
export const MASTER_DEPARTMENTS = [
  { id: 'aero', code: 'AE', name: 'Aerospace Engineering', home: true },
  { id: 'cse', code: 'CS', name: 'Computer Science' },
  { id: 'math', code: 'MA', name: 'Mathematics' },
  { id: 'physics', code: 'PH', name: 'Physics' },
  { id: 'hss', code: 'HSS', name: 'HSS / IDC' },
  { id: 'eco', code: 'EC', name: 'Economics' },
  { id: 'env', code: 'ES', name: 'Environmental Studies' },
  { id: 'elective', code: '—', name: 'Electives / Minor' },
  { id: 'cocurricular', code: 'NO', name: 'Co-curricular' },
]

// --- Course catalogue (carried over from last year) --------------------------
// One entry per code the grid can place. `kind` is the course's nature (a core
// lecture, a three-hour lab, or a basket elective); `dept` owns/schedules it.
// `short` is what the narrow cell prints — verbatim from the institute sheet.
// `faculty` is the coordinating professor shown on the block (blank for a basket
// elective with several offerings); `etype` names the basket an elective is drawn
// from. Together `kind` + `etype` produce the block's Core / Elective · … tag.
const C = (code, title, dept, kind = 'lecture', { short, faculty = '', etype = '' } = {}) => ({
  code,
  title,
  dept,
  kind,
  short: short || code,
  faculty,
  etype,
})

export const MASTER_COURSES = {
  // Semester I
  'AE 103': C('AE 103', 'A Historical Perspective of Aerospace Engineering', 'aero', 'lecture', { faculty: 'Vaidya' }),
  'CS 101': C('CS 101', 'Computer Programming and Utilization', 'cse', 'lecture', { faculty: 'Iyer' }),
  'MA 105': C('MA 105', 'Calculus', 'math', 'lecture', { faculty: 'Rao' }),
  'HSS/IDC/ENT': C('HSS/IDC/ENT', 'HASMED / IDC / Entrepreneurship elective', 'hss', 'elective', { short: 'HSS/IDC/E', etype: 'HSS / IDC' }),
  'NOCS 01': C('NOCS 01', 'Co-curricular (NSO / NSS / NCC)', 'cocurricular', 'cocurricular', { short: 'NOCS 01' }),
  'PH 117': C('PH 117', 'Physics Laboratory', 'physics', 'lab', { faculty: 'Nair' }),
  // Semester III
  'AE 223': C('AE 223', 'Thermodynamics and Propulsion', 'aero', 'lecture', { faculty: 'Bhattacharya' }),
  'AE 227': C('AE 227', 'Solid Mechanics', 'aero', 'lecture', { faculty: 'Nadkarni' }),
  'AE 308': C('AE 308', 'Control Theory', 'aero', 'lecture', { faculty: 'Rajagopal' }),
  'EC 101': C('EC 101', 'Economics', 'eco', 'lecture', { faculty: 'Kulkarni' }),
  'ES 250 / HS 25': C('ES 250 / HS 25', 'Environmental Studies', 'env', 'lecture', { short: 'ES 250 / HS 25', faculty: 'Sharma' }),
  'AE 153': C('AE 153', 'Data Analysis and Interpretation', 'aero', 'lecture', { faculty: 'Kaul' }),
  'AE 229': C('AE 229', 'Introduction to Aerodynamics and Propulsion Laboratory', 'aero', 'lab', { faculty: 'Bhattacharya' }),
  'AE 231': C('AE 231', 'Introduction to Aerospace Structures and Control Laboratory', 'aero', 'lab', { faculty: 'Nadkarni' }),
  // Semester V
  'AE 339': C('AE 339', 'High Speed Aerodynamics', 'aero', 'lecture', { faculty: 'Rajagopal' }),
  'AE 341': C('AE 341', 'Flight Mechanics of Aircrafts & Spacecrafts', 'aero', 'lecture', { faculty: 'Vaidya' }),
  'AE 344': C('AE 344', 'Aero Propulsion', 'aero', 'lecture', { faculty: 'Bhattacharya' }),
  HASMED: C('HASMED', 'HASMED Elective', 'hss', 'elective', { short: 'HASMED E', etype: 'HASMED' }),
  'Flexible Elective': C('Flexible Elective', 'Flexible Elective (institute basket)', 'elective', 'elective', { short: 'Flexible Elective', etype: 'Flexible' }),
  'Honors/Minor': C('Honors/Minor', 'Honours / Minor course', 'elective', 'elective', { short: 'Honors/Minor', etype: 'Honours / Minor' }),
  'AE 343': C('AE 343', 'Aerodynamics Laboratory', 'aero', 'lab', { faculty: 'Deshmukh' }),
  'AE 345': C('AE 345', 'Aircraft Propulsion Laboratory', 'aero', 'lab', { faculty: 'Menon' }),
  // Semester VII
  'Dept Elective I': C('Dept Elective I', 'Departmental Elective (AE basket)', 'aero', 'elective', { short: 'Dept Elective', etype: 'Departmental', faculty: 'Menon' }),
  'Dept Elective II': C('Dept Elective II', 'Departmental Elective (AE basket)', 'aero', 'elective', { short: 'Dept Elective', etype: 'Departmental', faculty: 'Sundaram' }),
  'STEM Elective': C('STEM Elective', 'STEM Elective (institute basket)', 'elective', 'elective', { short: 'STEM Elective', etype: 'STEM' }),
}

// The block tag: Core (lecture), Lab, Co-curricular, or Elective · <basket>.
// This is the one classification the uniform course block prints under the code.
export function courseTag(course) {
  if (!course) return ''
  if (course.kind === 'elective') return course.etype ? `Elective · ${course.etype}` : 'Elective'
  if (course.kind === 'lab') return 'Lab'
  if (course.kind === 'cocurricular') return 'Co-curricular'
  return 'Core'
}

// The professors who coordinate a course this term — the roster the grid's
// "By faculty" chips are built from (basket electives contribute no name).
export const MASTER_FACULTY = [
  ...new Set(Object.values(MASTER_COURSES).map((c) => c.faculty).filter(Boolean)),
].sort((a, b) => a.localeCompare(b))

// --- The four semesters and their institute-slot allotment -------------------
// Each course sits at a real INSTITUTE SLOT (data/slotSystem.js), not a made-up
// rotation. A lecture slot such as S1 meets at its three periods 1A (Mon 9:30),
// 1B (Tue 9:30) and 1C (Thu 9:30) — three distinct day/time cells, NOT one row
// across the week; a lab slot (L1…L4) is a single afternoon block. Within a
// semester every course takes a different slot so the batch never clashes; the
// same slot recurs across semesters (different batches, different rooms). The
// grid places a course exactly at the periods its slot occupies, so the week
// reads sparsely and correctly — and a faculty's own courses, gathered across
// semesters, compose that professor's personal weekly timetable.
export const MASTER_SEMESTERS = [
  {
    id: 'sem1',
    label: '1st Sem',
    courses: [
      { code: 'AE 103', slot: 'S1' },
      { code: 'CS 101', slot: 'S2' },
      { code: 'MA 105', slot: 'S3' },
      { code: 'HSS/IDC/ENT', slot: 'S4' },
      { code: 'NOCS 01', slot: 'S5' },
      { code: 'PH 117', slot: 'L1' },
    ],
  },
  {
    id: 'sem3',
    label: '3rd Sem',
    courses: [
      { code: 'AE 223', slot: 'S1' },
      { code: 'AE 227', slot: 'S2' },
      { code: 'AE 308', slot: 'S3' },
      { code: 'EC 101', slot: 'S4' },
      { code: 'ES 250 / HS 25', slot: 'S5' },
      { code: 'AE 153', slot: 'S6' },
      { code: 'AE 229', slot: 'L1' },
      { code: 'AE 231', slot: 'L3' },
    ],
  },
  {
    id: 'sem5',
    label: '5th Sem',
    courses: [
      { code: 'AE 339', slot: 'S1' },
      { code: 'AE 341', slot: 'S2' },
      { code: 'AE 344', slot: 'S3' },
      { code: 'HASMED', slot: 'S4' },
      { code: 'Flexible Elective', slot: 'S5' },
      { code: 'Honors/Minor', slot: 'S6' },
      { code: 'AE 343', slot: 'L2' },
      { code: 'AE 345', slot: 'L4' },
    ],
  },
  {
    id: 'sem7',
    label: '7th Sem',
    courses: [
      { code: 'Dept Elective I', slot: 'S1' },
      { code: 'Dept Elective II', slot: 'S2' },
      { code: 'STEM Elective', slot: 'S3' },
      { code: 'Flexible Elective', slot: 'S4' },
      { code: 'Honors/Minor', slot: 'S5' },
    ],
  },
]

// The days the grid columns split into (institute label ↔ slotSystem day key).
export const MASTER_DAYS = [
  { key: 'Mon', label: 'M' },
  { key: 'Tue', label: 'Tu' },
  { key: 'Wed', label: 'W' },
  { key: 'Thu', label: 'Th' },
  { key: 'Fri', label: 'Fr' },
]

// Every (course, slot) placement across the four semesters — the flat list the
// grid and the faculty pivot are both built from.
export const MASTER_PLACEMENTS = MASTER_SEMESTERS.flatMap((sem) =>
  sem.courses.map((c) => ({
    code: c.code,
    slot: c.slot,
    semId: sem.id,
    semLabel: sem.label,
    course: MASTER_COURSES[c.code],
  })),
)

// The "By faculty" columns: one per professor, carrying every course they teach
// (across all semesters) at its allotted slot — i.e. their weekly timetable.
export const MASTER_FACULTY_COLUMNS = MASTER_FACULTY.map((name) => ({
  id: name,
  label: name,
  courses: MASTER_PLACEMENTS.filter((p) => p.course?.faculty === name).map((p) => ({
    code: p.code,
    slot: p.slot,
  })),
}))

// --- The term's teaching blocks and exam bands -------------------------------
// The weekly grid is drawn once per teaching block; the exam stretches are
// full-width bands. Dates match the institute sheet's Start / End columns.
export const MASTER_PHASES = [
  { id: 'block1', kind: 'teach', label: 'Teaching block I', start: '01-Aug', end: '15-Oct' },
  { id: 'midsem', kind: 'exam', label: 'MIDSEMS', start: '16-Oct', end: '22-Oct' },
  { id: 'block2', kind: 'teach', label: 'Teaching block II', start: '23-Oct', end: '26-Nov' },
  { id: 'endsem', kind: 'exam', label: 'ENDSEMS', start: '27-Nov', end: '06-Dec' },
]

const toMin = (t) => {
  const [h, m] = (t || '').split(':').map(Number)
  return h * 60 + m
}

// The course an entity (a semester, or a faculty member) holds at (dayKey,
// period), resolved against the LIVE slot system so a slot edit flows straight
// through. `entityCourses` is a list of { code, slot }; `slotDefs` maps a slot id
// to its definition (from departmentSlots). Returns { course, slotCode } — the
// catalogue entry plus the concrete sub-slot met there (e.g. "1A") — or null.
export function placeAt(entityCourses, dayKey, period, slotDefs) {
  for (const ec of entityCourses) {
    const def = slotDefs[ec.slot]
    if (!def) continue
    const hit = def.blocks.find(
      (b) => b.day === dayKey && toMin(b.start) >= toMin(period.start) && toMin(b.start) < toMin(period.end),
    )
    if (hit) return { course: MASTER_COURSES[ec.code], slotCode: hit.code }
  }
  return null
}
