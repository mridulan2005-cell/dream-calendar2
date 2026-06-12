// Seed data for the IDC Department Timetable, Autumn 2025-26.
// Generated from the official "IDC Autumn Timetable 2025" sheet.
// The source sheet is a cohort x WEEK grid; weeks 1-15 are mapped onto the
// app's 15 scheduling slots M1..M15 (week N -> slot MN). Counters/progress in
// the UI are derived from this data, not hard-coded.

export const TERM = { academicYear: '2025 - 2026', semester: 'Autumn', dept: 'IDC' }

// --- Student cohorts = the columns of the "Student" view of the timetable ---
// Ordered so cohorts that share a seminar sit next to each other — that lets a
// course taught to several cohorts render as one merged block (e.g. DE 804 over
// the research cohorts, DE 613 over the two MDes-1 tracks).
export const cohorts = [
  'BDes 1',
  'BDes 2',
  'BDes 3',
  'BDes 4',
  'Dual Degree',
  'MDes 1: ID',
  'MDes 1: CD',
  'MDes 1: IxD',
  'MDes 1: AN',
  'MDes 1: MVD',
  'MDes 2: ID',
  'MDes 2: CD',
  'MDes 2: IxD',
  'MDes 2: AN',
  'MDes 2: MVD',
  'MDesR 1',
  'MDesR 2',
  'Ph.D.',
]

// --- Slots = the rows of the timetable. Each slot is one teaching week of the
// term (the source sheet's week rows). Conflict detection keys off slot identity
// (two courses sharing a slot meet in the same week-block). ---
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
// Teaching weeks run Mon–Fri, starting the first week of term (from the sheet).
// Every module occupies whole-week slots, so it always starts and ends on a week.
const WEEK1_MON = new Date('2025-07-28')
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
const isoD = (d) => d.toISOString().slice(0, 10)
export const slots = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1
  const day = DAYS[i % DAYS.length]
  const altDay = DAYS[(i + 2) % DAYS.length]
  const hour = 8 + (i % 7)
  const start = addDays(WEEK1_MON, (n - 1) * 7)
  const end = addDays(start, 4)
  return {
    id: `M${n}`, // internal slot id — course.slots reference these
    label: `W${n}`, // shown to users as the teaching week
    week: n,
    dateRange: { start: isoD(start), end: isoD(end) },
    blocks: [
      { day, start: `${hour}:30`, end: `${hour + 1}:25` },
      { day: altDay, start: `${hour}:30`, end: `${hour + 1}:25` },
    ],
  }
})

