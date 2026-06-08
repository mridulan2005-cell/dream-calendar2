// The constraint engine — a referee, not a solver. It validates a *candidate*
// placement (moving one of a course's slots to a new slot) against the rules and
// returns categorised results fast enough to run on hover/drag. Pure functions;
// never mutates the draft.

import { slots, slotLabel } from '../data/seed.js'
import {
  rooms,
  cohortSizes,
  requiredFacilities,
  adjacentSlots,
  isProtected,
  inSameElectiveGroup,
  isJointSession,
} from '../data/rules.js'

/**
 * @typedef {'green'|'amber'|'red'|'grey'} Category
 * @typedef {{ type:string, text:string }} Issue
 * @typedef {Object} Evaluation
 * @property {string} toSlot
 * @property {Category} category
 * @property {Issue[]} hard      hard clashes (block green/amber)
 * @property {Issue[]} soft      soft warnings
 * @property {{cohorts:{name:string,size:number}[], faculty:string[]}} affected
 * @property {string[]} backToBack faculty who'd teach back-to-back
 * @property {string} reason     one-line summary (used for the rank-1 annotation)
 * @property {string[]} candidateSlots the course's slot set if applied
 */

// Replace `fromSlot` with `toSlot` in the course's slot set (or add it).
function candidateSlotSet(course, fromSlot, toSlot) {
  const set = course.slots.includes(fromSlot)
    ? course.slots.map((s) => (s === fromSlot ? toSlot : s))
    : [...course.slots, toSlot]
  return Array.from(new Set(set))
}

/**
 * Evaluate placing `course`'s `fromSlot` occurrence at `toSlot`.
 * @returns {Evaluation}
 */
export function evaluatePlacement(course, fromSlot, toSlot, courses, { ignoreFromSlot = true } = {}) {
  const hard = []
  const soft = []
  const affectedCohorts = new Map()
  const affectedFaculty = new Set()
  const backToBack = new Set()

  const candidateSlots = candidateSlotSet(course, fromSlot, toSlot)

  // Structurally impossible.
  if (isProtected(toSlot)) {
    return done('grey', `${slotLabel(toSlot)} is institute-protected`)
  }

  const others = courses.filter((c) => c.id !== course.id)
  const occupants = others.filter((c) => c.slots.includes(toSlot))

  for (const o of occupants) {
    // The same course taught to another cohort is one shared session, not a clash.
    if (o.code === course.code) continue
    // Cohort core clash (electives in the same group overlap on purpose).
    if (
      o.cohort === course.cohort &&
      course.type === 'Core' &&
      o.type === 'Core' &&
      !inSameElectiveGroup(course.id, o.id)
    ) {
      hard.push({ type: 'cohort', text: `Cohort core clash with ${o.code} (${o.cohort})` })
      addCohort(course.cohort)
    } else if (o.cohort === course.cohort && !inSameElectiveGroup(course.id, o.id)) {
      soft.push({ type: 'cohort', text: `Overlaps ${o.code} for ${o.cohort}` })
      addCohort(course.cohort)
    }

    // Faculty double-booking (joint sessions are allowed).
    const shared = course.faculty.filter((f) => o.faculty.includes(f))
    for (const f of shared) {
      if (isJointSession(course.id, o.id)) {
        soft.push({ type: 'joint', text: `${f}: joint session with ${o.code}` })
      } else {
        hard.push({ type: 'faculty', text: `${f} double-booked with ${o.code}` })
      }
      affectedFaculty.add(f)
    }

    // Room conflict.
    if (course.venue && o.venue === course.venue) {
      hard.push({ type: 'room', text: `${course.venue} occupied by ${o.code}` })
    }
  }

  // Soft: faculty back-to-back (teaching in an adjacent slot).
  const adj = adjacentSlots(toSlot)
  for (const o of others) {
    if (o.code === course.code) continue
    if (!o.slots.some((s) => adj.includes(s))) continue
    const shared = course.faculty.filter((f) => o.faculty.includes(f))
    for (const f of shared) {
      backToBack.add(f)
      affectedFaculty.add(f)
    }
  }
  for (const f of backToBack) {
    soft.push({ type: 'b2b', text: `${f} would teach back-to-back` })
  }

  // Soft/hard: room capacity + facilities.
  if (course.venue && rooms[course.venue]) {
    const room = rooms[course.venue]
    const size = cohortSizes[course.cohort] || 0
    if (size > room.capacity) {
      soft.push({
        type: 'capacity',
        text: `${course.venue} tight: ${size} students > ${room.capacity} seats`,
      })
    }
    const missing = requiredFacilities(course).filter((f) => !room.facilities.includes(f))
    for (const m of missing) {
      hard.push({ type: 'facility', text: `${course.venue} lacks ${m}` })
    }
  }

  course.faculty.forEach((f) => affectedFaculty.add(f))
  addCohort(course.cohort)

  const category = hard.length ? 'red' : soft.length ? 'amber' : 'green'
  return done(category, buildReason(category, course, toSlot, soft, backToBack))

  function addCohort(name) {
    if (!affectedCohorts.has(name)) affectedCohorts.set(name, cohortSizes[name] || 0)
  }
  function done(category, reason) {
    return {
      toSlot,
      category,
      hard,
      soft,
      affected: {
        cohorts: [...affectedCohorts].map(([name, size]) => ({ name, size })),
        faculty: [...affectedFaculty],
      },
      backToBack: [...backToBack],
      reason,
      candidateSlots,
    }
  }
}

