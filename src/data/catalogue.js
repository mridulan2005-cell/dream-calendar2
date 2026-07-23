// --- The course catalogue a student browses while planning their term ---------
// Everything here is what a student may ADD around their programme core: the
// baskets they choose from rather than the studio they're already enrolled in.
// Each entry is pinned to the institute slot(s) it meets at (see slotSystem.js),
// which is what lets the weekly view answer "what could I take in THIS slot?".

// Course registration happens before teaching begins — once the term is running
// a student's week is fixed and the slot picker has nothing to offer. The real
// app would derive this from the academic calendar; the wireframe carries the
// flag explicitly so the flow can be demonstrated.
export const REGISTRATION = { open: true, closes: '24 Jul' }

// The four things a student can add. `elective` is the only one with baskets
// beneath it — the others are a single list, so no second filter appears.
export const COURSE_TAGS = [
  { id: 'elective', label: 'Elective' },
  { id: 'minor', label: 'Minor' },
  { id: 'honor', label: 'Honor' },
  { id: 'additional', label: 'Additional Learning' },
]

// Elective baskets — the institute's categories for what an elective counts as.
export const ELECTIVE_BASKETS = [
  { id: 'dept', label: 'Dept elective' },
  { id: 'hasmed', label: 'HASMED' },
  { id: 'stem', label: 'STEM' },
  { id: 'flexible', label: 'Flexible' },
]

// The credit values the catalogue actually offers, low → high. The range picker
// is built from these rather than a free 0–n scale: a student picks among real
// values, never an empty range.
export const CREDIT_STEPS = [2, 4, 6, 8]

