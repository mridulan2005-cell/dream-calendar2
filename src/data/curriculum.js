// --- BDes programme curriculum (the "knowledge layer") -----------------------
// The course curriculum defines WHAT each batch studies, semester by semester —
// the source of truth the timetable planner schedules against, and what students
// see for the semesters ahead. It is VERSIONED: a version (e.g. the 2025
// Revision) applies to the batch it takes effect for and every batch after,
// until a change is approved as a new version effective from a future batch.
//
// Transcribed from "BDes Bulletins (2025-2029 Batch)". Entry kinds:
//   core      — a fixed required course (with L / T / ST hours)
//   project   — a studio / design project (credits only)
//   mandatory — a non-credit requirement (NCC/NSS/NSO)
//   basket    — a soft-core / elective basket: pick `pick` of the options
//   elective  — an open institute / humanities / cross-programme elective slot

const core = (code, name, l, t, st, credits) => ({ kind: 'core', code, name, l, t, st, credits })
const project = (code, name, credits) => ({ kind: 'project', code, name, credits })
const mandatory = (code, name) => ({ kind: 'mandatory', code, name, credits: 0 })
const opt = (code, name, credits) => ({ code, name, credits })
const basket = (title, pick, credits, options) => ({ kind: 'basket', title, pick, credits, options })
const elective = (title, credits, note) => ({ kind: 'elective', title, credits, note })