function buildReason(category, course, toSlot, soft, backToBack) {
  if (category === 'green') {
    const bits = ['no clash']
    if (course.venue) bits.push('room free')
    if (backToBack.size === 0 && course.faculty.length) bits.push('keeps faculty gap')
    return bits.join(', ')
  }
  if (category === 'amber') return soft[0]?.text || 'soft issue'
  return 'hard clash'
}

/**
 * Evaluate every slot as a destination for `course`'s `fromSlot`, rank the green
 * ones, and annotate the top 3.
 * @returns {{ map: Record<string, Evaluation & {rank?:number}>, top: string[], rank1Slot: string|null }}
 */
export function rankDestinations(course, fromSlot, courses) {
  const map = {}
  for (const s of slots) {
    map[s.id] = evaluatePlacement(course, fromSlot, s.id, courses)
  }

  // Greens, best first: least crowded slot, then nearest to the original.
  const fromIdx = slots.findIndex((s) => s.id === fromSlot)
  const greens = slots
    .map((s) => s.id)
    .filter((id) => map[id].category === 'green' && id !== fromSlot)
    .sort((a, b) => {
      const crowdA = courses.filter((c) => c.slots.includes(a)).length
      const crowdB = courses.filter((c) => c.slots.includes(b)).length
      if (crowdA !== crowdB) return crowdA - crowdB
      const da = Math.abs(slots.findIndex((s) => s.id === a) - fromIdx)
      const db = Math.abs(slots.findIndex((s) => s.id === b) - fromIdx)
      return da - db
    })

  greens.slice(0, 3).forEach((id, i) => {
    map[id].rank = i + 1
  })

  return { map, top: greens.slice(0, 3), rank1Slot: greens[0] || null }
}

/**
 * Evaluate a whole edited course draft (any slot set / venue / faculty) against
 * the rest of the draft. Used by the unified edit panel for live impact.
 * @returns {{ category:Category, hard:Issue[], soft:Issue[], affected:{cohorts:{name:string,size:number}[],faculty:string[]}, backToBack:string[] }}
 */