// Slot lookup + display helpers.
export const slotById = Object.fromEntries(slots.map((s) => [s.id, s]))
export const slotLabel = (id) => slotById[id]?.label || id
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const fmtDay = (iso) => {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${parseInt(d, 10)} ${MONTHS[parseInt(m, 10) - 1]}`
}
export const slotDateShort = (id) => fmtDay(slotById[id]?.dateRange.start)
export const slotDateRange = (id) => {
  const s = slotById[id]
  return s ? `${fmtDay(s.dateRange.start)} – ${fmtDay(s.dateRange.end)}` : ''
}
// Date span (first week start – last week end) for a set of slot ids.
export const slotsSpan = (ids) => {
  const list = ids.map((id) => slotById[id]).filter(Boolean)
  if (!list.length) return ''
  const starts = list.map((s) => s.dateRange.start).sort()
  const ends = list.map((s) => s.dateRange.end).sort()
  return `${fmtDay(starts[0])} – ${fmtDay(ends[ends.length - 1])}`
}

// --- Faculty (teaching the Autumn 2025 courses) ---
export const faculty = [
  'Abhishek',
  'Aditi Chitre',
  'Aman',
  'Anirudha',
  'Anisha',
  'Bharat',
  'Deepa',
  'Dhimant',
  'Dhimant Vyas',
  'Dhruv Parmar',
  'Girish',
  'GVS',
  'Jayati',
  'Jayesh',
  'Junjha',
  'Kanika',
  'Kartikeya',
  'Kumaresan',
  'Mandar',
  'Milouni',
  'Nishant Kamboj',
  'Nishant Sharma',
  'Phani',
  'Prasad',
  'Purba',
  'Raja',
  'Ravi Mahamuni',
  'Ravi Rao',
  'RM',
  'Sandesh',
  'Sanket',
  'Sanket Patil',
  'Satheesh',
  'Satish',
  'Shilpa',
  'Sridhar',
  'Sridhar Mahadevan',
  'Sudesh',
  'Sudhir',
  'Sudesh Bhatia',
  'Sugandh',
  'Sumant',
  'Swati Agarwal',
  'Swati Pal',
  'Unni',
  'Venkat',
  'Venkatesh',
  'Vidhya',
  'Vinayak',
  'Wricha',
  'Yann',
  'Yohan',
]

// --- Venues (as named in the source sheet) ---
export const venues = [
  'Audi',
  'B.Des 1',
  'B.Des 2',
  'B.Des 3',
  'B.Des 4',
  'BDes 1',
  'BDes 3',
  'BDes 4 and Mini Theatre',
  'BDes 4/Mini Theatre',
  'Conf. 4',
  'Conf.3',
  'Jr. AN',
  'Jr. CD',
  'Jr. ID',
  'Jr. IxD',
  'Jr. MVD',
  'Mini Theatre',
  'Shenoy',
  'Sr. AN',
  'Sr. CD',
  'Sr. ID',
  'Sr. ID & MVD',
  'Sr. IxD',
]

const dr = (start, end) => ({ start, end })

// --- Courses. slots: [] means slot not yet allotted; faculty/venue empty = not
// yet allotted (drives the "X of N" progress counters). ---
export const courses = [
  { id: 'DE-119', code: 'DE 119', title: 'Material Exploration', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['Dhruv Parmar'], venue: 'B.Des 1', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-101', code: 'DE 101', title: 'Art Design Fundamental 2D', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['GVS', 'RM'], venue: 'B.Des 1', slots: ['M3'], durationWeeks: 1, dateRanges: [dr('2025-08-11', '2025-08-15')] },
  { id: 'DE-351', code: 'DE 351', title: 'Introduction to elements of design', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['Kumaresan'], venue: 'B.Des 1', slots: ['M6'], durationWeeks: 1, dateRanges: [dr('2025-09-01', '2025-09-05')] },
  { id: 'DE-139', code: 'DE 139', title: 'Typography Fundamentals', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['GVS'], venue: 'B.Des 1', slots: ['M9'], durationWeeks: 1, dateRanges: [dr('2025-09-22', '2025-09-26')] },
  { id: 'DE-6101', code: 'DE 6101', title: 'Elements of Photography', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['Sanket Patil'], venue: 'B.Des 1', slots: ['M11'], durationWeeks: 1, dateRanges: [dr('2025-10-06', '2025-10-10')] },
  { id: 'DE-191', code: 'DE 191', title: 'Visual Design Project', type: 'Core', credits: 6, cohort: 'BDes 1', year: 'B.Des. 1 year', faculty: ['Aman', 'Anisha'], venue: 'B.Des 1', slots: ['M13'], durationWeeks: 1, dateRanges: [dr('2025-10-20', '2025-10-24')] },
  { id: 'DEP-102', code: 'DEP 102', title: 'Summer project presentation', type: 'Core', credits: 6, cohort: 'BDes 2', year: 'B.Des. 2 year', faculty: ['Sudesh', 'Phani'], venue: 'B.Des 2', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-201', code: 'DE 201', title: '2D Visual Studies', type: 'Core', credits: 6, cohort: 'BDes 2', year: 'B.Des. 2 year', faculty: ['Shilpa'], venue: 'B.Des 2', slots: ['M2'], durationWeeks: 1, dateRanges: [dr('2025-08-04', '2025-08-08')] },
  { id: 'DE-221', code: 'DE 221', title: 'Design Studio Project', type: 'Core', credits: 6, cohort: 'BDes 2', year: 'B.Des. 2 year', faculty: ['Sudesh', 'Phani', 'Unni', 'Sridhar'], venue: 'B.Des 2', slots: ['M5', 'M10'], durationWeeks: 2, dateRanges: [dr('2025-08-25', '2025-08-29'), dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-203', code: 'DE 203', title: '3D Form Studies I', type: 'Core', credits: 6, cohort: 'BDes 2', year: 'B.Des. 2 year', faculty: ['Dhruv Parmar'], venue: 'B.Des 2', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-417', code: 'DE 417', title: 'Physical Ergonomics', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Swati Pal'], venue: 'Shenoy', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-419', code: 'DE 419', title: 'Visual Ergonomics', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Wricha'], venue: 'B.Des 3', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-319', code: 'DE 319', title: 'IxD Process and Methods', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Anirudha'], venue: 'B.Des 3', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-320', code: 'DE 320', title: 'Designing Books for Children', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Deepa'], venue: 'Shenoy', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-317', code: 'DE 317', title: 'Documentary Film', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Bharat'], venue: '', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-303', code: 'DE 303', title: 'Info graphics', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Venkatesh'], venue: 'B.Des 3', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-302', code: 'DE 302', title: 'Animation Design', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Shilpa'], venue: 'Conf.3', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-311', code: 'DE 311', title: 'Mobility Design I', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Sridhar'], venue: 'Shenoy', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-329', code: 'DE 329', title: 'Ceramics', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Raja', 'Yann'], venue: '', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-307', code: 'DE 307', title: 'Product Design I', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Yohan'], venue: 'Shenoy', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-331', code: 'DE 331', title: 'Design Tech & Innov.', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Milouni'], venue: 'Conf. 4', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-699', code: 'DE 699', title: 'Entrepreneurship', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Junjha'], venue: 'Shenoy', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-337', code: 'DE 337', title: 'Sound Design', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Satish'], venue: 'B.Des 3', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-327', code: 'DE 327', title: 'Material and Process', type: 'Elective', credits: 4, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Nishant Kamboj'], venue: 'Conf. 4', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DEP-301', code: 'DEP 301', title: 'Collaborative Project', type: 'Core', credits: 6, cohort: 'BDes 3', year: 'B.Des. 3 year', faculty: ['Sudesh Bhatia', 'Vinayak', 'Shilpa'], venue: 'B.Des 3', slots: ['M12'], durationWeeks: 1, dateRanges: [dr('2025-10-13', '2025-10-17')] },
  { id: 'DE-431', code: 'DE 431', title: 'Global Thoughts and Discourse', type: 'Core', credits: 6, cohort: 'BDes 4', year: 'B.Des. 4 year', faculty: ['Sandesh'], venue: 'B.Des 4', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-804', code: 'DE 804', title: 'Qual DRM', type: 'Core', credits: 6, cohort: 'Dual Degree', year: 'Dual Degree (B.Des.+M.Des.)', faculty: ['Girish'], venue: 'BDes 4 and Mini Theatre', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-803', code: 'DE 803', title: 'Quant', type: 'Core', credits: 6, cohort: 'Dual Degree', year: 'Dual Degree (B.Des.+M.Des.)', faculty: ['Anirudha', 'Kartikeya'], venue: '', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-605', code: 'DE 605', title: 'Workshop Skills', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Dhruv Parmar'], venue: 'BDes 1', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-610', code: 'DE 610', title: 'Materials and Processes', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Purba'], venue: 'Jr. ID', slots: ['M3'], durationWeeks: 1, dateRanges: [dr('2025-08-11', '2025-08-15')] },
  { id: 'DE-611', code: 'DE 611', title: 'EoD', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Kumaresan'], venue: 'Jr. ID', slots: ['M6'], durationWeeks: 1, dateRanges: [dr('2025-09-01', '2025-09-05')] },
  { id: 'DE-603', code: 'DE 603', title: 'Pre & Comm', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Milouni'], venue: 'Jr. ID', slots: ['M9'], durationWeeks: 1, dateRanges: [dr('2025-09-22', '2025-09-26')] },
  { id: 'DE-607', code: 'DE 607', title: 'Form 1', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Yohan'], venue: 'Jr. ID', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-609', code: 'DE 609', title: 'PD 1', type: 'Core', credits: 6, cohort: 'MDes 1: ID', year: 'M.Des. 1st year', faculty: ['Dhruv Parmar'], venue: 'Jr. ID', slots: ['M13'], durationWeeks: 1, dateRanges: [dr('2025-10-20', '2025-10-24')] },
  { id: 'DE-613', code: 'DE 613', title: 'Syntactics', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Prasad'], venue: 'Jr. CD', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-617', code: 'DE 617', title: 'Introduction to Advanced Photography', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Sanket'], venue: 'Jr. CD', slots: ['M3'], durationWeeks: 1, dateRanges: [dr('2025-08-11', '2025-08-15')] },
  { id: 'DE-615', code: 'DE 615', title: 'Typo', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Aman'], venue: 'Jr. CD', slots: ['M5'], durationWeeks: 1, dateRanges: [dr('2025-08-25', '2025-08-29')] },
  { id: 'DE-621', code: 'DE 621', title: 'Media Tech', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Deepa'], venue: 'Jr. CD', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-619', code: 'DE 619', title: 'Speaking Images', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Raja'], venue: 'Jr. CD', slots: ['M9'], durationWeeks: 1, dateRanges: [dr('2025-09-22', '2025-09-26')] },
  { id: 'DE-625', code: 'DE 625', title: 'Film Making', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Bharat'], venue: 'Jr. CD', slots: ['M11'], durationWeeks: 1, dateRanges: [dr('2025-10-06', '2025-10-10')] },
  { id: 'DE-623', code: 'DE 623', title: 'Visual Design', type: 'Core', credits: 6, cohort: 'MDes 1: CD', year: 'M.Des. 1st year', faculty: ['Mandar'], venue: 'Jr. CD', slots: ['M13'], durationWeeks: 1, dateRanges: [dr('2025-10-20', '2025-10-24')] },
  { id: 'DE-708', code: 'DE 708', title: 'Introduction to Interface', type: 'Core', credits: 6, cohort: 'MDes 1: IxD', year: 'M.Des. 1st year', faculty: ['Sudhir'], venue: 'Jr. IxD', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-319', code: 'DE 319', title: 'IxD Process and Methods', type: 'Core', credits: 6, cohort: 'MDes 1: IxD', year: 'M.Des. 1st year', faculty: ['Anirudha'], venue: 'Jr. IxD', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-641', code: 'DE 641', title: 'Interaction media senses', type: 'Core', credits: 6, cohort: 'MDes 1: IxD', year: 'M.Des. 1st year', faculty: ['Jayati'], venue: 'Jr. IxD', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-803', code: 'DE 803', title: 'Quant', type: 'Core', credits: 6, cohort: 'MDes 1: IxD', year: 'M.Des. 1st year', faculty: ['Anirudha', 'Kartikeya'], venue: 'Jr. IxD', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-710', code: 'DE 710', title: 'Design Evaluation', type: 'Core', credits: 6, cohort: 'MDes 1: IxD', year: 'M.Des. 1st year', faculty: ['Vidhya', 'Wricha'], venue: 'Jr. IxD', slots: ['M13'], durationWeeks: 1, dateRanges: [dr('2025-10-20', '2025-10-24')] },
  { id: 'DE-613', code: 'DE 613', title: 'Syntactics', type: 'Core', credits: 6, cohort: 'MDes 1: AN', year: 'M.Des. 1st year', faculty: ['Sumant'], venue: 'Jr. AN', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-323', code: 'DE 323', title: 'Stop Motion Animation', type: 'Core', credits: 6, cohort: 'MDes 1: AN', year: 'M.Des. 1st year', faculty: ['Swati Agarwal'], venue: 'Jr. AN', slots: ['M3'], durationWeeks: 1, dateRanges: [dr('2025-08-11', '2025-08-15')] },
  { id: 'DE-649', code: 'DE 649', title: 'Animation design 1', type: 'Core', credits: 6, cohort: 'MDes 1: AN', year: 'M.Des. 1st year', faculty: ['Dhimant', 'Abhishek', 'Satheesh'], venue: 'Jr. AN', slots: ['M6'], durationWeeks: 1, dateRanges: [dr('2025-09-01', '2025-09-05')] },
  { id: 'DE-643', code: 'DE 643', title: 'Digital Anim 1', type: 'Core', credits: 6, cohort: 'MDes 1: AN', year: 'M.Des. 1st year', faculty: ['Sumant', 'Ravi Rao'], venue: 'Jr. AN', slots: ['M9'], durationWeeks: 1, dateRanges: [dr('2025-09-22', '2025-09-26')] },
  { id: 'DE-647', code: 'DE 647', title: 'Animation principles 1', type: 'Core', credits: 6, cohort: 'MDes 1: AN', year: 'M.Des. 1st year', faculty: ['Phani', 'Dhimant'], venue: 'Jr. AN', slots: ['M12'], durationWeeks: 1, dateRanges: [dr('2025-10-13', '2025-10-17')] },
  { id: 'DE-659', code: 'DE 659', title: 'Form, space, order', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Nishant Sharma'], venue: 'Jr. MVD', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-653', code: 'DE 653', title: 'Materials and Manuf.', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Kanika'], venue: 'Jr. MVD', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-675', code: 'DE 675', title: 'Sketching', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Kanika'], venue: 'Jr. MVD', slots: ['M5', 'M9'], durationWeeks: 2, dateRanges: [dr('2025-08-25', '2025-08-29'), dr('2025-09-22', '2025-09-26')] },
  { id: 'DE-601', code: 'DE 601', title: 'Photography', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Sanket Patil'], venue: 'Jr. MVD', slots: ['M6'], durationWeeks: 1, dateRanges: [dr('2025-09-01', '2025-09-05')] },
  { id: 'DE-657', code: 'DE 657', title: 'Vehicle ergo', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Swati Pal'], venue: 'Jr. MVD', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-733', code: 'DE 733', title: 'Mobility System and Technology', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Sugandh', 'Sridhar'], venue: 'Jr. MVD', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-661', code: 'DE 661', title: 'Mobility Design 1', type: 'Core', credits: 6, cohort: 'MDes 1: MVD', year: 'M.Des. 1st year', faculty: ['Sridhar Mahadevan'], venue: 'Jr. MVD', slots: ['M13'], durationWeeks: 1, dateRanges: [dr('2025-10-20', '2025-10-24')] },
  { id: 'DE-804', code: 'DE 804', title: 'Qual DRM', type: 'Core', credits: 6, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Girish'], venue: 'BDes 4/Mini Theatre', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-718', code: 'DE 718', title: 'Design for Future', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Sugandh'], venue: 'Mini Theatre', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-679', code: 'DE 679', title: 'Experimental animation', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Dhimant Vyas'], venue: 'Audi', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-677', code: 'DE 677', title: 'Design for VR', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Jayesh'], venue: 'Conf. 4', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-692', code: 'DE 692', title: 'Advanced Topics in Service Design', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Ravi Mahamuni'], venue: 'Sr. ID', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-698', code: 'DE 698', title: 'Pottery', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Raja'], venue: '', slots: ['M4'], durationWeeks: 1, dateRanges: [dr('2025-08-18', '2025-08-22')] },
  { id: 'DE-721', code: 'DE 721', title: 'Rep Tech for Anim', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Aditi Chitre'], venue: 'Sr. AN', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-705', code: 'DE 705', title: 'Data Vis', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Venkat'], venue: 'BDes 3', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-668', code: 'DE 668', title: 'Instructional Design', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Anisha'], venue: 'Sr. IxD', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-720', code: 'DE 720', title: 'Power of Colour', type: 'Elective', credits: 4, cohort: 'MDes 2: ID', year: 'M.Des. 2nd year', faculty: ['Kanika'], venue: 'Sr. ID & MVD', slots: ['M7'], durationWeeks: 1, dateRanges: [dr('2025-09-08', '2025-09-12')] },
  { id: 'DE-701', code: 'DE 701', title: 'Visual Ergo', type: 'Core', credits: 6, cohort: 'MDes 2: CD', year: 'M.Des. 2nd year', faculty: ['Wricha'], venue: 'Sr. CD', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-709', code: 'DE 709', title: 'Sound Camera', type: 'Core', credits: 6, cohort: 'MDes 2: AN', year: 'M.Des. 2nd year', faculty: ['Sumant'], venue: 'Sr. AN', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-711', code: 'DE 711', title: 'Anim Prod', type: 'Core', credits: 6, cohort: 'MDes 2: AN', year: 'M.Des. 2nd year', faculty: ['Abhishek'], venue: 'Sr. AN', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-804', code: 'DE 804', title: 'Qual DRM', type: 'Core', credits: 6, cohort: 'MDesR 1', year: 'M.Des. (Research)', faculty: ['Girish'], venue: '', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-803', code: 'DE 803', title: 'Quant', type: 'Core', credits: 6, cohort: 'MDesR 1', year: 'M.Des. (Research)', faculty: ['Anirudha', 'Kartikeya'], venue: '', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
  { id: 'DE-804', code: 'DE 804', title: 'Qual DRM', type: 'Core', credits: 6, cohort: 'Ph.D.', year: 'Ph.D.', faculty: ['Girish'], venue: '', slots: ['M1'], durationWeeks: 1, dateRanges: [dr('2025-07-28', '2025-08-01')] },
  { id: 'DE-803', code: 'DE 803', title: 'Quant', type: 'Core', credits: 6, cohort: 'Ph.D.', year: 'Ph.D.', faculty: ['Anirudha', 'Kartikeya'], venue: '', slots: ['M10'], durationWeeks: 1, dateRanges: [dr('2025-09-29', '2025-10-03')] },
]

// Shared courses repeat their code across cohorts (e.g. DE 804 for the research
// cohorts). Give every course a UNIQUE id — keep the first occurrence's id and
// suffix the rest — so per-instance selection, preview, and drag are correct.
// (The grid still merges shared blocks by code, and conflict/constraint checks
// treat same-code instances as one shared session.)
const _idCount = {}
for (const c of courses) {
  const n = (_idCount[c.id] = (_idCount[c.id] || 0) + 1)
  if (n > 1) c.id = `${c.id}-${n}`
}

// --- Duration reconstruction (gap-fill) ---------------------------------------
// In the source sheet a course's week-cells are merged: it runs from the week it
// starts until the next course begins (back-to-back, no gaps). The CSV export
// loses those merges, so each course landed on a single week. We rebuild the real
// span for EVERY course here, so each block vertically fills all its weeks.

// Split a list of week numbers into contiguous runs ("blocks"). A course that
// meets in two separate stretches (e.g. a studio that returns later in the term,
// like DE 221) has two blocks; each is filled independently.
function blocksOf(weeks) {
  const runs = []
  for (const w of [...weeks].sort((a, b) => a - b)) {
    const last = runs[runs.length - 1]
    if (last && w === last[last.length - 1] + 1) last.push(w)
    else runs.push([w])
  }
  return runs
}

// Every block runs from its start week until the week before the NEXT block (of
// any course) begins in the same cohort — filling the gap. Blocks that start on
// the same week (parallel electives) share a span. A block with no course after
// it keeps its own length (we don't invent an end-of-term run). Recurring courses
// keep both blocks; same-cohort weeks never gap.
// Columns that are isolated qualifier/seminar sessions, NOT continuous teaching:
// DE 804 (Qual DRM) and DE 803 (Quant) sit alone at weeks 1 and 10 with a real
// gap between. "Fill to next" would wrongly stretch DE 804 across that gap, so
// these columns keep each course at its own length (and DE 804/803 stay the clean
// one-week joint sessions they are).
const NO_FILL_COHORTS = new Set(['Ph.D.', 'MDesR 1', 'MDesR 2', 'Dual Degree'])
function fillDurations(list) {
  const byCohort = {}
  for (const c of list) {
    if (c.slots.length === 0 || NO_FILL_COHORTS.has(c.cohort)) continue
    ;(byCohort[c.cohort] ||= []).push(c)
  }
  for (const group of Object.values(byCohort)) {
    const blocks = [] // { course, start, end }
    for (const c of group)
      for (const run of blocksOf(c.slots.map((s) => Number(s.slice(1)))))
        blocks.push({ course: c, start: run[0], end: run[run.length - 1] })
    const starts = [...new Set(blocks.map((b) => b.start))].sort((a, b) => a - b)
    const nextStart = (s) => starts.find((x) => x > s)

    const newWeeks = new Map(group.map((c) => [c, []]))
    for (const b of blocks) {
      const ns = nextStart(b.start)
      const end = ns ? ns - 1 : b.end // fill the gap to the next course; else keep own run
      for (let w = b.start; w <= end; w++) newWeeks.get(b.course).push(w)
    }
    for (const c of group) {
      const weeks = [...new Set(newWeeks.get(c))].sort((a, b) => a - b)
      c.slots = weeks.map((w) => `M${w}`)
      c.durationWeeks = weeks.length
      c.dateRanges = blocksOf(weeks).map((run) =>
        dr(slots[run[0] - 1].dateRange.start, slots[run[run.length - 1] - 1].dateRange.end),
      )
    }
  }
}
fillDurations(courses)

// Snapshot each course's reconstructed week allotment as its PAST baseline
// (where it ran last year). The week grid marks exactly these weeks as the
// optimal places to re-allot the course — constraints permitting — instead of
// greening every free week. Stays fixed as the draft is edited.
for (const c of courses) c.prevSlots = [...c.slots]

// --- Change requests raised by faculty against the draft ---
export const changeRequests = [
  {
    id: 'cr-1',
    by: 'Prof. Purba Joshi',
    courseId: 'DE-610',
    courseCode: 'DE 610',
    summary: 'Shift the week so it follows the workshop-skills block.',
    detail: 'Move from week 3 (M3) to week 2 (M2).',
    op: { kind: 'reslot', from: 'M3', to: 'M2' },
    status: 'pending',
  },
  {
    id: 'cr-2',
    by: 'Prof. Phani Tetali',
    courseId: 'DE-221',
    courseCode: 'DE 221',
    summary: 'Run the studio project in two focused blocks.',
    detail: 'Split into 3 and 5 week chunks.',
    op: { kind: 'split', weeks: [3, 5] },
    status: 'pending',
  },
  {
    id: 'cr-3',
    by: 'Prof. Sudesh Balan',
    courseId: 'DE-221',
    courseCode: 'DE 221',
    summary: 'Add a build week to the studio project.',
    detail: 'Add slot M11 for the build week.',
    op: { kind: 'addSlot', slot: 'M11' },
    status: 'pending',
  },
  {
    id: 'cr-4',
    by: 'Prof. Swati Pal',
    courseId: 'DE-417',
    courseCode: 'DE 417',
    summary: 'Need a larger room for ergonomics lab sessions.',
    detail: 'Move venue to Mini Theatre.',
    op: { kind: 'venue', to: 'Mini Theatre' },
    status: 'pending',
  },
  {
    id: 'cr-5',
    by: 'Prof. Sudhir',
    courseId: 'DE-708',
    courseCode: 'DE 708',
    summary: 'Avoid the week-1 registration crunch.',
    detail: 'Move from week 1 (M1) to week 2 (M2).',
    op: { kind: 'reslot', from: 'M1', to: 'M2' },
    status: 'pending',
  },
  {
    id: 'cr-6',
    by: 'Prof. Anirudha Joshi',
    courseId: 'DE-319',
    courseCode: 'DE 319',
    summary: 'Add a co-instructor for the IxD process course.',
    detail: 'Add Wricha as teaching faculty.',
    op: { kind: 'addFaculty', faculty: 'Wricha' },
    status: 'pending',
  },
]

// People the draft is shared with (Share access modal).
export const sharedAccess = [
  { name: 'Faculty', email: 'tt-committee@idc.iitb.ac.in', role: 'Owner' },
  { name: 'Anirudh A.', email: 'anirudh@idc.iitb.ac.in', role: 'Editor' },
  { name: 'Amogh S.', email: 'amogh@idc.iitb.ac.in', role: 'Editor' },
  { name: 'Saumya R.', email: 'saumya@idc.iitb.ac.in', role: 'Editor' },
  { name: 'Tanmay S.', email: 'tanmay@idc.iitb.ac.in', role: 'Viewer' },
  { name: 'Purba Joshi', email: 'purba@idc.iitb.ac.in', role: 'Editor' },
]

export const reviewStats = { reviewed: 5, total: 6 }

// The academic year the carried-over data (faculty who taught, past slots) is
// from — shown as a reference while allotting the new term.
export const PREV_YEAR = '2024-25'

// Slot allotment is informed by (a) the slot system a course ran in previously
// and (b) availability preferences faculty have submitted. These are the
// preferences: a faculty member's blocked weeks/days for the term. Surfaced on
// the slot card for any course they teach so the coordinator avoids clashes.
export const facultyPreferences = {
  Sudhir: { note: 'Unavailable on Mondays', blockedSlots: [] },
  Anirudha: { note: 'Away weeks W1–W2 (conference)', blockedSlots: ['M1', 'M2'] },
  Purba: { note: 'Prefers afternoon slots only', blockedSlots: [] },
  GVS: { note: 'No teaching in W9 (review duty)', blockedSlots: ['M9'] },
  Bharat: { note: 'Available from W5 onward', blockedSlots: ['M1', 'M2', 'M3', 'M4'] },
  Deepa: { note: 'Unavailable W7 (external jury)', blockedSlots: ['M7'] },
  Raja: { note: 'Prefers back-to-back studio weeks', blockedSlots: [] },
  Kumaresan: { note: 'Not available on Fridays', blockedSlots: [] },
}

// The named IITB slot systems a course's weekly blocks can follow. Each defines
// the slots it offers (with the weeks they run — every system skips W8, the
// mid-sem break) and a weekly view of when those slots meet. Surfaced in the
// "View slotting types" side panel and as hover-timing in the slotting-type
// selector.
export const slotSystemDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
const WEEKS_NOTE = 'Week 1 to Week 7 and Week 9 to Week 15'
// Build a list of {id, runs} slots for a system, e.g. seriesSlots('S', 15, true).
const seriesSlots = (prefix, n, withX) => {
  const list = Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i + 1}`, runs: WEEKS_NOTE }))
  if (withX) list.push({ id: `${prefix}X`, runs: WEEKS_NOTE })
  return list
}