// Each semester: number, total credits (as printed in the bulletin), and entries.
const C1_SEMESTERS = [
  {
    n: 1,
    totalCredits: 36,
    entries: [
      core('DE 101', 'Art and Design Fundamentals 2D', 0, 0, 6, 6),
      core('DE 139', 'Typography Fundamentals', 1, 0, 2, 4),
      core('DE 6101', 'Elements of Photography', 1, 0, 2, 4),
      core('DE 351', 'Introduction to Elements of Design', 1, 0, 4, 6),
      core('DE 115', 'Drawing Tools, Lines, and Forms', 0, 0, 4, 4),
      core('DE 117', 'Introduction to Writing', 0, 0, 4, 4),
      core('DE 119', 'Material Exploration', 0, 0, 4, 4),
      core('DE 191', 'Visual Design Project', 1, 0, 2, 4),
      mandatory('NOC S01', 'NCC / NSS / NSO'),
    ],
  },
  {
    n: 2,
    totalCredits: 36,
    entries: [
      core('DE 138', 'Space and Form', 1, 0, 2, 4),
      core('DE 203', '3D Form Studies I – Aesthetics, Identity and Expressions', 0, 0, 6, 6),
      core('DE 113', 'Introduction to Filmmaking', 1, 0, 4, 6),
      core('DE 126', 'Sculptural Form', 1, 0, 2, 4),
      core('DE 118', 'Product Analysis', 1, 0, 2, 4),
      core('DE 120', 'Product Sketching', 0, 0, 4, 4),
      core('DE 350', 'Introduction to Simple Product Design', 1.5, 0, 3, 6),
      basket('Softcore 1', 1, 2, [
        opt('DE 110', 'Form Exploration in Pottery', 2),
        opt('DE 128', 'Exploration with Digital Tools 1', 2),
        opt('DE 124', 'Print Making', 2),
      ]),
      mandatory('NOC S02', 'NCC / NSS / NSO'),
    ],
  },
  {
    n: 3,
    totalCredits: 34,
    entries: [
      core('DE 112', 'Communication through Illustrations', 0, 0, 4, 4),
      core('DE 325', '2D Animation Fundamentals and Techniques', 1, 0, 4, 6),
      core('DE 229', 'Global and Indian Design History – Current Perspective', 2, 0, 0, 4),
      core('DE 235', 'Moving Image Design Project', 1, 0, 6, 8),
      basket('Environmental Studies', 1, 3, [
        opt('HS 250', 'Environmental Studies', 3),
        opt('ES 250', 'Environmental Studies – Science and Engineering', 3),
      ]),
      basket('Softcore 2', 1, 2, [
        opt('DE 129', 'Introduction to Weaving', 2),
        opt('DE 107', 'A Study of the Power of Words', 2),
        opt('DE 207', 'Understanding Space and Perspective', 2),
        opt('DE 211', 'Introduction to Web Development', 2),
      ]),
      basket('Softcore 3', 1, 2, [
        opt('DE 114', 'Understanding Space and Perspective', 2),
        opt('DE 237', 'Color Materials Finish (CMF)', 2),
        opt('DE 227', 'Plastic and Metal Studio', 2),
      ]),
      basket('Softcore 4', 1, 2, [
        opt('DE 215', 'Reading the World Through Many Lenses', 2),
        opt('DE 224', 'Natural Dyeing Techniques', 2),
        opt('DE 223', 'Wood and Bamboo Studio', 2),
      ]),
    ],
  },
  {
    n: 4,
    totalCredits: 34,
    entries: [
      core('DE 206', 'Communication Theories, Visual Perception and Semiotics', 1.5, 0, 3, 6),
      core('DE 416', 'Sustainability Fundamentals', 2, 0, 0, 4),
      core('DE 134', 'Knowledge Organization and Communication', 1, 0, 2, 4),
      core('DE 218', 'Complex Product Design Project', 1.5, 0, 3, 6),
      basket('Softcore 5', 1, 2, [
        opt('DE 209', 'Sculptural Ceramics', 2),
        opt('DE 214', 'Writing by Design', 2),
        opt('DE xxx', 'Basic Electronics and Prototyping', 2),
      ]),
      basket('Softcore 6', 1, 2, [
        opt('DE 210', 'Understanding Human Anatomy', 2),
        opt('DE 212', 'Ceramic Glazes and Color Development', 2),
        opt('DE 219', 'Exploration with Digital Tools 2', 2),
      ]),
      basket('Softcore 7', 1, 4, [
        opt('DE 208', 'Design, Storytelling and Narratives', 4),
        opt('DE 232', 'Design, Media and Technology', 4),
        opt('DE 220', 'Studies in Typography 2', 4),
        opt('DE 421', 'Basics of Product Interface Design', 4),
      ]),
      elective('Institute / Humanities UG Elective', 6),
    ],
  },
  {
    n: 5,
    totalCredits: 34,
    entries: [
      project('DEP 301', 'Collaborative Design Project', 6),
      basket('Department Electives I & II', 2, 6, [
        opt('DE 304', 'Communication Design', 6),
        opt('DE 306', 'Film-Video Design', 6),
        opt('DE 308', 'Product Design II', 6),
        opt('DE 309', 'Design for Interactive Media', 6),
        opt('DE 312', 'Transportation Design', 6),
        opt('DE 313', '3D Modeling and Prototyping', 6),
        opt('DE 314', 'Game Design', 6),
        opt('DE 319', 'IxD Process and Methods', 6),
        opt('DE 321', 'Service Design', 6),
        opt('DE 329', 'Ceramics through the Ages', 6),
      ]),
      basket('Department Electives III', 1, 4, [
        opt('DE 337', 'Sound Design', 4),
        opt('DE 345', 'Emerging Technologies and PoC Prototyping', 4),
        opt('DE 327', 'Basics of Materials and Processes', 4),
        opt('DE 699', 'Basics of Entrepreneurship', 4),
        opt('DE 331', 'Design, Technology and Innovation', 4),
      ]),
      elective('Institute / Humanities UG Electives II', 6),
      basket('Softcore 8', 1, 6, [
        opt('DE 417', 'Physical Ergonomics', 6),
        opt('DE 419', 'Visual and Cognitive Ergonomics', 6),
      ]),
    ],
  },
  {
    n: 6,
    totalCredits: 34,
    entries: [
      project('DEP 302', 'System Design Project', 6),
      basket('Department Electives IV, V & VI', 3, 6, [
        opt('DE 304', 'Communication Design', 6),
        opt('DE 306', 'Film-Video Design', 6),
        opt('DE 308', 'Product Design II', 6),
        opt('DE 310', 'Interaction Design', 6),
        opt('DE 312', 'Transportation Design', 6),
        opt('DE 313', '3D Modeling and Prototyping', 6),
        opt('DE 314', 'Game Design', 6),
        opt('DE 316', 'Product Ergonomics', 6),
        opt('DE 324', 'Digital Media Technologies', 6),
        opt('DE 326', 'Introduction to Video Content Creation', 6),
        opt('DE 322', 'Materials and Processes / Interaction Techniques', 6),
        opt('DE 318', 'Interaction Techniques', 6),
        opt('DE 320', 'Designing Books for Children', 6),
        opt('DE 321', 'Service Design', 6),
        opt('DE 410', 'Perspectives of World Cinema', 6),
        opt('DE 333', 'Furniture Design', 6),
        opt('DE 330', 'Design for the Craft Sector', 6),
        opt('DE 339', 'Introduction to Photography', 6),
        opt('DE 336', 'Playing with Clay', 6),
      ]),
      elective('Department Elective VII', 4, 'Any M.Des. Semester 2, 4-credit elective'),
      elective('Institute / Humanities UG Electives III', 6),
    ],
  },
  {
    n: 7,
    totalCredits: 28,
    entries: [
      core('DE 431', 'Global Design Thoughts and Discourse', 2, 0, 0, 4),
      project('DEP 405', 'System Design Project', 24),
    ],
  },
  {
    n: 8,
    totalCredits: 36,
    entries: [
      project('DEP 410', 'BDes Design Project-2', 24),
      project('DEP 408', 'Design Research Project', 12),
    ],
  },
]