export function evaluateCourse(draft, courses) {
  const others = courses.filter((c) => c.id !== draft.id)
  const hard = new Map()
  const soft = new Map()
  const cohorts = new Map()
  const faculty = new Set()
  const backToBack = new Set()
  const addHard = (text, type) => hard.set(text, { type, text })
  const addSoft = (text, type) => soft.set(text, { type, text })
  const addCohort = (n) => {
    if (!cohorts.has(n)) cohorts.set(n, cohortSizes[n] || 0)
  }

  addCohort(draft.cohort)
  draft.faculty.forEach((f) => faculty.add(f))

  for (const slot of draft.slots) {
    if (isProtected(slot)) addHard(`${slotLabel(slot)} is institute-protected`, 'protected')

    const occ = others.filter((o) => o.slots.includes(slot))
    for (const o of occ) {
      if (o.code === draft.code) continue // same shared course, not a clash
      if (
        o.cohort === draft.cohort &&
        draft.type === 'Core' &&
        o.type === 'Core' &&
        !inSameElectiveGroup(draft.id, o.id)
      ) {
        addHard(`Cohort core clash with ${o.code} at ${slotLabel(slot)}`, 'cohort')
      } else if (o.cohort === draft.cohort && !inSameElectiveGroup(draft.id, o.id)) {
        addSoft(`Overlaps ${o.code} (${o.cohort}) at ${slotLabel(slot)}`, 'cohort')
      }

      const shared = draft.faculty.filter((f) => o.faculty.includes(f))
      for (const f of shared) {
        if (isJointSession(draft.id, o.id)) addSoft(`${f}: joint session with ${o.code}`, 'joint')
        else addHard(`${f} double-booked with ${o.code} at ${slotLabel(slot)}`, 'faculty')
        faculty.add(f)
      }

      if (draft.venue && o.venue === draft.venue) {
        addHard(`${draft.venue} occupied by ${o.code} at ${slotLabel(slot)}`, 'room')
      }
    }

    const adj = adjacentSlots(slot)
    for (const o of others) {
      if (o.code === draft.code) continue
      if (!o.slots.some((s) => adj.includes(s))) continue
      draft.faculty
        .filter((f) => o.faculty.includes(f))
        .forEach((f) => {
          backToBack.add(f)
          faculty.add(f)
        })
    }
  }

  if (draft.venue && rooms[draft.venue]) {
    const room = rooms[draft.venue]
    const size = cohortSizes[draft.cohort] || 0
    if (size > room.capacity) {
      addSoft(`${draft.venue} tight: ${size} students > ${room.capacity} seats`, 'capacity')
    }
    requiredFacilities(draft)
      .filter((f) => !room.facilities.includes(f))
      .forEach((m) => addHard(`${draft.venue} lacks ${m}`, 'facility'))
  }
  for (const f of backToBack) addSoft(`${f} would teach back-to-back`, 'b2b')

  const hardArr = [...hard.values()]
  const softArr = [...soft.values()]
  const category =
    draft.slots.length === 0 ? 'grey' : hardArr.length ? 'red' : softArr.length ? 'amber' : 'green'

  return {
    category,
    hard: hardArr,
    soft: softArr,
    affected: {
      cohorts: [...cohorts].map(([name, size]) => ({ name, size })),
      faculty: [...faculty],
    },
    backToBack: [...backToBack],
  }
}

/**
 * Recommend the single best fix for a course that currently has a clash (or a
 * soft constraint). Brute-forces every "move one of its weeks to a free week",
 * scores the result (a hard clash counts far more than a soft one), and returns
 * the lowest-scoring strictly-better option — preferring the nearest week on a
 * tie. Reports what the fix resolves and any knock-on effects it introduces.
 * @returns {null | { from:string, to:string, candidate:object, resolved:string[], sideEffects:string[], remainingHard:string[] }}
 */
export function recommendFix(course, courses) {
  if (!course.slots.length) return null
  const now = evaluateCourse(course, courses)
  const nowScore = now.hard.length * 100 + now.soft.length
  if (nowScore === 0) return null

  const idx = (id) => slots.findIndex((s) => s.id === id)
  let best = null
  for (const from of course.slots) {
    for (const s of slots) {
      if (s.id === from || course.slots.includes(s.id)) continue
      const candidate = { ...course, slots: course.slots.map((x) => (x === from ? s.id : x)) }
      const e = evaluateCourse(candidate, courses)
      const score = e.hard.length * 100 + e.soft.length
      if (score >= nowScore) continue
      const dist = Math.abs(idx(s.id) - idx(from))
      if (!best || score < best.score || (score === best.score && dist < best.dist)) {
        best = { score, dist, from, to: s.id, candidate, e }
      }
    }
  }
  if (!best) return null

  const candHard = new Set(best.e.hard.map((h) => h.text))
  const candSoft = new Set(best.e.soft.map((h) => h.text))
  return {
    from: best.from,
    to: best.to,
    candidate: best.candidate,
    // problems that existed before and are gone after the move
    resolved: [
      ...now.hard.filter((h) => !candHard.has(h.text)).map((h) => h.text),
      ...now.soft.filter((h) => !candSoft.has(h.text)).map((h) => h.text),
    ],
    // brand-new soft issues the move introduces (the knock-on effects)
    sideEffects: best.e.soft.filter((h) => !now.soft.some((n) => n.text === h.text)).map((h) => h.text),
    remainingHard: best.e.hard.map((h) => h.text),
  }
}
