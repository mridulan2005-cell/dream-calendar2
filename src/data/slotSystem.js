// --- IITB institute slot system (version 2026) -------------------------------
// Transcribed from the institute slot definition. Three systems share the same
// weekly canvas:
//   S — single teaching periods (lecture/tutorial)
//   L — composed lecture blocks (a few S periods fused)
//   M — studio / module blocks (what IDC runs in)
// The weekly timetable fills the M cells with the studio running that week and
// shows the free S/L slots in every cell the studio doesn't occupy.

export const SLOT_S = [
  // Mon
  { id: 'XE', day: 'Mon', start: '08:00', end: '09:25', note: 'overflow' },
  { id: '1A', day: 'Mon', start: '09:30', end: '10:25' },
  { id: '2A', day: 'Mon', start: '10:35', end: '11:25' },
  { id: '3A', day: 'Mon', start: '11:35', end: '12:25' },
  { id: '8A', day: 'Mon', start: '14:00', end: '15:25' },
  { id: '9A', day: 'Mon', start: '15:30', end: '16:55' },
  { id: '12A', day: 'Mon', start: '17:05', end: '18:00' },
  // Tue
  { id: '4A', day: 'Tue', start: '08:00', end: '09:25' },
  { id: '1B', day: 'Tue', start: '09:30', end: '10:25' },
  { id: '2B', day: 'Tue', start: '10:35', end: '11:25' },
  { id: '3B', day: 'Tue', start: '11:35', end: '12:25' },
  { id: '10A', day: 'Tue', start: '14:00', end: '15:25' },
  { id: '11A', day: 'Tue', start: '15:30', end: '16:55' },
  { id: '12B', day: 'Tue', start: '17:05', end: '18:00' },
  // Wed
  { id: '5A', day: 'Wed', start: '08:00', end: '09:25' },
  { id: '6A', day: 'Wed', start: '09:30', end: '10:55', note: 'extended' },
  { id: '7A', day: 'Wed', start: '11:05', end: '12:30', note: 'extended' },
  { id: 'X1', day: 'Wed', start: '14:00', end: '14:55', note: 'overflow' },
  { id: 'X2', day: 'Wed', start: '15:00', end: '15:55', note: 'overflow' },
  { id: 'X3', day: 'Wed', start: '16:00', end: '16:55', note: 'overflow' },
  { id: 'XC', day: 'Wed', start: '17:05', end: '18:00', note: 'overflow' },
  // Thu
  { id: '4B', day: 'Thu', start: '08:00', end: '09:25' },
  { id: '1C', day: 'Thu', start: '09:30', end: '10:25' },
  { id: '2C', day: 'Thu', start: '10:35', end: '11:25' },
  { id: '3C', day: 'Thu', start: '11:35', end: '12:25' },
  { id: '8B', day: 'Thu', start: '14:00', end: '15:25' },
  { id: '9B', day: 'Thu', start: '15:30', end: '16:55' },
  { id: '12C', day: 'Thu', start: '17:05', end: '18:00' },
  // Fri
  { id: '5B', day: 'Fri', start: '08:00', end: '09:25' },
  { id: '6B', day: 'Fri', start: '09:30', end: '10:55', note: 'extended' },
  { id: '7B', day: 'Fri', start: '11:05', end: '12:30', note: 'extended' },
  { id: '10B', day: 'Fri', start: '14:00', end: '15:25' },
  { id: '11B', day: 'Fri', start: '15:30', end: '16:55' },
  { id: 'XD', day: 'Fri', start: '17:05', end: '18:00', note: 'overflow' },
]