// ── M.Des. (2-year postgraduate) curriculum ──────────────────────────────────
const MDES_SEMESTERS = [
  {
    n: 1,
    totalCredits: 30,
    entries: [
      core('DS 601', 'Design Process and Methods', 2, 0, 2, 6),
      core('DS 611', 'Visual Design and Communication', 1, 0, 3, 6),
      core('DS 621', 'Design Research Methodology', 2, 0, 0, 4),
      project('DSP 601', 'Foundation Design Studio', 8),
      basket('Discipline Studio I', 1, 6, [
        opt('DS 631', 'Product Design Studio', 6),
        opt('DS 633', 'Interaction Design Studio', 6),
        opt('DS 635', 'Visual Communication Studio', 6),
        opt('DS 637', 'Animation Design Studio', 6),
      ]),
    ],
  },
  {
    n: 2,
    totalCredits: 30,
    entries: [
      core('DS 602', 'Human Factors and Ergonomics', 2, 0, 2, 6),
      core('DS 612', 'Materials, Form and Technology', 1, 0, 3, 6),
      project('DSP 602', 'Discipline Studio Project', 8),
      basket('Discipline Studio II', 1, 6, [
        opt('DS 642', 'Service Design', 6),
        opt('DS 644', 'Information Design', 6),
        opt('DS 646', 'Design for Sustainability', 6),
        opt('DS 648', 'UX and Interface Design', 6),
      ]),
      elective('Institute Elective', 4),
    ],
  },
  {
    n: 3,
    totalCredits: 24,
    entries: [
      project('DSP 701', 'Design Project', 12),
      basket('Discipline Elective III', 1, 6, [
        opt('DS 651', 'Advanced Prototyping', 6),
        opt('DS 653', 'Design Management and Strategy', 6),
        opt('DS 655', 'Speculative and Critical Design', 6),
      ]),
      elective('Institute / Open Elective', 6),
    ],
  },
  {
    n: 4,
    totalCredits: 24,
    entries: [project('DSP 702', 'Graduation Project (Thesis)', 24)],
  },
]

// ── Ph.D. (research) programme: coursework, then staged research milestones ───
const PHD_SEMESTERS = [
  {
    n: 1,
    totalCredits: 12,
    entries: [
      core('DS 801', 'Research Methodology in Design', 3, 0, 0, 6),
      basket('Doctoral Coursework I', 1, 6, [
        opt('DS 811', 'Advanced Design Theory', 6),
        opt('DS 813', 'Cognition and Design', 6),
        opt('DS 815', 'Design and Emerging Technology', 6),
      ]),
      mandatory('DSS 801', 'Research Seminar I'),
    ],
  },
  {
    n: 2,
    totalCredits: 12,
    entries: [
      core('DS 802', 'Comprehensive Examination', 0, 0, 0, 6),
      basket('Doctoral Coursework II', 1, 6, [
        opt('DS 821', 'Qualitative Research Methods', 6),
        opt('DS 823', 'Quantitative Methods and Statistics', 6),
        opt('DS 825', 'Human–Computer Interaction Research', 6),
      ]),
      mandatory('DSS 802', 'Research Seminar II'),
    ],
  },
  {
    n: 3,
    totalCredits: 0,
    entries: [project('DSR 901', 'Research Stage I — Proposal Defense (APS)', 0)],
  },
  {
    n: 4,
    totalCredits: 0,
    entries: [project('DSR 902', 'Research Stage II — Mid-term Review', 0)],
  },
  {
    n: 5,
    totalCredits: 0,
    entries: [project('DSR 903', 'Research Stage III — Pre-synopsis Seminar', 0)],
  },
  {
    n: 6,
    totalCredits: 0,
    entries: [project('DSR 904', 'Research Stage IV — Thesis Submission and Defense', 0)],
  },
]