// Everything below meets in the institute slots that sit OUTSIDE studio hours —
// the early-morning and evening singles. That isn't decoration: a design
// student's 9:30–12:30 and 2:00–5:00 belong to the studio and its weekly
// electives all term, so an add-on course can only live at the edges of the day.
// The seed's own MDes sketching electives already work this way (Tue & Thu 4A/4B).
export const catalogue = [
  // ── Electives · department ──────────────────────────────────────────
  { id: 'DE-425', code: 'DE 425', title: 'Design of Everyday Things', tag: 'elective', basket: 'dept', credits: 4, faculty: ['Wricha Mishra'], slots: ['4A', '4B'], schedule: 'Tue & Thu 8:00–9:25' },
  { id: 'DE-329', code: 'DE 329', title: 'Ceramics Studio', tag: 'elective', basket: 'dept', credits: 4, faculty: ['Raja Mohanty'], slots: ['5A', '5B'], schedule: 'Wed & Fri 8:00–9:25' },
  { id: 'DE-410', code: 'DE 410', title: 'Interaction Design Studio', tag: 'elective', basket: 'dept', credits: 6, faculty: ['Anirudha Joshi'], slots: ['12A', '12B', '12C'], schedule: 'Mon, Tue & Thu 5:05–6:00' },
  { id: 'DE-337', code: 'DE 337', title: 'Sound Design', tag: 'elective', basket: 'dept', credits: 2, faculty: ['Satish Pai'], slots: ['XD'], schedule: 'Fri 5:05–6:00' },

  // ── Electives · HASMED ──────────────────────────────────────────────
  { id: 'HS-218', code: 'HS 218', title: 'Introduction to Psychology', tag: 'elective', basket: 'hasmed', credits: 4, faculty: ['Azizuddin Khan'], slots: ['4A', '4B'], schedule: 'Tue & Thu 8:00–9:25' },
  { id: 'HS-407', code: 'HS 407', title: 'Urban Sociology', tag: 'elective', basket: 'hasmed', credits: 4, faculty: ['Meera Iyer'], slots: ['5A', '5B'], schedule: 'Wed & Fri 8:00–9:25' },
  { id: 'HS-301', code: 'HS 301', title: 'Philosophy of Mind', tag: 'elective', basket: 'hasmed', credits: 6, faculty: ['Ranjan Panda'], slots: ['12A', '12B', '12C'], schedule: 'Mon, Tue & Thu 5:05–6:00' },

  // ── Electives · STEM ────────────────────────────────────────────────
  { id: 'ME-209', code: 'ME 209', title: 'Materials Science', tag: 'elective', basket: 'stem', credits: 4, faculty: ['N. Kamboj'], slots: ['4A', '4B'], schedule: 'Tue & Thu 8:00–9:25' },
  { id: 'EE-210', code: 'EE 210', title: 'Signals & Systems', tag: 'elective', basket: 'stem', credits: 4, faculty: ['V. Rao'], slots: ['5A', '5B'], schedule: 'Wed & Fri 8:00–9:25' },
  { id: 'CS-335', code: 'CS 335', title: 'Human–Computer Interaction', tag: 'elective', basket: 'stem', credits: 6, faculty: ['Kavi Arya'], slots: ['12A', '12B', '12C'], schedule: 'Mon, Tue & Thu 5:05–6:00' },

  // ── Electives · flexible ────────────────────────────────────────────
  { id: 'IE-501', code: 'IE 501', title: 'Design Thinking for Innovation', tag: 'elective', basket: 'flexible', credits: 2, faculty: ['Junjha Patel'], slots: ['XE'], schedule: 'Mon 8:00–9:25' },
  { id: 'DE-699', code: 'DE 699', title: 'Entrepreneurship', tag: 'elective', basket: 'flexible', credits: 4, faculty: ['Junjha Patel'], slots: ['5A', '5B'], schedule: 'Wed & Fri 8:00–9:25' },
  { id: 'SC-601', code: 'SC 601', title: 'Science Communication', tag: 'elective', basket: 'flexible', credits: 2, faculty: ['Deepa Kamath'], slots: ['XC'], schedule: 'Wed 5:05–6:00' },

  // ── Minor ───────────────────────────────────────────────────────────
  { id: 'HS-200M', code: 'HS 200', title: 'Minor · Psychology Core', tag: 'minor', credits: 6, faculty: ['Azizuddin Khan'], slots: ['4A', '4B'], schedule: 'Tue & Thu 8:00–9:25' },
  { id: 'MA-214M', code: 'MA 214', title: 'Minor · Applied Statistics', tag: 'minor', credits: 6, faculty: ['S. Bhattacharya'], slots: ['5A', '5B'], schedule: 'Wed & Fri 8:00–9:25' },
  { id: 'CS-101M', code: 'CS 101', title: 'Minor · Programming Fundamentals', tag: 'minor', credits: 6, faculty: ['Kavi Arya'], slots: ['12A', '12B', '12C'], schedule: 'Mon, Tue & Thu 5:05–6:00' },

  // ── Honor ───────────────────────────────────────────────────────────
  { id: 'DE-492H', code: 'DE 492', title: 'Honor · Design Systems Seminar', tag: 'honor', credits: 6, faculty: ['Girish Dalvi'], slots: ['4A', '4B'], schedule: 'Tue & Thu 8:00–9:25' },
  { id: 'DE-490H', code: 'DE 490', title: 'Honor · Advanced Design Research', tag: 'honor', credits: 8, faculty: ['Ravi Poovaiah'], slots: ['12A', '12B', '12C'], schedule: 'Mon, Tue & Thu 5:05–6:00' },

  // ── Additional learning ─────────────────────────────────────────────
  { id: 'DE-702A', code: 'DE 702', title: 'NPTEL · Design Thinking', tag: 'additional', credits: 2, faculty: ['Self-paced'], slots: ['XE'], schedule: 'Mon 8:00–9:25' },
  { id: 'DE-700A', code: 'DE 700', title: 'NPTEL · Sustainable Design', tag: 'additional', credits: 2, faculty: ['Self-paced'], slots: ['XC'], schedule: 'Wed 5:05–6:00' },
  { id: 'DE-701A', code: 'DE 701', title: 'Workshop · Rapid Prototyping', tag: 'additional', credits: 2, faculty: ['Sanket Patil'], slots: ['XD'], schedule: 'Fri 5:05–6:00' },
]

// Everything on offer at `slotIds` — the institute slots that are free in the
// cell the student clicked. This is the whole reason the panel hangs off a slot
// rather than a search box: the list is already narrowed to what can physically
// go there, so the filters below it stay small.
export const catalogueAt = (slotIds) => {
  const free = new Set(slotIds)
  return catalogue.filter((c) => c.slots.some((s) => free.has(s)))
}