export const SLOT_L = [
  { id: 'L1', day: 'Mon', start: '14:00', end: '16:55', composedOf: ['8A', '9A'] },
  { id: 'L2', day: 'Tue', start: '14:00', end: '16:55', composedOf: ['10A', '11A'] },
  { id: 'L3', day: 'Thu', start: '14:00', end: '16:55', composedOf: ['8B', '9B'] },
  { id: 'L4', day: 'Fri', start: '14:00', end: '16:55', composedOf: ['10B', '11B'] },
  { id: 'L5', day: 'Wed', start: '09:30', end: '12:30', composedOf: ['6A', '7A'] },
  { id: 'L6', day: 'Fri', start: '09:30', end: '12:30', composedOf: ['6B', '7B'] },
  { id: 'LX', day: 'Wed', start: '14:00', end: '16:55', composedOf: ['X1', 'X2', 'X3'] },
]

export const SLOT_M = [
  { id: 'MA', day: 'Mon', start: '09:30', end: '12:30' },
  { id: 'MA', day: 'Tue', start: '09:30', end: '12:30' },
  { id: 'MA', day: 'Thu', start: '09:30', end: '12:30' },
  { id: 'MB', day: 'Mon', start: '14:00', end: '17:00' },
  { id: 'MB', day: 'Tue', start: '14:00', end: '17:00' },
  { id: 'MB', day: 'Thu', start: '14:00', end: '17:00' },
  { id: 'MB', day: 'Fri', start: '14:00', end: '17:00' },
]

// The default (seed) slot system — the institute definition transcribed above.
// At runtime the live system lives in the store (editable on the Slot System
// page, persisted to localStorage), so every reader works off a passed-in
// system object rather than these arrays directly.
export const DEFAULT_SLOT_SYSTEM = { S: SLOT_S, L: SLOT_L, M: SLOT_M }

// A fresh deep clone of the seed — used to seed the store and to "reset to
// default" without mutating the originals.
export const cloneSlotSystem = (sys = DEFAULT_SLOT_SYSTEM) => ({
  S: sys.S.map((s) => ({ ...s, composedOf: s.composedOf ? [...s.composedOf] : undefined })),
  L: sys.L.map((s) => ({ ...s, composedOf: s.composedOf ? [...s.composedOf] : undefined })),
  M: sys.M.map((s) => ({ ...s, composedOf: s.composedOf ? [...s.composedOf] : undefined })),
})

// The slot vocabulary a department (B.Tech) actually allots in, derived straight
// from the institute slot system so it stays in lockstep with it — edit the slot
// system and this updates everywhere it's read (the allotment dropdown, the
// weekly grid, the course panel).
//
//   lectures — the S periods that share a slot NUMBER are one lecture slot: 1A
//              (Mon), 1B (Tue), 1C (Thu) are the three meetings of lecture slot
//              "1". A 6-credit course sits at one such slot and meets at each of
//              its periods. X-overflow periods (no number) stand alone.
//   labs     — the L slots (one 3-hour afternoon block each): L1, L2, … LX.
//   modules  — the M studio blocks (MA, MB), IDC's own system, listed for
//              completeness.
export function departmentSlots(system = DEFAULT_SLOT_SYSTEM) {
  const S = system?.S || SLOT_S
  const L = system?.L || SLOT_L
  const M = system?.M || SLOT_M

  // Each institute S-period is its OWN lecture slot — 1A (Mon), 1B (Tue) and 1C
  // (Thu) are three separate slots, not one grouped "1A · 1B · 1C" entry. Ordered
  // by slot number then period letter so the dropdown reads 1A, 1B, 1C, 2A, …
  const lectures = [...S]
    .sort((a, b) => {
      const na = Number(a.id.match(/^(\d+)/)?.[1] ?? Infinity)
      const nb = Number(b.id.match(/^(\d+)/)?.[1] ?? Infinity)
      return na - nb || a.id.localeCompare(b.id)
    })
    .map((s) => ({
      id: s.id,
      kind: 'lecture',
      system: 'S',
      code: s.id,
      days: [s.day],
      start: s.start,
      end: s.end,
      blocks: [{ day: s.day, start: s.start, end: s.end, code: s.id }],
    }))
  // Legacy grouped lecture slots (id "S1" = the periods 1A·1B·1C) are no longer
  // offered for allotment, but stay resolvable so any course previously allotted
  // to a whole group still renders on the grid and master timetable.
  const legacyGroups = (() => {
    const groups = new Map()
    for (const s of S) {
      const key = s.id.match(/^(\d+)/)?.[1] || s.id
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(s)
    }
    return [...groups.values()].map((members) => ({
      id: `S${members[0].id.match(/^(\d+)/)?.[1] || members[0].id}`,
      kind: 'lecture',
      system: 'S',
      code: members.map((m) => m.id).join(' · '),
      days: [...new Set(members.map((m) => m.day))],
      start: members[0].start,
      end: members[0].end,
      blocks: members.map((m) => ({ day: m.day, start: m.start, end: m.end, code: m.id })),
    }))
  })()
  const labs = L.map((l) => ({
    id: l.id,
    kind: 'lab',
    system: 'L',
    code: l.id,
    days: [l.day],
    start: l.start,
    end: l.end,
    blocks: [{ day: l.day, start: l.start, end: l.end, code: l.id }],
  }))
  const seenM = new Set()
  const modules = []
  for (const m of M) {
    if (seenM.has(m.id)) continue
    seenM.add(m.id)
    const mine = M.filter((x) => x.id === m.id)
    modules.push({
      id: m.id,
      kind: 'module',
      system: 'M',
      code: m.id,
      days: mine.map((x) => x.day),
      start: m.start,
      end: m.end,
      blocks: mine.map((x) => ({ day: x.day, start: x.start, end: x.end, code: x.id })),
    })
  }
  return { lectures, labs, modules, all: [...lectures, ...labs, ...modules] }
}

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