// Which semesters fall under each year of study, per programme.
const BDES_YEARS = [
  { year: 1, label: 'Year 1', sems: [1, 2] },
  { year: 2, label: 'Year 2', sems: [3, 4] },
  { year: 3, label: 'Year 3', sems: [5, 6] },
  { year: 4, label: 'Year 4', sems: [7, 8] },
]
const MDES_YEARS = [
  { year: 1, label: 'Year 1', sems: [1, 2] },
  { year: 2, label: 'Year 2', sems: [3, 4] },
]
const PHD_YEARS = [
  { year: 1, label: 'Year 1 · Coursework', sems: [1, 2] },
  { year: 2, label: 'Year 2 · Research', sems: [3, 4] },
  { year: 3, label: 'Year 3 · Research', sems: [5, 6] },
]

// Ordered list of programmes for the top-level programme filter.
export const PROGRAMME_IDS = ['BDes', 'MDes', 'PhD']

// The seeded knowledge layer — one entry per programme. Each programme carries
// its own meta, year grouping, curriculum versions and enrolled batches, so the
// page can swap the entire view (filter chips + content) when the programme
// changes. `currentSem` is where a batch is this (autumn) term, so the UI marks
// completed vs. current vs. upcoming semesters; a `currentSem` past `maxSem`
// means the batch has graduated.
export const SEED_CURRICULUM = {
  BDes: {
    program: { id: 'BDes', label: 'B.Des.', durationLabel: '4-year programme', totalCredits: 272 },
    years: BDES_YEARS,
    maxSem: 8,
    activeVersionId: 'C1',
    versions: {
      C1: {
        id: 'C1',
        label: '2025 Revision',
        effectiveFromYear: 2025,
        approved: true,
        note: 'Approved curriculum, effective for the 2025 batch onward.',
        semesters: C1_SEMESTERS,
      },
    },
    batches: [
      { id: '2022', label: '2022–2026', admitYear: 2022, standing: 5, currentSem: 9, versionId: 'C1' },
      { id: '2023', label: '2023–2027', admitYear: 2023, standing: 4, currentSem: 7, versionId: 'C1' },
      { id: '2024', label: '2024–2028', admitYear: 2024, standing: 3, currentSem: 5, versionId: 'C1' },
      { id: '2025', label: '2025–2029', admitYear: 2025, standing: 2, currentSem: 3, versionId: 'C1' },
    ],
  },
  MDes: {
    program: { id: 'MDes', label: 'M.Des.', durationLabel: '2-year programme', totalCredits: 108 },
    years: MDES_YEARS,
    maxSem: 4,
    activeVersionId: 'M1',
    versions: {
      M1: {
        id: 'M1',
        label: '2024 Curriculum',
        effectiveFromYear: 2024,
        approved: true,
        note: 'Approved curriculum, effective for the 2024 batch onward.',
        semesters: MDES_SEMESTERS,
      },
    },
    batches: [
      { id: '2023', label: '2023–2025', admitYear: 2023, standing: 4, currentSem: 7, versionId: 'M1' },
      { id: '2024', label: '2024–2026', admitYear: 2024, standing: 3, currentSem: 5, versionId: 'M1' },
      { id: '2025', label: '2025–2027', admitYear: 2025, standing: 2, currentSem: 3, versionId: 'M1' },
    ],
  },
  PhD: {
    program: { id: 'PhD', label: 'Ph.D.', durationLabel: 'Research programme', totalCredits: 24 },
    years: PHD_YEARS,
    maxSem: 6,
    activeVersionId: 'P1',
    versions: {
      P1: {
        id: 'P1',
        label: '2022 Framework',
        effectiveFromYear: 2022,
        approved: true,
        note: 'Approved doctoral framework, effective for the 2022 batch onward.',
        semesters: PHD_SEMESTERS,
      },
    },
    batches: [
      { id: '2021', label: '2021–', admitYear: 2021, standing: 6, currentSem: 11, versionId: 'P1' },
      { id: '2022', label: '2022–', admitYear: 2022, standing: 5, currentSem: 9, versionId: 'P1' },
      { id: '2023', label: '2023–', admitYear: 2023, standing: 4, currentSem: 7, versionId: 'P1' },
      { id: '2024', label: '2024–', admitYear: 2024, standing: 3, currentSem: 5, versionId: 'P1' },
      { id: '2025', label: '2025–', admitYear: 2025, standing: 2, currentSem: 3, versionId: 'P1' },
    ],
  },
}

// Total credits a basket / elective / entry contributes (pick-aware).
export function entryCredits(e) {
  if (e.kind === 'basket') return (e.credits || 0) * (e.pick || 1)
  return e.credits || 0
}

// A semester's status for a given batch: done | current | upcoming.
export function semStatus(batch, semN) {
  if (semN < batch.currentSem) return 'done'
  if (semN === batch.currentSem) return 'current'
  return 'upcoming'
}