export const slotSystems = [
  {
    id: 'S',
    label: 'System S — Seminar',
    desc: 'Single weekly seminar slot, often an elective. Two short sessions a week.',
    timing: 'Seminar · 55 min · twice weekly (morning, afternoon & evening bands)',
    slots: seriesSlots('S', 15, true),
    schedule: [
      { t: '08:30', Mon: 'S01A', Tue: 'S04B', Wed: 'S07A', Thu: 'S03C', Fri: 'S07B' },
      { t: '09:30', Mon: 'S02A', Tue: 'S01B', Wed: 'S05A', Thu: 'S04C', Fri: 'S05B' },
      { t: '10:30', Mon: 'S03A', Tue: 'S02B', Wed: '', Thu: 'S01C', Fri: '' },
      { t: '11:30', Mon: 'S04A', Tue: 'S03B', Wed: 'S06A', Thu: 'S02C', Fri: 'S06B' },
      { t: '14:30', Mon: 'S08A', Tue: 'S10A', Wed: 'SXA', Thu: 'S08B', Fri: 'S10B' },
      { t: '15:30', Mon: 'S09A', Tue: 'S11A', Wed: 'SXB', Thu: 'S09B', Fri: 'S11B' },
      { t: '17:30', Mon: 'S12A', Tue: 'S14A', Wed: 'SXC', Thu: 'S12B', Fri: 'S14B' },
      { t: '19:30', Mon: 'S13A', Tue: 'S15A', Wed: 'SXD', Thu: 'S13B', Fri: 'S15B' },
    ],
  },
  {
    id: 'L',
    label: 'System L — Lab',
    desc: 'Two lab afternoons per week with workshop access.',
    timing: 'Lab · 2 hrs · two afternoons per week',
    slots: seriesSlots('L', 8, false),
    schedule: [
      { t: '14:00', Mon: 'L1', Tue: 'L3', Wed: 'L5', Thu: 'L7', Fri: 'L8' },
      { t: '16:00', Mon: 'L2', Tue: 'L4', Wed: 'L6', Thu: '', Fri: '' },
    ],
  },
  {
    id: 'M',
    label: 'System M — Major studio',
    desc: 'Full-week studio blocks (Mon–Fri), one module per week.',
    timing: 'Studio · full week · Mon–Fri, all day',
    slots: seriesSlots('M', 15, false),
    schedule: [
      { t: '09:30', Mon: 'Studio', Tue: 'Studio', Wed: 'Studio', Thu: 'Studio', Fri: 'Studio' },
      { t: '14:00', Mon: 'Studio', Tue: 'Studio', Wed: 'Studio', Thu: 'Review', Fri: 'Studio' },
    ],
  },
  {
    id: 'H',
    label: 'System H — Half / HASMED',
    desc: 'Two 1.5h lecture slots per week, shared across cohorts.',
    timing: 'Lecture · 1.5 hrs · twice weekly (mornings)',
    slots: seriesSlots('H', 4, false),
    schedule: [
      { t: '08:30', Mon: 'H1', Tue: 'H3', Wed: 'H1', Thu: 'H3', Fri: '' },
      { t: '09:30', Mon: 'H2', Tue: 'H4', Wed: 'H2', Thu: 'H4', Fri: '' },
    ],
  },
]