// Canonical teaching-period columns for the weekly grid. LUNCH is a narrow
// divider between the morning and afternoon halves.
export const PERIODS = [
  { id: 'p1', start: '08:00', end: '09:25' },
  { id: 'p2', start: '09:30', end: '10:25' },
  { id: 'p3', start: '10:35', end: '11:25' },
  { id: 'p4', start: '11:35', end: '12:25' },
  { id: 'lunch', start: '12:30', end: '13:55', kind: 'lunch' },
  { id: 'p5', start: '14:00', end: '15:25' },
  { id: 'p6', start: '15:30', end: '16:55' },
  { id: 'p7', start: '17:05', end: '18:00' },
]

const toMin = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const overlaps = (s1, e1, s2, e2) => toMin(s1) < toMin(e2) && toMin(e1) > toMin(s2)
// A slot belongs to the column its START falls inside (avoids showing a long
// slot in several columns at once).
const startsIn = (slot, col) =>
  toMin(slot.start) >= toMin(col.start) && toMin(slot.start) < toMin(col.end)

// The M studio slot covering (day, period), or null. M is what IDC runs in, so
// these are the cells the running studio fills. Reads from the live system.
export function mSlotAt(system, day, period) {
  const M = system?.M || SLOT_M
  const hit = M.find((s) => s.day === day && overlaps(s.start, s.end, period.start, period.end))
  return hit ? hit.id : null
}

// Free institute slots available at (day, period) — the S/L slots a studio batch
// isn't using. Returned split so the UI can tone them differently. Reads from
// the live system so edits on the Slot System page flow through here.
export function freeSlotsAt(system, day, period) {
  if (period.kind === 'lunch') return { s: [], l: [] }
  const S = system?.S || SLOT_S
  const L = system?.L || SLOT_L
  const s = S.filter((x) => x.day === day && startsIn(x, period)).map((x) => x.id)
  const l = L.filter((x) => x.day === day && startsIn(x, period)).map((x) => x.id)
  return { s, l }
}

// 24h "HH:MM" → compact 12h label without suffix ("14:00" → "2:00").
export function periodLabel(t) {
  const [h, m] = t.split(':').map(Number)
  const hr = ((h + 11) % 12) + 1
  return `${hr}:${String(m).padStart(2, '0')}`
}
